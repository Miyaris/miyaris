"""NVI_kimlik_dogrulama + delivery/payment method + discount

Revision ID: d333af093dda
Revises: 746bc919eade
Create Date: 2026-05-15 13:26:44.946061

Not: Alembic auto-generate, PostgreSQL ENUM type'larını column eklemeden önce
CREATE TYPE etmiyor. Bu yüzden ENUM'ları manuel bind üzerinden yaratıyoruz
(checkfirst=True ile idempotent) ve column'larda `create_type=False` veriyoruz.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd333af093dda'
down_revision: Union[str, None] = '746bc919eade'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ENUM type'ları — module-level tanım, hem upgrade hem downgrade kullanır.
delivery_method_enum = sa.Enum('SHIPPING', 'STORE_PICKUP', name='delivery_method')
payment_method_enum = sa.Enum('CREDIT_CARD', 'BANK_TRANSFER', name='payment_method')


def upgrade() -> None:
    bind = op.get_bind()

    # 1) ENUM type'larını yarat (idempotent — varsa atla)
    delivery_method_enum.create(bind, checkfirst=True)
    payment_method_enum.create(bind, checkfirst=True)

    # 2) Column'ları ekle — create_type=False, çünkü type zaten var
    op.add_column(
        'escrow_transactions',
        sa.Column(
            'delivery_method',
            sa.Enum('SHIPPING', 'STORE_PICKUP', name='delivery_method', create_type=False),
            nullable=True,
        ),
    )
    op.add_column(
        'escrow_transactions',
        sa.Column(
            'payment_method',
            sa.Enum('CREDIT_CARD', 'BANK_TRANSFER', name='payment_method', create_type=False),
            nullable=True,
        ),
    )
    # discount_amount NOT NULL — eski satırlar için server_default ile 0 ata
    op.add_column(
        'escrow_transactions',
        sa.Column(
            'discount_amount',
            sa.Numeric(precision=14, scale=2),
            nullable=False,
            server_default='0',
        ),
    )

    op.add_column('users', sa.Column('first_name', sa.String(length=80), nullable=True))
    op.add_column('users', sa.Column('last_name', sa.String(length=80), nullable=True))
    op.add_column('users', sa.Column('birth_year', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'birth_year')
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'first_name')
    op.drop_column('escrow_transactions', 'discount_amount')
    op.drop_column('escrow_transactions', 'payment_method')
    op.drop_column('escrow_transactions', 'delivery_method')

    bind = op.get_bind()
    payment_method_enum.drop(bind, checkfirst=True)
    delivery_method_enum.drop(bind, checkfirst=True)
