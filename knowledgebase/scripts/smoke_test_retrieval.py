#!/usr/bin/env python3
"""Smoke-test live ONLI lexical retrieval against the built FTS index."""

from __future__ import annotations

import argparse
import json
import re
import sys
import types
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = _SCRIPT_DIR.resolve().parents[1]
ADAPTER = REPO_ROOT / "erp_bot" / "src" / "nlu" / "np_kb_adapter.py"
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import atomic_write_json, utc_now_iso  # noqa: E402


QUERIES = [
    "sales report",
    "bank reconciliation",
    "vat tds",
    "payroll salary",
    "period close",
    "maker checker",
    "legal hold",
    "aaja ko bikri report",
]


def _load_adapter():
    code = ADAPTER.read_text(encoding="utf-8")
    mod = types.ModuleType("np_kb_adapter")
    sys.modules["np_kb_adapter"] = mod
    exec(compile(code, str(ADAPTER), "exec"), mod.__dict__)
    return mod


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Smoke test NP KB lexical retrieval")
    parser.add_argument("--enable", action="store_true", help="Force-enable KB for this run")
    args = parser.parse_args(argv)

    mod = _load_adapter()
    cfg = mod.NpKbConfig(
        enabled=bool(args.enable),
        root=REPO_ROOT / "knowledgebase",
        lexical_enabled=True,
        citations_enabled=True,
        review_policy="development_all",
        min_quality_score=0.0,
        lexical_top_k=5,
    )

    results = []
    for q in QUERIES:
        res = mod.interpret_user_text(q, cfg=cfg)
        results.append(
            {
                "query": q,
                "enabled": res.enabled,
                "hit_count": len(res.citations),
                "record_ids": [c.record_id for c in res.citations[:5]],
                "source_file_ids": sorted(
                    {c.source_file_id for c in res.citations if c.source_file_id}
                ),
                "execution_allowed": res.execution_allowed,
                "retrieval_ms": (res.observability or {}).get("retrieval_ms"),
            }
        )

    out = {
        "generated_at": utc_now_iso(),
        "enabled": cfg.enabled,
        "queries": results,
        "hits_total": sum(r["hit_count"] for r in results),
        "all_execution_forbidden": all(r["execution_allowed"] is False for r in results),
    }
    path = REPO_ROOT / "knowledgebase" / "review" / "retrieval_smoke_test.json"
    atomic_write_json(path, out)
    print(
        json.dumps(
            {
                "hits_total": out["hits_total"],
                "all_execution_forbidden": out["all_execution_forbidden"],
                "path": str(path),
                "per_query_hits": [r["hit_count"] for r in results],
            },
            indent=2,
        )
    )
    if not cfg.enabled:
        print("KB disabled — re-run with --enable for live hits")
        return 0
    return 0 if out["hits_total"] > 0 and out["all_execution_forbidden"] else 1


if __name__ == "__main__":
    sys.exit(main())
