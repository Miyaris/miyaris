"""Admin/Expert moderasyon iş mantığı.

State machine (her üç giriş durumu da aynı verdict tablosuna gider):
  PENDING_REVIEW          (legacy)
  PENDING_PRE_EXPERTISE   (yeni AUCTION akışı — müzayededen önce ekspertiz)
  AWAITING_EXPERTISE      (yeni DIRECT_SALE akışı — satıştan sonra ekspertiz)

Verdict'ler:
  AUTHENTIC      → ACTIVE
  SERVICE_PARTS  → ACTIVE  (servis parçalı, satılır)
  NOT_AUTHENTIC  → REJECTED + SATICI HESABI ASKIDA
  INCONCLUSIVE   → REJECTED
  reject(reason) → REJECTED (sertifikasız)

NOT_AUTHENTIC (SAHTE) verdict KALICI BAN tetikler — satıcının User.is_active
False olur. Bu sahteciliğe karşı tek tetik mekanizmasıdır.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.certificate import AuthenticityCertificate, AuthenticityVerdict
from app.models.user import User
from app.models.watch import Watch, WatchStatus
from app.schemas.admin import CertificateCreate, RejectRequest
from app.utils.exceptions import ConflictError, NotFoundError

# Verdict → Watch state geçiş tablosu
_VERDICT_TO_STATUS: dict[AuthenticityVerdict, WatchStatus] = {
    AuthenticityVerdict.AUTHENTIC: WatchStatus.ACTIVE,
    AuthenticityVerdict.SERVICE_PARTS: WatchStatus.ACTIVE,
    AuthenticityVerdict.NOT_AUTHENTIC: WatchStatus.REJECTED,
    AuthenticityVerdict.INCONCLUSIVE: WatchStatus.REJECTED,
}

# Moderasyon kuyruğunda görünecek (ekspertiz bekleyen) tüm statüler
_MODERATION_QUEUE_STATUSES: tuple[WatchStatus, ...] = (
    WatchStatus.PENDING_REVIEW,
    WatchStatus.PENDING_PRE_EXPERTISE,
    WatchStatus.AWAITING_EXPERTISE,
)


async def list_pending(
    db: AsyncSession, limit: int = 50, offset: int = 0
) -> list[Watch]:
    """Moderasyon kuyruğu — ekspertiz bekleyen tüm saatler (PENDING_REVIEW,
    PENDING_PRE_EXPERTISE, AWAITING_EXPERTISE)."""
    result = await db.execute(
        select(Watch)
        .where(Watch.status.in_(_MODERATION_QUEUE_STATUSES))
        .options(
            selectinload(Watch.seller),
            selectinload(Watch.images),
            selectinload(Watch.valuations),
            selectinload(Watch.certificate),
        )
        .order_by(Watch.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def get_detail(db: AsyncSession, watch_id: uuid.UUID) -> Watch:
    """Admin/Expert için saat detayı — satıcı + valuation + certificate."""
    result = await db.execute(
        select(Watch)
        .where(Watch.id == watch_id)
        .options(
            selectinload(Watch.seller),
            selectinload(Watch.images),
            selectinload(Watch.valuations),
            selectinload(Watch.certificate),
        )
    )
    watch = result.scalar_one_or_none()
    if not watch:
        raise NotFoundError("Saat bulunamadı")
    return watch


async def issue_certificate(
    db: AsyncSession,
    watch_id: uuid.UUID,
    expert: User,
    payload: CertificateCreate,
) -> tuple[Watch, AuthenticityCertificate]:
    """Sertifika çıkar + saat statüsünü verdict'e göre güncelle (atomic)."""
    watch = await get_detail(db, watch_id)

    if watch.status not in _MODERATION_QUEUE_STATUSES:
        raise ConflictError(
            "Sadece ekspertiz bekleyen saatler için sertifika çıkarılabilir"
        )
    if watch.certificate is not None:
        raise ConflictError("Bu saat için zaten bir sertifika mevcut")

    cert = AuthenticityCertificate(
        watch_id=watch.id,
        expert_id=expert.id,
        verdict=payload.verdict,
        notes=payload.notes,
        pdf_url=str(payload.pdf_url),
    )
    db.add(cert)

    # Verdict → status geçişi (state machine)
    watch.status = _VERDICT_TO_STATUS[payload.verdict]

    # SAHTECİLİKLE MÜCADELE — NOT_AUTHENTIC (sahte) verdict, satıcının
    # hesabını süresiz askıya alır. Tek transaction'da atomic uygulanır.
    if payload.verdict == AuthenticityVerdict.NOT_AUTHENTIC:
        # seller eager-loaded (get_detail'de selectinload var)
        watch.seller.is_active = False

    await db.commit()
    await db.refresh(watch)
    await db.refresh(cert)
    return watch, cert


async def reject_watch(
    db: AsyncSession,
    watch_id: uuid.UUID,
    admin: User,  # noqa: ARG001 — ileride audit log için
    payload: RejectRequest,
) -> Watch:
    """Sertifikasız doğrudan red — fiziksel saat gelmemiş, duplicate ilan vb."""
    watch = await get_detail(db, watch_id)

    if watch.status not in _MODERATION_QUEUE_STATUSES:
        raise ConflictError("Sadece ekspertiz bekleyen saatler reddedilebilir")

    watch.status = WatchStatus.REJECTED
    # Red sebebini description sonuna ekle (basit; ileride ayrı audit tablosu)
    watch.ai_processing_error = f"[ADMIN_REJECT] {payload.reason}"

    await db.commit()
    await db.refresh(watch)
    return watch
