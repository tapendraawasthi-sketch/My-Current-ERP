"""Dedicated thread pool for async I/O offload."""

from __future__ import annotations

import asyncio
import atexit
import os
import threading
from collections.abc import Awaitable, Callable
from concurrent.futures import ThreadPoolExecutor
from typing import ParamSpec, TypeVar

P = ParamSpec("P")
T = TypeVar("T")

_pool_lock = threading.Lock()
_pool: ThreadPoolExecutor | None = None


def _default_workers() -> int:
    return int(os.getenv("R2_IO_THREAD_POOL_WORKERS", "8"))


def get_io_executor() -> ThreadPoolExecutor:
    """Return the shared I/O thread pool."""
    global _pool
    with _pool_lock:
        if _pool is None:
            workers = max(2, _default_workers())
            _pool = ThreadPoolExecutor(
                max_workers=workers,
                thread_name_prefix="r2-io",
            )
        return _pool


def shutdown_io_executor() -> None:
    """Shut down the I/O pool (tests and graceful shutdown)."""
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.shutdown(wait=False, cancel_futures=True)
            _pool = None


def run_sync_in_executor(
    loop: asyncio.AbstractEventLoop | None,
    func: Callable[P, T],
    /,
    *args: P.args,
    **kwargs: P.kwargs,
) -> Awaitable[T]:
    """Run a blocking storage call in the dedicated I/O thread pool."""
    event_loop = loop or asyncio.get_running_loop()
    return event_loop.run_in_executor(
        get_io_executor(), lambda: func(*args, **kwargs)
    )


atexit.register(shutdown_io_executor)
