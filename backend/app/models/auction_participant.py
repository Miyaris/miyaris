"""AuctionParticipant — kullanıcının bir müzayedeye katılım kaydı.

Her satır (user_id, auction_id) çiftine özel. deposit_paid=True olan
kullanıcı o müzayedede teklif verebilir; False ise bid_service'in guard'ı
403 reject eder.

Provizyon ödeme modeli: kart üzerinde 1000 TL bloke alınır (3D Secure).
- Kullanıcı kazanmazsa: bloke anında kaldırılır
- Kullanıcı kazanır ve satışı tamamlarsa: bloke kaldırılır
- Kullanıcı kazanır ama ödemeyi yapmazsa: bloke tahsil edilir (irat)
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.auction import Auction
    from app.models.user import User


class AuctionParticipant(Base, TimestampMixin):
    """Bir kullanıcının bir müzayedeye katılım + kapora durumu."""

    __tablename__ = "auction_participants"
    __table_args__ = (
        UniqueConstraint(
            "auction_id", "user_id", name="uq_participant_auction_user"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    auction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auctions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    # Kapora tutarı — auction.required_deposit_amount kayıt anında snapshot
    deposit_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False
    )
    deposit_paid: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )
    deposit_paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    # Ödeme sağlayıcı referansı (iyzico/PayTR transaction ID).
    # Mock akışta NULL — gerçek POS entegrasyonu Faz 2'de yapılacak.
    deposit_provider_ref: Mapped[str | None] = mapped_column(String(80))

    auction: Mapped[Auction] = relationship(lazy="joined")
    user: Mapped[User] = relationship(lazy="joined")
