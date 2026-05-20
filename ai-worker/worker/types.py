"""Worker iç tipleri — backend DTO'larıyla 1:1 değil; ajan-ajan domain modeli."""

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class WatchData:
    id: str
    brand: str
    model: str
    reference_number: str
    year: int | None
    condition: str
    box_papers: bool
    description: str


@dataclass
class MarketComparable:
    """Tek bir ikinci el listeleme. Scraping kaynağında bazı alanlar boş olabilir
    (snippet'tan title/year/condition çekemediğimiz durumlar)."""

    source: str
    brand: str
    model: str
    reference: str
    sold_price: Decimal
    year: int | None = None
    sold_date: str = ""
    condition: str = ""
    url: str = ""

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "brand": self.brand,
            "model": self.model,
            "reference": self.reference,
            "year": self.year,
            "sold_price": str(self.sold_price),
            "sold_date": self.sold_date,
            "condition": self.condition,
            "url": self.url,
        }


@dataclass
class ChronoMarketResult:
    """Chrono24 canlı scraping çıktısı — dar bant + örnek sayısı."""

    min_price: Decimal
    max_price: Decimal
    average: Decimal
    sample_count: int  # outlier'lar atıldıktan sonra kalan listeleme sayısı
    raw_prices: list[Decimal] = field(default_factory=list)


class InsufficientMarketDataError(RuntimeError):
    """Bir referans için canlı ikinci el piyasada yeterli listeleme bulunamadı.

    AI Worker bu hatayı yakaladığında değerlemeyi DEĞİL — açık bir
    'yetersiz piyasa verisi' durumu olarak işaretler. Marka ortalamasına
    veya halüsinasyona ASLA fallback YOK.
    """


@dataclass
class ValuationResult:
    estimated_value_min: Decimal
    estimated_value_max: Decimal
    confidence_score: float
    comparables: list[MarketComparable] = field(default_factory=list)
    reasoning: str = ""


@dataclass
class SEOResult:
    seo_description: str


# Ajan sürüm etiketleri — DB'de takip edilir, sürüm bumpı = yeni AIValuation kaydı
VALUATION_AGENT_VERSION = "valuation_v2.1_multisource_live"
SEO_AGENT_VERSION = "seo_writer_v1.0"
