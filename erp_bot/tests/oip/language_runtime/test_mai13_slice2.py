"""MAI-13 slice 2 — read-only object-reference store resolution."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from src.oip.contracts.object_reference import ObjectReferenceResolutionStatus
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.object_reference_service import (
    RUNTIME_VERSION,
    attach_object_references_to_request,
    build_object_reference_bundle,
)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-13.0.2-slice2"


def _write_sales_draft(store_dir: Path, *, draft_id: str, status: str) -> None:
    store_dir.mkdir(parents=True, exist_ok=True)
    path = store_dir / "sales_drafts.json"
    data = {
        draft_id: {
            "draft_id": draft_id,
            "status": status,
            "tenant_id": "tenant-a",
            "company_id": "co-1",
            "session_id": "sess-1",
        }
    }
    path.write_text(json.dumps(data), encoding="utf-8")


def _make_conversation_db(db_path: Path, *, tenant_id: str, conversation_id: str) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE oip_conversations (
                conversation_id TEXT PRIMARY KEY,
                tenant_id TEXT,
                session_id TEXT,
                user_id TEXT,
                company_id TEXT,
                branch_id TEXT,
                module TEXT,
                status TEXT,
                message_count INTEGER,
                started_at TEXT,
                updated_at TEXT,
                closed_at TEXT
            )
            """
        )
        conn.execute(
            """
            INSERT INTO oip_conversations (
                conversation_id, tenant_id, session_id, user_id, company_id, branch_id,
                module, status, message_count, started_at, updated_at, closed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                conversation_id,
                tenant_id,
                "sess-1",
                "user-1",
                "co-1",
                None,
                "orbix",
                "active",
                1,
                datetime.now(timezone.utc).isoformat(),
                datetime.now(timezone.utc).isoformat(),
                None,
            ),
        )
        conn.commit()


def test_pending_draft_found(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ORBIX_DRAFT_STORE_DIR", str(tmp_path / "drafts"))
    _write_sales_draft(tmp_path / "drafts", draft_id="draft-ok", status="awaiting_clarification")
    db = tmp_path / "oip.db"
    _make_conversation_db(db, tenant_id="tenant-a", conversation_id="conv-1")
    bundle = build_object_reference_bundle(
        conversation_id="conv-1",
        active_draft_reference="draft-ok",
        tenant_id="tenant-a",
        database_url=f"sqlite+aiosqlite:///{db.as_posix()}",
    )
    assert bundle.runtime_version == RUNTIME_VERSION
    assert bundle.silent_applications == 0
    assert bundle.draft_mutations == 0
    statuses = {r.object_id: r.resolution_status for r in bundle.resolutions}
    assert statuses["draft-ok"] == ObjectReferenceResolutionStatus.FOUND
    draft_res = next(r for r in bundle.resolutions if r.object_id == "draft-ok")
    assert draft_res.draft_kind == "sale"
    assert draft_res.applied is False
    assert statuses["conv-1"] == ObjectReferenceResolutionStatus.CONVERSATION_FOUND
    assert bundle.found_count >= 2


def test_missing_draft(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ORBIX_DRAFT_STORE_DIR", str(tmp_path / "drafts"))
    (tmp_path / "drafts").mkdir(parents=True, exist_ok=True)
    bundle = build_object_reference_bundle(
        conversation_id="conv-x",
        active_draft_reference="draft-missing",
        tenant_id="tenant-a",
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'missing.db').as_posix()}",
    )
    draft_res = next(r for r in bundle.resolutions if r.object_id == "draft-missing")
    assert draft_res.resolution_status == ObjectReferenceResolutionStatus.MISSING
    assert bundle.missing_count >= 1


def test_posted_draft_not_pending(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ORBIX_DRAFT_STORE_DIR", str(tmp_path / "drafts"))
    _write_sales_draft(tmp_path / "drafts", draft_id="draft-posted", status="posted")
    bundle = build_object_reference_bundle(
        conversation_id="conv-y",
        active_draft_reference="draft-posted",
        tenant_id="tenant-a",
    )
    draft_res = next(r for r in bundle.resolutions if r.object_id == "draft-posted")
    assert draft_res.resolution_status == ObjectReferenceResolutionStatus.NOT_PENDING
    assert draft_res.draft_status == "posted"
    assert bundle.not_pending_count == 1


def test_ui_party_skipped_not_draft_store(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ORBIX_DRAFT_STORE_DIR", str(tmp_path / "drafts"))
    bundle = build_object_reference_bundle(
        conversation_id="conv-z",
        active_ui_context={"party_id": "party-9"},
        tenant_id="tenant-a",
    )
    party = next(r for r in bundle.resolutions if r.object_id == "party-9")
    assert party.resolution_status == ObjectReferenceResolutionStatus.SKIPPED
    assert "NOT_DRAFT_STORE_OBJECT" in party.reason_codes


def test_attach_preserves_raw_text(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ORBIX_DRAFT_STORE_DIR", str(tmp_path / "drafts"))
    _write_sales_draft(tmp_path / "drafts", draft_id="draft-a", status="draft")
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="aaja ko bikri",
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
        active_draft_reference="draft-a",
    )
    updated = attach_object_references_to_request(req)
    assert updated.raw_text == req.raw_text
    assert updated.object_reference_bundle is not None
    assert updated.object_reference_bundle.resolution_count >= 1


def test_no_khata_writer_imports() -> None:
    import ast
    from pathlib import Path as P

    path = (
        P(__file__).resolve().parents[3]
        / "src"
        / "oip"
        / "modules"
        / "conversation"
        / "application"
        / "object_reference_resolution_service.py"
    )
    tree = ast.parse(path.read_text(encoding="utf-8"))
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.append(node.module)
    joined = " ".join(imports)
    assert "khata" not in joined
    assert "save_draft" not in path.read_text(encoding="utf-8")
    assert "mark_posted" not in path.read_text(encoding="utf-8")


def test_frozen_eval_fixtures(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("ORBIX_DRAFT_STORE_DIR", str(tmp_path / "drafts"))
    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai13"
        / "frozen"
        / "object_reference_store_resolve_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        drafts_dir = tmp_path / "drafts" / case["case_id"]
        monkeypatch.setenv("ORBIX_DRAFT_STORE_DIR", str(drafts_dir))
        for d in case.get("seed_drafts", []):
            _write_sales_draft(
                drafts_dir,
                draft_id=d["draft_id"],
                status=d["status"],
            )
        db_url = None
        if case.get("seed_conversation"):
            db = tmp_path / f"{case['case_id']}.db"
            sc = case["seed_conversation"]
            _make_conversation_db(
                db,
                tenant_id=sc["tenant_id"],
                conversation_id=sc["conversation_id"],
            )
            db_url = f"sqlite+aiosqlite:///{db.as_posix()}"
        bundle = build_object_reference_bundle(
            conversation_id=case["conversation_id"],
            active_draft_reference=case.get("active_draft_reference"),
            active_ui_context=case.get("active_ui_context") or {},
            tenant_id=case.get("tenant_id") or "tenant-a",
            database_url=db_url,
        )
        assert bundle.silent_applications == 0
        assert bundle.draft_mutations == 0
        by_id = {r.object_id: r.resolution_status.value for r in bundle.resolutions}
        for object_id, expected in case.get("expected_resolutions", {}).items():
            assert by_id.get(object_id) == expected, (
                f"{case['case_id']}: {object_id} got {by_id.get(object_id)} want {expected}"
            )
