"""escrow_transactions sahtekarlik onleme alanlari

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-06-19 18:00:00.000000

Sahtekarlik onleme akisi:
  * seller_seal_photo_url: satici kargoya verirken kurcalama izi gosteren
    muhurlu kutu fotografi. Vercel Blob URL.
  * seller_seal_uploaded_at: fotografi yukledigi an.
  * buyer_unboxing_video_url: alici paket acma anini 60 saniyelik videoyla
    kaydeder. Vercel Blob URL.
  * buyer_unboxing_uploaded_at: videoyu yukledigi an.
  * seal_intact: alici muhrun saglam mi yoksa kirik mi oldugunu beyan eder.
    NULL = henuz beyan yok, True = saglam (akis devam), False = kirik
    (escrow DISPUTED durumuna gecer, iade akisi tetiklenir).

Tum alanlar NULLABLE: mevcut escrow kayitlari etkilenmesin. Yeni akis
opsiyonel olarak baslar; ileride backend zorunlu hale getirebilir.

Raw SQL ile idempotent.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE escrow_transactions
        ADD COLUMN IF NOT EXISTS seller_seal_photo_url VARCHAR(600);
        """
    )
    op.execute(
        """
        ALTER TABLE escrow_transactions
        ADD COLUMN IF NOT EXISTS seller_seal_uploaded_at TIMESTAMP WITH TIME ZONE;
        """
    )
    op.execute(
        """
        ALTER TABLE escrow_transactions
        ADD COLUMN IF NOT EXISTS buyer_unboxing_video_url VARCHAR(600);
        """
    )
    op.execute(
        """
        ALTER TABLE escrow_transactions
        ADD COLUMN IF NOT EXISTS buyer_unboxing_uploaded_at TIMESTAMP WITH TIME ZONE;
        """
    )
    op.execute(
        """
        ALTER TABLE escrow_transactions
        ADD COLUMN IF NOT EXISTS seal_intact BOOLEAN;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE escrow_transactions
        DROP COLUMN IF EXISTS seal_intact;
        """
    )
    op.execute(
        """
        ALTER TABLE escrow_transactions
        DROP COLUMN IF EXISTS buyer_unboxing_uploaded_at;
        """
    )
    op.execute(
        """
        ALTER TABLE escrow_transactions
        DROP COLUMN IF EXISTS buyer_unboxing_video_url;
        """
    )
    op.execute(
        """
        ALTER TABLE escrow_transactions
        DROP COLUMN IF EXISTS seller_seal_uploaded_at;
        """
    )
    op.execute(
        """
        ALTER TABLE escrow_transactions
        DROP COLUMN IF EXISTS seller_seal_photo_url;
        """
    )
