"""Kapora (deposit) servis katmanı.

İş akışı:
  1. Kullanıcı /auctions/{id}/deposit POST eder
  2. Backend AuctionParticipant satırı yaratır veya günceller, deposit_paid=True
  3. (Gerçek POS entegrasyonu Faz 2'de) iyzico/PayTR ile pre-auth alınır,
     provider_ref kaydedilir
  4. bid_service.place_bid içinde guard: deposit_paid=True olmalı

MVP: ödeme akışı mock — endpoint çağrıldığında hemen paid=True olur.
İleride buraya gerçek payment provider entegrasyonu eklenecek.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.auction import Auction, AuctionStatus
from app.models.auction_participant import AuctionParticipant
from app.models.user import User
from app.utils.exceptions import APIError, ConflictError, NotFoundError


async def get_or_create_participant(
    db: AsyncSession,
    auction_id: uuid.UUID,
    user: User,
) -> AuctionParticipant:
    """Mevcut katılım kaydını döndür; yoksa boş (paid=False) bir tane yarat.

    `deposit_amount` auction.required_deposit_amount'tan kayıt anında
    snapshot alınır — auction sonradan tutar değiştirse bile katılımcının
    ödediği tutar değişmez.
    """
    auction = (
        await db.execute(select(Auction).where(Auction.id == auction_id))
    ).scalar_one_or_none()
    if auction is None:
        raise NotFoundError("Müzayede bulunamadı")

    existing = (
        await db.execute(
            select(AuctionParticipant).where(
                AuctionParticipant.auction_id == auction_id,
                AuctionParticipant.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    participant = AuctionParticipant(
        auction_id=auction_id,
        user_id=user.id,
        deposit_amount=auction.required_deposit_amount,
        deposit_paid=False,
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)
    return participant


async def has_paid_deposit(
    db: AsyncSession,
    auction_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    """Kullanıcı bu müzayedede kapora ödedi mi?

    bid_service.place_bid guard'ı bunu çağırır. Sıkı ve hızlı sorgu —
    sadece deposit_paid alanına bakar.
    """
    result = await db.execute(
        select(AuctionParticipant.deposit_paid).where(
            AuctionParticipant.auction_id == auction_id,
            AuctionParticipant.user_id == user_id,
            AuctionParticipant.deposit_paid == True,  # noqa: E712
        )
    )
    return result.scalar_one_or_none() is not None


async def pay_deposit(
    db: AsyncSession,
    auction_id: uuid.UUID,
    user: User,
    provider_ref: str | None = None,
) -> AuctionParticipant:
    """Kaporayı 'ödendi' olarak işaretle.

    MVP'de mock — sadece flag set'ler. Gerçek POS entegrasyonu Faz 2'de:
      * iyzico Pre-auth API çağrılır
      * Başarılıysa provider_ref (transaction_id) kaydedilir
      * Başarısızsa exception fırlatılır, paid=False kalır

    İş kuralları:
      * Aynı kullanıcı + aynı müzayede için 2. ödeme yok (zaten ödedi → no-op)
      * Müzayede ENDED/CANCELLED durumdaysa ödeme reddedilir
      * Saatin sahibi kendi müzayedesine kapora yatıramaz (anlamsız)
    """
    # Güvenlik gate: gerçek POS entegrasyonu yokken bu fonksiyon parayı
    # tahsil etmeden sadece deposit_paid=True yapar. Production'da açık
    # olursa herkes 0 TL ile teklif hakkı kazanır (anti-troll koruması
    # devre dışı). Bu yüzden prod'da mock varsayılan kapalı — bilinçli
    # olarak DEPOSIT_MOCK_ENABLED=true set'lenmedikçe reddedilir.
    settings = get_settings()
    mock_allowed = settings.APP_ENV != "production" or settings.DEPOSIT_MOCK_ENABLED
    if not mock_allowed:
        raise APIError(
            status_code=503,
            detail=(
                "Kapora ödeme sistemi henüz aktif değil. Lütfen daha sonra "
                "tekrar deneyin."
            ),
        )

    auction = (
        await db.execute(
            select(Auction).where(Auction.id == auction_id)
        )
    ).scalar_one_or_none()
    if auction is None:
        raise NotFoundError("Müzayede bulunamadı")
    if auction.status in (
        AuctionStatus.ENDED,
        AuctionStatus.COMPLETED,
        AuctionStatus.CANCELLED,
    ):
        raise ConflictError(
            "Bu müzayede artık kapora kabul etmiyor"
        )

    participant = await get_or_create_participant(db, auction_id, user)
    if participant.deposit_paid:
        # Idempotent — zaten ödenmiş, yeniden ücretlendirmeyiz
        return participant

    participant.deposit_paid = True
    participant.deposit_paid_at = datetime.now(timezone.utc)
    participant.deposit_provider_ref = provider_ref
    await db.commit()
    await db.refresh(participant)
    return participant
