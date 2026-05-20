"""AI ajan pipeline'ı için iç state machine yardımcıları.

Ana sözleşme: yalnızca service router buradan çağrı yapar — kullanıcı
endpoint'leri bu fonksiyonları doğrudan kullanmaz.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_valuation import AIValuation
from app.models.watch import AIProcessingStatus, Watch
from app.schemas.service import (
    ServiceCompleteRequest,
    ServiceSEOUpdate,
    ServiceValuationCreate,
)
from app.utils.exceptions import ConflictError, NotFoundError


async def list_queued(
    db: AsyncSession, limit: int = 5, offset: int = 0
) -> list[Watch]:
    result = await db.execute(
        select(Watch)
        .where(Watch.ai_processing_status == AIProcessingStatus.QUEUED)
        .order_by(Watch.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def claim(db: AsyncSession, watch_id: uuid.UUID) -> bool:
    """Atomic claim — yalnızca QUEUED'dan PROCESSING'e geçer.

    İki worker aynı anda claim ederse yalnızca biri başarılı olur (race-safe).
    """
    result = await db.execute(
        update(Watch)
        .where(
            Watch.id == watch_id,
            Watch.ai_processing_status == AIProcessingStatus.QUEUED,
        )
        .values(ai_processing_status=AIProcessingStatus.PROCESSING)
    )
    await db.commit()
    return (result.rowcount or 0) > 0


async def submit_valuation(
    db: AsyncSession, watch_id: uuid.UUID, payload: ServiceValuationCreate
) -> AIValuation:
    watch = (
        await db.execute(select(Watch).where(Watch.id == watch_id))
    ).scalar_one_or_none()
    if not watch:
        raise NotFoundError("Saat bulunamadı")
    if watch.ai_processing_status != AIProcessingStatus.PROCESSING:
        raise ConflictError(
            "Saat PROCESSING durumunda değil — önce claim edilmesi gerek"
        )

    valuation = AIValuation(
        watch_id=watch_id,
        estimated_value_min=payload.estimated_value_min,
        estimated_value_max=payload.estimated_value_max,
        confidence_score=payload.confidence_score,
        sources=payload.sources,
        agent_version=payload.agent_version,
        raw_output=payload.raw_output,
    )
    db.add(valuation)
    await db.commit()
    await db.refresh(valuation)
    return valuation


async def submit_seo(
    db: AsyncSession, watch_id: uuid.UUID, payload: ServiceSEOUpdate
) -> Watch:
    watch = (
        await db.execute(select(Watch).where(Watch.id == watch_id))
    ).scalar_one_or_none()
    if not watch:
        raise NotFoundError("Saat bulunamadı")
    if watch.ai_processing_status != AIProcessingStatus.PROCESSING:
        raise ConflictError(
            "Saat PROCESSING durumunda değil — önce claim edilmesi gerek"
        )
    watch.seo_description = payload.seo_description
    await db.commit()
    await db.refresh(watch)
    return watch


async def complete(
    db: AsyncSession, watch_id: uuid.UUID, payload: ServiceCompleteRequest
) -> Watch:
    watch = (
        await db.execute(select(Watch).where(Watch.id == watch_id))
    ).scalar_one_or_none()
    if not watch:
        raise NotFoundError("Saat bulunamadı")
    if watch.ai_processing_status != AIProcessingStatus.PROCESSING:
        raise ConflictError("Saat PROCESSING durumunda değil")

    if payload.success:
        watch.ai_processing_status = AIProcessingStatus.DONE
        watch.ai_processing_error = None
    else:
        watch.ai_processing_status = AIProcessingStatus.FAILED
        watch.ai_processing_error = payload.error_message

    await db.commit()
    await db.refresh(watch)
    return watch
