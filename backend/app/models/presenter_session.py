"""Presenter Müzayede Oturumu.

Bir presenter'ın açtığı oturum — içinde birden çok saat (Auction lot'u) yer
alır. Sıralı canlı yayın akışı: presenter saatleri önce oturuma ekler
(planning faz), sonra oturumu canlıya alır (live faz), her saati sırayla
açıp kapatır, son saat bitince oturum sonlanır.

Public /auctions sayfası bu oturumları "tek kart" olarak gösterir (tek tek
saatler değil); kullanıcı kartı tıklayınca oturum detay sayfasında o
oturumdaki tüm saatleri görür.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.auction import Auction
    from app.models.user import User


class PresenterSessionStatus(str, enum.Enum):
    """Oturum durumu.

    PLANNING → presenter saatleri ekliyor, henüz canlıya alınmadı
    LIVE     → oturum canlıda; içinde bir lot LIVE statüsünde teklif alıyor
    ENDED    → tüm lot'lar bitti veya presenter manuel kapattı
    CANCELLED→ presenter veya admin iptal etti
    """

    PLANNING = "planning"
    LIVE = "live"
    ENDED = "ended"
    CANCELLED = "cancelled"


class PresenterSession(Base, TimestampMixin):
    __tablename__ = "presenter_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    presenter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    # Oturumun adı — public kartta "[name]" olarak görünür
    # (örn. "Cuma Akşamı Vintage Saat Müzayedesi")
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    # Açıklama — public detay sayfasında oturumun ne olduğu, hangi marka/tema
    description: Mapped[str | None] = mapped_column(Text)
    # Oturumun başlayacağı tarih/saat — presenter takvimden seçer
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, nullable=False
    )
    status: Mapped[PresenterSessionStatus] = mapped_column(
        SAEnum(PresenterSessionStatus, name="presenter_session_status"),
        default=PresenterSessionStatus.PLANNING,
        nullable=False,
        index=True,
    )
    # Admin tarafından gizlenmiş olabilir — public listeden filtrelenir
    is_hidden: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )

    presenter: Mapped[User] = relationship(lazy="joined")
    lots: Mapped[list[Auction]] = relationship(
        back_populates="presenter_session",
        order_by="Auction.created_at.asc()",
        lazy="selectin",
    )
