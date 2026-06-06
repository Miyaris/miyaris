"""add Auction.required_deposit_amount + auction_participants table

Revision ID: d7e8f9a0b1c2
Revises: c5d6e7f8a9b0
Create Date: 2026-06-04 12:00:00.000000

Anti-troll kapora (deposit) sistemi:
  * auctions.required_deposit_amount: müzayedeye katılım için zorunlu
    kapora tutarı (TL). Varsayılan 1000.
  * auction_participants tablosu: hangi user'ın hangi müzayedeye kapora
    ödediğini takip. (auction_id, user_id) unique.

Bid endpoint guard'ı bu tabloya bakarak teklif vermeye izin verir.

Raw SQL ile idempotent — başarısız önceki deploy state'ini tolere eder.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Auction.required_deposit_amount kolonu (idempotent)
    op.execute(
        """
        ALTER TABLE auctions
        ADD COLUMN IF NOT EXISTS required_deposit_amount NUMERIC(14, 2)
            NOT NULL DEFAULT 1000;
        """
    )

    # 2) auction_participants tablosu
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS auction_participants (
            id UUID PRIMARY KEY,
            auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            deposit_amount NUMERIC(14, 2) NOT NULL,
            deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
            deposit_paid_at TIMESTAMP WITH TIME ZONE,
            deposit_provider_ref VARCHAR(80),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_participant_auction_user UNIQUE (auction_id, user_id)
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_auction_participants_auction_id "
        "ON auction_participants(auction_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_auction_participants_user_id "
        "ON auction_participants(user_id);"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS auction_participants;")
    op.execute(
        "ALTER TABLE auctions DROP COLUMN IF EXISTS required_deposit_amount;"
    )
