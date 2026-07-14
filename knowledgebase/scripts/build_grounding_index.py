"""Build a compact NP KB FTS index for Ask Orbix prompt grounding (Render-safe)."""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "knowledgebase" / "indexes" / "lexical" / "kb_lexical.sqlite"
OUT_DIR = REPO / "knowledgebase" / "indexes" / "lexical"
OUT = OUT_DIR / "kb_grounding.sqlite"

# Exclude the multi-million accounting corpus; keep language/intent/safety.
KEEP_COLLECTIONS = (
    "language_and_normalization",
    "intent_and_dialogue",
    "safety_and_governance",
)
# Also pull a capped slice of high-signal accounting phrases for romanized verbs.
ACCOUNTING_LIMIT = 25000
ACCOUNTING_COLLECTION = "accounting_and_erp"


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing source index: {SRC}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()

    t0 = time.perf_counter()
    src = sqlite3.connect(f"file:{SRC}?mode=ro", uri=True)
    dst = sqlite3.connect(str(OUT))
    dst.execute(
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
            tokenize = 'unicode61'
        )
        """
    )

    cols = (
        "record_id, retrieval_collection, record_type, domain, "
        "source_file_id, source_filename, source_line_start, source_line_end, "
        "quality_score, review_status, safety_labels, content_text"
    )
    placeholders = ",".join("?" for _ in cols.split(","))
    insert_sql = f"INSERT INTO prod_fts ({cols}) VALUES ({placeholders})"

    total = 0
    q_keep = ",".join("?" for _ in KEEP_COLLECTIONS)
    cur = src.execute(
        f"SELECT {cols} FROM prod_fts WHERE retrieval_collection IN ({q_keep})",
        KEEP_COLLECTIONS,
    )
    batch: list[tuple] = []
    while True:
        rows = cur.fetchmany(2000)
        if not rows:
            break
        batch.extend(rows)
        if len(batch) >= 5000:
            dst.executemany(insert_sql, batch)
            total += len(batch)
            batch.clear()
            print(f"  copied {total}…", flush=True)
    if batch:
        dst.executemany(insert_sql, batch)
        total += len(batch)
        batch.clear()

    # Cap accounting slice — prefer shorter phrase-like rows.
    cur2 = src.execute(
        f"""
        SELECT {cols} FROM prod_fts
        WHERE retrieval_collection = ?
          AND length(content_text) BETWEEN 20 AND 400
        ORDER BY quality_score DESC
        LIMIT ?
        """,
        (ACCOUNTING_COLLECTION, ACCOUNTING_LIMIT),
    )
    acc = cur2.fetchall()
    if acc:
        dst.executemany(insert_sql, acc)
        total += len(acc)
        print(f"  accounting slice {len(acc)}", flush=True)

    dst.commit()
    src.close()
    dst.execute("VACUUM")
    dst.close()
    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(
        f"wrote {OUT} rows={total} size_mb={size_mb:.1f} "
        f"elapsed_s={time.perf_counter() - t0:.1f}"
    )


if __name__ == "__main__":
    main()
