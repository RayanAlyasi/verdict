"""add the ai usage ledger

Revision ID: 4dbe124e79bc
Revises:
Create Date: 2026-10-24 21:40:11.063953
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "4dbe124e79bc"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "usage_ledger",
        sa.Column("id", sa.Uuid(), server_default=sa.text("uuidv7()"), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("course_id", sa.Uuid(), nullable=True),
        sa.Column("feature", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("model", sa.String(), nullable=False),
        sa.Column("tokens", sa.BigInteger(), nullable=False),
        sa.Column("cost_usd", sa.Numeric(precision=12, scale=6), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("cache_read_tokens", sa.Integer(), nullable=True),
        sa.Column("cache_write_tokens", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "tokens >= 0 AND cost_usd >= 0", name=op.f("ck_usage_ledger_not_negative")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_usage_ledger")),
    )
    op.create_index(
        op.f("ix_usage_ledger_day_user_id"),
        "usage_ledger",
        ["day", "user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_usage_ledger_day_user_id"), table_name="usage_ledger")
    op.drop_table("usage_ledger")
