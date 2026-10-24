import asyncio
import threading
import uuid
from collections.abc import Callable
from decimal import Decimal
from typing import Any

import anyio
import pytest
from anthropic import AsyncAnthropic
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pydantic import BaseModel, SecretStr
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.messages import ModelMessage, ModelResponse, TextPart, ToolCallPart
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.function import AgentInfo, FunctionModel
from pydantic_ai.usage import RequestUsage
from sqlalchemy import Engine, func, select, text
from sqlalchemy.orm import Session

from verdict.ai_gateway import budget
from verdict.ai_gateway import gateway as gateway_module
from verdict.ai_gateway.api import (
    BudgetExceededError,
    Gateway,
    OutputInvalidError,
    Role,
)
from verdict.ai_gateway.budget import BUDGET_LOCK, Usage
from verdict.ai_gateway.credentials import MissingCredentialError, resolve_credential
from verdict.ai_gateway.gateway import (
    FAKE_INFO,
    _estimate,
    _input_tokens_upper_bound,
    _usage,
)
from verdict.ai_gateway.models import UsageLedger
from verdict.ai_gateway.registry import load_registry
from verdict.settings import Settings

pytestmark = pytest.mark.anyio

INSTRUCTIONS = "Write one exam question."
PROMPT = "Notes on photosynthesis"
VALID = {"text": "What is chlorophyll for?", "answer": 1}
INVALID = {"text": "What is chlorophyll for?", "answer": "many"}

Reply = dict[str, Any] | str
ModelFunction = Callable[[list[ModelMessage], AgentInfo], ModelResponse]


class Question(BaseModel):
    text: str
    answer: int


def settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "app_env": "test",
        "deployment_mode": "hosted",
        "database_url": "postgresql+psycopg://unused",
        "ai_provider": "fake",
        "ai_daily_spend_limit_usd": Decimal(1),
    }
    return Settings(**(values | overrides))


def replying(*replies: Reply, calls: list[int] | None = None) -> FunctionModel:
    """A fake model giving each reply in turn (tool arguments, or prose that skips the tool).

    Each reply reports 1,000 input and 100 output tokens. `calls` counts the requests.
    """
    remaining = list(replies)

    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        if calls is not None:
            calls.append(1)
        reply = remaining.pop(0) if len(remaining) > 1 else remaining[0]
        part = (
            TextPart(reply)
            if isinstance(reply, str)
            else ToolCallPart(info.output_tools[0].name, reply)
        )
        return ModelResponse(
            parts=[part], usage=RequestUsage(input_tokens=1000, output_tokens=100)
        )

    return FunctionModel(respond)


def failing(
    error: BaseException, after: Reply | None = None
) -> Callable[[list[ModelMessage], AgentInfo], ModelResponse]:
    """A fake model that raises `error`, on its second request if `after` is its first reply."""
    first = replying(after) if after is not None else None
    requests = 0

    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        nonlocal requests
        requests += 1
        if first is not None and requests == 1:
            assert first.function is not None
            return first.function(messages, info)  # type: ignore[return-value]
        raise error

    return respond


async def ask(gateway: Gateway) -> Question:
    return await gateway.complete(
        role=Role.GENERATE,
        output_type=Question,
        instructions=INSTRUCTIONS,
        prompt=PROMPT,
        user_id=uuid.uuid4(),
        course_id=None,
        feature="test",
    )


def estimate() -> Usage:
    return _estimate(
        FAKE_INFO, _input_tokens_upper_bound(INSTRUCTIONS, PROMPT, Question), 4096
    )


def ledger(engine: Engine) -> list[UsageLedger]:
    with Session(engine) as session:
        return list(session.scalars(select(UsageLedger)))


async def test_a_fake_call_returns_valid_output_and_records_its_usage(
    api_engine: Engine,
) -> None:
    question = await ask(Gateway(api_engine, settings()))

    assert isinstance(question, Question)
    [row] = ledger(api_engine)
    assert (row.role, row.feature, row.model) == ("generate", "test", "test:fake")
    assert row.settled_at is not None
    assert row.input_tokens is not None
    assert row.output_tokens is not None
    assert row.tokens == row.input_tokens + row.output_tokens > 0
    assert row.cost_usd > 0


@pytest.mark.parametrize(
    ("overrides", "limit"),
    [
        ({"ai_daily_token_limit_per_user": 100}, "tokens_per_user"),
        ({"ai_daily_spend_limit_usd": Decimal("0.0001")}, "spend_usd"),
    ],
    ids=["token limit", "spend cap"],
)
async def test_a_call_that_would_pass_a_daily_limit_never_reaches_the_model(
    api_engine: Engine, overrides: dict[str, Any], limit: str
) -> None:
    calls: list[int] = []
    gateway = Gateway(
        api_engine, settings(**overrides), fake_model=replying(VALID, calls=calls)
    )

    with pytest.raises(BudgetExceededError) as refused:
        await ask(gateway)

    assert refused.value.limit == limit
    assert calls == []
    assert ledger(api_engine) == []


async def test_invalid_output_gets_one_repair(api_engine: Engine) -> None:
    gateway = Gateway(api_engine, settings(), fake_model=replying(INVALID, VALID))

    question = await ask(gateway)

    assert question.answer == 1
    [row] = ledger(api_engine)
    assert (row.tokens, row.cost_usd) == (2200, Decimal("0.002200"))


async def test_output_still_invalid_after_the_repair_is_charged_and_never_quoted(
    api_engine: Engine,
) -> None:
    calls: list[int] = []
    gateway = Gateway(api_engine, settings(), fake_model=replying(INVALID, calls=calls))

    with pytest.raises(OutputInvalidError) as failed:
        await ask(gateway)

    assert len(calls) == 2
    assert failed.value.reason == "invalid"
    assert "chlorophyll" not in str(failed.value)
    assert failed.value.__cause__ is None
    assert failed.value.__suppress_context__
    [row] = ledger(api_engine)
    assert (row.tokens, row.cost_usd, row.output_tokens) == (
        2200,
        Decimal("0.002200"),
        200,
    )


async def test_a_reply_that_skips_the_output_tool_still_gets_only_one_repair(
    api_engine: Engine,
) -> None:
    # Pydantic AI counts prose replies against a separate retry budget; without a request
    # limit, prose then invalid then valid would make three requests, past the estimate.
    calls: list[int] = []
    gateway = Gateway(
        api_engine,
        settings(),
        fake_model=replying("Here is a question:", INVALID, VALID, calls=calls),
    )

    with pytest.raises(OutputInvalidError):
        await ask(gateway)

    assert len(calls) == 2
    [row] = ledger(api_engine)
    assert row.tokens <= estimate().tokens
    assert row.cost_usd <= estimate().cost_usd


async def test_a_request_the_provider_rejected_costs_nothing(
    api_engine: Engine,
) -> None:
    rejected = ModelHTTPError(status_code=400, model_name="fake", body="bad request")
    gateway = Gateway(
        api_engine, settings(), fake_model=FunctionModel(failing(rejected))
    )

    with pytest.raises(ModelHTTPError):
        await ask(gateway)

    assert ledger(api_engine) == []


async def test_a_rejected_repair_still_charges_the_answer_before_it(
    api_engine: Engine,
) -> None:
    rate_limited = ModelHTTPError(status_code=429, model_name="fake", body="slow down")
    model = FunctionModel(failing(rate_limited, after=INVALID))

    with pytest.raises(ModelHTTPError):
        await ask(Gateway(api_engine, settings(), fake_model=model))

    [row] = ledger(api_engine)
    assert (row.tokens, row.input_tokens, row.output_tokens) == (1100, 1000, 100)


@pytest.mark.parametrize(
    "error",
    [TimeoutError("read timed out"), ModelHTTPError(529, "fake", "overloaded")],
    ids=["timeout", "server error"],
)
async def test_a_call_that_may_have_been_billed_settles_at_its_estimate(
    api_engine: Engine, error: BaseException
) -> None:
    gateway = Gateway(api_engine, settings(), fake_model=FunctionModel(failing(error)))

    with pytest.raises(type(error)):
        await ask(gateway)

    [row] = ledger(api_engine)
    assert row.settled_at is not None
    assert (row.tokens, row.cost_usd) == (estimate().tokens, estimate().cost_usd)
    assert row.input_tokens is None


async def test_a_call_cancelled_mid_request_settles_at_its_estimate(
    api_engine: Engine,
) -> None:
    started = asyncio.Event()

    async def hang(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        started.set()
        await asyncio.Event().wait()
        raise AssertionError("unreachable")

    task = asyncio.create_task(
        ask(Gateway(api_engine, settings(), fake_model=FunctionModel(hang)))
    )
    await started.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    [row] = ledger(api_engine)
    assert row.settled_at is not None
    assert row.tokens == estimate().tokens


async def test_a_call_cancelled_while_reserving_leaves_nothing_reserved(
    api_engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    released = threading.Event()

    def release(engine: Engine, reservation: uuid.UUID) -> None:
        budget.release(engine, reservation)
        released.set()

    monkeypatch.setattr(gateway_module, "release", release)
    with api_engine.connect() as blocker:
        day = blocker.execute(
            text("SELECT (now() AT TIME ZONE 'UTC')::date")
        ).scalar_one()
        blocker.execute(
            select(func.pg_advisory_xact_lock(BUDGET_LOCK, day.toordinal()))
        )
        task = asyncio.create_task(ask(Gateway(api_engine, settings())))
        waiting = text(
            "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted"
        )
        while blocker.execute(waiting).scalar_one() == 0:
            await asyncio.sleep(0.01)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        blocker.rollback()
    # The reservation commits in its thread once the lock is free; the gateway then releases it.
    with anyio.fail_after(5):
        while not released.is_set():
            await asyncio.sleep(0.01)

    assert ledger(api_engine) == []


async def test_every_call_is_traced_to_its_ledger_row_without_prompts_or_answers(
    api_engine: Engine,
) -> None:
    exporter = InMemorySpanExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    gateway = Gateway(
        api_engine,
        settings(),
        tracer_provider=tracer_provider,
        fake_model=replying(VALID),
    )

    await ask(gateway)

    [row] = ledger(api_engine)
    spans = exporter.get_finished_spans()
    run = next(span for span in spans if span.name == "invoke_agent generate")
    assert run.attributes is not None
    metadata = str(run.attributes["metadata"])
    assert '"feature":"test"' in metadata
    assert f'"ledger_id":"{row.id}"' in metadata
    recorded = repr(
        [
            (dict(s.attributes or {}), [dict(e.attributes or {}) for e in s.events])
            for s in spans
        ]
    )
    for content in ("photosynthesis", "exam question", "chlorophyll"):
        assert content not in recorded


async def test_a_role_with_no_model_is_refused(api_engine: Engine) -> None:
    gateway = Gateway(
        api_engine, settings(ai_provider="auto", anthropic_api_key="sk-x")
    )
    with pytest.raises(LookupError, match="embed"):
        await gateway.complete(
            role=Role.EMBED,
            output_type=Question,
            instructions="",
            prompt="",
            user_id=uuid.uuid4(),
            course_id=None,
            feature="test",
        )


async def test_answers_longer_than_the_streaming_threshold_are_refused(
    api_engine: Engine,
) -> None:
    with pytest.raises(ValueError, match="at most 16000 tokens"):
        await Gateway(api_engine, settings()).complete(
            role=Role.GENERATE,
            output_type=Question,
            instructions="",
            prompt="",
            user_id=uuid.uuid4(),
            course_id=None,
            feature="test",
            max_output_tokens=16_001,
        )
    assert ledger(api_engine) == []


def test_registry_models_use_the_platform_key_without_hidden_retries(
    api_engine: Engine,
) -> None:
    gateway = Gateway(
        api_engine, settings(ai_provider="auto", anthropic_api_key="sk-x")
    )

    model = gateway._model("anthropic:claude-haiku-5-5", uuid.uuid4())

    assert isinstance(model, AnthropicModel)
    assert model.model_name == "claude-haiku-5-5"
    assert isinstance(model.client, AsyncAnthropic)
    assert model.client.api_key == "sk-x"
    assert model.client.max_retries == 0


def test_a_model_built_for_one_key_never_serves_another(
    api_engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        gateway_module, "resolve_credential", lambda s, p, user: SecretStr(f"sk-{user}")
    )
    gateway = Gateway(
        api_engine, settings(ai_provider="auto", anthropic_api_key="sk-x")
    )
    first, second = uuid.uuid4(), uuid.uuid4()
    name = "anthropic:claude-haiku-5-5"

    assert gateway._model(name, first) is gateway._model(name, first)
    assert gateway._model(name, first) is not gateway._model(name, second)


def test_the_estimate_covers_two_requests_at_their_largest(api_engine: Engine) -> None:
    haiku = load_registry().models["anthropic:claude-haiku-5-5"]
    estimate = _estimate(haiku, input_tokens=95_000, max_output_tokens=4096)
    # Both requests at their largest, every input token written to the cache, and the repair's
    # prompt over Haiku's 100,000-token price step.
    second_input = 95_000 + 2 * 4096 + 1000
    worst = _usage(
        haiku,
        [
            ModelResponse(
                parts=[],
                usage=RequestUsage(
                    input_tokens=n, cache_write_tokens=n, output_tokens=4096
                ),
            )
            for n in (95_000, second_input)
        ],
    )
    assert worst.tokens <= estimate.tokens
    assert worst.cost_usd <= estimate.cost_usd


def test_cost_counts_cached_tokens_at_their_own_prices() -> None:
    sonnet = load_registry().models["anthropic:claude-sonnet-5-5"]
    usage = RequestUsage(
        input_tokens=1_000_000, cache_read_tokens=500_000, cache_write_tokens=100_000
    )
    usage.output_tokens = 10_000
    billed = _usage(sonnet, [ModelResponse(parts=[], usage=usage)])
    # 400,000 uncached at $2, 100,000 written at $2.50, 500,000 read at $0.10, 10,000 out at $10.
    assert billed.cost_usd == Decimal("1.20")
    assert billed.tokens == 1_010_000


def test_credentials_come_from_the_environment_until_byok_arrives() -> None:
    student = uuid.uuid4()
    hosted = settings(ai_provider="auto", anthropic_api_key="sk-platform")
    assert resolve_credential(hosted, "anthropic", student) == SecretStr("sk-platform")
    with pytest.raises(MissingCredentialError, match="ANTHROPIC_API_KEY"):
        resolve_credential(
            settings(deployment_mode="self_hosted"), "anthropic", student
        )
    with pytest.raises(NotImplementedError):
        resolve_credential(settings(deployment_mode="byok"), "anthropic", student)
