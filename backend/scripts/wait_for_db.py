"""DB hazır olana kadar bekle — Render zamanlama sorunu için defansif şim.

ÖNEMLİ: Bu script TAMAMEN STANDALONE'dur. `app.core.config` veya başka
herhangi bir uygulama modülünü import etmez — çünkü Render preDeploy
container'ında uygulama env'inin tamamı (örn. JWT_SECRET_KEY min_length=32
validasyonu) sağlanmamış olabilir; Settings instantiation'ı patlar ve
script daha tek satır çalışamadan exit 128 ile ölür.

Sadece:
  1. os.environ'dan DATABASE_URL'i oku
  2. hostname/port çıkar
  3. DNS resolve + asyncpg.connect retry'la dene
"""
from __future__ import annotations

import asyncio
import os
import socket
import sys
import time
from urllib.parse import urlparse

MAX_ATTEMPTS = 60          # 60 × 2s = 120s toplam
DNS_RETRY_INTERVAL = 2.0   # saniye
CONN_TIMEOUT = 5.0         # saniye


def _normalize_url(url: str) -> str:
    """`postgres://` veya `postgresql://` → `postgresql+asyncpg://`,
    whitespace + tırnak strip."""
    if not url:
        return url
    url = url.strip().strip("'\"")
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    return url


def _strip_asyncpg_driver(url: str) -> str:
    """asyncpg.connect() raw URL bekler; SQLAlchemy `+asyncpg`'sini çıkar."""
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def wait_for_database() -> None:
    raw = os.environ.get("DATABASE_URL", "")
    if not raw:
        print("[wait_for_db] HATA — DATABASE_URL env değişkeni boş.",
              file=sys.stderr)
        sys.exit(2)

    url = _normalize_url(raw)
    raw_url = _strip_asyncpg_driver(url)
    parsed = urlparse(raw_url)
    host = parsed.hostname
    port = parsed.port or 5432

    if not host:
        print(f"[wait_for_db] HATA — hostname parse edilemedi: {raw!r}",
              file=sys.stderr)
        sys.exit(2)

    # Hassas bilgi (parola) basmadan log
    print(
        f"[wait_for_db] Hedef: {host}:{port} "
        f"(driver: postgresql+asyncpg, max {MAX_ATTEMPTS} deneme)"
    )

    # asyncpg'yi script içinde lazy import et — import hatası varsa
    # mesaj daha temiz görünsün.
    try:
        import asyncpg  # type: ignore
    except ImportError as e:
        print(f"[wait_for_db] HATA — asyncpg yüklü değil: {e}",
              file=sys.stderr)
        sys.exit(2)

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
                asyncpg.connect(raw_url),
                timeout=CONN_TIMEOUT,
            )
            await conn.close()
            print(f"[wait_for_db] OK — {attempt}. denemede bağlandı.")
            return
        except (asyncio.TimeoutError, OSError, asyncpg.PostgresError) as e:
            last_err = (
                f"Connection denendi ama açılmadı "
                f"({type(e).__name__}: {e})"
            )
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
