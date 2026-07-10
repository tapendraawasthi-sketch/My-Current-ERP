"""Background worker for knowledge ingestion jobs."""

from __future__ import annotations

import logging
import threading
import time

from backend.knowledge.config import WORKER_ENABLED, WORKER_POLL_INTERVAL_SEC
from backend.knowledge.container import get_knowledge_container

logger = logging.getLogger(__name__)

_worker_thread: threading.Thread | None = None
_stop_event = threading.Event()


def _worker_loop() -> None:
    container = get_knowledge_container()
    orchestrator = container.orchestrator
    queue = container.job_queue
    repo = container.repository

    logger.info("Knowledge ingestion worker started")
    while not _stop_event.is_set():
        try:
            job_id = queue.dequeue(timeout_sec=WORKER_POLL_INTERVAL_SEC)
            if job_id is not None:
                orchestrator.process_job(job_id)
                continue

            claimed = repo.claim_next_job()
            if claimed:
                orchestrator.process_job(claimed.id)
        except Exception as exc:
            logger.exception("Worker loop error: %s", exc)
            time.sleep(1.0)
    logger.info("Knowledge ingestion worker stopped")


def start_knowledge_worker() -> None:
    """Start the background ingestion worker thread."""
    global _worker_thread
    if not WORKER_ENABLED:
        logger.info("Knowledge worker disabled (KNOWLEDGE_WORKER_ENABLED=false)")
        return
    if _worker_thread and _worker_thread.is_alive():
        return
    _stop_event.clear()
    _worker_thread = threading.Thread(
        target=_worker_loop,
        name="knowledge-ingestion-worker",
        daemon=True,
    )
    _worker_thread.start()


def stop_knowledge_worker() -> None:
    """Signal the worker to stop."""
    _stop_event.set()
