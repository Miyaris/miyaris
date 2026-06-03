"""NVİ (Nüfus ve Vatandaşlık İşleri) KPSPublic SOAP entegrasyonu."""
from __future__ import annotations

import logging
import re
from xml.sax.saxutils import escape as xml_escape

import httpx

from app.core.config import get_settings
from app.utils.exceptions import APIError

logger = logging.getLogger(__name__)

NVI_ENDPOINT = "https://tckimlik.nvi.gov.tr/Service/KPSPublic.asmx"
# SOAP 1.1 RFC: SOAPAction header değeri tırnak içinde olmalı. ASP.NET / IIS
# sunucular tırnaksız SOAPAction'ı parse edemeyip "302 → Error.html" redirect
# atar. NVI'nın bu davranışına maruz kaldık — şimdi tırnaklı gönderiyoruz.
NVI_SOAP_ACTION = '"http://tckimlik.nvi.gov.tr/WS/TCKimlikNoDogrula"'

_RESULT_TRUE_PATTERN = re.compile(
    r"<\s*TCKimlikNoDogrulaResult\s*>\s*true\s*</\s*TCKimlikNoDogrulaResult\s*>",
    re.IGNORECASE,
)


# ============================================================================
# Türkçe büyük harf — TAMAMEN explicit karakter eşleştirmesi.
# ----------------------------------------------------------------------------
# Python'un str.upper()'ı locale-bağımsız ve Türkçe i↔İ özelinde YANLIŞ:
#   'i'.upper() → 'I'   (NVİ 'İ' bekler!)
#   'ı'.upper() → 'I'   (doğru ama yukarıdakiyle çakışır)
# Bu yüzden Python'un .upper()'ına HİÇ güvenmiyoruz; tüm Türk alfabesi için
# birebir karakter eşlemesi yapıyoruz. Eşlemede olmayan karakterler (rakam,
# tire, boşluk, kesme) olduğu gibi geçer.
# ============================================================================

_TR_UPPER_TRANSLATE = str.maketrans(
    "abcçdefgğhıijklmnoöpqrsştuüvwxyzâîû",
    "ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZÂÎÛ",
)


def turkish_upper(s: str) -> str:
    """e-Devlet/NVİ uyumlu Türkçe büyük harf dönüşümü.

    Örnekler:
      'ali'         → 'ALİ'
      'ışık'        → 'IŞIK'
      'şükrü'       → 'ŞÜKRÜ'
      'çiğdem'      → 'ÇİĞDEM'
      'göksu'       → 'GÖKSU'

    Python'un .upper()'ına ASLA çağırmaz — locale bozulma riski yok.
    """
    return s.translate(_TR_UPPER_TRANSLATE)


def _build_envelope(
    tc_kimlik_no: str, ad: str, soyad: str, dogum_yili: int
) -> str:
    """SOAP 1.1 envelope inşa et.

    Ad/Soyad XML-escape edilir (`'`, `&`, `<`, `>`) — tire/kesme içeren
    soyadlarda envelope bozulmasını engeller.
    """
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<soap:Envelope '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xmlns:xsd="http://www.w3.org/2001/XMLSchema" '
        'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n'
        "  <soap:Body>\n"
        '    <TCKimlikNoDogrula xmlns="http://tckimlik.nvi.gov.tr/WS">\n'
        f"      <TCKimlikNo>{xml_escape(tc_kimlik_no)}</TCKimlikNo>\n"
        f"      <Ad>{xml_escape(ad)}</Ad>\n"
        f"      <Soyad>{xml_escape(soyad)}</Soyad>\n"
        f"      <DogumYili>{dogum_yili}</DogumYili>\n"
        "    </TCKimlikNoDogrula>\n"
        "  </soap:Body>\n"
        "</soap:Envelope>"
    )


async def verify_tc_with_nvi(
    tc_kimlik_no: str,
    first_name: str,
    last_name: str,
    birth_year: int,
) -> bool:
    """NVİ KPSPublic'e TCKimlikNoDogrula çağrısı.

    Returns:
        True  → NVİ doğruladı
        False → NVİ eşleştirmedi (kullanıcıya 400 göstereceğiz)

    Raises:
        APIError 503: NVİ'ye ulaşılamadı (network/SSL/timeout).
    """
    settings = get_settings()
    if not settings.NVI_VERIFICATION_ENABLED:
        logger.info(
            "NVİ doğrulaması KAPALI (dev modu) — TC=%s atlandı", tc_kimlik_no
        )
        return True

    ad = turkish_upper(first_name.strip())
    soyad = turkish_upper(last_name.strip())
    body = _build_envelope(tc_kimlik_no.strip(), ad, soyad, birth_year)

    # NVI bazı User-Agent'ları reddediyor (botlara karşı). Gerçekçi tarayıcı
    # string'i kullan — sunucu loglarında "Mozilla 5.0 + Chrome" görür.
    headers = {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": NVI_SOAP_ACTION,
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/xml, application/soap+xml, application/xml",
        "Accept-Encoding": "gzip, deflate",
    }

    logger.info(
        "NVİ isteği gönderiliyor — TC=%s Ad=%r Soyad=%r Yıl=%d",
        tc_kimlik_no, ad, soyad, birth_year,
    )
    # SOAP envelope'i log'a yaz — encoding/escape problemlerini görmek için.
    # PII içerdiği için sadece DEBUG seviyede, production'da gizli kalsın.
    logger.debug("NVİ SOAP request body:\n%s", body)

    try:
        # `follow_redirects=True` — NVI bazen HTTP→HTTPS yönlendirmesi yapar
        # ve geçerli SOAP yanıtı redirect chain'in sonunda gelir. verify=True
        # production'da geçerli (certifi bundle NVİ kök sertifikasını tanır);
        # Mac local dev için fallback olarak verify=False denenebilir ama
        # Render container'ında verify=True doğru.
        async with httpx.AsyncClient(
            timeout=settings.NVI_TIMEOUT_SECONDS,
            verify=True,
            follow_redirects=True,
        ) as client:
            response = await client.post(
                NVI_ENDPOINT, content=body.encode("utf-8"), headers=headers
            )
        logger.info(
            "NVİ yanıt status=%d, body_size=%d",
            response.status_code, len(response.text),
        )
        if response.status_code >= 400:
            logger.error(
                "NVİ HTTP hatası — status=%d body=%s",
                response.status_code, response.text[:500],
            )
            response.raise_for_status()

    except httpx.TimeoutException as e:
        logger.error(
            "NVİ TIMEOUT (%ss) — TC=%s. Hata: %s",
            settings.NVI_TIMEOUT_SECONDS, tc_kimlik_no, e,
            exc_info=True,
        )
        raise APIError(
            status_code=503,
            detail="NVİ servisi zaman aşımına uğradı. Lütfen tekrar deneyin.",
        ) from e
    except httpx.ConnectError as e:
        logger.error(
            "NVİ BAĞLANTI hatası (muhtemelen SSL/DNS) — TC=%s. Detay: %s",
            tc_kimlik_no, e,
            exc_info=True,
        )
        raise APIError(
            status_code=503,
            detail=(
                "NVİ devlet servisine bağlanılamadı (SSL/ağ). "
                "Lütfen birkaç dakika sonra tekrar deneyin."
            ),
        ) from e
    except httpx.HTTPError as e:
        logger.error(
            "NVİ genel HTTP hatası — TC=%s type=%s detay=%s",
            tc_kimlik_no, type(e).__name__, e,
            exc_info=True,
        )
        raise APIError(
            status_code=503,
            detail="NVİ devlet doğrulama servisine ulaşılamadı. Lütfen tekrar deneyin.",
        ) from e
    except Exception as e:  # noqa: BLE001
        logger.error(
            "NVİ BEKLENMEDİK hata — TC=%s type=%s detay=%s",
            tc_kimlik_no, type(e).__name__, e,
            exc_info=True,
        )
        raise APIError(
            status_code=503,
            detail="NVİ doğrulamasında beklenmedik bir hata oluştu.",
        ) from e

    # Yanıt SOAP zarfı içeriyor mu? NVI servisi bozulunca (302 redirect,
    # IIS Error.html vb.) HTML dönüyor — geçerli SOAP yanıtı değil. SOAP
    # yapısı yoksa "servis hatası" kabul edilir → APIError 503 (kayıt
    # fail-open ile geçer, admin manuel onay verir). Aksi halde False
    # döndürmek "kullanıcı yanlış bilgi verdi" olarak algılanır ve kayıt
    # YANLIŞLIKLA reddedilir.
    body_lower = response.text.lower()
    has_soap_envelope = (
        "<soap:envelope" in body_lower or "<s:envelope" in body_lower
    )
    has_nvi_response = "tckimliknodogrularesponse" in body_lower
    if not (has_soap_envelope and has_nvi_response):
        logger.error(
            "NVİ servisi SOAP yanıtı dönmedi — TC=%s. "
            "Response (ilk 1000 char):\n%s",
            tc_kimlik_no, response.text[:1000],
        )
        raise APIError(
            status_code=503,
            detail="NVİ servisi geçici olarak yanıt veremiyor",
        )

    result = parse_nvi_response(response.text)
    logger.info("NVİ sonucu — TC=%s → %s", tc_kimlik_no, result)
    if not result:
        # Servis çalıştı, ama bilgi eşleşmedi (kullanıcı yanlış bilgi verdi)
        logger.warning(
            "NVİ EŞLEŞMEDİ — TC=%s gönderilen Ad=%r Soyad=%r Yıl=%d.\n"
            "Full response (ilk 2000 char):\n%s",
            tc_kimlik_no, ad, soyad, birth_year, response.text[:2000],
        )
    return result


def parse_nvi_response(xml_text: str) -> bool:
    """SOAP response'dan TCKimlikNoDogrulaResult'ı çek."""
    return bool(_RESULT_TRUE_PATTERN.search(xml_text))
