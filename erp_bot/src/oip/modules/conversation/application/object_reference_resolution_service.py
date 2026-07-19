"""MAI-13 slice 2 — read-only store resolution for object-reference candidates.

Reads draft JSON store files and conversation SQLite. Never imports khata
writers. Never merges or posts.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from ....contracts.object_reference import (
    ObjectReferenceCandidateV1,
    ObjectReferenceKind,
    ObjectReferenceResolutionStatus,
    ObjectReferenceResolutionV1,
)

# (draft_kind, store filename) — mirrors khata *_draft._store_path names.
_DRAFT_STORES: tuple[tuple[str, str], ...] = (
    ("sale", "sales_drafts.json"),
    ("purchase", "purchase_drafts.json"),
    ("return", "sales_return_drafts.json"),
    ("purchase_return", "purchase_return_drafts.json"),
    ("financial", "financial_drafts.json"),
    ("bank_recon", "bank_recon_drafts.json"),
)

_TERMINAL_DRAFT_STATUSES = frozenset({"posted", "cancelled"})
_DRAFT_UI_KEYS = frozenset({"draft_id", "active_draft_id"})


def _draft_store_dir() -> Path:
    base = os.environ.get("ORBIX_DRAFT_STORE_DIR") or os.path.join(
        tempfile.gettempdir(), "orbix_drafts"
    )
    return Path(base)


def _read_json_object(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}
    return raw if isinstance(raw, dict) else {}


def peek_draft_record(draft_id: str) -> dict[str, Any] | None:
    """Return first matching draft record across stores (read-only)."""
    did = (draft_id or "").strip()
    if not did:
        return None
    root = _draft_store_dir()
    for draft_kind, filename in _DRAFT_STORES:
        data = _read_json_object(root / filename)
        raw = data.get(did)
        if not isinstance(raw, dict):
            continue
        return {
            "draft_kind": draft_kind,
            "store_name": filename,
            "draft_status": str(raw.get("status") or "unknown"),
            "raw": raw,
        }
    return None


def resolve_sqlite_db_path(database_url: str | None = None) -> Path | None:
    url = database_url or os.environ.get(
        "OIP_DATABASE_URL", "sqlite+aiosqlite:///./data/oip/oip.db"
    )
    # sqlite+aiosqlite:///./data/oip/oip.db or sqlite:///path
    if "://" not in url:
        path = Path(url)
        return path if str(path) else None
    # Strip driver prefixes like sqlite+aiosqlite
    cleaned = re.sub(r"^sqlite\+[^:]+", "sqlite", url, count=1, flags=re.IGNORECASE)
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"sqlite", "file", ""}:
        return None
    path_str = unquote(parsed.path or "")
    if path_str.startswith("/") and len(path_str) > 2 and path_str[2] == ":":
        # Windows absolute: /C:/...
        path_str = path_str[1:]
    if not path_str:
        return None
    return Path(path_str)


def peek_conversation_record(
    *,
    tenant_id: str,
    conversation_id: str,
    database_url: str | None = None,
) -> dict[str, Any] | None:
    """Sync read-only peek of oip_conversations. None if DB/table unavailable."""
    cid = (conversation_id or "").strip()
    tid = (tenant_id or "").strip()
    if not cid or not tid:
        return None
    db_path = resolve_sqlite_db_path(database_url)
    if db_path is None or not db_path.exists():
        return None
    uri = f"file:{db_path.resolve().as_posix()}?mode=ro"
    try:
        with sqlite3.connect(uri, uri=True) as conn:
            row = conn.execute(
                """
                SELECT conversation_id, status, module, message_count
                FROM oip_conversations
                WHERE tenant_id = ? AND conversation_id = ?
                LIMIT 1
                """,
                (tid, cid),
            ).fetchone()
    except sqlite3.Error:
        return None
    if row is None:
        return {"found": False}
    return {
        "found": True,
        "conversation_id": row[0],
        "conversation_status": str(row[1] or "unknown"),
        "module": row[2],
        "message_count": row[3],
    }


def resolve_candidate(
    candidate: ObjectReferenceCandidateV1,
    *,
    tenant_id: str,
    database_url: str | None = None,
) -> ObjectReferenceResolutionV1:
    if candidate.kind == ObjectReferenceKind.CONVERSATION:
        peeked = peek_conversation_record(
            tenant_id=tenant_id,
            conversation_id=candidate.object_id,
            database_url=database_url,
        )
        if peeked is None:
            return ObjectReferenceResolutionV1(
                candidate_id=candidate.candidate_id,
                kind=candidate.kind,
                object_id=candidate.object_id,
                resolution_status=ObjectReferenceResolutionStatus.SKIPPED,
                store_name="oip_conversations",
                reason_codes=("CONVERSATION_STORE_UNAVAILABLE",),
                applied=False,
            )
        if peeked.get("found"):
            return ObjectReferenceResolutionV1(
                candidate_id=candidate.candidate_id,
                kind=candidate.kind,
                object_id=candidate.object_id,
                resolution_status=ObjectReferenceResolutionStatus.CONVERSATION_FOUND,
                store_name="oip_conversations",
                conversation_status=str(peeked.get("conversation_status") or "unknown"),
                reason_codes=("CONVERSATION_STORE_HIT",),
                applied=False,
            )
        return ObjectReferenceResolutionV1(
            candidate_id=candidate.candidate_id,
            kind=candidate.kind,
            object_id=candidate.object_id,
            resolution_status=ObjectReferenceResolutionStatus.CONVERSATION_MISSING,
            store_name="oip_conversations",
            reason_codes=("CONVERSATION_STORE_MISS",),
            applied=False,
        )

    # ACTIVE_DRAFT always; UI draft keys only.
    resolve_as_draft = candidate.kind == ObjectReferenceKind.ACTIVE_DRAFT
    if candidate.kind == ObjectReferenceKind.UI_CONTEXT_OBJECT:
        # reason_codes include key like DRAFT_ID / PARTY_ID
        codes = {c.upper() for c in candidate.reason_codes}
        resolve_as_draft = bool(codes & {k.upper() for k in _DRAFT_UI_KEYS}) or (
            "DRAFT_ID" in codes or "ACTIVE_DRAFT_ID" in codes
        )

    if not resolve_as_draft:
        return ObjectReferenceResolutionV1(
            candidate_id=candidate.candidate_id,
            kind=candidate.kind,
            object_id=candidate.object_id,
            resolution_status=ObjectReferenceResolutionStatus.SKIPPED,
            reason_codes=("NOT_DRAFT_STORE_OBJECT",),
            applied=False,
        )

    record = peek_draft_record(candidate.object_id)
    if record is None:
        return ObjectReferenceResolutionV1(
            candidate_id=candidate.candidate_id,
            kind=candidate.kind,
            object_id=candidate.object_id,
            resolution_status=ObjectReferenceResolutionStatus.MISSING,
            reason_codes=("DRAFT_STORE_MISS",),
            applied=False,
        )
    draft_status = str(record["draft_status"])
    if draft_status in _TERMINAL_DRAFT_STATUSES:
        return ObjectReferenceResolutionV1(
            candidate_id=candidate.candidate_id,
            kind=candidate.kind,
            object_id=candidate.object_id,
            resolution_status=ObjectReferenceResolutionStatus.NOT_PENDING,
            store_name=str(record["store_name"]),
            draft_kind=str(record["draft_kind"]),
            draft_status=draft_status,
            reason_codes=("DRAFT_TERMINAL_STATUS", draft_status.upper()),
            applied=False,
        )
    return ObjectReferenceResolutionV1(
        candidate_id=candidate.candidate_id,
        kind=candidate.kind,
        object_id=candidate.object_id,
        resolution_status=ObjectReferenceResolutionStatus.FOUND,
        store_name=str(record["store_name"]),
        draft_kind=str(record["draft_kind"]),
        draft_status=draft_status,
        reason_codes=("DRAFT_STORE_HIT",),
        applied=False,
    )


def resolve_candidates(
    candidates: tuple[ObjectReferenceCandidateV1, ...] | list[ObjectReferenceCandidateV1],
    *,
    tenant_id: str,
    database_url: str | None = None,
) -> tuple[ObjectReferenceResolutionV1, ...]:
    return tuple(
        resolve_candidate(c, tenant_id=tenant_id, database_url=database_url)
        for c in candidates
    )
