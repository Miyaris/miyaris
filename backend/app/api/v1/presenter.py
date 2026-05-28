"""Presenter (canlı müzayede sunucusu) endpoint'leri — oturum modeli.

Yapı:
  * POST /presenter/sessions               — yeni oturum aç
  * GET  /presenter/sessions               — kendi oturumlarım (hub)
  * GET  /presenter/sessions/{id}          — oturum detayı + lot'lar
  * POST /presenter/sessions/{id}/lots     — oturuma saat ekle
  * POST /presenter/sessions/{id}/start    — oturumu canlıya al
  * POST /presenter/sessions/{id}/advance  — sıradaki saate geç (mevcudu kapat)
  * POST /presenter/sessions/{id}/finalize-current — SATTIM (mevcut lot biter)
  * POST /presenter/sessions/{id}/extend   — +30sn mevcut lot için
  * POST /presenter/sessions/{id}/end      — oturumu manuel kapat

Public:
  * GET /auction-sessions          — listede gözüken aktif oturumlar
  * GET /auction-sessions/{id}     — public detay (lot listesi)
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_presenter
from app.models.auction import Auction
from app.models.presenter_session import PresenterSession
from app.models.user import User
from app.schemas.presenter import (
    PresenterLotCreate,
    PresenterLotListItem,
    PresenterSessionCreate,
    PresenterSessionDetail,
    PresenterSessionListItem,
    PublicSessionDetail,
    PublicSessionListItem,
)
from app.services import presenter_service
from app.utils.pagination import PaginationParams, pagination_dep
from app.websockets.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/presenter",
    tags=["presenter"],
    dependencies=[Depends(get_current_presenter)],
)

public_router = APIRouter(prefix="/auction-sessions", tags=["auction-sessions"])


# ============================================================================
# DTO map helpers
# ============================================================================


def _lot_to_item(lot: Auction) -> PresenterLotListItem:
    images = lot.watch.images
    primary = next((i.url for i in images if i.is_primary), None) or (
        images[0].url if images else None
    )
    return PresenterLotListItem(
        auction_id=lot.id,
        watch_id=lot.watch.id,
        brand=lot.watch.brand,
        model=lot.watch.model,
        reference_number=lot.watch.reference_number,
        primary_image_url=primary,
        starting_price=lot.starting_price,
        current_price=lot.current_price,
        buy_it_now_price=lot.buy_it_now_price,
        status=lot.status,
        bid_count=len(lot.bids) if lot.bids else 0,
    )


def _session_to_list_item(session: PresenterSession) -> PresenterSessionListItem:
    cover: str | None = None
    if session.lots:
        first_lot_with_images = next(
            (lot for lot in session.lots if lot.watch.images), None
        )
        if first_lot_with_images is not None:
            images = first_lot_with_images.watch.images
            cover = next(
                (i.url for i in images if i.is_primary), None
            ) or (images[0].url if images else None)
    return PresenterSessionListItem(
        id=session.id,
        name=session.name,
        description=session.description,
        scheduled_at=session.scheduled_at,
        status=session.status,
        is_hidden=session.is_hidden,
        lot_count=len(session.lots) if session.lots else 0,
        cover_image_url=cover,
    )


def _session_to_detail(session: PresenterSession) -> PresenterSessionDetail:
    return PresenterSessionDetail(
        id=session.id,
        name=session.name,
        description=session.description,
        scheduled_at=session.scheduled_at,
        status=session.status,
        is_hidden=session.is_hidden,
        presenter_name=session.presenter.full_name,
        lots=[
            _lot_to_item(lot)
            for lot in sorted(session.lots, key=lambda a: a.created_at)
        ],
    )


def _session_to_public_list(session: PresenterSession) -> PublicSessionListItem:
    cover: str | None = None
    if session.lots:
        first_lot = next(
            (lot for lot in session.lots if lot.watch.images), None
        )
        if first_lot is not None:
            images = first_lot.watch.images
            cover = next(
                (i.url for i in images if i.is_primary), None
            ) or (images[0].url if images else None)
    return PublicSessionListItem(
        id=session.id,
        name=session.name,
        scheduled_at=session.scheduled_at,
        status=session.status,
        presenter_name=session.presenter.full_name,
        lot_count=len(session.lots) if session.lots else 0,
        cover_image_url=cover,
    )


def _session_to_public_detail(session: PresenterSession) -> PublicSessionDetail:
    return PublicSessionDetail(
        id=session.id,
        name=session.name,
        description=session.description,
        scheduled_at=session.scheduled_at,
        status=session.status,
        presenter_name=session.presenter.full_name,
        lots=[
            _lot_to_item(lot)
            for lot in sorted(session.lots, key=lambda a: a.created_at)
        ],
    )


# ============================================================================
# Presenter endpoints
# ============================================================================


class ExtendRequest(BaseModel):
    seconds: int = Field(default=30, ge=1, le=600)


@router.post(
    "/sessions",
    response_model=PresenterSessionListItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_session_endpoint(
    payload: PresenterSessionCreate,
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """Yeni oturum aç (PLANNING)."""
    session = await presenter_service.create_session(db, user, payload)
    # Lots boş — re-fetch'e gerek yok, list item DTO'su nesneyi kabul eder.
    return _session_to_list_item(session)


@router.get("/sessions", response_model=list[PresenterSessionListItem])
async def list_sessions(
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """Kendi oturumlarım — hub için."""
    sessions = await presenter_service.list_my_sessions(
        db, user, limit=pagination.limit, offset=pagination.offset
    )
    return [_session_to_list_item(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=PresenterSessionDetail)
async def get_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """Oturum detayı — sahibi olmayan presenter 403, var olmayan 404."""
    session = await presenter_service.get_my_session(db, session_id, user)
    return _session_to_detail(session)


@router.post(
    "/sessions/{session_id}/lots",
    response_model=PresenterLotListItem,
    status_code=status.HTTP_201_CREATED,
)
async def add_lot_endpoint(
    session_id: uuid.UUID,
    payload: PresenterLotCreate,
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """Oturuma yeni saat lot'u ekle. PLANNING veya LIVE oturumlarda izinli."""
    lot = await presenter_service.add_lot(db, session_id, user, payload)
    # Eager-load watch.images için detay session fetch
    session = await presenter_service.get_my_session(db, session_id, user)
    target = next((a for a in session.lots if a.id == lot.id), lot)
    return _lot_to_item(target)


@router.post(
    "/sessions/{session_id}/start",
    response_model=PresenterSessionDetail,
)
async def start_session_endpoint(
    session_id: uuid.UUID,
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """Oturumu canlıya al — PLANNING → LIVE, ilk lot LIVE."""
    await presenter_service.start_session(db, session_id, user)
    session = await presenter_service.get_my_session(db, session_id, user)
    return _session_to_detail(session)


@router.post(
    "/sessions/{session_id}/advance",
    response_model=PresenterSessionDetail,
)
async def advance_endpoint(
    session_id: uuid.UUID,
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """Sıradaki saate geç — mevcudu kapatır, sıradakini LIVE'a alır.

    Sıradaki lot yoksa oturum ENDED'a geçer.
    """
    await presenter_service.advance_to_next_lot(db, session_id, user)
    session = await presenter_service.get_my_session(db, session_id, user)
    # Yeni LIVE olan lot için WS broadcast (varsa)
    current = await presenter_service.get_current_lot(session)
    if current is not None:
        await manager.broadcast(
            str(current.id),
            {
                "type": "auction.started",
                "data": {"status": current.status.value},
            },
        )
    return _session_to_detail(session)


@router.post(
    "/sessions/{session_id}/finalize-current",
    response_model=PresenterSessionDetail,
)
async def finalize_current_endpoint(
    session_id: uuid.UUID,
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """SATTIM — mevcut LIVE lot için escrow + ENDED."""
    lot = await presenter_service.finalize_current_lot(db, session_id, user)
    session = await presenter_service.get_my_session(db, session_id, user)
    await manager.broadcast(
        str(lot.id),
        {
            "type": "auction.ended",
            "data": {
                "sold": lot.winning_bid_id is not None,
                "final_price": str(lot.current_price)
                if lot.winning_bid_id is not None
                else None,
                "winning_bid_id": str(lot.winning_bid_id)
                if lot.winning_bid_id
                else None,
                "via_presenter": True,
            },
        },
    )
    return _session_to_detail(session)


@router.post(
    "/sessions/{session_id}/extend",
    response_model=PresenterSessionDetail,
)
async def extend_endpoint(
    session_id: uuid.UUID,
    payload: ExtendRequest = ExtendRequest(),
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """+saniye mevcut LIVE lot için."""
    current = await presenter_service.extend_current_lot(
        db, session_id, user, seconds=payload.seconds
    )
    await manager.broadcast(
        str(current.id),
        {
            "type": "bid.placed",
            "data": {
                "auction": {
                    "current_price": str(current.current_price),
                    "extended_until": current.extended_until.isoformat()
                    if current.extended_until
                    else None,
                    "bid_count": len(current.bids) if current.bids else 0,
                    "status": current.status.value,
                },
            },
        },
    )
    session = await presenter_service.get_my_session(db, session_id, user)
    return _session_to_detail(session)


@router.post(
    "/sessions/{session_id}/end",
    response_model=PresenterSessionDetail,
)
async def end_session_endpoint(
    session_id: uuid.UUID,
    user: User = Depends(get_current_presenter),
    db: AsyncSession = Depends(get_db),
):
    """Oturumu manuel kapat (LIVE → ENDED)."""
    await presenter_service.end_session(db, session_id, user)
    session = await presenter_service.get_my_session(db, session_id, user)
    return _session_to_detail(session)


# ============================================================================
# Public endpoints
# ============================================================================


@public_router.get("", response_model=list[PublicSessionListItem])
async def list_public_sessions_endpoint(
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_dep),
):
    """Public — aktif (planning + live) oturumlar."""
    sessions = await presenter_service.list_public_sessions(
        db, limit=pagination.limit, offset=pagination.offset
    )
    return [_session_to_public_list(s) for s in sessions]


@public_router.get("/{session_id}", response_model=PublicSessionDetail)
async def get_public_session_endpoint(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Public oturum detayı + lot listesi."""
    session = await presenter_service.get_public_session(db, session_id)
    return _session_to_public_detail(session)
