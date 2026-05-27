"""add Auction.is_hidden for soft-hide from public pages

Revision ID: f2b3c4d5e6a7
Revises: e1f2a3b4c5d6
Create Date: 2026-05-25 22:00:00.000000

Admin'in "sayfadan kaldır" akışı için `auctions` tablosuna `is_hidden`
boolean sütunu ekler. is_hidden=True olan müzayedeler public listelerde
ve detay sayfalarında gözükmez; admin panelinin "Gizli" sekmesinde
görünür ve istenirse geri getirilebilir.

Soft-hide tercihi — teklif geçmişi, escrow kayıtları ve audit trail
korunur. Hard delete yasal/finansal kayıt kayıp riski taşıdığı için
tercih edilmedi.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2b3c4d5e6a7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "auctions",
        sa.Column(
            "is_hidden",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Backfill tamam — yeni kayıtlarda Python default=False set'liyor.
    op.alter_column("auctions", "is_hidden", server_default=None)


def downgrade() -> None:
    op.drop_column("auctions", "is_hidden")
