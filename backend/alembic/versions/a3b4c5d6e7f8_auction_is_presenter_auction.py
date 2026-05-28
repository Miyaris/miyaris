"""add Auction.is_presenter_auction flag for presenter showcases

Revision ID: a3b4c5d6e7f8
Revises: f2b3c4d5e6a7
Create Date: 2026-05-27 18:00:00.000000

Presenter (canlı müzayede sunucusu) tarafından açılan showcase'leri normal
müzayedelerden ayırt eder. Presenter showcase'leri /auctions ana liste
grid'inde GÖZÜKMEZ — sunucu Instagram canlı yayını gibi dış kanaldan
alıcı çeker ve direkt /auctions/{id} linkini paylaşır. Detay sayfası
direct link için açık kalır.

Backfill: tüm mevcut satırlar False — sadece bundan sonra presenter
service üzerinden açılanlar True olarak işaretlenir.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "f2b3c4d5e6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "auctions",
        sa.Column(
            "is_presenter_auction",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.alter_column("auctions", "is_presenter_auction", server_default=None)


def downgrade() -> None:
    op.drop_column("auctions", "is_presenter_auction")
