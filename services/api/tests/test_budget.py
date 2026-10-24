import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import pytest
from sqlalchemy import Engine, func, select, text
from sqlalchemy.orm import Session

from verdict.ai_gateway.budget import (
    BudgetExceededError,
    Limits,
    Usage,
    release,
    reserve,
    settle,
)
from verdict.ai_gateway.models import UsageLedger

USAGE = Usage(
    tokens=40,
    cost_usd=Decimal("0.04"),
    input_tokens=30,
    output_tokens=10,
    cache_read_tokens=0,
    cache_write_tokens=0,
)


def call(
    engine: Engine,
    limits: Limits,
    *,
    user_id: uuid.UUID | None = None,
    tokens: int = 100,
    cost: str = "0.10",
) -> uuid.UUID:
    return reserve(
        engine,
        user_id=user_id or uuid.uuid4(),
        course_id=None,
        feature="test",
        role="generate",
        model="fake",
        tokens=tokens,
        cost_usd=Decimal(cost),
        limits=limits,
    )


def ledger_rows(engine: Engine) -> int:
    with Session(engine) as session:
        return session.scalar(select(func.count()).select_from(UsageLedger)) or 0


@pytest.mark.parametrize(
    ("limits", "same_student"),
    [
        (Limits(tokens_per_user=500, spend_usd=None), True),
        (Limits(tokens_per_user=None, spend_usd=Decimal("0.50")), False),
        (Limits(tokens_per_user=500, spend_usd=Decimal("0.50")), True),
    ],
    ids=["token limit", "spend cap", "both"],
)
def test_twenty_parallel_calls_against_limits_that_fit_five(
    api_engine: Engine, limits: Limits, same_student: bool
) -> None:
    student = uuid.uuid4()
    start = threading.Barrier(20)

    def attempt(_: int) -> bool:
        start.wait()
        try:
            call(api_engine, limits, user_id=student if same_student else None)
        except BudgetExceededError:
            return False
        return True

    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(attempt, range(20)))

    assert results.count(True) == 5
    with Session(api_engine) as session:
        most_tokens = session.scalar(
            select(func.max(text("tokens"))).select_from(
                select(func.sum(UsageLedger.tokens).label("tokens"))
                .group_by(UsageLedger.user_id)
                .subquery()
            )
        )
        spend = session.scalar(select(func.sum(UsageLedger.cost_usd)))
    assert most_tokens is not None
    assert spend is not None
    assert most_tokens <= 500
    assert spend <= Decimal("0.50")


def test_a_call_over_either_limit_reserves_nothing(api_engine: Engine) -> None:
    limits = Limits(tokens_per_user=1000, spend_usd=Decimal("1.00"))
    with pytest.raises(BudgetExceededError) as over_tokens:
        call(api_engine, limits, tokens=1001, cost="0.01")
    assert over_tokens.value.limit == "tokens_per_user"
    with pytest.raises(BudgetExceededError) as over_spend:
        call(api_engine, limits, tokens=1, cost="1.01")
    assert over_spend.value.limit == "spend_usd"
    assert ledger_rows(api_engine) == 0


def test_each_limit_compares_like_with_like(api_engine: Engine) -> None:
    # 999 tokens is far above a $1 cap, and $50 is far above a 5-token limit; neither matters.
    call(
        api_engine,
        Limits(tokens_per_user=1000, spend_usd=Decimal(1)),
        tokens=999,
        cost="0.01",
    )
    call(
        api_engine,
        Limits(tokens_per_user=5, spend_usd=Decimal(100)),
        tokens=1,
        cost="50",
    )
    assert ledger_rows(api_engine) == 2


def test_one_students_tokens_dont_count_against_another(api_engine: Engine) -> None:
    limits = Limits(tokens_per_user=100, spend_usd=None)
    call(api_engine, limits, tokens=100)
    call(api_engine, limits, tokens=100)
    assert ledger_rows(api_engine) == 2


def test_settling_replaces_the_reservation_with_real_usage(api_engine: Engine) -> None:
    limits = Limits(tokens_per_user=100, spend_usd=Decimal("0.10"))
    student = uuid.uuid4()
    reservation = call(api_engine, limits, user_id=student, tokens=100, cost="0.10")

    settle(api_engine, reservation, USAGE)

    with Session(api_engine) as session:
        row = session.get_one(UsageLedger, reservation)
        assert (row.tokens, row.cost_usd, row.output_tokens) == (
            40,
            Decimal("0.04"),
            10,
        )
        assert row.settled_at is not None
    call(api_engine, limits, user_id=student, tokens=60, cost="0.06")
    with pytest.raises(BudgetExceededError):
        call(api_engine, limits, user_id=student, tokens=1, cost="0.01")
    with pytest.raises(LookupError):
        settle(api_engine, reservation, USAGE)


def test_a_failed_call_releases_its_reservation(api_engine: Engine) -> None:
    limits = Limits(tokens_per_user=100, spend_usd=Decimal("0.10"))
    student = uuid.uuid4()
    reservation = call(api_engine, limits, user_id=student, tokens=100, cost="0.10")
    with pytest.raises(BudgetExceededError):
        call(api_engine, limits, user_id=student, tokens=1, cost="0.01")

    release(api_engine, reservation)

    call(api_engine, limits, user_id=student, tokens=100, cost="0.10")


def test_reservations_left_from_yesterday_dont_count_today(api_engine: Engine) -> None:
    student = uuid.uuid4()
    with Session(api_engine) as session, session.begin():
        session.execute(
            text("""
                INSERT INTO usage_ledger (day, user_id, feature, role, model, tokens, cost_usd)
                VALUES ((now() AT TIME ZONE 'UTC')::date - 1, :student,
                        'test', 'generate', 'fake', 100, 0.10)
            """),
            {"student": student},
        )
    limits = Limits(tokens_per_user=100, spend_usd=Decimal("0.10"))
    call(api_engine, limits, user_id=student, tokens=100, cost="0.10")
