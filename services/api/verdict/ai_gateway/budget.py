"""Daily AI budgets that parallel calls can't overspend.

Each call reserves its estimate before it runs, then settles its real usage or releases the
reservation if it fails. Estimates must be upper bounds (all input tokens plus the call's maximum
output tokens), so settling never pushes the ledger past a limit.
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
    # AI_DAILY_TOKEN_LIMIT_PER_USER; None means no limit.
    tokens_per_user: int | None
    # AI_DAILY_SPEND_LIMIT_USD, shared by every student; None means no cap.
    spend_usd: Decimal | None


@dataclass(frozen=True)
class Usage:
    tokens: int
    cost_usd: Decimal
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_tokens: int


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
    with Session(engine) as session, session.begin():
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
            logger.warning("AI call %s used more than it reserved", reservation_id)
        row.tokens = usage.tokens
        row.cost_usd = usage.cost_usd
        row.input_tokens = usage.input_tokens
        row.output_tokens = usage.output_tokens
        row.cache_read_tokens = usage.cache_read_tokens
        row.cache_write_tokens = usage.cache_write_tokens
        row.settled_at = func.now()


def release(engine: Engine, reservation_id: uuid.UUID) -> None:
    """Free a failed call's reservation."""
    with Session(engine) as session, session.begin():
        session.execute(
            delete(UsageLedger).where(
                UsageLedger.id == reservation_id, UsageLedger.settled_at.is_(None)
            )
        )
