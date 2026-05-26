import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import admin, auctions, auth, orders, presenter, service, watches
from app.core.bootstrap import promote_seed_admins
from app.core.config import get_settings
from app.core.middleware import SecurityHeadersMiddleware, init_rate_limiter
from app.core.security import assert_signing_ready
from app.services.scheduler import scheduler_loop
from app.websockets import auction_ws

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Uygulama yaşam döngüsü.

    Scheduler'ı varsayılan olarak başlatırız. Multi-replica ortamda yalnızca tek
    instance çalıştırmak için `RUN_SCHEDULER=0` env'i set'lenebilir.
    """
    # Production hardening — RS256 anahtarları boot anında yoksa
    # fail-fast. Dev (APP_ENV != production) sessiz geçer.
    assert_signing_ready()

    # Seed admin'leri ADMIN_EMAILS env'inden veritabanına yansıt.
    # Hata fırlatmaz — başarısız olursa log'a yazılır ve uygulama yine
    # ayağa kalkar (mevcut admin'ler hâlâ giriş yapabilir).
    try:
        await promote_seed_admins()
    except Exception:
        logger.exception("Seed admin bootstrap unexpectedly failed")

    task: asyncio.Task[None] | None = None
    if os.getenv("RUN_SCHEDULER", "1") != "0":
        task = asyncio.create_task(scheduler_loop(), name="auction-scheduler")
    else:
        logger.info("RUN_SCHEDULER=0, scheduler is disabled in this instance")

    try:
        yield
    finally:
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Miyaris API",
        version="0.1.0",
        description="Türkiye'nin lüks saat açık artırma platformu — Miyaris backend",
        lifespan=lifespan,
    )

    # ---- CORS ----
    # Production'da CORS sıkı kilitli: yalnız apex + www. Browser direkt
    # backend'e cookie ile çağrı atmıyor (Vercel route handler'ları proxy
    # görüyor, cookie Next.js host'unda kalıyor) — ama defense-in-depth
    # için yine de origin listesi minimal tutulur.
    #
    # Dev (APP_ENV != production): localhost:3000 ek olarak izinli.
    # CORS_ORIGINS env'i set'liyse override eder (custom staging origin
    # için kaçış kapısı).
    is_prod = settings.APP_ENV == "production"
    # Prod default'u her zaman miyaris.com — CORS_ORIGINS env'i sadece dev/
    # staging için override (custom staging origin'i eklemek için "*" YERINE
    # spesifik origin'lerle, comma-separated). "*" prod'da KESİNLİKLE kabul
    # edilmez (allow_credentials=True ile imkansız zaten).
    if is_prod:
        # Prod env'i CORS_ORIGINS açıkça set'lemişse onu kullan (örn. staging
        # subdomain), default ise www + apex sabit.
        if (
            settings.CORS_ORIGINS
            and settings.CORS_ORIGINS != ["*"]
            and settings.CORS_ORIGINS != ["http://localhost:3000"]
        ):
            allowed_origins = settings.CORS_ORIGINS
        else:
            allowed_origins = [
                "https://www.miyaris.com",
                "https://miyaris.com",
            ]
    else:
        # Dev/staging — CORS_ORIGINS env set'liyse onu, değilse localhost.
        if settings.CORS_ORIGINS and settings.CORS_ORIGINS != ["*"]:
            allowed_origins = settings.CORS_ORIGINS
        else:
            allowed_origins = [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "X-CSRF-Token",
            "X-Service-Key",
            "X-Requested-With",
        ],
        max_age=600,
    )

    # ---- Security Headers ----
    # HSTS (prod), XCTO, X-Frame-Options, Referrer-Policy, Permissions-Policy,
    # CSP frame-ancestors. Her response'a otomatik eklenir.
    app.add_middleware(SecurityHeadersMiddleware)

    # ---- Rate Limiting ----
    # slowapi in-memory backend. RATE_LIMIT_ENABLED=False ise no-op.
    # Route'larda @limiter.limit("5/minute") dekoratörleri devrede.
    init_rate_limiter(app)

    # REST — kullanıcı endpoint'leri
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(watches.router, prefix="/api/v1")
    app.include_router(auctions.router, prefix="/api/v1")
    app.include_router(orders.router, prefix="/api/v1")

    # REST — admin/expert moderasyon (rol kontrollü)
    app.include_router(admin.router, prefix="/api/v1")

    # REST — presenter (canlı müzayede sunucu paneli) — is_presenter zorunlu
    app.include_router(presenter.router, prefix="/api/v1")

    # REST — servisler arası (X-Service-Key zorunlu)
    app.include_router(service.router, prefix="/api/v1")

    # WebSocket — prefix yok, doğrudan /ws/...
    app.include_router(auction_ws.router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "app": settings.APP_NAME}

    return app


app = create_app()
