"""DB hazır olana kadar bekle — Render zamanlama sorunu için defansif şim.

Container yeni provision edilen Postgres'ten önce başlatılırsa asyncpg
`socket.gaierror: Name or service not known` ile patlar. Bu script:
  1. DATABASE_URL'i parse eder, hostname'i çıkarır
  2. DNS lookup'ı retry'la dener (DNS propagation'ı bekler)
  3. Gerçek asyncpg connection'ı dener (DB'nin gerçekten kabul ettiğini doğrular)
  4. Başarısızsa exit code 1 — Dockerfile chain durur, deploy fail eder.

Render Blueprint deploy'unun ilk çalışmasında DB hazır olana kadar 60s
beklenir; sonraki deploy'larda hızlı (1-2 deneme).
"""
from __future__ import annotations

import asyncio
import socket
import sys
import time
from urllib.parse import urlparse

import asyncpg

from app.core.config import get_settings

MAX_ATTEMPTS = 60          # 60 × 2s = 120s toplam
DNS_RETRY_INTERVAL = 2.0   # saniye
CONN_TIMEOUT = 5.0         # saniye


def _strip_asyncpg_driver(url: str) -> str:
    """asyncpg.connect() raw URL bekler; SQLAlchemy `+asyncpg`'sini çıkar."""
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def wait_for_database() -> None:
    settings = get_settings()
    url = settings.DATABASE_URL
    parsed = urlparse(_strip_asyncpg_driver(url))
    host = parsed.hostname
    port = parsed.port or 5432

    if not host:
        print(f"[wait_for_db] DATABASE_URL hostname çıkarılamadı: {url!r}",
              file=sys.stderr)
        sys.exit(2)

    print(f"[wait_for_db] Hedef: {host}:{port} (max {MAX_ATTEMPTS} deneme)")

    last_err: str | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        # Aşama 1: DNS
        try:
            socket.gethostbyname(host)
        except socket.gaierror as e:
            last_err = f"DNS henüz hazır değil ({e})"
            print(f"[wait_for_db] {attempt}/{MAX_ATTEMPTS} — {last_err}")
            time.sleep(DNS_RETRY_INTERVAL)
            continue

        # Aşama 2: gerçek connection
        try:
            conn = await asyncio.wait_for(
                asyncpg.connect(_strip_asyncpg_driver(url)),
                timeout=CONN_TIMEOUT,
            )
            await conn.close()
            print(f"[wait_for_db] OK — {attempt}. denemede bağlandı.")
            return
        except (asyncio.TimeoutError, OSError, asyncpg.PostgresError) as e:
            last_err = f"Connection denendi ama açılmadı ({type(e).__name__}: {e})"
            print(f"[wait_for_db] {attempt}/{MAX_ATTEMPTS} — {last_err}")
            await asyncio.sleep(DNS_RETRY_INTERVAL)
            continue

    print(
        f"[wait_for_db] HATA — {MAX_ATTEMPTS} denemeden sonra hâlâ erişilemiyor.\n"
        f"  Son hata: {last_err}\n"
        f"  Host: {host}:{port}\n"
        f"  Olası nedenler: yanlış DATABASE_URL, DB henüz oluşturulmamış,\n"
        f"  network izolasyonu (Render: External URL kullanmayı dene).",
        file=sys.stderr,
    )
    sys.exit(1)


if __name__ == "__main__":
    asyncio.run(wait_for_database())
