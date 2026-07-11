"""SQLite connection helper for OIP persistence."""

from __future__ import annotations

import os
from pathlib import Path

import aiosqlite


async def open_oip_database(database_url: str) -> aiosqlite.Connection:
    """Open SQLite database from OIP_DATABASE_URL (sqlite+aiosqlite:///path)."""
    if database_url.startswith("sqlite+aiosqlite:///"):
        path = database_url.replace("sqlite+aiosqlite:///", "", 1)
    elif database_url.startswith("sqlite:///"):
        path = database_url.replace("sqlite:///", "", 1)
    else:
        path = database_url

    db_path = Path(path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = await aiosqlite.connect(str(db_path))
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA foreign_keys=ON")
    return conn


async def migrate_oip_schema(conn: aiosqlite.Connection) -> None:
    oip_root = Path(__file__).resolve().parents[2]
    migration_paths: list[Path] = []
    migration_paths.extend(sorted((Path(__file__).parent / "migrations").glob("*.sql")))
    migration_paths.extend(sorted(oip_root.glob("modules/*/infrastructure/persistence/migrations/*.sql")))
    seen: set[str] = set()
    for migration_path in migration_paths:
        if migration_path.name in seen:
            continue
        seen.add(migration_path.name)
        sql = migration_path.read_text(encoding="utf-8")
        await conn.executescript(sql)
    await conn.commit()
