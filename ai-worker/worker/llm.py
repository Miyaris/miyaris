"""LLM sürücü soyutlaması.

Worker artık piyasa fiyatları için **hiçbir hardcoded sözlük** kullanmaz:
gerçek değerleme yalnızca canlı LLM (Ollama, OpenAI vb.) ile yapılır. StubLLM
bu sözlük olmadan halüsinasyon engeline uyamaz, dolayısıyla bir geliştirme-modu
fallback'i olarak `confidence_score=0.3` ile geniş bir aralık döner ve üretim
ortamında Ollama bağlanmadığı sürece güvenilir DEĞİLDİR.
"""
from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from datetime import date
from typing import Literal

import httpx

from worker.config import get_settings

logger = logging.getLogger(__name__)

ResponseFormat = Literal["text", "json"]


class LLM(ABC):
    @abstractmethod
    def complete(
        self, system: str, user: str, *, response_format: ResponseFormat = "text"
    ) -> str: ...


class StubLLM(LLM):
    """Geliştirme-modu fallback. Gerçek piyasa verisi YOKTUR.

    Kasıtlı olarak çok düşük confidence (0.3) ve kabaca yıl-tabanlı (genel,
    marka-bağımsız) bir aralık döndürür. Üretim için **Ollama veya OpenAI
    sürücüsü zorunludur** — bu sınıf yalnızca dev/CI'da pipeline'ın çalıştığını
    test etmek için.

    Çıktıda kaynak ismi (Chrono24, eBay, ...) GEÇMEZ.
    """

    def complete(
        self, system: str, user: str, *, response_format: ResponseFormat = "text"
    ) -> str:
        if (
            response_format == "json"
            or "json" in system.lower()
            or "value range" in user.lower()
        ):
            # User prompt'tan SADECE Year'ı çek — yıl primary kriterimiz
            year = _extract_year(user)
            v_min, v_max = _year_based_estimate(year)

            return json.dumps(
                {
                    "estimated_value_min": v_min,
                    "estimated_value_max": v_max,
                    "confidence_score": 0.3,
                    "reasoning": (
                        "Bu değerleme StubLLM (geliştirme modu) tarafından "
                        "üretildi — gerçek piyasa verisine bağlı DEĞİL. "
                        "Üretim ortamında Ollama veya OpenAI sürücüsü, "
                        "saatin yılına ve referansına göre canlı ikinci el "
                        "piyasa verisinden gerçekçi bir aralık üretir. "
                        "Mevcut tahmin yalnızca yılın genel etkisini "
                        "yansıtır; satış kararına temel oluşturmaz."
                    ),
                }
            )

        # SEO writer cevabı — generic, kaynak ismi yok
        return (
            "Bu parça, üreticinin spor koleksiyonunun sabit referans noktası "
            "olan modelin son güncellemesini taşıyor. Kasanın orijinal yüzey "
            "işlemleri korunmuş; safir cam üzerinde mikroskobik dokunma izleri "
            "dışında müdahale yok. Dahili kalibre fabrika servis dönemini "
            "tamamlamış, kronometrik sapma günde +2/-1 saniye bandında "
            "ölçüldü.\n\n"
            "Bu referans, kutu ve orijinal kağıtlarıyla geldiğinde "
            "koleksiyon segmentinde nadir bir parçadır. Saatin tarihçesi, "
            "servis kayıtları ve resmi distribütör damgası, müzayede "
            "süresince Miyaris uzmanlarınca doğrulanır."
        )


def _extract_year(prompt: str) -> int | None:
    """Prompt'tan 'Year: 2022' satırını çek. Yoksa None."""
    import re

    m = re.search(r"Year:\s*(\d{4})", prompt)
    if not m:
        return None
    try:
        y = int(m.group(1))
        if 1900 <= y <= 2100:
            return y
    except ValueError:
        pass
    return None


def _year_based_estimate(year: int | None) -> tuple[int, int]:
    """Sadece yıl üzerinden çok genel bir aralık. Marka/model bilgisi yok —
    bu kasıtlı, çünkü hardcoded sözlüğümüz YOK ve halüsinasyon yapmıyoruz.

    Daha yeni saatler için biraz daha geniş bant; çok eski (vintage) saatler
    sürpriz değerler taşıdığı için bant da geniş. Düz, savunulamaz bir
    placeholder — production'da kullanılması için DEĞİL.
    """
    if year is None:
        # Hiç bilgi yok — savunulamaz geniş bant
        return (3_000, 25_000)

    current_year = date.today().year
    age = max(0, current_year - year)

    if age <= 3:
        return (5_000, 30_000)  # Yakın model — geniş ama orta-üst bant
    if age <= 10:
        return (3_500, 25_000)  # Modern ikinci el
    if age <= 30:
        return (2_500, 35_000)  # Vintage öncesi
    return (3_000, 50_000)  # Vintage — sürpriz değerler


class OllamaLLM(LLM):
    """Lokal Ollama sürücüsü — ücretsiz, GPU varsa hızlı."""

    def __init__(self, base_url: str, model: str, timeout: float = 120.0):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def complete(
        self, system: str, user: str, *, response_format: ResponseFormat = "text"
    ) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            # Sıkı determinizm — uydurma şansını minimize et
            "options": {"temperature": 0.2},
        }
        if response_format == "json":
            payload["format"] = "json"

        try:
            response = httpx.post(
                f"{self.base_url}/api/chat", json=payload, timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()["message"]["content"]
        except httpx.HTTPError as e:
            logger.exception("Ollama request failed")
            raise RuntimeError(f"Ollama hatası: {e}") from e


def get_llm() -> LLM:
    settings = get_settings()
    if settings.OLLAMA_BASE_URL:
        logger.info(
            "Using Ollama LLM at %s (model=%s)",
            settings.OLLAMA_BASE_URL,
            settings.OLLAMA_MODEL,
        )
        return OllamaLLM(settings.OLLAMA_BASE_URL, settings.OLLAMA_MODEL)
    logger.warning(
        "Using StubLLM — DEV MODE. Üretim için Ollama veya OpenAI bağlanmalı; "
        "stub gerçek piyasa verisi içermez."
    )
    return StubLLM()
