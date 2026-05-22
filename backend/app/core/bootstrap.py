"""Container startup bootstrap görevleri.

Buradaki fonksiyonlar `main.py` lifespan'ı içinde, FastAPI request
trafiği başlamadan önce çalışır. Hatalar fatal değildir — log'a yazılır
ve uygulama yine de ayağa kalkar (admin olmadan da API çalışabilmeli).
"""
from __future__ import annotations

import logging

from sqlalchemy import func, select, update

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


async def promote_seed_admins() -> None:
    """`ADMIN_EMAILS` env'ine yazılan kullanıcıları admin rolüne yükseltir.

    - Idempotent: aynı e-posta için tekrar çalışmak hiçbir şey değiştirmez.
    - Kayıtlı olmayan e-posta sessizce atlanır (henüz register etmemiş olabilir).
    - E-posta karşılaştırması case-insensitive (PostgreSQL `lower(email)` ile).
    - Promote edilen kullanıcılar aynı zamanda `is_verified=True` ve
      `is_active=True` olarak işaretlenir — admin login'ini Resend mail
      gelmemiş olsa bile engellememek için.
    """
    settings = get_settings()
    targets = settings.admin_email_list

    if not targets:
        logger.info("[bootstrap] ADMIN_EMAILS boş, seed admin promotion atlandı")
        return

    logger.info("[bootstrap] %d seed admin adayı kontrol ediliyor", len(targets))

    async with AsyncSessionLocal() as session:
        try:
            # Hangi e-postalar DB'de var, hangileri admin'e yükseltilecek?
            existing_result = await session.execute(
                select(User.id, User.email, User.role).where(
                    func.lower(User.email).in_(targets)
                )
            )
            existing_rows = existing_result.all()

            if not existing_rows:
                logger.warning(
                    "[bootstrap] ADMIN_EMAILS'teki e-postaların hiçbiri DB'de"
                    " bulunamadı. Önce kayıt olun, sonra container restart'ı"
                    " admin'e yükseltecektir. Adaylar: %s",
                    targets,
                )
                return

            promoted: list[str] = []
            already_admin: list[str] = []
            for _user_id, email, role in existing_rows:
                if role == UserRole.ADMIN:
                    already_admin.append(email)
                else:
                    promoted.append(email)

            # Eksik (henüz kayıt olmamış) e-postalar bilgisi
            existing_emails_lower = {row[1].lower() for row in existing_rows}
            missing = [e for e in targets if e not in existing_emails_lower]

            if promoted:
                await session.execute(
                    update(User)
                    .where(func.lower(User.email).in_([e.lower() for e in promoted]))
                    .values(
                        role=UserRole.ADMIN,
                        is_verified=True,
                        is_active=True,
                    )
                )
                await session.commit()
                logger.info(
                    "[bootstrap] %d kullanıcı admin'e yükseltildi: %s",
                    len(promoted),
                    promoted,
                )

            if already_admin:
                logger.info(
                    "[bootstrap] Zaten admin: %s", already_admin
                )

            if missing:
                logger.warning(
                    "[bootstrap] ADMIN_EMAILS'te tanımlı ama DB'de yok: %s",
                    missing,
                )
        except Exception as exc:  # pragma: no cover — defansif
            logger.exception(
                "[bootstrap] Seed admin promotion başarısız: %s", exc
            )
            await session.rollback()
