"""Tüm modelleri burada import etmek Alembic'in autogenerate için kritik."""

from app.models.ai_valuation import AIValuation
from app.models.auction import Auction, AuctionStatus
from app.models.base import Base
from app.models.bid import Bid
from app.models.certificate import AuthenticityCertificate, AuthenticityVerdict
from app.models.escrow import (
    DeliveryMethod,
    EscrowStatus,
    EscrowTransaction,
    PaymentMethod,
)
from app.models.user import User, UserRole
from app.models.watch import (
    AIProcessingStatus,
    ListingType,
    Watch,
    WatchCondition,
    WatchImage,
    WatchStatus,
)

__all__ = [
    "Base",
    "User",
    "UserRole",
    "Watch",
    "WatchImage",
    "WatchStatus",
    "WatchCondition",
    "AIProcessingStatus",
    "ListingType",
    "Auction",
    "AuctionStatus",
    "Bid",
    "EscrowTransaction",
    "EscrowStatus",
    "DeliveryMethod",
    "PaymentMethod",
    "AuthenticityCertificate",
    "AuthenticityVerdict",
    "AIValuation",
]
