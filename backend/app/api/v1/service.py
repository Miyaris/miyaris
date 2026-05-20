"""Servisler arası endpoint'ler — yalnızca X-Service-Key ile erişilebilir.

Kullanıcı JWT'siyle gelen istekler 401/503 alır. Bu router AI worker, BBB
finans ajanları ve gelecekte eklenecek diğer iç süreçler tarafından kullanılır.
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_service_token
from app.schemas.service import (
    ServiceClaimResponse,
    ServiceCompleteRequest,
    ServiceSEOUpdate,
    ServiceValuationCreate,
    ServiceWatchData,
)
from app.services import service_pipeline
from app.utils.pagination import PaginationParams, pagination_dep

# Tüm endpoint'lere otomatik X-Service-Key zorunluluğu — router-level dependency
router = APIRouter(
    prefix="/service",
    tags=["service"],
    dependencies=[Depends(require_service_token)],
)


@router.get("/watches/queued", response_model=list[ServiceWatchData])
async def list_queued(
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """AI ajan kuyruğundaki bir sonraki batch'i döndür."""
    watches = await service_pipeline.list_queued(
        db, limit=pagination.limit, offset=pagination.offset
    )
    return [ServiceWatchData.model_validate(w) for w in watches]


@router.post(
    "/watches/{watch_id}/start-processing",
    response_model=ServiceClaimResponse,
)
async def claim_watch(
    watch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Atomic claim — başka worker aynı saati alamaz."""
    claimed = await service_pipeline.claim(db, watch_id)
    return ServiceClaimResponse(
        watch_id=watch_id,
        claimed=claimed,
        detail=None if claimed else "Saat başka bir worker tarafından alındı",
    )


@router.post(
    "/watches/{watch_id}/valuation",
    status_code=status.HTTP_201_CREATED,
)
async def submit_valuation(
    watch_id: uuid.UUID,
    payload: ServiceValuationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Valuation Agent çıktısını kaydet."""
    val = await service_pipeline.submit_valuation(db, watch_id, payload)
    return {"id": str(val.id), "watch_id": str(val.watch_id)}


@router.post("/watches/{watch_id}/seo-description")
async def submit_seo(
    watch_id: uuid.UUID,
    payload: ServiceSEOUpdate,
    db: AsyncSession = Depends(get_db),
):
    """SEO Writer Agent çıktısını saatin seo_description alanına yaz."""
    await service_pipeline.submit_seo(db, watch_id, payload)
    return {"ok": True}


@router.post("/watches/{watch_id}/complete")
async def complete(
    watch_id: uuid.UUID,
    payload: ServiceCompleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Pipeline'ın tamamını DONE/FAILED olarak işaretle."""
    watch = await service_pipeline.complete(db, watch_id, payload)
    return {
        "watch_id": str(watch.id),
        "ai_processing_status": watch.ai_processing_status.value,
    }
