#!/bin/sh
# ============================================================================
# Miyaris Backend — Container Startup Script
# Docker CMD bunu çağırır. Üç aşamayı tek seferde, her birinde net log basarak
# yürütür. Adımlardan biri patlarsa Render Logs'ta tam yeri görülür.
# ============================================================================
set -e   # Hata varsa hemen dur; pipe'ı stdout'a forward et

echo "=========================================="
echo "[startup] Miyaris backend container booting"
echo "[startup] CWD: $(pwd)"
echo "[startup] Python: $(python --version 2>&1)"
echo "[startup] PORT: ${PORT:-8000}"
echo "=========================================="

# 1) WORKDIR garanti — Render preDeploy bazen CWD'yi değiştiriyor
cd /app
echo "[startup] cd /app — OK ($(pwd))"

# 2) DATABASE_URL var mı?
if [ -z "$DATABASE_URL" ]; then
    echo "[startup] HATA — DATABASE_URL env değişkeni boş!" >&2
    exit 2
fi
echo "[startup] DATABASE_URL set (gizli)"

# 3) DB hazır olana kadar bekle
echo "[startup] DB hazırlık bekleniyor..."
python scripts/wait_for_db.py
echo "[startup] DB hazır."

# 4) Alembic migration
echo "[startup] alembic upgrade head başlıyor..."
alembic upgrade head
echo "[startup] Migration tamamlandı."

# 5) Uvicorn başlat
echo "[startup] uvicorn açılıyor (port=${PORT:-8000})..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers 2 \
    --proxy-headers \
    --forwarded-allow-ips='*'
