"""add User.is_verified for email verification

Revision ID: b8c2e4a1d9f3
Revises: f1a2b3c4d5e6
Create Date: 2026-05-21 12:00:00.000000

Resend e-posta doğrulama akışı için users tablosuna `is_verified` boolean
sütunu ekler. Mevcut satırlar için server_default='false' ile backfill —
böylece eski kullanıcılar otomatik olarak "doğrulanmamış" sayılır ve istenirse
admin paneliden manuel doğrulanabilir.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b8c2e4a1d9f3"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Backfill tamam — yeni kayıtlarda Python tarafı default=False zaten set'liyor,
    # server_default'a artık ihtiyaç yok. (Drop etmek opsiyonel, schema temizliği.)
    op.alter_column("users", "is_verified", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "is_verified")
