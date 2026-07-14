#!/usr/bin/env python3
"""KB Phase 3 — Streaming deduplication, contradiction heuristics, quality scoring.

Designed for multi-million record corpora without loading all records into RAM.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterator

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import (  # noqa: E402
    REPO_ROOT,
    atomic_write_json,
    atomic_write_text,
    load_config,
    rel_to_repo,
    setup_logging,
    update_phase,
    utc_now_iso,
)

logger = setup_logging("analyze_kb_quality")

EVAL_COLLECTIONS = {"gold_tests", "adversarial_tests", "e2e_tests"}


def iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    if not path.exists():
        return
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def iter_all_records(jsonl_dir: Path) -> Iterator[tuple[str, dict[str, Any]]]:
    for path in sorted(jsonl_dir.glob("*.jsonl")):
        for rec in iter_jsonl(path):
            yield path.name, rec


def simhash64(text: str, shingle_size: int = 5) -> int:
    import re

    tokens = re.findall(r"[\w\u0900-\u097F]+", text.lower())
    if not tokens:
        return 0
    if len(tokens) < shingle_size:
        shingles = [" ".join(tokens)]
    else:
        shingles = [
            " ".join(tokens[i : i + shingle_size])
            for i in range(min(40, len(tokens) - shingle_size + 1))
        ]
    vec = [0] * 64
    for sh in shingles:
        h = int(hashlib.md5(sh.encode("utf-8")).hexdigest(), 16)
        for bit in range(64):
            vec[bit] += 1 if (h >> bit) & 1 else -1
    out = 0
    for bit, v in enumerate(vec):
        if v >= 0:
            out |= 1 << bit
    return out


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def score_record(
    record: dict[str, Any],
    *,
    exact_dup: bool,
    near_dup_count: int,
    contradiction_flags: list[str],
    cfg: dict[str, Any],
) -> tuple[float, dict[str, Any], str]:
    thresholds = cfg["thresholds"]
    components: dict[str, float] = {}
    parse_status = record.get("parse_status", "ok")
    collection = record.get("collection", "")

    components["parse_integrity"] = (
        1.0 if parse_status == "ok" else 0.5 if parse_status == "warning" else 0.0
    )
    components["field_completeness"] = min(
        1.0,
        sum(1 for f in ("raw_input", "domain", "intent", "language_form") if record.get(f))
        / 4.0,
    )
    components["execution_safety"] = 1.0 if not record.get("execution_allowed") else 0.2
    components["source_traceability"] = (
        1.0
        if record.get("source_file_id") and record.get("source_line_start") is not None
        else 0.0
    )
    components["exact_duplicate_penalty"] = 0.4 if exact_dup else 0.0
    components["near_duplicate_penalty"] = min(0.3, near_dup_count * 0.05)
    components["contradiction_penalty"] = min(0.5, len(contradiction_flags) * 0.15)

    score = (
        components["parse_integrity"] * 0.25
        + components["field_completeness"] * 0.15
        + components["execution_safety"] * 0.20
        + components["source_traceability"] * 0.10
        + (1.0 - components["exact_duplicate_penalty"]) * 0.15
        + (1.0 - components["near_duplicate_penalty"]) * 0.10
        + (1.0 - components["contradiction_penalty"]) * 0.05
    )
    score = round(max(0.0, min(1.0, score)), 4)

    if parse_status == "quarantined":
        eligibility = "quarantined"
    elif collection in EVAL_COLLECTIONS:
        eligibility = "evaluation_only"
    elif contradiction_flags:
        eligibility = "human_review_required"
    elif score >= thresholds["quality_score_eligible_min"]:
        eligibility = (
            "eligible_with_warning" if near_dup_count or exact_dup else "eligible"
        )
    elif score >= thresholds["quality_score_warning_min"]:
        eligibility = "eligible_with_warning"
    else:
        eligibility = "human_review_required"
    return score, components, eligibility


def run(
    *,
    repo_root: Path,
    jsonl_dir: Path,
    review_dir: Path,
    records_dir: Path,
    near_dup_sample_per_bucket: int = 80,
) -> int:
    cfg = load_config(repo_root)
    update_phase(
        "3",
        name="Deduplication, Contradiction Detection, Quality Scoring",
        status="in_progress",
        start=True,
        next_phase="4",
    )
    review_dir.mkdir(parents=True, exist_ok=True)
    records_dir.mkdir(parents=True, exist_ok=True)

    # Pass 1: hash frequency + contradiction surface map (hash of raw → sides)
    logger.info("Pass 1: content-hash frequencies")
    content_hash_counts: Counter[str] = Counter()
    norm_hash_counts: Counter[str] = Counter()
    total = 0
    # Map raw_key -> bitflags: bit0 saw execution True, bit1 saw False; intents as sample strings
    exec_conflict: dict[str, int] = {}
    intent_samples: dict[str, set[str]] = defaultdict(set)
    MAX_CONTRA_KEYS = 200_000

    for _src, rec in iter_all_records(jsonl_dir):
        total += 1
        ch = rec.get("content_hash") or ""
        nh = rec.get("normalized_content_hash") or ""
        if ch:
            content_hash_counts[ch] += 1
        if nh:
            norm_hash_counts[nh] += 1
        raw = rec.get("raw_input") or rec.get("normalized_input")
        if isinstance(raw, str) and 3 <= len(raw.strip()) <= 200:
            key = raw.strip().casefold()
            if key not in exec_conflict and len(exec_conflict) >= MAX_CONTRA_KEYS:
                continue
            flags = exec_conflict.get(key, 0)
            if rec.get("execution_allowed"):
                flags |= 1
            else:
                flags |= 2
            exec_conflict[key] = flags
            intent = rec.get("intent")
            if intent and len(intent_samples[key]) < 5:
                intent_samples[key].add(str(intent)[:80])
        if total % 200_000 == 0:
            logger.info("Pass 1 progress: %s records", total)

    exact_dup_hashes = {h for h, c in content_hash_counts.items() if h and c > 1}
    logger.info(
        "Pass 1 done: total=%s exact_dup_hashes=%s",
        total,
        len(exact_dup_hashes),
    )

    contradiction_candidates: list[dict[str, Any]] = []
    for key, flags in exec_conflict.items():
        if flags == 3:  # both true and false seen
            contradiction_candidates.append(
                {
                    "kind": "execution_allowed_conflict",
                    "raw_input_key": key[:200],
                    "explanation": "Same surface text maps to conflicting execution_allowed values.",
                }
            )
        intents = intent_samples.get(key) or set()
        if len(intents) > 1:
            contradiction_candidates.append(
                {
                    "kind": "intent_conflict",
                    "raw_input_key": key[:200],
                    "intents": sorted(intents),
                    "explanation": "Same surface text associated with multiple intents.",
                }
            )
    # Cap candidates written
    contradiction_candidates = contradiction_candidates[:20_000]
    contra_raw_keys = {
        c["raw_input_key"] for c in contradiction_candidates if "raw_input_key" in c
    }

    # Pass 2: bounded near-dup sample + annotations
    logger.info("Pass 2: quality annotations + bounded near-dup")
    hamming_threshold = int(cfg["thresholds"]["near_duplicate_simhash_hamming"])
    buckets: dict[str, list[tuple[str, int]]] = defaultdict(list)
    near_dup_counts: Counter[str] = Counter()
    near_dup_pairs: list[dict[str, Any]] = []

    annotations_path = records_dir / "quality_annotations.jsonl"
    tmp = annotations_path.with_suffix(".jsonl.tmp")
    eligibility_counts: Counter[str] = Counter()
    score_sum = 0.0
    scored = 0
    collection_counts: Counter[str] = Counter()

    # First collect near-dup buckets from a stream sample, then annotate in same pass using running buckets
    with tmp.open("w", encoding="utf-8", newline="\n") as out:
        for src, rec in iter_all_records(jsonl_dir):
            rid = str(rec.get("record_id", ""))
            ch = rec.get("content_hash") or ""
            exact = bool(ch and ch in exact_dup_hashes and content_hash_counts[ch] > 1)

            # Near-dup: add to bucket if under capacity
            text = str(rec.get("content_text") or "")[:500]
            sim = simhash64(text)
            bkey = f"{(sim >> 48):04x}|{rec.get('domain')}|{rec.get('record_type')}|{rec.get('collection')}"
            items = buckets[bkey]
            local_near = 0
            if len(items) < near_dup_sample_per_bucket:
                for other_id, other_sim in items[-40:]:
                    dist = hamming(sim, other_sim)
                    if dist <= hamming_threshold:
                        local_near += 1
                        near_dup_counts[other_id] += 1
                        if len(near_dup_pairs) < 5000:
                            near_dup_pairs.append(
                                {
                                    "record_id_a": rid,
                                    "record_id_b": other_id,
                                    "simhash_hamming": dist,
                                }
                            )
                items.append((rid, sim))

            raw = rec.get("raw_input") or rec.get("normalized_input")
            contra: list[str] = []
            if isinstance(raw, str):
                rk = raw.strip().casefold()[:200]
                if rk in contra_raw_keys:
                    contra.append("surface_conflict")

            score, components, eligibility = score_record(
                rec,
                exact_dup=exact,
                near_dup_count=local_near + near_dup_counts.get(rid, 0),
                contradiction_flags=contra,
                cfg=cfg,
            )
            eligibility_counts[eligibility] += 1
            score_sum += score
            scored += 1
            collection_counts[str(rec.get("collection", ""))] += 1
            annotation = {
                "record_id": rid,
                "quality_score": score,
                "quality_components": components,
                "eligibility": eligibility,
                "exact_duplicate": exact,
                "near_duplicate_neighbors": local_near,
                "contradiction_kinds": contra,
                "source_jsonl": src,
                "source_file_id": rec.get("source_file_id"),
                "collection": rec.get("collection"),
            }
            out.write(json.dumps(annotation, ensure_ascii=False, sort_keys=True) + "\n")
            if scored % 200_000 == 0:
                logger.info("Pass 2 progress: %s", scored)

    tmp.replace(annotations_path)

    # Duplicate groups (only hashes with count>1; sample member IDs on pass 3 light stream)
    logger.info("Pass 3: sample duplicate group member IDs")
    dup_members: dict[str, list[str]] = defaultdict(list)
    for _src, rec in iter_all_records(jsonl_dir):
        ch = rec.get("content_hash") or ""
        if ch in exact_dup_hashes and len(dup_members[ch]) < 20:
            dup_members[ch].append(str(rec.get("record_id")))

    dup_groups_path = review_dir / "duplicate_groups.jsonl"
    with dup_groups_path.open("w", encoding="utf-8", newline="\n") as fh:
        for h, ids in sorted(dup_members.items(), key=lambda x: -content_hash_counts[x[0]])[
            :50_000
        ]:
            fh.write(
                json.dumps(
                    {
                        "hash_type": "content_hash",
                        "hash": h,
                        "count": content_hash_counts[h],
                        "sample_record_ids": ids,
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                )
                + "\n"
            )
        for pair in near_dup_pairs:
            fh.write(
                json.dumps({"hash_type": "near_simhash", **pair}, ensure_ascii=False, sort_keys=True)
                + "\n"
            )

    contra_path = review_dir / "contradiction_candidates.jsonl"
    with contra_path.open("w", encoding="utf-8", newline="\n") as fh:
        for cand in contradiction_candidates:
            fh.write(json.dumps(cand, ensure_ascii=False, sort_keys=True) + "\n")

    avg = round(score_sum / scored, 4) if scored else 0.0
    quality_summary = {
        "generated_at": utc_now_iso(),
        "records_scored": scored,
        "average_quality_score": avg,
        "eligibility_counts": dict(eligibility_counts),
        "exact_duplicate_hash_count": len(exact_dup_hashes),
        "exact_duplicate_record_instances": sum(
            c for h, c in content_hash_counts.items() if h in exact_dup_hashes
        ),
        "near_duplicate_pairs_sampled": len(near_dup_pairs),
        "contradiction_candidates": len(contradiction_candidates),
        "collection_counts": dict(collection_counts),
        "method": {
            "exact": "streaming content_hash frequency",
            "near": "bounded SimHash buckets (no all-pairs)",
            "contradictions": "surface-text execution/intent conflict map (capped)",
            "quality_score": "explainable weighted components; annotations only — no deletions",
        },
    }
    atomic_write_json(review_dir / "quality_score_summary.json", quality_summary)

    report = "\n".join(
        [
            "# Deduplication & Quality Report (Phase 3)",
            "",
            f"Generated: {quality_summary['generated_at']}",
            f"Records scored: {scored}",
            f"Average quality score: {avg}",
            f"Exact duplicate hashes: {len(exact_dup_hashes)}",
            f"Near-duplicate pairs sampled: {len(near_dup_pairs)}",
            f"Contradiction candidates: {len(contradiction_candidates)}",
            "",
            "## Eligibility counts",
            "",
            *[f"- {k}: {v}" for k, v in sorted(eligibility_counts.items())],
            "",
            "## Notes",
            "",
            "- No source or canonical records were deleted.",
            "- Near-duplicate detection is bounded (not all-pairs).",
            "- Scores are algorithmic; not human language or accounting approval.",
            "",
        ]
    )
    atomic_write_text(review_dir / "deduplication_report.md", report)

    update_phase(
        "3",
        name="Deduplication, Contradiction Detection, Quality Scoring",
        status="passed_with_warnings" if contradiction_candidates or exact_dup_hashes else "passed",
        finish=True,
        commands=["python knowledgebase/scripts/analyze_kb_quality.py"],
        outputs=[
            rel_to_repo(repo_root, review_dir / "deduplication_report.md"),
            rel_to_repo(repo_root, review_dir / "duplicate_groups.jsonl"),
            rel_to_repo(repo_root, review_dir / "contradiction_candidates.jsonl"),
            rel_to_repo(repo_root, review_dir / "quality_score_summary.json"),
            rel_to_repo(repo_root, annotations_path),
        ],
        findings=[
            f"scored={scored}",
            f"avg_score={avg}",
            f"exact_dup_hashes={len(exact_dup_hashes)}",
            f"contradictions={len(contradiction_candidates)}",
        ],
        warnings=[
            "Near-duplicate detection is sampled/bounded at multi-million scale.",
        ],
        next_phase="4",
    )
    logger.info("Phase 3 complete scored=%s avg=%s", scored, avg)
    return 0


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    parser = argparse.ArgumentParser(description="Phase 3: KB quality analysis (streaming)")
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--jsonl-dir", type=Path, default=None)
    parser.add_argument("--review-dir", type=Path, default=None)
    parser.add_argument("--records-dir", type=Path, default=None)
    args = parser.parse_args(argv)
    repo_root = args.repo_root.resolve()
    jsonl_dir = (
        args.jsonl_dir.resolve()
        if args.jsonl_dir
        else (repo_root / cfg["paths"]["processed_jsonl_dir"]).resolve()
    )
    review_dir = (
        args.review_dir.resolve()
        if args.review_dir
        else (repo_root / cfg["paths"]["review_dir"]).resolve()
    )
    records_dir = (
        args.records_dir.resolve()
        if args.records_dir
        else (repo_root / cfg["paths"]["processed_records_dir"]).resolve()
    )
    try:
        return run(
            repo_root=repo_root,
            jsonl_dir=jsonl_dir,
            review_dir=review_dir,
            records_dir=records_dir,
        )
    except Exception as exc:
        logger.exception("Phase 3 failed: %s", exc)
        update_phase(
            "3",
            name="Deduplication, Contradiction Detection, Quality Scoring",
            status="failed",
            finish=True,
            blockers=[str(exc)],
            next_phase="blocked",
        )
        return 2


if __name__ == "__main__":
    sys.exit(main())
