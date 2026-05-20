from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from decimal import Decimal

from sqlalchemy import Boolean
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.ai_valuation import AIValuation
    from app.models.auction import Auction
    from app.models.certificate import AuthenticityCertificate
    from app.models.user import User


class WatchStatus(str, enum.Enum):
    DRAFT = "draft"
    # Legacy — eski sertifika akışı (geriye dönük uyumlu)
    PENDING_REVIEW = "pending_review"
    # AÇIK ARTIRMA listesinde — saat henüz partner mağaza ekspertizinden geçmedi
    PENDING_PRE_EXPERTISE = "pending_pre_expertise"
    ACTIVE = "active"
    # DİREKT SATIŞ ile satıldı — şimdi alıcıya gönderilmeden önce ekspertize gidiyor
    AWAITING_EXPERTISE = "awaiting_expertise"
    SOLD = "sold"
    REJECTED = "rejected"


class ListingType(str, enum.Enum):
    """İlan tipi.

    DIRECT_SALE: Satıcı sabit fiyat belirler, saat ekspertize gitmeden listelenir.
                 Satıldığında AWAITING_EXPERTISE'e geçer (alıcıya gönderilmeden
                 önce partner mağazada doğrulanır).
    AUCTION:     Saat müzayedeye çıkmadan ÖNCE ekspertize gitmek zorunda.
                 İlan PENDING_PRE_EXPERTISE'te bekler, eksper onaylayınca
                 SCHEDULED/LIVE'a geçer.
    """

    DIRECT_SALE = "direct_sale"
    AUCTION = "auction"


class WatchCondition(str, enum.Enum):
    NEW = "new"
    MINT = "mint"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"


class AIProcessingStatus(str, enum.Enum):
    """AI ajan boru hattının saat üzerindeki durumu.

    NONE     → Hiç işlenmemiş (örn. legacy ya da ajan pipeline'ı kapalıyken yaratılmış).
    QUEUED   → Worker'ın görmesi bekleniyor.
    PROCESSING → Bir worker bu saati claim etti, ajanları çalıştırıyor.
    DONE     → Tüm ajanlar tamamlandı.
    FAILED   → Bir ajan/aşama hata verdi; manuel inceleme veya yeniden kuyruğa alma gerek.
    """

    NONE = "none"
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


class Watch(Base, TimestampMixin):
    __tablename__ = "watches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    brand: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    model: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    reference_number: Mapped[str] = mapped_column(
        String(60), index=True, nullable=False
    )
    # Year ZORUNLU — AI değerlemesi için birincil kriter (model + yıl).
    # Eski kayıtlarda NULL kalmış olabilir; migration backfill ile doldurulur.
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    serial_number: Mapped[str | None] = mapped_column(String(80))
    box_papers: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    condition: Mapped[WatchCondition] = mapped_column(
        SAEnum(WatchCondition, name="watch_condition"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    seo_description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[WatchStatus] = mapped_column(
        SAEnum(WatchStatus, name="watch_status"),
        default=WatchStatus.DRAFT,
        nullable=False,
    )
    slug: Mapped[str] = mapped_column(
        String(220), unique=True, index=True, nullable=False
    )
    # İlan tipi — DIRECT_SALE vs AUCTION. Workflow bu kolona göre yönlendirilir.
    # Legacy kayıtlar AUCTION default'una düşer (geriye dönük güvenli).
    listing_type: Mapped[ListingType] = mapped_column(
        SAEnum(ListingType, name="listing_type"),
        default=ListingType.AUCTION,
        nullable=False,
        index=True,
    )
    # DIRECT_SALE için satıcının belirlediği sabit asking_price.
    # AUCTION için NULL (fiyat Auction tablosunda yönetilir).
    asking_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    # Fiziksel teslimat takip kodu — saatin partner mağazaya tesliminde
    # operasyon ekibi tarafından doğrulanır. Format: MYR-XXXXXX (6 hex).
    delivery_code: Mapped[str | None] = mapped_column(
        String(16), unique=True, index=True
    )
    ai_processing_status: Mapped[AIProcessingStatus] = mapped_column(
        SAEnum(AIProcessingStatus, name="ai_processing_status"),
        default=AIProcessingStatus.NONE,
        nullable=False,
        index=True,
    )
    ai_processing_error: Mapped[str | None] = mapped_column(Text)

    seller: Mapped[User] = relationship(back_populates="watches", lazy="joined")
    images: Mapped[list[WatchImage]] = relationship(
        back_populates="watch",
        order_by="WatchImage.sort_order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    auction: Mapped[Auction | None] = relationship(
        back_populates="watch", uselist=False, lazy="selectin"
    )
    certificate: Mapped[AuthenticityCertificate | None] = relationship(
        back_populates="watch", uselist=False, lazy="selectin"
    )
    valuations: Mapped[list[AIValuation]] = relationship(back_populates="watch")


class WatchImage(Base):
    __tablename__ = "watch_images"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    watch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("watches.id", ondelete="CASCADE"),
        index=True,
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    watch: Mapped[Watch] = relationship(back_populates="images")
