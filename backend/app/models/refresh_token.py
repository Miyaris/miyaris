"""RefreshToken — DB-backed refresh token kayıtları (rotation + reuse detect).

Her login bir RefreshToken row üretir; her /refresh çağrısı eski row'u
`revoked_at` ile kapatır + yeni row açar (chain: replaced_by_jti).

Token reuse algılama:
  - Kullanıcı /refresh'e zaten revoked olan bir token getirirse
    → "token reuse" → kullanıcının TÜM aktif refresh'leri iptal edilir
    (compromise senaryosu: hem saldırgan hem kurban aynı eski token'ı
    elinde tutuyor, biri kullandı → diğeri yeniden kullanmaya çalışınca
    yakalanır)

Şema gerekçesi:
  - `jti` = JWT'nin jti claim'i; primary lookup key, UNIQUE index
  - `user_id` cascade DELETE → user silinince session'ları temiz
  - `expires_at` indekslenmiş; periyodik temizleme job'ı için
  - `revoked_at` NULL = aktif; NOT NULL = iptal edilmiş (revoke nedeni
    bağımsız sütun olmadan implicit: replaced_by_jti varsa rotation,
    yoksa logout veya force-revoke)
  - `replaced_by_jti` rotation zincirini takip etmek için (audit trail)
  - `user_agent` / `ip` → audit + suspicious-device detection (ileride)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class RefreshToken(Base, TimestampMixin):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # JWT'nin jti claim'i ile birebir eşleşir; lookup buradan yapılır.
    jti: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    # NULL → aktif. NOT NULL → revoke edildi (rotation veya logout veya
    # security event tarafından).
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Bu token rotation ile değiştirilirse, halefi bu kolonda işaretlenir.
    # Audit trail için: hangi token hangi token'a evrildi.
    replaced_by_jti: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Audit / forensics — token sızıntısı sonrası ortamı analiz için.
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    user: Mapped[User] = relationship()
