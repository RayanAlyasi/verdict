import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Index, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from verdict.db import Base, UUIDv7PrimaryKey


class UsageLedger(Base):
    """One row per AI call: a reservation until `settled_at` is set, then the call's real usage."""

    __tablename__ = "usage_ledger"
    __table_args__ = (Index(None, "day", "user_id"),)

    id: Mapped[UUIDv7PrimaryKey]
    # The UTC day whose limits the call counts against.
    day: Mapped[date]
    user_id: Mapped[uuid.UUID]
    course_id: Mapped[uuid.UUID | None]
    feature: Mapped[str]
    role: Mapped[str]
    model: Mapped[str]
    tokens: Mapped[int] = mapped_column(BigInteger)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6))
    input_tokens: Mapped[int | None]
    output_tokens: Mapped[int | None]
    cache_read_tokens: Mapped[int | None]
    cache_write_tokens: Mapped[int | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    settled_at: Mapped[datetime | None]
