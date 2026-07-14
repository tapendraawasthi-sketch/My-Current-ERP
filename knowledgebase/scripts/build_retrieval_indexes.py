#!/usr/bin/env python3
"""KB Phase 5 — Build SQLite FTS5 lexical index and metadata store (streaming)."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Any, Iterator

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import (  # noqa: E402
    REPO_ROOT,
    atomic_write_json,
    load_config,
    rel_to_repo,
    setup_logging,
    update_phase,
    utc_now_iso,
)

logger = setup_logging("build_retrieval_indexes")

EVAL_COLLECTIONS = {"gold_tests", "adversarial_tests", "e2e_tests"}

COLLECTION_TO_RETRIEVAL: dict[str, str] = {
    "language_rules": "language_and_normalization",
    "lexicon": "language_and_normalization",
    "normalization_examples": "language_and_normalization",
    "intent_examples": "intent_and_dialogue",
    "entity_examples": "intent_and_dialogue",
    "slot_examples": "intent_and_dialogue",
    "dialogue_examples": "intent_and_dialogue",
    "domain_records": "accounting_and_erp",
    "safety_rules": "safety_and_governance",
    "authorization_rules": "safety_and_governance",
    "runtime_contracts": "safety_and_governance",
    "gold_tests": "evaluation_only",
    "adversarial_tests": "evaluation_only",
    "e2e_tests": "evaluation_only",
    "unclassified_records": "language_and_normalization",
}

DOMAIN_ROUTING: dict[str, list[str]] = {
    "ACCOUNTING": ["accounting_and_erp", "language_and_normalization"],
    "BANKING": ["accounting_and_erp", "safety_and_governance"],
    "TAXATION": ["accounting_and_erp"],
    "PAYROLL_HR": ["accounting_and_erp"],
    "SECURITY": ["safety_and_governance"],
    "REGULATORY": ["accounting_and_erp", "safety_and_governance"],
    "DEFAULT": ["language_and_normalization", "intent_and_dialogue"],
}


def iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    if not path.exists():
        return
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                yield json.loads(line)


def retrieval_collection(record: dict[str, Any]) -> str:
    coll = record.get("collection", "unclassified_records")
    if coll in EVAL_COLLECTIONS:
        return "evaluation_only"
    return COLLECTION_TO_RETRIEVAL.get(str(coll), "language_and_normalization")


def init_lexical_db(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    for table in ("prod_fts", "eval_fts"):
        conn.execute(
            f"""
            CREATE VIRTUAL TABLE {table} USING fts5(
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
    conn.commit()
    return conn


def init_metadata_db(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
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
            is_eval INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE kb_quality (
            record_id TEXT PRIMARY KEY,
            quality_score REAL,
            eligibility TEXT,
            exact_duplicate INTEGER,
            near_duplicate_neighbors INTEGER
        )
        """
    )
    conn.execute("CREATE INDEX idx_kb_retrieval ON kb_records(retrieval_collection)")
    conn.execute("CREATE INDEX idx_kb_eligibility ON kb_records(eligibility)")
    conn.commit()
    return conn


def import_annotations(meta_conn: sqlite3.Connection, records_dir: Path) -> int:
    path = records_dir / "quality_annotations.jsonl"
    if not path.exists():
        return 0
    n = 0
    batch: list[tuple[Any, ...]] = []
    for row in iter_jsonl(path):
        batch.append(
            (
                row.get("record_id"),
                row.get("quality_score"),
                row.get("eligibility"),
                1 if row.get("exact_duplicate") else 0,
                int(row.get("near_duplicate_neighbors") or 0),
            )
        )
        if len(batch) >= 5000:
            meta_conn.executemany(
                "INSERT OR REPLACE INTO kb_quality VALUES (?, ?, ?, ?, ?)", batch
            )
            n += len(batch)
            batch.clear()
    if batch:
        meta_conn.executemany(
            "INSERT OR REPLACE INTO kb_quality VALUES (?, ?, ?, ?, ?)", batch
        )
        n += len(batch)
    meta_conn.commit()
    return n


def run(
    *,
    repo_root: Path,
    jsonl_dir: Path,
    records_dir: Path,
    lexical_dir: Path,
    metadata_dir: Path,
    manifests_dir: Path,
) -> int:
    cfg = load_config(repo_root)
    update_phase(
        "5",
        name="Retrieval Indexes and Routing Map",
        status="in_progress",
        start=True,
        next_phase="6",
    )

    lexical_path = lexical_dir / "kb_lexical.sqlite"
    metadata_path = metadata_dir / "kb_metadata.sqlite"
    lex_conn = init_lexical_db(lexical_path)
    meta_conn = init_metadata_db(metadata_path)

    annotations_count = import_annotations(meta_conn, records_dir)
    logger.info("Imported quality annotations: %s", annotations_count)

    quarantine_ids: set[str] = set()
    if annotations_count:
        for row in meta_conn.execute(
            "SELECT record_id FROM kb_quality WHERE eligibility = 'quarantined'"
        ):
            quarantine_ids.add(row[0])

    counts: dict[str, int] = {c: 0 for c in cfg["retrieval_collections"]}
    prod_count = 0
    eval_count = 0
    inserted = 0
    batch_size = 5000

    for path in sorted(jsonl_dir.glob("*.jsonl")):
        batch_prod: list[tuple[Any, ...]] = []
        batch_eval: list[tuple[Any, ...]] = []
        batch_meta: list[tuple[Any, ...]] = []
        for rec in iter_jsonl(path):
            if rec.get("parse_status") == "quarantined":
                continue
            rid = rec.get("record_id")
            if not rid or rid in quarantine_ids:
                continue

            eligibility = rec.get("eligibility") or "eligible"
            quality_score = rec.get("quality_score")

            rcoll = retrieval_collection(rec)
            counts[rcoll] = counts.get(rcoll, 0) + 1
            domain = rec.get("domain")
            domain_s = (
                "|".join(str(x) for x in domain)
                if isinstance(domain, list)
                else str(domain or "")
            )
            is_eval = 1 if rcoll == "evaluation_only" else 0
            safety = rec.get("safety_labels") or []
            safety_s = (
                ",".join(str(x) for x in safety[:20])
                if isinstance(safety, list)
                else str(safety)
            )
            review_status = rec.get("review_status")
            if isinstance(review_status, list):
                review_status = ",".join(str(x) for x in review_status[:10])
            elif review_status is not None:
                review_status = str(review_status)

            record_type = rec.get("record_type")
            if isinstance(record_type, list):
                record_type = "|".join(str(x) for x in record_type)
            language_form = rec.get("language_form")
            if isinstance(language_form, list):
                language_form = "|".join(str(x) for x in language_form)

            fts_row = (
                rid,
                rcoll,
                record_type,
                domain_s,
                str(rec.get("source_file_id") or ""),
                str(rec.get("source_filename") or ""),
                rec.get("source_line_start"),
                rec.get("source_line_end"),
                quality_score if not isinstance(quality_score, (list, dict)) else None,
                review_status,
                safety_s,
                rec.get("content_text") or "",
            )
            if is_eval:
                batch_eval.append(fts_row)
                eval_count += 1
            else:
                batch_prod.append(fts_row)
                prod_count += 1

            batch_meta.append(
                (
                    rid,
                    str(rec.get("collection") or ""),
                    rcoll,
                    record_type,
                    domain_s,
                    language_form if language_form is None or isinstance(language_form, str) else str(language_form),
                    str(rec.get("source_file_id") or ""),
                    str(rec.get("source_filename") or ""),
                    rec.get("source_line_start"),
                    rec.get("source_line_end"),
                    str(rec.get("content_hash") or ""),
                    quality_score if not isinstance(quality_score, (list, dict)) else None,
                    str(eligibility),
                    review_status,
                    safety_s,
                    1 if rec.get("execution_allowed") else 0,
                    is_eval,
                )
            )

            if len(batch_meta) >= batch_size:
                if batch_prod:
                    lex_conn.executemany(
                        "INSERT INTO prod_fts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        batch_prod,
                    )
                if batch_eval:
                    lex_conn.executemany(
                        "INSERT INTO eval_fts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        batch_eval,
                    )
                meta_conn.executemany(
                    "INSERT OR REPLACE INTO kb_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    batch_meta,
                )
                inserted += len(batch_meta)
                batch_prod.clear()
                batch_eval.clear()
                batch_meta.clear()
                if inserted % 100_000 < batch_size:
                    lex_conn.commit()
                    meta_conn.commit()
                    logger.info("Indexed %s…", inserted)

        if batch_meta:
            if batch_prod:
                lex_conn.executemany(
                    "INSERT INTO prod_fts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    batch_prod,
                )
            if batch_eval:
                lex_conn.executemany(
                    "INSERT INTO eval_fts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    batch_eval,
                )
            meta_conn.executemany(
                "INSERT OR REPLACE INTO kb_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                batch_meta,
            )
            inserted += len(batch_meta)
            lex_conn.commit()
            meta_conn.commit()
            logger.info("Finished file %s (inserted=%s)", path.name, inserted)

    # Overlay quality scores / eligibility from annotations without per-row lookups during insert.
    if annotations_count:
        meta_conn.execute(
            """
            UPDATE kb_records
            SET
              quality_score = COALESCE(
                (SELECT q.quality_score FROM kb_quality q WHERE q.record_id = kb_records.record_id),
                quality_score
              ),
              eligibility = COALESCE(
                (SELECT q.eligibility FROM kb_quality q WHERE q.record_id = kb_records.record_id),
                eligibility
              )
            WHERE EXISTS (
              SELECT 1 FROM kb_quality q WHERE q.record_id = kb_records.record_id
            )
            """
        )
        meta_conn.commit()
        logger.info("Applied quality overlays")

    lex_conn.close()
    meta_conn.close()
    manifests_dir.mkdir(parents=True, exist_ok=True)
    retrieval_manifest = {
        "generated_at": utc_now_iso(),
        "retrieval_collections": cfg["retrieval_collections"],
        "collection_mapping": COLLECTION_TO_RETRIEVAL,
        "counts_by_retrieval_collection": counts,
        "production_fts_table": "prod_fts",
        "evaluation_fts_table": "eval_fts",
        "production_rows": prod_count,
        "evaluation_rows": eval_count,
        "lexical_index": rel_to_repo(repo_root, lexical_path),
        "metadata_index": rel_to_repo(repo_root, metadata_path),
        "notes": [
            "Evaluation records are in eval_fts only and must not be returned by production retrieval.",
            "Semantic index is optional and non-authoritative for safety decisions.",
        ],
    }
    atomic_write_json(manifests_dir / "retrieval_collections.json", retrieval_manifest)
    atomic_write_json(
        manifests_dir / "domain_routing_map.json",
        {
            "generated_at": utc_now_iso(),
            "domain_routing": DOMAIN_ROUTING,
            "default_collections": cfg["retrieval_collections"],
        },
    )

    update_phase(
        "5",
        name="Retrieval Indexes and Routing Map",
        status="passed",
        finish=True,
        commands=["python knowledgebase/scripts/build_retrieval_indexes.py"],
        outputs=[
            rel_to_repo(repo_root, lexical_path),
            rel_to_repo(repo_root, metadata_path),
            rel_to_repo(repo_root, manifests_dir / "retrieval_collections.json"),
        ],
        findings=[
            f"Production FTS rows: {prod_count}",
            f"Evaluation FTS rows: {eval_count}",
        ],
        next_phase="6",
    )
    logger.info("Phase 5 indexes prod=%d eval=%d", prod_count, eval_count)
    return 0


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    parser = argparse.ArgumentParser(description="Build KB retrieval indexes")
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--jsonl-dir", type=Path, default=None)
    parser.add_argument("--records-dir", type=Path, default=None)
    parser.add_argument("--lexical-dir", type=Path, default=None)
    parser.add_argument("--metadata-dir", type=Path, default=None)
    parser.add_argument("--manifests-dir", type=Path, default=None)
    args = parser.parse_args(argv)
    repo_root = args.repo_root.resolve()
    try:
        return run(
            repo_root=repo_root,
            jsonl_dir=(args.jsonl_dir or repo_root / cfg["paths"]["processed_jsonl_dir"]).resolve(),
            records_dir=(args.records_dir or repo_root / cfg["paths"]["processed_records_dir"]).resolve(),
            lexical_dir=(args.lexical_dir or repo_root / cfg["paths"]["indexes_lexical_dir"]).resolve(),
            metadata_dir=(args.metadata_dir or repo_root / cfg["paths"]["indexes_metadata_dir"]).resolve(),
            manifests_dir=(args.manifests_dir or repo_root / cfg["paths"]["manifests_dir"]).resolve(),
        )
    except Exception as exc:
        logger.exception("Phase 5 failed: %s", exc)
        update_phase(
            "5",
            name="Retrieval Indexes and Routing Map",
            status="failed",
            finish=True,
            blockers=[str(exc)],
            next_phase="blocked",
        )
        return 2


if __name__ == "__main__":
    sys.exit(main())
