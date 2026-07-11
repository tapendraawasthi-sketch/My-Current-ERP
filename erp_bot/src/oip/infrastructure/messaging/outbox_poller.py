"""Background outbox poller."""

from __future__ import annotations

import asyncio

from .outbox_dispatcher import OutboxDispatcher


class OutboxPoller:
    def __init__(
        self,
        dispatcher: OutboxDispatcher,
        *,
        interval_seconds: float = 5.0,
        batch_size: int = 100,
    ) -> None:
        self._dispatcher = dispatcher
        self._interval_seconds = interval_seconds
        self._batch_size = batch_size
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop(self) -> None:
        while self._running:
            try:
                await self._dispatcher.dispatch_pending(limit=self._batch_size)
            except Exception:  # noqa: BLE001
                pass
            await asyncio.sleep(self._interval_seconds)

    async def tick(self) -> int:
        return await self._dispatcher.dispatch_pending(limit=self._batch_size)
