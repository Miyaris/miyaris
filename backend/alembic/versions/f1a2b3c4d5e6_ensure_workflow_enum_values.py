"""ensure_workflow_enum_values

Revision ID: f1a2b3c4d5e6
Revises: ee960d9e114d
Create Date: 2026-05-17 17:36:00.000000

`ee960d9e114d` migration'ı bazı geliştirme ortamlarında PG enum'una yeni
WatchStatus değerlerini eklemeden uygulanmış olabiliyor. Bu fix-up migration
idempotent şekilde `PENDING_PRE_EXPERTISE` ve `AWAITING_EXPERTISE` değerlerini
`watch_status` enum'una ekler. Zaten ekliyse no-op (IF NOT EXISTS).
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "ee960d9e114d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ADD VALUE PG'de transaction'a alınamaz → autocommit blok.
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE watch_status ADD VALUE IF NOT EXISTS 'PENDING_PRE_EXPERTISE'"
        )
        op.execute(
            "ALTER TYPE watch_status ADD VALUE IF NOT EXISTS 'AWAITING_EXPERTISE'"
        )


def downgrade() -> None:
    # PG enum değerleri silinemez — no-op. ee960d9e114d downgrade'i enum'u
    # zaten DROP'lamıyor, böylece bu fix de idempotent kalır.
    pass
