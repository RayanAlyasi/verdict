import uuid
from collections.abc import Callable
from decimal import Decimal
from typing import Any

import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pydantic import BaseModel, SecretStr
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.messages import ModelMessage, ModelResponse, ToolCallPart
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.function import AgentInfo, FunctionModel
from pydantic_ai.usage import RequestUsage
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from verdict.ai_gateway.api import (
    BudgetExceededError,
    Gateway,
    OutputInvalidError,
    Role,
)
from verdict.ai_gateway.credentials import MissingCredentialError, resolve_credential
from verdict.ai_gateway.gateway import _estimate, _usage
from verdict.ai_gateway.models import UsageLedger
from verdict.ai_gateway.registry import load_registry
from verdict.settings import Settings

pytestmark = pytest.mark.anyio

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


def answering(
    *outputs: dict[str, Any], tokens: tuple[int, int] = (1000, 100)
) -> ModelFunction:
    """A fake model that gives each output in turn, reporting `tokens` (input, output) each time."""
    remaining = list(outputs)

    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        args = remaining.pop(0) if len(remaining) > 1 else remaining[0]
        return ModelResponse(
            parts=[ToolCallPart(info.output_tools[0].name, args)],
            usage=RequestUsage(input_tokens=tokens[0], output_tokens=tokens[1]),
        )

    return respond


def failing(error: BaseException) -> ModelFunction:
    def respond(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        raise error

    return respond


async def ask(gateway: Gateway) -> Question:
    return await gateway.complete(
        role=Role.GENERATE,
        output_type=Question,
        instructions="Write one exam question.",
        prompt="Notes on photosynthesis",
        user_id=uuid.uuid4(),
        course_id=None,
        feature="test",
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
    calls = 0

    def count(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        nonlocal calls
        calls += 1
        return answering({"text": "q", "answer": 1})(messages, info)

    gateway = Gateway(
        api_engine, settings(**overrides), fake_model=FunctionModel(count)
    )
    with pytest.raises(BudgetExceededError) as refused:
        await ask(gateway)

    assert refused.value.limit == limit
    assert calls == 0
    assert ledger(api_engine) == []


async def test_invalid_output_gets_one_repair(api_engine: Engine) -> None:
    model = FunctionModel(
        answering({"text": "q", "answer": "many"}, {"text": "q", "answer": 2})
    )

    question = await ask(Gateway(api_engine, settings(), fake_model=model))

    assert question.answer == 2
    [row] = ledger(api_engine)
    assert (row.tokens, row.cost_usd) == (2200, Decimal("0.002200"))


async def test_output_still_invalid_after_the_repair_fails_and_is_charged(
    api_engine: Engine,
) -> None:
    calls = 0
    invalid = answering({"text": "q", "answer": "many"})

    def count(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        nonlocal calls
        calls += 1
        return invalid(messages, info)

    with pytest.raises(OutputInvalidError):
        await ask(Gateway(api_engine, settings(), fake_model=FunctionModel(count)))

    assert calls == 2
    [row] = ledger(api_engine)
    assert (row.tokens, row.cost_usd, row.output_tokens) == (
        2200,
        Decimal("0.002200"),
        200,
    )


async def test_a_request_the_provider_rejected_costs_nothing(
    api_engine: Engine,
) -> None:
    rejected = ModelHTTPError(status_code=400, model_name="fake", body="bad request")
    with pytest.raises(ModelHTTPError):
        await ask(
            Gateway(api_engine, settings(), fake_model=FunctionModel(failing(rejected)))
        )

    assert ledger(api_engine) == []


@pytest.mark.parametrize(
    "error",
    [TimeoutError("read timed out"), ModelHTTPError(529, "fake", "overloaded")],
    ids=["timeout", "server error"],
)
async def test_a_call_that_may_have_been_billed_keeps_its_estimate(
    api_engine: Engine, error: BaseException
) -> None:
    with pytest.raises(type(error)):
        await ask(
            Gateway(api_engine, settings(), fake_model=FunctionModel(failing(error)))
        )

    [row] = ledger(api_engine)
    assert row.settled_at is not None
    assert row.input_tokens is None
    assert row.cost_usd > 0


async def test_every_call_is_traced_without_prompts_or_answers(
    api_engine: Engine,
) -> None:
    exporter = InMemorySpanExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    model = FunctionModel(answering({"text": "What is chlorophyll for?", "answer": 1}))

    await ask(
        Gateway(
            api_engine, settings(), tracer_provider=tracer_provider, fake_model=model
        )
    )

    spans = exporter.get_finished_spans()
    run = next(span for span in spans if span.name == "invoke_agent generate")
    assert run.attributes is not None
    assert '"feature":"test"' in str(run.attributes["metadata"])
    recorded = repr(
        [
            (dict(s.attributes or {}), [dict(e.attributes or {}) for e in s.events])
            for s in spans
        ]
    )
    for text in ("photosynthesis", "exam question", "chlorophyll"):
        assert text not in recorded


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


def test_the_registry_models_are_built_with_the_platform_key(
    api_engine: Engine,
) -> None:
    gateway = Gateway(
        api_engine, settings(ai_provider="auto", anthropic_api_key="sk-x")
    )
    model = gateway._model("anthropic:claude-haiku-5-5", uuid.uuid4())
    assert isinstance(model, AnthropicModel)
    assert model.model_name == "claude-haiku-5-5"


def test_the_estimate_covers_the_most_a_call_can_cost() -> None:
    haiku = load_registry().models["anthropic:claude-haiku-5-5"]
    estimate = _estimate(haiku, input_tokens=95_000, max_output_tokens=4096)
    # The worst case: a repair whose prompt crosses Haiku's 100,000-token price step, every
    # input token written to the cache, and both answers at full length.
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
    assert billed.cost_usd == Decimal("0.80") + Decimal("0.25") + Decimal(
        "0.05"
    ) + Decimal("0.10")
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
