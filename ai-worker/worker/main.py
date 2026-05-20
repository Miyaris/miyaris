"""Worker entry point — poller loop + agent orchestration."""
from __future__ import annotations

import logging
import signal
import time

from worker.agents import SEOWriterAgent, ValuationAgent
from worker.client import MiyarisClient
from worker.config import get_settings
from worker.llm import get_llm
from worker.types import (
    SEO_AGENT_VERSION,
    VALUATION_AGENT_VERSION,
    WatchData,
)

logger = logging.getLogger(__name__)

_should_stop = False


def _handle_shutdown(signum, frame):  # noqa: ARG001
    global _should_stop
    logger.info("Shutdown signal received (%s)", signum)
    _should_stop = True


def process_watch(
    client: MiyarisClient,
    watch: WatchData,
    val_agent: ValuationAgent,
    seo_agent: SEOWriterAgent,
) -> None:
    """Tek saatin uçtan uca pipeline'ı."""
    if not client.claim(watch.id):
        logger.debug("Watch %s already claimed by another worker", watch.id)
        return

    logger.info("Processing watch %s (%s %s)", watch.id, watch.brand, watch.model)
    try:
        valuation = val_agent.run(watch)
        client.submit_valuation(watch.id, valuation, VALUATION_AGENT_VERSION)
        logger.info(
            "Watch %s valuation: $%s–$%s USD (confidence %.2f)",
            watch.id,
            valuation.estimated_value_min,
            valuation.estimated_value_max,
            valuation.confidence_score,
        )

        seo = seo_agent.run(watch, valuation)
        client.submit_seo(watch.id, seo)
        logger.info("Watch %s SEO description written (%d chars)", watch.id, len(seo.seo_description))

        client.complete(watch.id, success=True)
        logger.info("Watch %s DONE", watch.id)

    except Exception as e:
        logger.exception("Watch %s FAILED", watch.id)
        try:
            client.complete(watch.id, success=False, error=str(e)[:1000])
        except Exception:
            logger.exception("Failed to mark watch %s as failed", watch.id)


def run() -> None:
    """Poller loop entry point — `python -m worker.main` ile çalışır."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    signal.signal(signal.SIGINT, _handle_shutdown)
    signal.signal(signal.SIGTERM, _handle_shutdown)

    settings = get_settings()
    llm = get_llm()
    val_agent = ValuationAgent(llm)
    seo_agent = SEOWriterAgent(llm)

    logger.info(
        "Miyaris AI worker started — polling %s every %ds (batch=%d)",
        settings.MIYARIS_API_URL,
        settings.POLL_INTERVAL_SECONDS,
        settings.BATCH_SIZE,
    )

    with MiyarisClient() as client:
        while not _should_stop:
            try:
                watches = client.fetch_queued(limit=settings.BATCH_SIZE)
                if not watches:
                    logger.debug("No queued watches")
                else:
                    for watch in watches:
                        if _should_stop:
                            break
                        process_watch(client, watch, val_agent, seo_agent)
                        # Worker'ı bombardımandan koru — saat başına küçük gap
                        time.sleep(0.5)
            except Exception:
                logger.exception("Polling cycle failed")

            # Bir sonraki tick'e kadar bekle (interruptable)
            for _ in range(settings.POLL_INTERVAL_SECONDS):
                if _should_stop:
                    break
                time.sleep(1)

    logger.info("Miyaris AI worker stopped")


if __name__ == "__main__":
    run()
