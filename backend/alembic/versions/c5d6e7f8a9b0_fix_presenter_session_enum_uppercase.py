"""fix presenter_session_status enum to use UPPERCASE values

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-05-29 09:30:00.000000

Önceki migration (b4c5d6e7f8a9) enum'u lowercase değerlerle yaratmıştı,
fakat SQLAlchemy SAEnum default davranışı `.name` ile (UPPERCASE) yazar.
Insert anında `'PLANNING'` gelirken DB enum'u `'planning'` beklediği için
`InvalidTextRepresentationError` atıyordu.

Çözüm: önceki migration `alembic_version`'a yazıldı (yeniden çalıştırılmaz),
o yüzden bu yeni revision'da DROP + CREATE ile enum'u UPPERCASE'e
çeviriyoruz. Tablo şu ana kadar hiç başarılı insert almadığı için drop
güvenli — kayıp veri yok.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, None] = "b4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Önceki yanlış state'i temizle. CASCADE FK ve index'leri otomatik
    #    siler. Boş tablo olduğu için içerik kayıp riski yok.
    op.execute("DROP INDEX IF EXISTS ix_auctions_presenter_session_id;")
    op.execute(
        "ALTER TABLE auctions DROP COLUMN IF EXISTS presenter_session_id;"
    )
    op.execute("DROP TABLE IF EXISTS presenter_sessions CASCADE;")
    op.execute("DROP TYPE IF EXISTS presenter_session_status;")

    # 2) UPPERCASE enum (SAEnum .name pattern'i ile uyumlu — codebase'deki
    #    tüm diğer enum'lar gibi: BUYER/SELLER/DRAFT/PENDING_REVIEW vb.)
    op.execute(
        """
        CREATE TYPE presenter_session_status
            AS ENUM ('PLANNING', 'LIVE', 'ENDED', 'CANCELLED');
        """
    )

    # 3) Tablo
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

    # 4) Auction FK
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
    # Tam rollback — lowercase versiyonuna geri dönmüyoruz (eski hatalıydı),
    # tüm yapıyı kaldırırız.
    op.execute("DROP INDEX IF EXISTS ix_auctions_presenter_session_id;")
    op.execute(
        "ALTER TABLE auctions DROP COLUMN IF EXISTS presenter_session_id;"
    )
    op.execute("DROP TABLE IF EXISTS presenter_sessions CASCADE;")
    op.execute("DROP TYPE IF EXISTS presenter_session_status;")
