import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import admin, auctions, auth, orders, service, watches
from app.core.bootstrap import promote_seed_admins
from app.core.config import get_settings
from app.services.scheduler import scheduler_loop
from app.websockets import auction_ws

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    """Uygulama yaşam döngüsü.

    Scheduler'ı varsayılan olarak başlatırız. Multi-replica ortamda yalnızca tek
    instance çalıştırmak için `RUN_SCHEDULER=0` env'i set'lenebilir.
    """
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

    # CORS — MVP geniş açık ("*"). Browser direkt backend'e cookie ile çağrı
    # atmıyor (Vercel'deki Next.js route handler'ları sunucu tarafında proxy
    # görevi görüyor; cookie httpOnly ve Next.js host'unda kalıyor). Bu
    # nedenle `allow_credentials=False` ile `allow_origins=["*"]` kombinasyonu
    # CORS spec açısından geçerli. Production'da Vercel domain'ini kısıtlamak
    # için `CORS_ORIGINS` env'ini `["https://miyaris.vercel.app"]` yap ve
    # `allow_credentials=True`'a geri al.
    is_wide_open = settings.CORS_ORIGINS == ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=not is_wide_open,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # REST — kullanıcı endpoint'leri
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(watches.router, prefix="/api/v1")
    app.include_router(auctions.router, prefix="/api/v1")
    app.include_router(orders.router, prefix="/api/v1")

    # REST — admin/expert moderasyon (rol kontrollü)
    app.include_router(admin.router, prefix="/api/v1")

    # REST — servisler arası (X-Service-Key zorunlu)
    app.include_router(service.router, prefix="/api/v1")

    # WebSocket — prefix yok, doğrudan /ws/...
    app.include_router(auction_ws.router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "app": settings.APP_NAME}

    return app


app = create_app()
