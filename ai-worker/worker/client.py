"""Miyaris backend için HTTP client.

X-Service-Key kanalını kullanır — kullanıcı endpoint'lerinden bağımsız.
"""
from __future__ import annotations

import logging

import httpx

from worker.config import get_settings
from worker.types import SEOResult, ValuationResult, WatchData

logger = logging.getLogger(__name__)


class MiyarisClient:
    def __init__(self):
        settings = get_settings()
        self._client = httpx.Client(
            base_url=settings.MIYARIS_API_URL,
            headers={"X-Service-Key": settings.SERVICE_API_KEY},
            timeout=settings.HTTP_TIMEOUT_SECONDS,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "MiyarisClient":
        return self

    def __exit__(self, *args) -> None:
        self.close()

    def fetch_queued(self, limit: int = 5) -> list[WatchData]:
        r = self._client.get(
            "/api/v1/service/watches/queued", params={"limit": limit}
        )
        r.raise_for_status()
        return [
            WatchData(
                id=w["id"],
                brand=w["brand"],
                model=w["model"],
                reference_number=w["reference_number"],
                year=w["year"],
                condition=w["condition"],
                box_papers=w["box_papers"],
                description=w["description"],
            )
            for w in r.json()
        ]

    def claim(self, watch_id: str) -> bool:
        r = self._client.post(
            f"/api/v1/service/watches/{watch_id}/start-processing"
        )
        r.raise_for_status()
        return bool(r.json().get("claimed", False))

    def submit_valuation(
        self, watch_id: str, valuation: ValuationResult, agent_version: str
    ) -> None:
        sources = {
            "comparables": [c.to_dict() for c in valuation.comparables],
        }
        r = self._client.post(
            f"/api/v1/service/watches/{watch_id}/valuation",
            json={
                "estimated_value_min": str(valuation.estimated_value_min),
                "estimated_value_max": str(valuation.estimated_value_max),
                "confidence_score": valuation.confidence_score,
                "sources": sources,
                "agent_version": agent_version,
                "raw_output": {"reasoning": valuation.reasoning},
            },
        )
        r.raise_for_status()

    def submit_seo(self, watch_id: str, seo: SEOResult) -> None:
        r = self._client.post(
            f"/api/v1/service/watches/{watch_id}/seo-description",
            json={"seo_description": seo.seo_description},
        )
        r.raise_for_status()

    def complete(
        self, watch_id: str, *, success: bool, error: str | None = None
    ) -> None:
        r = self._client.post(
            f"/api/v1/service/watches/{watch_id}/complete",
            json={"success": success, "error_message": error},
        )
        r.raise_for_status()
