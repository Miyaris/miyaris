"""Güvenlik middleware'leri — security headers + rate limiting.

`SecurityHeadersMiddleware`:
  - HSTS (HTTP Strict Transport Security) → tarayıcı sadece HTTPS bağlanır
    preload=true sadece prod'da (apex domain'i 'never-HTTPS-fallback'
    listesine ekler; geri alınması zordur, bilinçli)
  - X-Content-Type-Options: nosniff → MIME-sniffing XSS koruması
  - X-Frame-Options: DENY → clickjacking koruması (CSP frame-ancestors
    backup)
  - Referrer-Policy: strict-origin-when-cross-origin → URL leak'i azalt
  - Permissions-Policy → camera/mic/geolocation default-deny
  - CSP: minimal (yalnız frame-ancestors none) — full CSP frontend
    tarafında set'lenir (Next.js _headers veya middleware). API JSON
    response için CSP marjinal etki yapar, kritik olan frame-ancestors.

Rate limiting `slowapi` ile FastAPI'ye exception_handler + middleware
olarak bağlanır. Limiter `init_rate_limiter()` ile başlatılır; route
seviyesinde `@limiter.limit("5/minute")` decorator'ı ile kullanılır.

Key extractor: X-Forwarded-For (Render reverse proxy arkasındayız) →
yoksa direct client IP.
"""

from __future__ import annotations

import logging
from typing import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import get_settings

logger = logging.getLogger(__name__)


# ============================================================================
# Security Headers Middleware
# ============================================================================


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Her response'a savunmacı güvenlik header'ları ekle.

    Karar matrisi:
      - HSTS BİLİNÇLİ OLARAK YOK: MVP aşamasında uzun süreli HTTPS
        commitment'a girmek istemiyoruz. Render + Vercel zaten HTTPS
        zorluyor; HSTS header'ı yokken de kullanıcı sertifika hatası
        görmez. İleride domain ve SSL kurulumu stabil olunca HSTS
        (1 yıl, preload yok) eklenebilir — geri alınabilir kararlar
        önce, kalıcı kilitler sonra.
      - CSP minimal (frame-ancestors) — API JSON response, full CSP marjinal
      - X-Powered-By siliniyor (FastAPI varsayılan göndermiyor ama
        defansif)
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Default-deny davranışı: kullanıcı kamerasına, mikrofonuna,
        # konumuna, ödeme API'sine vs. erişim yok. Frontend gerek
        # duyarsa kendi sayfasında override eder.
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )
        # Minimal CSP — API çoğunlukla JSON döner; frame-ancestors
        # clickjacking için XFO'nun modern eşdeğeri.
        response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
        # X-Powered-By sızıntısı (varsayılan değil ama temizle).
        # Starlette MutableHeaders'da `pop` yok → guard'lı del.
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]
        # Server header'ı uvicorn 'uvicorn' yazıyor; minimize et
        if "server" in response.headers:
            response.headers["server"] = "miyaris"

        return response


# ============================================================================
# Rate Limiter
# ============================================================================


def client_ip(request: Request) -> str:
    """Gerçek client IP'sini X-Forwarded-For'dan güvenli biçimde çıkar.

    XFF formatı "client, proxy1, proxy2, ..."dir; her proxy bağlantıyı
    kimden aldıysa onu SONA ekler. Dolayısıyla bizim önümüzdeki güvenilen
    proxy sayısı (`TRUSTED_PROXY_HOPS`) kadar SAĞDAN içerideki girdi gerçek
    client'tır.

    İlk (en soldaki) girdiyi okumak GÜVENSİZDİR: o değer client tarafından
    serbestçe set edilebilir → saldırgan her istekte farklı sahte IP
    göndererek IP-bazlı rate limit'i (login brute-force) bypass edebilir.
    Bu yüzden sağdan, güvenilen hop sayısı kadar geri sayıyoruz.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            hops = max(get_settings().TRUSTED_PROXY_HOPS, 1)
            idx = max(0, len(parts) - hops)
            return parts[idx]
    return get_remote_address(request)


def _client_ip(request: Request) -> str:
    """slowapi key_func uyumlu wrapper — `client_ip`'ye delege eder."""
    return client_ip(request)


# In-memory storage default. Multi-replica'ya geçince:
#   from slowapi.middleware import SlowAPIMiddleware
#   limiter = Limiter(key_func=_client_ip, storage_uri="redis://...")
limiter = Limiter(
    key_func=_client_ip,
    default_limits=[],  # default kapalı; sadece dekoratörlü route'lar limitli
    enabled=True,  # init_rate_limiter() runtime'da config'e göre toggle
)


def _rate_limit_exceeded_handler(
    request: Request,  # noqa: ARG001
    exc: RateLimitExceeded,
) -> JSONResponse:
    """429 cevabı için Türkçe + retry-after."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                "Çok fazla istek gönderildiniz. Lütfen bir dakika sonra "
                "tekrar deneyin."
            ),
            "code": "rate_limit_exceeded",
        },
        headers={"Retry-After": "60"},
    )


def init_rate_limiter(app: FastAPI) -> None:
    """FastAPI app'e rate limiter'ı bağla. Settings RATE_LIMIT_ENABLED=False
    iken limiter no-op (lokal dev / pytest)."""
    settings = get_settings()
    limiter.enabled = settings.RATE_LIMIT_ENABLED
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    if not settings.RATE_LIMIT_ENABLED:
        logger.warning("Rate limiting DEVRE DIŞI (RATE_LIMIT_ENABLED=False)")
    else:
        logger.info("Rate limiting aktif — in-memory backend")
