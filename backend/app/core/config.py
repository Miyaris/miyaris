from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_database_url(url: str) -> str:
    """Render / Heroku / GCP gibi platformlar PostgreSQL bağlantısını
    sürücüsüz format'ta verir (`postgres://...` veya `postgresql://...`).
    SQLAlchemy default'u psycopg2'dir; biz tüm stack'i asyncpg ile çalıştığımız
    için URL'in `postgresql+asyncpg://` ile başladığından emin oluruz.

    Defansif temizlik:
      - Whitespace strip (env yapıştırırken kayan boşluklar)
      - Tek/çift tırnak strip (kabuk escape'inden artakalan)
      - `postgres://` → `postgresql+asyncpg://` (Heroku legacy)
      - `postgresql://` → `postgresql+asyncpg://`
      - asyncpg, `sslmode=require` query parametresini desteklemez; SQLAlchemy
        2.0 onu otomatik tercüme ediyor, ama `sslmode=disable` gibi varyantlar
        problem çıkarabilir. Burada özel bir dönüşüm yapmıyoruz; sorun olursa
        ileride `?ssl=true` parametresine çeviririz.
    """
    if not url:
        return url
    url = url.strip().strip("'\"")
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    APP_NAME: str = "miyaris"
    DEBUG: bool = False

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://miyaris:miyaris@localhost:5432/miyaris_db"
    )

    @field_validator("DATABASE_URL")
    @classmethod
    def _ensure_asyncpg_driver(cls, v: str) -> str:
        return _normalize_database_url(v)

    JWT_SECRET_KEY: str = Field(min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # Servisler arası auth (örn: BBB finans ajanları → Miyaris API).
    # Kullanıcı JWT'sinden bağımsız, paylaşılan statik anahtar.
    # X-Service-Key header ile gönderilir. Boş bırakılırsa servis
    # endpoint'leri hiçbir çağrıyı kabul etmez.
    SERVICE_API_KEY: str = ""

    # NVİ (KPSPublic) TC kimlik doğrulama servisi.
    #   Default: False — dev makinesinde ve CI'da kayıt akışı NVİ erişim/
    #   eşleşme gerektirmesin (NVI servisi MERNİS gecikmelerinden ötürü
    #   doğru bilgiyle bile zaman zaman 'no match' döndürüyor).
    #   Production deployment'larında .env'de `NVI_VERIFICATION_ENABLED=true`
    #   set edilmeli. Kapalıyken kayıt kabul edilir ama `kyc_verified=False`
    #   olarak işaretlenir → admin manuel onay verir.
    NVI_VERIFICATION_ENABLED: bool = False
    NVI_TIMEOUT_SECONDS: float = 10.0

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
