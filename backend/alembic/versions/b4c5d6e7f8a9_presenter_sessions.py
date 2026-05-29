"""create presenter_sessions table + Auction.presenter_session_id FK

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-05-27 22:00:00.000000

Presenter müzayede oturum modelini DB'ye taşır:
  * presenter_sessions tablosu
  * presenter_session_status enum (planning/live/ended/cancelled)
  * auctions.presenter_session_id FK (nullable, indexed, ON DELETE SET NULL)

Tüm DDL raw SQL ile yazıldı — SQLAlchemy'nin `before_create` event'i devreye
girip enum'u ikinci kez yaratmaya çalışmasın. Eski başarısız deploy'lardan
kalan kısmî state (enum var ama tablo yok vs.) için tüm operasyonlar
`IF NOT EXISTS` / `EXCEPTION duplicate_object` ile idempotent.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Enum tipi — idempotent. Önceki başarısız deploy oluşturmuş olabilir.
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE presenter_session_status
                AS ENUM ('planning', 'live', 'ended', 'cancelled');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )

    # 2) presenter_sessions tablosu — IF NOT EXISTS ile idempotent.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS presenter_sessions (
            id UUID PRIMARY KEY,
            presenter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            name VARCHAR(160) NOT NULL,
            description TEXT,
            scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
            status presenter_session_status NOT NULL DEFAULT 'planning',
            is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_presenter_sessions_presenter_id
            ON presenter_sessions(presenter_id);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_presenter_sessions_scheduled_at
            ON presenter_sessions(scheduled_at);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_presenter_sessions_status
            ON presenter_sessions(status);
        """
    )

    # 3) Auction.presenter_session_id FK — idempotent kolon + index.
    op.execute(
        """
        ALTER TABLE auctions
        ADD COLUMN IF NOT EXISTS presenter_session_id UUID
            REFERENCES presenter_sessions(id) ON DELETE SET NULL;
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_auctions_presenter_session_id
            ON auctions(presenter_session_id);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_auctions_presenter_session_id;")
    op.execute(
        "ALTER TABLE auctions DROP COLUMN IF EXISTS presenter_session_id;"
    )
    op.execute("DROP TABLE IF EXISTS presenter_sessions;")
    op.execute("DROP TYPE IF EXISTS presenter_session_status;")
