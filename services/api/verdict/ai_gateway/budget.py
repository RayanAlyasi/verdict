"""Daily AI budgets that parallel calls can't overspend.

Each call reserves its estimate before it runs, then settles its real usage. Estimates must be
upper bounds, so settling never pushes the ledger past a limit: all input tokens priced at the
model's highest input rate (cache writes cost more than plain input), plus the maximum output.

Release a reservation only when the provider never accepted the request. A call that may have been
billed (a timeout or a broken stream) settles at its estimate instead.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from sqlalchemy import Engine, delete, func, select, text
from sqlalchemy.orm import Session

from verdict.ai_gateway.models import UsageLedger

logger = logging.getLogger(__name__)

# First key of pg_advisory_xact_lock(key, day). Any int4 not used by another two-key lock.
BUDGET_LOCK = 0x61690001


@dataclass(frozen=True)
class Limits:
    # AI_DAILY_TOKEN_LIMIT_PER_USER; None means no limit, as when students pay with their own keys.
    tokens_per_user: int | None
    # AI_DAILY_SPEND_LIMIT_USD, shared by every student; None means no cap.
    spend_usd: Decimal | None


@dataclass(frozen=True)
class Usage:
    tokens: int
    cost_usd: Decimal
    # None when the provider reported no breakdown, as for a call settled at its estimate.
    input_tokens: int | None = None
    output_tokens: int | None = None
    cache_read_tokens: int | None = None
    cache_write_tokens: int | None = None


class BudgetExceededError(Exception):
    def __init__(self, limit: Literal["tokens_per_user", "spend_usd"]) -> None:
        super().__init__(f"The call would pass today's {limit} limit")
        self.limit = limit


def reserve(
    engine: Engine,
    *,
    user_id: uuid.UUID,
    course_id: uuid.UUID | None,
    feature: str,
    role: str,
    model: str,
    tokens: int,
    cost_usd: Decimal,
    limits: Limits,
) -> uuid.UUID:
    """Reserve a call's estimate against every limit at once, or reserve nothing."""
    # READ COMMITTED whatever the engine's default: under REPEATABLE READ the snapshot is taken
    # before the lock, so each reservation would read totals from before the previous one.
    read_committed = engine.execution_options(isolation_level="READ COMMITTED")
    with Session(read_committed) as session, session.begin():
        day: date = session.execute(
            text("SELECT (now() AT TIME ZONE 'UTC')::date")
        ).scalar_one()
        # One lock per UTC day: the spend cap is shared by every student, so two reservations
        # must never both read the same totals.
        session.execute(
            select(func.pg_advisory_xact_lock(BUDGET_LOCK, day.toordinal()))
        )
        user_tokens, platform_spend = session.execute(
            select(
                func.coalesce(
                    func.sum(UsageLedger.tokens).filter(UsageLedger.user_id == user_id),
                    0,
                ),
                func.coalesce(func.sum(UsageLedger.cost_usd), 0),
            ).where(UsageLedger.day == day)
        ).one()
        if limits.tokens_per_user is not None and (
            user_tokens + tokens > limits.tokens_per_user
        ):
            raise BudgetExceededError("tokens_per_user")
        if (
            limits.spend_usd is not None
            and platform_spend + cost_usd > limits.spend_usd
        ):
            raise BudgetExceededError("spend_usd")
        reservation = UsageLedger(
            day=day,
            user_id=user_id,
            course_id=course_id,
            feature=feature,
            role=role,
            model=model,
            tokens=tokens,
            cost_usd=cost_usd,
        )
        session.add(reservation)
        session.flush()
        return reservation.id


def settle(engine: Engine, reservation_id: uuid.UUID, usage: Usage) -> None:
    """Replace a reservation with the call's real usage."""
    with Session(engine) as session, session.begin():
        row = session.get(UsageLedger, reservation_id, with_for_update=True)
        if row is None or row.settled_at is not None:
            raise LookupError(f"No open reservation {reservation_id}")
        if usage.tokens > row.tokens or usage.cost_usd > row.cost_usd:
            logger.warning(
                "AI call %s used more than it reserved: %d tokens and $%s, reserved %d and $%s",
                reservation_id,
                usage.tokens,
                usage.cost_usd,
                row.tokens,
                row.cost_usd,
            )
        row.tokens = usage.tokens
        row.cost_usd = usage.cost_usd
        row.input_tokens = usage.input_tokens
        row.output_tokens = usage.output_tokens
        row.cache_read_tokens = usage.cache_read_tokens
        row.cache_write_tokens = usage.cache_write_tokens
        row.settled_at = func.now()


def release(engine: Engine, reservation_id: uuid.UUID) -> None:
    """Free the reservation of a call the provider never accepted. A settled row stays."""
    with Session(engine) as session, session.begin():
        session.execute(
            delete(UsageLedger).where(
                UsageLedger.id == reservation_id, UsageLedger.settled_at.is_(None)
            )
        )
