#!/usr/bin/env python3
"""KB Phase 4 — Stratified human-review sample via streaming reservoir sampling."""

from __future__ import annotations

import argparse
import csv
import io
import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterator

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import (  # noqa: E402
    REPO_ROOT,
    atomic_write_text,
    load_config,
    rel_to_repo,
    setup_logging,
    update_phase,
    utc_now_iso,
)

logger = setup_logging("build_human_review_sample")

OVERSAMPLE = (
    "accounting",
    "banking",
    "payroll",
    "tax",
    "period",
    "security",
    "privacy",
    "tenant",
    "authorization",
    "mutation",
    "destructive",
    "vat",
    "tds",
    "legal_hold",
    "audit",
    "deployment",
)

COLUMNS = [
    "review_id",
    "source_file_id",
    "record_id",
    "domain",
    "language_form",
    "raw_input",
    "normalized_input",
    "intent",
    "operation_class",
    "expected_behavior",
    "execution_allowed",
    "quality_score",
    "duplicate_group",
    "contradiction_group",
    "language_naturalness",
    "intent_correct",
    "entities_correct",
    "accounting_correct",
    "safety_correct",
    "reviewer_correction",
    "reviewer_notes",
    "reviewer_name",
    "reviewed_at",
    "review_status",
]


def iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    if not path.exists():
        return
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                yield json.loads(line)


def stratum(rec: dict[str, Any]) -> str:
    blob = " ".join(
        str(rec.get(k, ""))
        for k in ("domain", "collection", "content_text", "raw_input", "source_filename")
    ).casefold()
    for kw in OVERSAMPLE:
        if kw in blob:
            return f"priority:{kw}"
    if rec.get("collection") in {"gold_tests", "adversarial_tests", "e2e_tests"}:
        return f"eval:{rec.get('collection')}"
    fid = str(rec.get("source_file_id") or "0000")
    return f"file:{fid}"


def run(*, repo_root: Path, jsonl_dir: Path, records_dir: Path, out_dir: Path) -> int:
    cfg = load_config(repo_root)
    update_phase(
        "4",
        name="Human-Review Sample and Gold Promotion Workflow",
        status="in_progress",
        start=True,
        next_phase="5",
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    target_min = int(cfg["thresholds"]["human_review_sample_target_min"])
    target_max = int(cfg["thresholds"]["human_review_sample_target_max"])
    target = min(target_max, max(target_min, 1800))
    rng = random.Random(42)

    # Load quality overlay as optional lookup — stream into sqlite-like dict only for sampled ids later
    # First reservoir per stratum
    per_stratum: dict[str, list[dict[str, Any]]] = defaultdict(list)
    stratum_seen: Counter[str] = Counter()
    file_seen: Counter[str] = Counter()
    CAP_PER = 80

    for path in sorted(jsonl_dir.glob("*.jsonl")):
        for rec in iter_jsonl(path):
            st = stratum(rec)
            stratum_seen[st] += 1
            file_seen[str(rec.get("source_file_id"))] += 1
            bucket = per_stratum[st]
            n = stratum_seen[st]
            weight = 3.0 if st.startswith("priority:") else 1.0
            if len(bucket) < CAP_PER:
                if rng.random() < min(1.0, weight):
                    bucket.append(rec)
            else:
                # reservoir
                j = rng.randint(1, max(1, int(n / weight)))
                if j <= CAP_PER:
                    bucket[j - 1] = rec

    # Ensure all 88 files represented
    by_file: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for rows in per_stratum.values():
        for rec in rows:
            by_file[str(rec.get("source_file_id") or "")].append(rec)

    # Fill missing files with dedicated pass
    need_files = {f"{i:04d}" for i in range(1, 89)} - set(by_file.keys())
    if need_files:
        logger.info("Filling missing file strata: %s", sorted(need_files)[:20])
        for path in sorted(jsonl_dir.glob("*.jsonl")):
            for rec in iter_jsonl(path):
                fid = str(rec.get("source_file_id") or "")
                if fid in need_files and len(by_file[fid]) < 5:
                    by_file[fid].append(rec)
                    need_files.discard(fid)
                if not need_files:
                    break
            if not need_files:
                break

    # Merge candidates with priority bias
    candidates: list[dict[str, Any]] = []
    for st, rows in per_stratum.items():
        # take more from priority
        take = CAP_PER if st.startswith("priority:") else min(40, len(rows))
        candidates.extend(rows[:take])
    for fid, rows in by_file.items():
        for rec in rows[:5]:
            candidates.append(rec)

    # Dedupe by record_id
    uniq: dict[str, dict[str, Any]] = {}
    for rec in candidates:
        rid = str(rec.get("record_id"))
        if rid and rid not in uniq:
            uniq[rid] = rec
    selected = list(uniq.values())
    rng.shuffle(selected)
    if len(selected) > target:
        # Prefer priority strata
        selected.sort(
            key=lambda r: (0 if stratum(r).startswith("priority:") else 1, r.get("record_id"))
        )
        selected = selected[:target]
    elif len(selected) < target_min:
        # Top up with more domain records
        for path in sorted(jsonl_dir.glob("domain_records.jsonl")) + sorted(
            jsonl_dir.glob("*.jsonl")
        ):
            for rec in iter_jsonl(path):
                rid = str(rec.get("record_id"))
                if rid and rid not in uniq:
                    uniq[rid] = rec
                    selected.append(rec)
                    if len(selected) >= target_min:
                        break
            if len(selected) >= target_min:
                break

    # Optional quality annotations join (streaming index of selected only)
    wanted = {str(r.get("record_id")) for r in selected}
    ann_map: dict[str, dict[str, Any]] = {}
    ann_path = records_dir / "quality_annotations.jsonl"
    if ann_path.exists():
        for row in iter_jsonl(ann_path):
            rid = str(row.get("record_id"))
            if rid in wanted:
                ann_map[rid] = row
                if len(ann_map) >= len(wanted):
                    break

    review_rows: list[dict[str, Any]] = []
    for i, rec in enumerate(selected, start=1):
        rid = str(rec.get("record_id"))
        ann = ann_map.get(rid, {})
        review_rows.append(
            {
                "review_id": f"HR-{i:05d}",
                "source_file_id": rec.get("source_file_id"),
                "record_id": rid,
                "domain": rec.get("domain"),
                "language_form": rec.get("language_form"),
                "raw_input": rec.get("raw_input"),
                "normalized_input": rec.get("normalized_input"),
                "intent": rec.get("intent"),
                "operation_class": rec.get("operation_class"),
                "expected_behavior": str(rec.get("expected_behavior") or "")[:500],
                "execution_allowed": rec.get("execution_allowed"),
                "quality_score": ann.get("quality_score"),
                "duplicate_group": "exact" if ann.get("exact_duplicate") else "",
                "contradiction_group": ",".join(ann.get("contradiction_kinds") or []),
                "language_naturalness": "",
                "intent_correct": "",
                "entities_correct": "",
                "accounting_correct": "",
                "safety_correct": "",
                "reviewer_correction": "",
                "reviewer_notes": "",
                "reviewer_name": "",
                "reviewed_at": "",
                "review_status": "pending",
            }
        )

    jsonl_out = out_dir / "human_review_sample.jsonl"
    csv_out = out_dir / "human_review_sample.csv"
    with jsonl_out.open("w", encoding="utf-8", newline="\n") as fh:
        for row in review_rows:
            fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=COLUMNS, extrasaction="ignore")
    w.writeheader()
    for row in review_rows:
        w.writerow(row)
    atomic_write_text(csv_out, buf.getvalue())

    summary = {
        "generated_at": utc_now_iso(),
        "sample_size": len(review_rows),
        "target_range": [target_min, target_max],
        "stratum_counts": dict(Counter(stratum(uniq[r["record_id"]]) for r in review_rows if r["record_id"] in uniq)),
        "files_covered": len({r["source_file_id"] for r in review_rows}),
    }
    atomic_write_text(
        out_dir / "human_review_sample_summary.json",
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
    )

    update_phase(
        "4",
        name="Human-Review Sample and Gold Promotion Workflow",
        status="passed" if target_min <= len(review_rows) <= target_max + 200 else "passed_with_warnings",
        finish=True,
        commands=["python knowledgebase/scripts/build_human_review_sample.py"],
        outputs=[
            rel_to_repo(repo_root, jsonl_out),
            rel_to_repo(repo_root, csv_out),
        ],
        findings=[f"sample_size={len(review_rows)}", f"files_covered={summary['files_covered']}"],
        warnings=[] if summary["files_covered"] >= 80 else ["Fewer than 80 source files represented in sample"],
        next_phase="5",
    )
    logger.info("Phase 4 sample_size=%s", len(review_rows))
    return 0


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    p = argparse.ArgumentParser(description="Phase 4 human review sample")
    p.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    p.add_argument("--jsonl-dir", type=Path, default=None)
    p.add_argument("--records-dir", type=Path, default=None)
    p.add_argument("--output-dir", type=Path, default=None)
    args = p.parse_args(argv)
    repo = args.repo_root.resolve()
    return run(
        repo_root=repo,
        jsonl_dir=(args.jsonl_dir or repo / cfg["paths"]["processed_jsonl_dir"]).resolve(),
        records_dir=(args.records_dir or repo / cfg["paths"]["processed_records_dir"]).resolve(),
        out_dir=(args.output_dir or repo / cfg["paths"]["review_ready_dir"]).resolve(),
    )


if __name__ == "__main__":
    sys.exit(main())
