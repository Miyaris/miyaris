from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.auction import Auction


class EscrowStatus(str, enum.Enum):
    PENDING_PAYMENT = "pending_payment"
    FUNDED = "funded"
    AWAITING_AUTHENTICATION = "awaiting_authentication"
    AUTHENTICATED = "authenticated"
    SHIPPED_TO_BUYER = "shipped_to_buyer"
    DELIVERED = "delivered"
    RELEASED = "released"
    REFUNDED = "refunded"
    DISPUTED = "disputed"


class DeliveryMethod(str, enum.Enum):
    """Alıcının seçtiği teslimat yöntemi — escrow oluşurken set edilir."""

    SHIPPING = "shipping"            # Sigortalı kargo, alıcı adresine
    STORE_PICKUP = "store_pickup"    # Anlaşmalı mağazadan teslim


class PaymentMethod(str, enum.Enum):
    """Alıcının ödeme yöntemi.

    YASAL: Kredi kartına surcharge yok. BANK_TRANSFER buyer için %2.5 EFT
    indirimi sağlar (kredi kartı işlem maliyetinin alıcıya yansıması).
    """

    CREDIT_CARD = "credit_card"
    BANK_TRANSFER = "bank_transfer"


class EscrowTransaction(Base, TimestampMixin):
    __tablename__ = "escrow_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    auction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auctions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    platform_fee: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[EscrowStatus] = mapped_column(
        SAEnum(EscrowStatus, name="escrow_status"),
        default=EscrowStatus.PENDING_PAYMENT,
        nullable=False,
    )
    # Alıcının teslimat seçimi: SHIPPING veya STORE_PICKUP.
    # NULL = henüz seçim yapılmamış (ör. scheduler escrow oluşturduğunda).
    # Buy-now akışında doğrudan set edilir; auction-win akışında fund anında.
    delivery_method: Mapped[DeliveryMethod | None] = mapped_column(
        SAEnum(DeliveryMethod, name="delivery_method"),
    )
    # Ödeme yöntemi: CREDIT_CARD veya BANK_TRANSFER.
    # BANK_TRANSFER → discount_amount = amount * 0.025 (EFT/Havale indirimi)
    payment_method: Mapped[PaymentMethod | None] = mapped_column(
        SAEnum(PaymentMethod, name="payment_method"),
    )
    # Standart fiyattan düşülen indirim (EFT seçilirse). 0 = indirim yok.
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0"), nullable=False
    )
    payment_provider_ref: Mapped[str | None] = mapped_column(String(120))
    funded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Sahtekarlik onleme akisi —————————————————————————————————————————
    # Satici kargoya verirken kurcalama izi gosteren muhurlu kutu fotografi.
    seller_seal_photo_url: Mapped[str | None] = mapped_column(String(600))
    seller_seal_uploaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    # Alici paket acma anini 60 saniyelik videoyla kaydeder.
    buyer_unboxing_video_url: Mapped[str | None] = mapped_column(String(600))
    buyer_unboxing_uploaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    # Alici muhrun saglam mi kirik mi oldugunu beyan eder.
    # NULL = henuz beyan yok | True = saglam (akis devam)
    # False = kirik (escrow DISPUTED durumuna gecer, iade tetiklenir)
    seal_intact: Mapped[bool | None] = mapped_column(Boolean)

    auction: Mapped[Auction] = relationship(back_populates="escrow")
