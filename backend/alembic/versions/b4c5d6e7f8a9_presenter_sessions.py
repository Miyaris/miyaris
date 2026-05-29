"""create presenter_sessions table + Auction.presenter_session_id FK

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-05-27 22:00:00.000000

Presenter müzayede oturum modelini DB'ye taşır:
  * presenter_sessions tablosu
  * presenter_session_status enum
  * auctions.presenter_session_id FK (nullable, indexed, ON DELETE SET NULL)

ENUM DEĞERLERİ: Mevcut codebase'de tüm Postgres enum'ları Python enum
`.name` ile (UPPERCASE) yaratılmış (initial migration'da `BUYER`, `SELLER`,
`DRAFT` vb.). SQLAlchemy default davranışı SAEnum bağlarken `.name`
kullanmak — bu yüzden enum DB'de de UPPERCASE olmalı:
PLANNING / LIVE / ENDED / CANCELLED.

ÖNCEKİ HATA: Bu migration'ın ilk sürümü lowercase değerler ile enum
yaratmıştı (`planning, live, ...`), ama SAEnum sürdüğünde `'PLANNING'`
yazdı → `invalid input value for enum` hatası.

ÖNCEKİ STATE TEMİZLİĞİ: Hatalı enum mevcut DB'de kalmış olabilir. Tablo
hiç başarıyla insert almamış olduğu için DROP'lamak güvenli. Migration
DROP IF EXISTS ile başlar, sonra UPPERCASE ile yeniden yaratır.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Hatalı önceki state'i temizle — enum ve tablo lowercase ile
    #    yaratılmış olabilir, hiç başarılı insert almadığı için drop güvenli.
    op.execute("DROP INDEX IF EXISTS ix_auctions_presenter_session_id;")
    op.execute(
        "ALTER TABLE auctions DROP COLUMN IF EXISTS presenter_session_id;"
    )
    op.execute("DROP TABLE IF EXISTS presenter_sessions CASCADE;")
    op.execute("DROP TYPE IF EXISTS presenter_session_status;")

    # 2) Enum tipi — UPPERCASE (SAEnum default .name davranışıyla uyumlu)
    op.execute(
        """
        CREATE TYPE presenter_session_status
            AS ENUM ('PLANNING', 'LIVE', 'ENDED', 'CANCELLED');
        """
    )

    # 3) presenter_sessions tablosu
    op.execute(
        """
        CREATE TABLE presenter_sessions (
            id UUID PRIMARY KEY,
            presenter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            name VARCHAR(160) NOT NULL,
            description TEXT,
            scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
            status presenter_session_status NOT NULL DEFAULT 'PLANNING',
            is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        """
    )
    op.execute(
        "CREATE INDEX ix_presenter_sessions_presenter_id ON presenter_sessions(presenter_id);"
    )
    op.execute(
        "CREATE INDEX ix_presenter_sessions_scheduled_at ON presenter_sessions(scheduled_at);"
    )
    op.execute(
        "CREATE INDEX ix_presenter_sessions_status ON presenter_sessions(status);"
    )

    # 4) Auction.presenter_session_id FK
    op.execute(
        """
        ALTER TABLE auctions
        ADD COLUMN presenter_session_id UUID
            REFERENCES presenter_sessions(id) ON DELETE SET NULL;
        """
    )
    op.execute(
        "CREATE INDEX ix_auctions_presenter_session_id ON auctions(presenter_session_id);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_auctions_presenter_session_id;")
    op.execute(
        "ALTER TABLE auctions DROP COLUMN IF EXISTS presenter_session_id;"
    )
    op.execute("DROP TABLE IF EXISTS presenter_sessions CASCADE;")
    op.execute("DROP TYPE IF EXISTS presenter_session_status;")
