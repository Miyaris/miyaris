import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auction import Auction, AuctionStatus
from app.models.bid import Bid
from app.models.user import User
from app.models.watch import Watch
from app.schemas.bid import BidCreate
from app.utils.exceptions import ConflictError, ForbiddenError, NotFoundError

# Anti-sniping: son 5 dk'da gelen teklif bitiş süresini 5 dk uzatır
ANTI_SNIPING_WINDOW = timedelta(minutes=5)
# Bu tutarın üstündeki teklifler için KYC zorunlu (USD)
KYC_REQUIRED_AMOUNT = Decimal("3000")


def bidder_alias(bidder_id: uuid.UUID) -> str:
    """Anonim ama deterministik bidder etiketi.

    SHA-256(uuid_str)[:6] uppercase. Aynı kullanıcı her zaman aynı kısaltmayı
    alır → "Bu Üye sürekli teklif veriyor" sezgisi korunur, fakat UUID veya
    ad/soyad API yanıtlarına sızmaz. Farklı UUID'ler farklı kısaltma alır
    (6-hex collision ihtimali ~1 / 16M).
    """
    h = hashlib.sha256(str(bidder_id).encode("utf-8")).hexdigest()[:6].upper()
    return f"Üye #{h}"


async def place_bid(
    db: AsyncSession,
    auction_id: uuid.UUID,
    bidder: User,
    payload: BidCreate,
) -> Bid:
    # Auction satırını FOR UPDATE ile kilitle — eşzamanlı tekliflere karşı
    # serileştirme. Kilit olmadan iki teklif aynı `current_price`'ı okuyup
    # ikisi de minimum-artış kontrolünü geçebilir, sonra commit sırasına göre
    # DÜŞÜK teklif yüksek olanın üstüne yazabilir (lost update). FOR UPDATE
    # ile ikinci teklif birincinin commit'ini bekler ve güncel fiyatı görür.
    # `watch` ilişkisi selectinload ile ayrı sorguda yüklenir → FOR UPDATE
    # yalnızca auctions satırına uygulanır (JOIN kilidi sorunu olmaz).
    auction = (
        await db.execute(
            select(Auction)
            .where(Auction.id == auction_id)
            .options(selectinload(Auction.watch))
            .with_for_update()
        )
    ).scalar_one_or_none()
    if not auction:
        raise NotFoundError("Açık artırma bulunamadı")

    now = datetime.now(timezone.utc)

    # Otomatik LIVE'a geç (eğer zamanı geldiyse ama scheduler henüz dokunmadıysa)
    if auction.status == AuctionStatus.SCHEDULED and auction.starts_at <= now:
        auction.status = AuctionStatus.LIVE

    if auction.status != AuctionStatus.LIVE:
        raise ConflictError("Açık artırma şu anda teklif almıyor")

    end_time = auction.extended_until or auction.ends_at
    if now > end_time:
        raise ConflictError("Açık artırma süresi doldu")

    if auction.watch.seller_id == bidder.id:
        raise ForbiddenError("Kendi saatinize teklif veremezsiniz")

    # Anti-troll kapora guard'ı — kullanıcı bu müzayedeye 1000 TL kapora
    # ödemediyse teklif veremez. Frontend bunu önden kontrol eder ama
    # backend de defense-in-depth olarak doğrular.
    from app.services.deposit_service import has_paid_deposit

    paid = await has_paid_deposit(db, auction.id, bidder.id)
    if not paid:
        raise ForbiddenError(
            "Teklif vermeden önce müzayede kaporasını ödemelisiniz"
        )

    min_required = auction.current_price + auction.min_bid_increment
    if payload.amount < min_required:
        raise ConflictError(f"Minimum teklif: ${min_required}")

    # "Hemen Al" tavanı — buy_it_now_price tanımlı ise teklif (ve proxy tavan)
    # buna ulaşmamalı. Bu seviyeye gelen alıcı "Hemen Al" akışını kullanmalı
    # (escrow + teslimat + ödeme yöntemi seçimi orada yapılır). Proxy
    # max_proxy_amount'ı da tavan altında tutuyoruz ki otomatik teklif
    # mekanizması sınırı aşmasın.
    if auction.buy_it_now_price is not None:
        if payload.amount >= auction.buy_it_now_price:
            raise ConflictError(
                f"Teklif ${auction.buy_it_now_price} 'Hemen Al' fiyatına eşit "
                "veya üstünde olamaz — bu seviyede 'Hemen Al' ile satın alın."
            )
        if (
            payload.is_proxy
            and payload.max_proxy_amount is not None
            and payload.max_proxy_amount >= auction.buy_it_now_price
        ):
            raise ConflictError(
                f"Proxy tavan ${auction.buy_it_now_price} 'Hemen Al' fiyatının "
                "altında olmalı — aksi halde otomatik teklif sınırı aşar."
            )

    if payload.amount >= KYC_REQUIRED_AMOUNT and not bidder.kyc_verified:
        raise ForbiddenError(
            f"${KYC_REQUIRED_AMOUNT} üstü teklifler için KYC doğrulaması gerekli"
        )

    if payload.is_proxy and (
        payload.max_proxy_amount is None or payload.max_proxy_amount < payload.amount
    ):
        raise ConflictError(
            "Proxy bid için max_proxy_amount belirtilmeli ve amount'tan büyük olmalı"
        )

    bid = Bid(
        auction_id=auction.id,
        bidder_id=bidder.id,
        amount=payload.amount,
        is_proxy=payload.is_proxy,
        max_proxy_amount=payload.max_proxy_amount,
    )
    db.add(bid)
    auction.current_price = payload.amount

    # Anti-sniping
    if end_time - now < ANTI_SNIPING_WINDOW:
        auction.extended_until = now + ANTI_SNIPING_WINDOW

    await db.commit()
    await db.refresh(bid)
    return bid


async def list_bids_for_auction(
    db: AsyncSession, auction_id: uuid.UUID, limit: int = 50
) -> list[Bid]:
    result = await db.execute(
        select(Bid)
        .where(Bid.auction_id == auction_id)
        .order_by(Bid.placed_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
