"""SQLite-backed working / episodic / semantic memory for Orbix v2.

Uses aiosqlite so the reasoning loop never blocks on disk I/O. Episodic search
is keyword-based (LIKE + token overlap ranking) which is dependency-free and
good enough for "what did I enter yesterday / repeat for Shyam" recall.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

_SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class MemoryStore:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self._initialized = False

    async def init(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        schema = _SCHEMA_PATH.read_text(encoding="utf-8")
        async with aiosqlite.connect(self.db_path) as db:
            await db.executescript(schema)
            await db.commit()
        self._initialized = True

    # ── working memory ──────────────────────────────────────────────────────
    async def get_working_memory(self, session_id: str) -> dict[str, Any]:
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT working_state_json FROM sessions WHERE id = ?", (session_id,)
            ) as cur:
                row = await cur.fetchone()
        if not row:
            return {}
        try:
            return json.loads(row[0] or "{}")
        except Exception:
            return {}

    async def update_working_memory(self, session_id: str, patch: dict[str, Any]) -> dict[str, Any]:
        current = await self.get_working_memory(session_id)
        current.update(patch)
        payload = json.dumps(current, default=str)
        now = _now()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO sessions (id, created_at, updated_at, working_state_json)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    working_state_json = excluded.working_state_json,
                    updated_at = excluded.updated_at
                """,
                (session_id, now, now, payload),
            )
            await db.commit()
        return current

    async def clear_working_memory(self, session_id: str) -> None:
        await self.update_working_memory(session_id, {})
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE sessions SET working_state_json = '{}' WHERE id = ?",
                (session_id,),
            )
            await db.commit()

    # ── episodic memory ─────────────────────────────────────────────────────
    async def write_episode(self, episode: dict[str, Any]) -> str:
        ep_id = episode.get("id") or _new_id("ep")
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO episodes
                    (id, session_id, user_id, company_id, user_message, agent_answer,
                     intent, tool_trace_json, evidence_json, summary, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    ep_id,
                    episode.get("session_id", ""),
                    episode.get("user_id"),
                    episode.get("company_id"),
                    episode.get("user_message", ""),
                    episode.get("agent_answer", ""),
                    episode.get("intent"),
                    json.dumps(episode.get("tool_trace", []), default=str),
                    json.dumps(episode.get("evidence", []), default=str),
                    episode.get("summary"),
                    _now(),
                ),
            )
            await db.commit()
        return ep_id

    async def search_episodes(
        self, query: str, user_id: str | None = None, session_id: str | None = None, k: int = 5
    ) -> list[dict[str, Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        if user_id:
            clauses.append("user_id = ?")
            params.append(user_id)
        if session_id:
            clauses.append("session_id = ?")
            params.append(session_id)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                f"SELECT * FROM episodes {where} ORDER BY created_at DESC LIMIT 200",
                params,
            ) as cur:
                rows = [dict(r) for r in await cur.fetchall()]

        tokens = {t for t in re.findall(r"\w+", query.lower()) if len(t) >= 3}
        scored: list[tuple[float, dict]] = []
        for r in rows:
            hay = f"{r.get('user_message','')} {r.get('agent_answer','')} {r.get('summary','')}".lower()
            score = sum(1 for t in tokens if t in hay)
            if score or not tokens:
                scored.append((score, r))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [r for _, r in scored[:k]]

    async def recent_episodes(self, session_id: str, k: int = 5) -> list[dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM episodes WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
                (session_id, k),
            ) as cur:
                return [dict(r) for r in await cur.fetchall()]

    # ── semantic facts ──────────────────────────────────────────────────────
    async def write_semantic_fact(self, fact: dict[str, Any]) -> str:
        fid = fact.get("id") or _new_id("fact")
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO semantic_facts
                    (id, namespace, subject, predicate, object, confidence,
                     source_type, source_uri, source_hash, valid_from, valid_until)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    fid,
                    fact.get("namespace", "default"),
                    fact.get("subject", ""),
                    fact.get("predicate", ""),
                    fact.get("object", ""),
                    float(fact.get("confidence", 0.5)),
                    fact.get("source_type", "generated"),
                    fact.get("source_uri"),
                    fact.get("source_hash"),
                    fact.get("valid_from") or _now(),
                    fact.get("valid_until"),
                ),
            )
            await db.commit()
        return fid

    async def search_semantic_facts(self, query: str, namespace: str | None = None, k: int = 5) -> list[dict]:
        clauses: list[str] = []
        params: list[Any] = []
        if namespace:
            clauses.append("namespace = ?")
            params.append(namespace)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                f"SELECT * FROM semantic_facts {where} ORDER BY confidence DESC LIMIT 100",
                params,
            ) as cur:
                rows = [dict(r) for r in await cur.fetchall()]
        tokens = {t for t in re.findall(r"\w+", query.lower()) if len(t) >= 3}
        scored = []
        for r in rows:
            hay = f"{r['subject']} {r['predicate']} {r['object']}".lower()
            score = sum(1 for t in tokens if t in hay)
            if score:
                scored.append((score, r))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [r for _, r in scored[:k]]

    # ── audit ───────────────────────────────────────────────────────────────
    async def log_tool_call(
        self, session_id: str | None, tool_name: str, args: dict, result: dict, ok: bool
    ) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO tool_audit_log
                    (id, session_id, tool_name, args_json, result_json, ok, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    _new_id("audit"),
                    session_id,
                    tool_name,
                    json.dumps(args, default=str)[:8000],
                    json.dumps(result, default=str)[:8000],
                    1 if ok else 0,
                    _now(),
                ),
            )
            await db.commit()

    async def forget_session(self, session_id: str) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM episodes WHERE session_id = ?", (session_id,))
            await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            await db.commit()
