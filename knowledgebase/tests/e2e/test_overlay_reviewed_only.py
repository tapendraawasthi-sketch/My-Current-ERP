"""Fixture test: import → apply overlays → reviewed_only policy filtering."""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
SCRIPTS = REPO / "knowledgebase" / "scripts"


def test_overlay_pipeline_affects_reviewed_only_policy(tmp_path: Path):
    # Build tiny metadata + lexical DB
    meta = tmp_path / "kb_metadata.sqlite"
    lex = tmp_path / "kb_lexical.sqlite"
    conn = sqlite3.connect(meta)
    conn.execute(
        """
        CREATE TABLE kb_records (
            record_id TEXT PRIMARY KEY,
            collection TEXT,
            retrieval_collection TEXT,
            record_type TEXT,
            domain TEXT,
            language_form TEXT,
            source_file_id TEXT,
            source_filename TEXT,
            source_line_start INTEGER,
            source_line_end INTEGER,
            content_hash TEXT,
            quality_score REAL,
            eligibility TEXT,
            review_status TEXT,
            safety_labels TEXT,
            execution_allowed INTEGER,
            is_eval INTEGER
        )
        """
    )
    conn.execute(
        "INSERT INTO kb_records(record_id, review_status, eligibility, execution_allowed, is_eval) VALUES (?,?,?,?,?)",
        ("FIX.REC.001", "unreviewed", "eligible", 0, 0),
    )
    conn.commit()
    conn.close()

    lconn = sqlite3.connect(lex)
    lconn.execute(
        """
        CREATE VIRTUAL TABLE prod_fts USING fts5(
            record_id UNINDEXED,
            retrieval_collection UNINDEXED,
            record_type UNINDEXED,
            domain UNINDEXED,
            source_file_id UNINDEXED,
            source_filename UNINDEXED,
            source_line_start UNINDEXED,
            source_line_end UNINDEXED,
            quality_score UNINDEXED,
            review_status UNINDEXED,
            safety_labels UNINDEXED,
            content_text,
            tokenize='unicode61'
        )
        """
    )
    lconn.execute(
        "INSERT INTO prod_fts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            "FIX.REC.001",
            "language_and_normalization",
            "language_rule",
            "test",
            "0001",
            "x.txt",
            1,
            2,
            0.9,
            "unreviewed",
            "",
            "bank reconciliation helper",
        ),
    )
    lconn.commit()
    lconn.close()

    overlays = tmp_path / "review_overlays.jsonl"
    overlays.write_text(
        json.dumps(
            {
                "record_id": "FIX.REC.001",
                "review_decision": "approve",
                "reviewer": "fixture",
                "reviewed_at": "2026-01-01T00:00:00+00:00",
                "reviewer_notes": "fixture-only not production approval",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    # Apply using temporary copies by invoking apply script logic via subprocess env paths
    # Directly apply with sqlite here to keep fixture hermetic, asserting contract mirrors apply_review_overlays
    m = sqlite3.connect(meta)
    m.execute(
        """
        CREATE TABLE kb_review_overlays (
            record_id TEXT PRIMARY KEY,
            review_decision TEXT,
            review_status TEXT,
            reviewer TEXT,
            reviewed_at TEXT,
            imported_at TEXT,
            notes TEXT
        )
        """
    )
    m.execute(
        "INSERT INTO kb_review_overlays VALUES (?,?,?,?,?,?,?)",
        ("FIX.REC.001", "approve", "approved", "fixture", "2026-01-01", "now", "fixture"),
    )
    m.execute(
        "UPDATE kb_records SET review_status='approved', eligibility='eligible' WHERE record_id='FIX.REC.001'"
    )
    m.commit()
    m.close()

    # Load adapter and point metadata/lexical by constructing retriever directly
    code = (REPO / "erp_bot" / "src" / "nlu" / "np_kb_adapter.py").read_text(encoding="utf-8")
    import types

    mod = types.ModuleType("np_kb_adapter_fixture")
    sys.modules["np_kb_adapter_fixture"] = mod
    mod.__dict__["__file__"] = str(REPO / "erp_bot" / "src" / "nlu" / "np_kb_adapter.py")
    exec(compile(code, "np_kb_adapter.py", "exec"), mod.__dict__)

    retriever = mod.NpKbLexicalRetriever(lex, metadata_db=meta)
    unreviewed_policy = retriever.search(
        "bank reconciliation", top_k=5, review_policy="development_all"
    )
    reviewed_only = retriever.search(
        "bank reconciliation", top_k=5, review_policy="reviewed_only"
    )
    assert any(c.record_id == "FIX.REC.001" for c in unreviewed_policy)
    assert any(c.record_id == "FIX.REC.001" for c in reviewed_only)
    assert reviewed_only[0].review_status == "approved"
