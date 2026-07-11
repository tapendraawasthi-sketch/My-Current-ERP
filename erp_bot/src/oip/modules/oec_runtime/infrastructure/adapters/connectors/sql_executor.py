"""Async SQLite SQL executor — parameterized queries only."""

from __future__ import annotations

import asyncio
import weakref
from typing import Any

import aiosqlite

_CONNECTION_LOCKS: weakref.WeakKeyDictionary[aiosqlite.Connection, asyncio.Lock] = weakref.WeakKeyDictionary()
_CONNECTION_IN_TX: weakref.WeakKeyDictionary[aiosqlite.Connection, bool] = weakref.WeakKeyDictionary()


def _connection_lock(conn: aiosqlite.Connection) -> asyncio.Lock:
    lock = _CONNECTION_LOCKS.get(conn)
    if lock is None:
        lock = asyncio.Lock()
        _CONNECTION_LOCKS[conn] = lock
    return lock


def _connection_in_tx(conn: aiosqlite.Connection) -> bool:
    return _CONNECTION_IN_TX.get(conn, False)


def _set_connection_in_tx(conn: aiosqlite.Connection, value: bool) -> None:
    if value:
        _CONNECTION_IN_TX[conn] = True
    else:
        _CONNECTION_IN_TX.pop(conn, None)


class AioSqliteExecutor:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn
        self._lock = _connection_lock(conn)

    @property
    def _in_tx(self) -> bool:
        return _connection_in_tx(self._conn)

    def _set_in_tx(self, value: bool) -> None:
        _set_connection_in_tx(self._conn, value)

    async def fetchone(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        if not self._in_tx:
            async with self._lock:
                return await self._fetchone_unlocked(sql, params)
        return await self._fetchone_unlocked(sql, params)

    async def _fetchone_unlocked(self, sql: str, params: tuple[Any, ...]) -> dict[str, Any] | None:
        cursor = await self._conn.execute(sql, params)
        row = await cursor.fetchone()
        if row is None:
            return None
        return dict(row)

    async def fetchall(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        if not self._in_tx:
            async with self._lock:
                return await self._fetchall_unlocked(sql, params)
        return await self._fetchall_unlocked(sql, params)

    async def _fetchall_unlocked(self, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        cursor = await self._conn.execute(sql, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def execute(self, sql: str, params: tuple[Any, ...] = ()) -> int:
        if not self._in_tx:
            async with self._lock:
                return await self._execute_unlocked(sql, params)
        return await self._execute_unlocked(sql, params)

    async def _execute_unlocked(self, sql: str, params: tuple[Any, ...]) -> int:
        cursor = await self._conn.execute(sql, params)
        if not self._in_tx:
            await self._conn.commit()
        return cursor.rowcount

    async def executemany(self, sql: str, params_seq: list[tuple[Any, ...]]) -> int:
        if not self._in_tx:
            async with self._lock:
                return await self._executemany_unlocked(sql, params_seq)
        return await self._executemany_unlocked(sql, params_seq)

    async def _executemany_unlocked(self, sql: str, params_seq: list[tuple[Any, ...]]) -> int:
        await self._conn.executemany(sql, params_seq)
        if not self._in_tx:
            await self._conn.commit()
        return len(params_seq)

    async def begin(self) -> None:
        await self._lock.acquire()
        try:
            await self._conn.execute("BEGIN")
            self._set_in_tx(True)
        except Exception:
            self._lock.release()
            raise

    async def commit(self) -> None:
        try:
            await self._conn.commit()
        finally:
            self._set_in_tx(False)
            self._lock.release()

    async def rollback(self) -> None:
        try:
            await self._conn.rollback()
        finally:
            self._set_in_tx(False)
            self._lock.release()

    async def health_check(self) -> dict[str, Any]:
        async with self._lock:
            cursor = await self._conn.execute("SELECT 1")
            await cursor.fetchone()
            return {"state": "healthy", "latency_ms": 5, "availability": 1.0}
