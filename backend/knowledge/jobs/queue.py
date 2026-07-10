"""Redis-backed job queue with in-memory fallback."""

from __future__ import annotations

import logging
import queue
import threading
import time
from uuid import UUID

from backend.knowledge.config import REDIS_URL

logger = logging.getLogger(__name__)

_QUEUE_KEY = "knowledge:ingestion:queue"
_RETRY_KEY = "knowledge:ingestion:retry"
_RETRY_SCHEDULE_KEY = "knowledge:ingestion:retry_schedule"


class InMemoryJobQueue:
    """Dev/test queue using thread-safe FIFO."""

    def __init__(self) -> None:
        self._queue: queue.Queue[tuple[float, str]] = queue.Queue()
        self._lock = threading.Lock()

    def enqueue(self, job_id: UUID, *, delay_sec: float = 0) -> None:
        run_at = time.time() + max(0.0, delay_sec)
        self._queue.put((run_at, str(job_id)))

    def dequeue(self, timeout_sec: float = 2.0) -> UUID | None:
        deadline = time.time() + timeout_sec
        while time.time() < deadline:
            try:
                run_at, job_id = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            if run_at > time.time():
                self._queue.put((run_at, job_id))
                time.sleep(0.2)
                continue
            return UUID(job_id)
        return None

    def enqueue_retry(self, job_id: UUID, delay_sec: float) -> None:
        self.enqueue(job_id, delay_sec=delay_sec)


class RedisJobQueue:
    """Production queue using Redis lists + sorted set for delayed retries."""

    def __init__(self, url: str) -> None:
        import redis

        self._redis = redis.from_url(url, decode_responses=True)

    def enqueue(self, job_id: UUID, *, delay_sec: float = 0) -> None:
        if delay_sec > 0:
            run_at = time.time() + delay_sec
            self._redis.zadd(_RETRY_SCHEDULE_KEY, {str(job_id): run_at})
        else:
            self._redis.lpush(_QUEUE_KEY, str(job_id))

    def dequeue(self, timeout_sec: float = 2.0) -> UUID | None:
        self._promote_retries()
        result = self._redis.brpop(_QUEUE_KEY, timeout=max(1, int(timeout_sec)))
        if result:
            return UUID(result[1])
        return None

    def enqueue_retry(self, job_id: UUID, delay_sec: float) -> None:
        self.enqueue(job_id, delay_sec=delay_sec)

    def _promote_retries(self) -> None:
        now = time.time()
        due = self._redis.zrangebyscore(_RETRY_SCHEDULE_KEY, 0, now)
        if not due:
            return
        pipe = self._redis.pipeline()
        for job_id in due:
            pipe.lpush(_QUEUE_KEY, job_id)
            pipe.zrem(_RETRY_SCHEDULE_KEY, job_id)
        pipe.execute()


def create_job_queue():
    """Factory: Redis when configured, else in-memory."""
    if REDIS_URL:
        try:
            q = RedisJobQueue(REDIS_URL)
            q._redis.ping()
            logger.info("Knowledge job queue: Redis")
            return q
        except Exception as exc:
            logger.warning("Redis unavailable, using in-memory queue: %s", exc)
    logger.info("Knowledge job queue: in-memory")
    return InMemoryJobQueue()
