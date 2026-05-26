"""add User.is_presenter for live auction presenter dashboard

Revision ID: e1f2a3b4c5d6
Revises: c1a2b3c4d5e6
Create Date: 2026-05-25 18:00:00.000000

Canlı müzayede sunucu ekranı (`/presenter/*`) için `users` tablosuna
`is_presenter` boolean sütunu ekler.

Bu yetki `role`'dan bağımsız tutulur — bir admin, expert veya buyer
hesabı çapraz olarak presenter yapılabilir (örn. yayını yöneten kişinin
hesabı `buyer` rolünde olsa da yetkisi olabilir).

Backfill: tüm mevcut satırlar için `false` — hiçbir kullanıcı varsayılan
olarak presenter değildir. Admin panelinden tek-tıkla onaylanır.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "c1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_presenter",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Backfill tamamlandı; ileride yeni kayıtlarda Python tarafı default=False
    # set'liyor, server_default'a artık ihtiyaç yok ama tutmakta zarar da yok.
    # Şema tutarlılığı için kaldırıyoruz (diğer migration'larla uyumlu).
    op.alter_column("users", "is_presenter", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "is_presenter")
