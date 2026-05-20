"""İki domain ajanı: ValuationAgent (canlı Chrono24 scraping) ve SEOWriterAgent.

ÖNEMLİ MİMARİ DEĞİŞİKLİK: ValuationAgent artık LLM'e fiyat tahmini için
DANIŞMAZ. Fiyatlar yalnızca `tools.fetch_chrono24_market_band` canlı araması
sonucundan gelir. LLM uydurma yapamaz — çünkü kararı LLM almıyor.

SEOWriterAgent hâlâ LLM kullanır (ilan metni yazma).
"""
from __future__ import annotations

import logging
import re
from decimal import Decimal

from worker.llm import LLM
from worker.tools import fetch_chrono24_market_band, fetch_comparables
from worker.types import (
    InsufficientMarketDataError,
    SEOResult,
    ValuationResult,
    WatchData,
)

logger = logging.getLogger(__name__)

# Source ismi sızıntısına karşı defense in depth
_SOURCE_LEAK_PATTERN = re.compile(
    r"\b(chrono\s*24|chrono24|ebay|watchcharts|bezel)\b", re.IGNORECASE
)


def _sanitize_user_text(text: str) -> str:
    """LLM çıktısından kaynak isimlerini sil — UI'a sızdırma."""
    return _SOURCE_LEAK_PATTERN.sub("ikinci el piyasa", text)


class ValuationAgent:
    """Market Research Agent — canlı Chrono24 listelemelerini scraper ile çeker.

    LLM ile uydurma yapmaz. Yalnızca scraping çıktısının üstüne karar yazar.
    Yetersiz veri durumunda confidence=0 ile "yetersiz piyasa verisi" işaretler.
    """

    def __init__(self, llm: LLM):
        # LLM artık opsiyonel — sadece reasoning text'i için gelecekte
        # kullanılabilir. Şu an reasoning de deterministik üretiliyor.
        self.llm = llm  # noqa: ARG002 — uyumluluk için tutulur

    def run(self, watch: WatchData) -> ValuationResult:
        try:
            market = fetch_chrono24_market_band(
                watch.reference_number,
                brand=watch.brand,
                condition=watch.condition,
            )
        except InsufficientMarketDataError as e:
            logger.info(
                "Watch %s — yetersiz piyasa verisi: %s", watch.id, e
            )
            return ValuationResult(
                estimated_value_min=Decimal("0"),
                estimated_value_max=Decimal("0"),
                confidence_score=0.0,
                comparables=[],
                reasoning=(
                    "Yetersiz piyasa verisi — bu referans için yeterli canlı "
                    "ikinci el listelemesi bulunamadı. AI değerlemesi "
                    "üretilemedi. Referans numarasının doğruluğunu kontrol "
                    "edin veya operasyon ekibimizle iletişime geçin."
                ),
            )

        # Comparable formatına çevir (jenerik source — UI'a sızıntı yok)
        comparables = fetch_comparables(
            watch.brand,
            watch.model,
            watch.reference_number,
            condition=watch.condition,
        )

        # Confidence: örnek sayısına bağlı; ≥10 listeleme = 0.9, 3-9 arası = 0.6
        if market.sample_count >= 10:
            confidence = 0.9
        elif market.sample_count >= 5:
            confidence = 0.75
        else:
            confidence = 0.6

        reasoning = (
            f"{market.sample_count} adet canlı ikinci el listeleme baz "
            f"alındı. En yüksek ve en düşük uç değerler atılarak elde edilen "
            f"dar gerçekçi bant ${market.min_price:,}–${market.max_price:,} "
            f"USD (ortalama ${market.average:,}). Saatin kondisyonu, "
            f"kutu/kağıt durumu ve servis geçmişi bu bandın hangi noktasında "
            f"konumlandığını etkileyecektir."
        )

        return ValuationResult(
            estimated_value_min=market.min_price,
            estimated_value_max=market.max_price,
            confidence_score=confidence,
            comparables=comparables,
            reasoning=_sanitize_user_text(reasoning),
        )


class SEOWriterAgent:
    """Lüks segment için Türkçe ilan açıklaması yazar."""

    SYSTEM = (
        "Sen Türkiye lüks saat pazarı için çalışan kıdemli bir ilan yazarısın. "
        "Klasik İsveç saatçiliğinin teknik detaylarına hakimsin (kalibre, mihver, "
        "kasa malzemesi, su geçirmezlik). Tonun olgun, kataloglardaki gibi: "
        "müşteri ikna etme dilinden uzak, parçanın özelliklerini tarif eden. "
        "'Kaçırılmaz fırsat', 'efsane' gibi klişeler yok. 200-280 kelime, "
        "iki paragraf. Doğrudan açıklamayla başla — başlık, başlık satırı yok.\n\n"
        "ÖNEMLİ: Hiçbir piyasa veri kaynağı (Chrono24, eBay vb.) ismi metinde "
        "geçmesin. Sadece 'piyasa', 'koleksiyon segmenti' gibi terimler kullan."
    )

    def __init__(self, llm: LLM):
        self.llm = llm

    def run(self, watch: WatchData, valuation: ValuationResult) -> SEOResult:
        # Değerleme başarısızsa fiyat ipucu vermeden ilan metni
        value_hint = (
            f"Piyasa değer aralığı: ${valuation.estimated_value_min:.0f}–"
            f"${valuation.estimated_value_max:.0f}\n"
            if valuation.estimated_value_min > 0
            else "Piyasa değer aralığı: (yetersiz veri — metinde fiyat geçmesin)\n"
        )

        user_prompt = (
            f"Saat: {watch.brand} {watch.model} ref. {watch.reference_number}\n"
            f"Yıl: {watch.year}\n"
            f"Kondisyon: {watch.condition}\n"
            f"Kutu & Kağıtlar: {'Var' if watch.box_papers else 'Yok'}\n"
            f"Satıcı notu: {watch.description}\n"
            f"{value_hint}"
            f"\n"
            f"Yukarıdaki saat için Türkçe bir ilan açıklaması yaz."
        )
        text = self.llm.complete(self.SYSTEM, user_prompt, response_format="text")
        return SEOResult(seo_description=_sanitize_user_text(text.strip()))
