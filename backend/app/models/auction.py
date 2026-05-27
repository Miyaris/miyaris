from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.bid import Bid
    from app.models.escrow import EscrowTransaction
    from app.models.watch import Watch


class AuctionStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Auction(Base, TimestampMixin):
    __tablename__ = "auctions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    watch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("watches.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    starting_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    reserve_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    # "Hemen Al" fiyatı — opsiyonel; set ise alıcı bid beklemeden anında satın alabilir
    buy_it_now_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    min_bid_increment: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("50"), nullable=False
    )
    current_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    ends_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, nullable=False
    )
    extended_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[AuctionStatus] = mapped_column(
        SAEnum(AuctionStatus, name="auction_status"),
        default=AuctionStatus.SCHEDULED,
        nullable=False,
    )
    winning_bid_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bids.id", use_alter=True, name="fk_auction_winning_bid"),
    )
    # Admin tarafından "sayfadan kaldırılmış" müzayedeler — public liste/detay
    # endpoint'lerinden gizlenir ama DB'de durur (teklif geçmişi, escrow, audit
    # trail korunur). Admin paneli "Gizli" sekmesinden geri getirilebilir.
    is_hidden: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )

    watch: Mapped[Watch] = relationship(back_populates="auction", lazy="joined")
    bids: Mapped[list[Bid]] = relationship(
        back_populates="auction",
        foreign_keys="Bid.auction_id",
        order_by="Bid.placed_at.desc()",
        lazy="selectin",
    )
    escrow: Mapped[EscrowTransaction | None] = relationship(
        back_populates="auction", uselist=False
    )

    @property
    def effective_end(self) -> datetime:
        return self.extended_until or self.ends_at
