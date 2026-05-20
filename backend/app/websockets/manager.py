"""Oda-bazlı WebSocket bağlantı yöneticisi.

In-process, asyncio'ya uygun. Tek instance üzerinde çalışır — yatay ölçeklenecek
ölçeğe geldiğimizde Redis pub/sub backbone'una geçeceğiz.
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, room: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._rooms[room].add(websocket)
        logger.debug("WS connected: room=%s total=%d", room, len(self._rooms[room]))

    async def disconnect(self, room: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._rooms[room].discard(websocket)
            if not self._rooms[room]:
                del self._rooms[room]

    async def broadcast(self, room: str, message: dict[str, Any]) -> None:
        """Odadaki tüm bağlantılara mesaj yolla. Kopuk soketler temizlenir."""
        async with self._lock:
            connections = list(self._rooms.get(room, ()))
        if not connections:
            return

        dead: list[WebSocket] = []
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception as e:  # noqa: BLE001 — ne olursa olsun temizle
                logger.debug("WS send failed, dropping: %s", e)
                dead.append(ws)

        if dead:
            async with self._lock:
                bucket = self._rooms.get(room)
                if bucket is not None:
                    for ws in dead:
                        bucket.discard(ws)
                    if not bucket:
                        del self._rooms[room]

    def room_size(self, room: str) -> int:
        return len(self._rooms.get(room, ()))


# Module-level singleton — uygulama boyunca tek instance.
manager = ConnectionManager()
