"""create presenter_sessions table + Auction.presenter_session_id FK

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-05-27 22:00:00.000000

Presenter müzayede oturum modelini DB'ye taşır:
  * presenter_sessions tablosu (name, scheduled_at, presenter_id, status,
    description, is_hidden, created_at, updated_at)
  * presenter_session_status enum (planning/live/ended/cancelled)
  * auctions.presenter_session_id FK (nullable, indexed, ON DELETE SET NULL)

Mevcut müzayedeler etkilenmez — hepsinin presenter_session_id=NULL kalır
(bağımsız müzayede). Sadece bundan sonra presenter tarafından oturum
içine eklenen lot'larda SET olur.

`is_presenter_auction` kolonu (önceki migration a3b4c5d6e7f8'de eklendi)
korunur ama servis kodu artık session FK'sini baz alır.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Enum tipi — Postgres'te tek seferde create edilir
    status_enum = sa.Enum(
        "planning",
        "live",
        "ended",
        "cancelled",
        name="presenter_session_status",
    )
    status_enum.create(op.get_bind(), checkfirst=True)

    # 2) presenter_sessions tablosu
    op.create_table(
        "presenter_sessions",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "presenter_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "scheduled_at",
            sa.DateTime(timezone=True),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "status",
            sa.Enum(name="presenter_session_status", create_type=False),
            nullable=False,
            server_default="planning",
            index=True,
        ),
        sa.Column(
            "is_hidden",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 3) Auction.presenter_session_id FK
    op.add_column(
        "auctions",
        sa.Column(
            "presenter_session_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("presenter_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_auctions_presenter_session_id",
        "auctions",
        ["presenter_session_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_auctions_presenter_session_id", table_name="auctions"
    )
    op.drop_column("auctions", "presenter_session_id")
    op.drop_table("presenter_sessions")
    sa.Enum(name="presenter_session_status").drop(
        op.get_bind(), checkfirst=True
    )
