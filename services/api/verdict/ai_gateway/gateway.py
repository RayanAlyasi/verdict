"""The only code that calls AI providers (docs/ARCHITECTURE.md, ADR 0005)."""

import asyncio
import json
import uuid
from collections.abc import Sequence
from decimal import ROUND_CEILING, Decimal
from typing import Literal

import pydantic_ai
from anthropic import AsyncAnthropic
from opentelemetry.trace import TracerProvider
from pydantic import TypeAdapter
from pydantic_ai import Agent, capture_run_messages
from pydantic_ai.capabilities.instrumentation import Instrumentation
from pydantic_ai.exceptions import (
    ContentFilterError,
    ModelHTTPError,
    UnexpectedModelBehavior,
    UsageLimitExceeded,
)
from pydantic_ai.messages import ModelMessage, ModelResponse
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.instrumented import InstrumentationSettings
from pydantic_ai.models.test import TestModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.usage import UsageLimits
from sqlalchemy import Engine

from verdict.ai_gateway.budget import Limits, Usage, release, reserve, settle
from verdict.ai_gateway.credentials import resolve_credential
from verdict.ai_gateway.registry import ModelInfo, Prices, Registry, Role, load_registry
from verdict.settings import Settings

# Pydantic AI's first-run banner advertises a hosted service; it has no place in our output.
pydantic_ai.BANNER_ENABLED = False

MILLION = Decimal(1_000_000)
MICRODOLLAR = Decimal("0.000001")
# Message framing and the output tool's wrapper, beyond the text we measure.
OVERHEAD_TOKENS = 1_000
# Longer answers make the Anthropic SDK stream, and an error part-way through a stream can carry
# a 4xx status after the request was billed.
MAX_OUTPUT_TOKENS = 16_000
# The answer and one repair. The estimate assumes no more.
REQUEST_LIMIT = 2

FAKE_MODEL = "test:fake"
# Priced like a real model, so budget limits apply to fake calls too.
FAKE_INFO = ModelInfo(
    context_tokens=1_000_000,
    max_output_tokens=128_000,
    vision=True,
    structured_output=True,
    prompt_caching="none",
    batch=False,
    prices=[
        Prices(
            input=Decimal(1),
            cache_write=Decimal(1),
            cache_read=Decimal(1),
            output=Decimal(1),
        )
    ],
)


class OutputInvalidError(Exception):
    """The model gave no usable output: invalid after one repair attempt, or a refusal."""

    def __init__(self, role: Role, reason: Literal["invalid", "refused"]) -> None:
        # A fixed message: the provider's errors quote the model's answer, built from students' work.
        super().__init__(f"The {role} call gave no usable output ({reason})")
        self.reason = reason


class Gateway:
    def __init__(
        self,
        engine: Engine,
        settings: Settings,
        *,
        registry: Registry | None = None,
        tracer_provider: TracerProvider | None = None,
        fake_model: Model | None = None,
    ) -> None:
        """`fake_model` replaces the fake provider's canned model, so tests can make it misbehave."""
        self._engine = engine
        self._settings = settings
        self._registry = registry or load_registry()
        self._limits = Limits(
            tokens_per_user=settings.ai_daily_token_limit_per_user,
            spend_usd=settings.ai_daily_spend_limit_usd,
        )
        self._fake_model = fake_model or TestModel()
        self._models: dict[tuple[str, str], Model] = {}
        # Traces carry token counts and timings, never prompts or answers (they hold students' work).
        self._instrumentation = Instrumentation(
            settings=InstrumentationSettings(
                tracer_provider=tracer_provider,
                include_content=False,
                include_binary_content=False,
            )
        )

    async def complete[T](
        self,
        *,
        role: Role,
        output_type: type[T],
        instructions: str,
        prompt: str,
        user_id: uuid.UUID,
        course_id: uuid.UUID | None,
        feature: str,
        max_output_tokens: int = 4096,
    ) -> T:
        """Run one call for a task role, budgeted, schema-checked and traced.

        Raises BudgetExceededError before any spending if the call would pass a daily limit, and
        OutputInvalidError if the model gives no usable output after one repair attempt.
        """
        name, info = self._model_for(role)
        most = min(MAX_OUTPUT_TOKENS, info.max_output_tokens)
        if max_output_tokens > most:
            raise ValueError(f"A {role} call writes at most {most} tokens")
        agent = Agent(
            self._model(name, user_id),
            output_type=output_type,
            instructions=instructions,
            name=role.value,
            retries={"output": 1},
            capabilities=[self._instrumentation],
        )
        estimate = _estimate(
            info,
            _input_tokens_upper_bound(instructions, prompt, output_type),
            max_output_tokens,
        )
        reserving = asyncio.create_task(
            asyncio.to_thread(
                reserve,
                self._engine,
                user_id=user_id,
                course_id=course_id,
                feature=feature,
                role=role.value,
                model=name,
                tokens=estimate.tokens,
                cost_usd=estimate.cost_usd,
                limits=self._limits,
            )
        )
        try:
            reservation = await asyncio.shield(reserving)
        except asyncio.CancelledError:
            # The reservation still commits in its thread; free it once it has, or it would
            # count against the student until midnight.
            reserving.add_done_callback(self._release_if_reserved)
            raise
        # The failure paths call the budget directly rather than in a thread, so that a cancelled
        # task still records what it may have spent.
        with capture_run_messages() as messages:
            try:
                result = await agent.run(
                    prompt,
                    model_settings={"max_tokens": max_output_tokens},
                    # Without this, a reply that skips the output tool gets retries of its own.
                    usage_limits=UsageLimits(request_limit=REQUEST_LIMIT),
                    metadata={
                        "role": role.value,
                        "feature": feature,
                        "ledger_id": str(reservation),
                    },
                )
            except ModelHTTPError as error:
                if 400 <= error.status_code < 500:
                    # Refused before doing any work: only earlier requests in this run were billed.
                    if _responses(messages):
                        settle(self._engine, reservation, _usage(info, messages))
                    else:
                        release(self._engine, reservation)
                else:
                    settle(self._engine, reservation, estimate)
                raise
            except (UnexpectedModelBehavior, UsageLimitExceeded) as error:
                # Fewer responses than requests means one failed in flight, such as a reply that
                # couldn't be parsed; it may have been billed, so the estimate stands.
                answered = len(_responses(messages)) == REQUEST_LIMIT
                billed = _usage(info, messages)
                exact = isinstance(error, UsageLimitExceeded) or answered
                settle(self._engine, reservation, billed if exact else estimate)
                reason: Literal["invalid", "refused"] = (
                    "refused" if isinstance(error, ContentFilterError) else "invalid"
                )
                raise OutputInvalidError(role, reason) from None
            except BaseException:
                # A timeout, a broken stream or a cancellation may still have been billed.
                settle(self._engine, reservation, estimate)
                raise
        await asyncio.to_thread(
            settle, self._engine, reservation, _usage(info, messages)
        )
        return result.output

    def _release_if_reserved(self, reserving: asyncio.Task[uuid.UUID]) -> None:
        if not reserving.cancelled() and reserving.exception() is None:
            release(self._engine, reserving.result())

    def _model_for(self, role: Role) -> tuple[str, ModelInfo]:
        if self._settings.ai_provider == "fake":
            return FAKE_MODEL, FAKE_INFO
        name = self._registry.roles.get(role)
        if name is None:
            raise LookupError(f"No model serves the {role} role yet")
        return name, self._registry.models[name]

    def _model(self, name: str, user_id: uuid.UUID) -> Model:
        if self._settings.ai_provider == "fake":
            return self._fake_model
        provider, _, model_name = name.partition(":")
        if provider != "anthropic":
            raise LookupError(f"No adapter for {provider} models")
        key = resolve_credential(self._settings, provider, user_id).get_secret_value()
        # Cached per key, not per model, so one student's key can never serve another.
        if (name, key) not in self._models:
            # No hidden retries: each attempt may be billed, so a retry must reserve again.
            client = AsyncAnthropic(api_key=key, max_retries=0)
            self._models[name, key] = AnthropicModel(
                model_name, provider=AnthropicProvider(anthropic_client=client)
            )
        return self._models[name, key]


def _input_tokens_upper_bound(instructions: str, prompt: str, output_type: type) -> int:
    # Every token is at least one byte of UTF-8, so the byte count bounds the token count.
    schema = json.dumps(TypeAdapter(output_type).json_schema())
    return (
        sum(len(text.encode()) for text in (instructions, prompt, schema))
        + OVERHEAD_TOKENS
    )


def _estimate(info: ModelInfo, input_tokens: int, max_output_tokens: int) -> Usage:
    """The most a call can cost, so settling never pushes the ledger past a limit.

    One repair attempt means up to two requests. The second also carries the first answer and the
    errors found in it, which can repeat the answer.
    """
    second_input = input_tokens + 2 * max_output_tokens + OVERHEAD_TOKENS
    prices = info.prices_for(second_input)
    input_total = input_tokens + second_input
    output_total = 2 * max_output_tokens
    cost = (
        input_total * max(prices.input, prices.cache_write)
        + output_total * prices.output
    ) / MILLION
    return Usage(
        tokens=input_total + output_total,
        cost_usd=cost.quantize(MICRODOLLAR, rounding=ROUND_CEILING),
    )


def _responses(messages: Sequence[ModelMessage]) -> list[ModelResponse]:
    return [message for message in messages if isinstance(message, ModelResponse)]


def _usage(info: ModelInfo, messages: Sequence[ModelMessage]) -> Usage:
    """What the provider billed, request by request, since each prompt's size sets its prices."""
    inputs = outputs = cache_reads = cache_writes = 0
    cost = Decimal(0)
    for response in _responses(messages):
        usage = response.usage
        prices = info.prices_for(usage.input_tokens)
        # Pydantic AI's input_tokens includes the cached tokens.
        uncached = (
            usage.input_tokens - usage.cache_read_tokens - usage.cache_write_tokens
        )
        cost += (
            uncached * prices.input
            + usage.cache_write_tokens * prices.cache_write
            + usage.cache_read_tokens * prices.cache_read
            + usage.output_tokens * prices.output
        ) / MILLION
        inputs += usage.input_tokens
        outputs += usage.output_tokens
        cache_reads += usage.cache_read_tokens
        cache_writes += usage.cache_write_tokens
    return Usage(
        tokens=inputs + outputs,
        cost_usd=cost.quantize(MICRODOLLAR),
        input_tokens=inputs,
        output_tokens=outputs,
        cache_read_tokens=cache_reads,
        cache_write_tokens=cache_writes,
    )
