"""add_listing_type_and_commission

Revision ID: ee960d9e114d
Revises: d333af093dda
Create Date: 2026-05-17 20:14:50.595515

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ee960d9e114d'
down_revision: Union[str, None] = 'd333af093dda'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) watch_status enum'una yeni değerleri ekle.
    #    PG'de ALTER TYPE ADD VALUE transaction içinde sınırlıdır → autocommit blok.
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE watch_status ADD VALUE IF NOT EXISTS 'PENDING_PRE_EXPERTISE'"
        )
        op.execute(
            "ALTER TYPE watch_status ADD VALUE IF NOT EXISTS 'AWAITING_EXPERTISE'"
        )

    # 2) listing_type kolonu — NOT NULL olduğu için server_default ile backfill.
    listing_type_enum = sa.Enum(
        'DIRECT_SALE', 'AUCTION', name='listing_type'
    )
    listing_type_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'watches',
        sa.Column(
            'listing_type',
            listing_type_enum,
            nullable=False,
            server_default='AUCTION',
        ),
    )
    # Backfill tamam — default'u kaldır (yeni kayıtlarda Python tarafı set eder).
    op.alter_column('watches', 'listing_type', server_default=None)

    # 3) asking_price kolonu — DIRECT_SALE için, nullable.
    op.add_column(
        'watches',
        sa.Column('asking_price', sa.Numeric(precision=14, scale=2), nullable=True),
    )
    op.create_index(
        op.f('ix_watches_listing_type'), 'watches', ['listing_type'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_watches_listing_type'), table_name='watches')
    op.drop_column('watches', 'asking_price')
    op.drop_column('watches', 'listing_type')
    op.execute("DROP TYPE IF EXISTS listing_type")
    # NOT: PG enum value silinemez — watch_status'a eklediğimiz yeni değerler
    # geriye dönüş esnasında kalır (ve hata vermez).
