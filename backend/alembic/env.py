"""Async Alembic env — SQLAlchemy 2.0 ile uyumlu."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import _normalize_database_url, get_settings

# Tüm modelleri register et — autogenerate metadata'yı buradan okur.
from app.models import Base  # noqa: F401  (import side effect)
from app.models import (  # noqa: F401
    AIValuation,
    Auction,
    AuthenticityCertificate,
    Bid,
    EscrowTransaction,
    User,
    Watch,
    WatchImage,
)

config = context.config

# alembic.ini'deki sqlalchemy.url'i Settings'ten override et.
# `_normalize_database_url` defensif çağrı — Render'ın verdiği `postgres://`
# format'ı çift filtreden geçsin (Settings validator + buradaki çağrı).
# Eski alembic_version kayıtları için de güvenli (DDL etkisi yok).
config.set_main_option(
    "sqlalchemy.url",
    _normalize_database_url(get_settings().DATABASE_URL),
)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
