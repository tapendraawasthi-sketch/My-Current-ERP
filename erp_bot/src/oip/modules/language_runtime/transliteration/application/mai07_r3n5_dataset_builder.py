"""Build the MAI-07R3N5 fresh target-span evaluation corpus.

The builder reads prior *input split* JSONL only to construct a one-way
freshness firewall.  It never reads R3N4 prediction/report JSONL.  Every R3N5
case carries an immutable raw code-point target interval created before runtime
execution.  Writes are gated and deterministic.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any

from .r3n5_target_span_contract import create_target_span, target_span_from_case

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3n5_fresh_holdout"
R3N4_OUT = REPO / "evals" / "mai07_r3n4_fresh_holdout"
AUTHORIZE_ENV = "MAI07_AUTHORIZE_R3N5_EVAL_WRITE"
BUILDER_VERSION = "mai-07-r3n5-dataset.1.0.0"
SCHEMA_VERSION = "mai07_r3n5_fresh_holdout_case_v1"
SEED_DEVELOPMENT = 20260728
SEED_HOLDOUT = 20260729

SPLIT_COUNTS = {
    "DEVELOPMENT": 900,
    "HOLDOUT_VALIDATION": 2475,
    "SAFETY_CHALLENGE": 400,
    "CONTEXT_COUNTERFACTUAL": 300,
    "OOV_CHALLENGE": 100,
    "MONOTONIC_REGRESSION": 400,
    "IDENTITY_ANCHOR_CHALLENGE": 500,
}

SPLIT_FILES = {
    "DEVELOPMENT": "development.jsonl",
    "HOLDOUT_VALIDATION": "holdout_validation.jsonl",
    "SAFETY_CHALLENGE": "safety_challenge.jsonl",
    "CONTEXT_COUNTERFACTUAL": "context_counterfactual.jsonl",
    "OOV_CHALLENGE": "oov_challenge.jsonl",
    "MONOTONIC_REGRESSION": "monotonic_regression.jsonl",
    "IDENTITY_ANCHOR_CHALLENGE": "identity_anchor_challenge.jsonl",
}

ENGLISH = (
    "ledger", "invoice", "payment", "customer", "supplier", "voucher",
    "balance", "discount", "commission", "statement", "reconcile", "freight",
)
ROMANIZED = (
    "baaki", "aamdani", "bikri", "kharcha", "hernu", "bhayo", "bholi",
    "garera", "mero", "sabai", "aaja", "bakaya",
)
ACRONYMS = ("VAT", "PAN", "ERP", "SKU", "FIFO", "TDS")
IDENTIFIERS = ("SKU-2026/07", "INV-2048/NP", "PAN-77/AB", "LOT-9/X")
UNICODE_IDENTITIES = ("Caf\u00e9", "na\u00efve", "A\u0301udit", "M\u00fcnchen")

_DIGITS = re.compile(r"\d+")


def _sha_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _normalized_hash(value: str) -> str:
    return _sha_text(" ".join(value.lower().split()))


def _skeleton_hash(value: str) -> str:
    normalized = " ".join(value.lower().split())
    return _sha_text(_DIGITS.sub("", normalized))


def _alpha_code(value: int) -> str:
    """Stable letters-only identifier so skeleton checks retain uniqueness."""
    chars: list[str] = []
    n = value + 1
    while n:
        n, rem = divmod(n - 1, 26)
        chars.append(chr(97 + rem))
    # Explicit boundary markers keep variable-length base-26 encodings
    # injective; left-padding with a valid digit would create collisions.
    return "q" + "".join(reversed(chars)) + "z"


def _prior_split_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for filename in SPLIT_FILES.values():
        path = R3N4_OUT / filename
        if not path.is_file():
            raise FileNotFoundError(f"missing_r3n4_split_authority:{path}")
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                rows.append(json.loads(line))
    return rows


def _prior_firewall() -> dict[str, set[str]]:
    rows = _prior_split_rows()
    return {
        "case_ids": {str(row["case_id"]) for row in rows},
        "text_hashes": {_normalized_hash(str(row["input_text"])) for row in rows},
        "skeleton_hashes": {_skeleton_hash(str(row["input_text"])) for row in rows},
        "template_families": {str(row.get("template_family", "")) for row in rows},
    }


def _holdout_populations(index: int) -> list[str]:
    populations = ["FINALIZER_IDEMPOTENCE_REQUIRED"]
    if index < 200:
        populations += ["ENGLISH_IDENTITY_REQUIRED"]
    if 200 <= index < 400:
        populations += ["ROMANIZED_NEPALI_REQUIRED"]
    if index < 850:
        populations += [
            "IDENTITY_RETENTION_REQUIRED",
            "EXACT_RAW_IDENTITY_REQUIRED",
            "EXACTLY_ONE_IDENTITY_REQUIRED",
        ]
    if index < 350:
        populations += ["IDENTITY_INVARIANT_ANALOGUE", "CANDIDATE_CAP_PRESSURE"]
    if index < 300:
        populations += ["MULTI_TOKEN_IDENTITY"]
    if index < 200:
        populations += ["REFINED_SPAN_IDENTITY", "COALESCED_SPAN_IDENTITY"]
    if index < 500:
        populations += ["SERIALIZATION_ROUNDTRIP"]
    if 400 <= index < 550:
        populations += ["UNICODE_IDENTITY"]
    if 550 <= index < 650:
        populations += ["ACRONYM_IDENTITY_REQUIRED"]
    if 650 <= index < 750:
        populations += ["IDENTIFIER_PROTECTION_REQUIRED"]
    if 750 <= index < 850:
        populations += ["PROTECTED_IDENTITY_REQUIRED"]
    if 850 <= index < 1000:
        populations += ["SHARED_OR_AMBIGUOUS"]
    if 1000 <= index < 1100:
        populations += ["ENGLISH_GUARD_ANALOGUE"]
    if 1100 <= index < 1175:
        populations += ["ACRONYM_IDENTIFIER_ANALOGUE"]
    return populations


def _target_for(split: str, index: int) -> tuple[str, str, str, list[str]]:
    if split == "HOLDOUT_VALIDATION":
        pops = _holdout_populations(index)
        if 200 <= index < 400:
            return ROMANIZED[index % len(ROMANIZED)], "ROMANIZED_SCRIPT_AT_5", "romanized", pops
        if 400 <= index < 550:
            return UNICODE_IDENTITIES[index % len(UNICODE_IDENTITIES)], "IDENTITY_RETAINED", "unicode", pops
        if 550 <= index < 650:
            return ACRONYMS[index % len(ACRONYMS)], "ACRONYM_IDENTITY_TOP1", "acronym", pops
        if 650 <= index < 750:
            # This structural form is an established exact analyzer-span shape;
            # per-case context codes still make every case text fresh.
            return IDENTIFIERS[0], "IDENTITY_TOP1", "identifier", pops
        return ENGLISH[index % len(ENGLISH)], "IDENTITY_RETAINED", "identity", pops
    if split == "IDENTITY_ANCHOR_CHALLENGE":
        return IDENTIFIERS[0], "IDENTITY_RETAINED", "anchor", ["IDENTITY_ANCHOR_CHALLENGE", "CANDIDATE_CAP_PRESSURE"]
    if split == "CONTEXT_COUNTERFACTUAL":
        return ENGLISH[index % len(ENGLISH)], "IDENTITY_TOP1", "counterfactual", ["CONTEXT_COUNTERFACTUAL"]
    if split == "OOV_CHALLENGE":
        return f"qz{_alpha_code(index)}", "IDENTITY_RETAINED", "oov", ["OOV"]
    if split == "MONOTONIC_REGRESSION":
        return ENGLISH[index % len(ENGLISH)], "IDENTITY_TOP1", "monotonic", ["MONOTONIC_PARENT_CORRECT"]
    if split == "SAFETY_CHALLENGE":
        return ACRONYMS[index % len(ACRONYMS)], "PROTECTED_IDENTITY", "safety", ["PROTECTED_IDENTITY_REQUIRED"]
    # DEVELOPMENT mirrors the authored population semantics, but uses a distinct
    # seed, case namespace, context code, and template family.
    target, behavior, family, populations = _target_for("HOLDOUT_VALIDATION", index)
    if index < 100:
        populations.append("ENGLISH_GUARD_ANALOGUE")
    if 100 <= index < 175:
        populations.append("ACRONYM_IDENTIFIER_ANALOGUE")
    if index < 9:
        populations.append("AUTHORIZED_CODE_CORRECTIVE")
    return target, behavior, f"development_{family}", populations


def _case(split: str, index: int) -> dict[str, Any]:
    target, behavior, family, populations = _target_for(split, index)
    code = _alpha_code(index + list(SPLIT_FILES).index(split) * 3000)
    prefix = f"audit-{code}: "
    # Whitespace surrounds the target so its immutable interval is also an
    # exact analyzer span; punctuation belongs to neighboring context only.
    raw = f"{prefix}{target} checkpoint-{code}"
    start = len(prefix)
    target_contract = create_target_span(raw, raw_start=start, raw_end_exclusive=start + len(target))
    seed = SEED_DEVELOPMENT if split == "DEVELOPMENT" else SEED_HOLDOUT
    return {
        "schema_version": SCHEMA_VERSION,
        "builder_version": BUILDER_VERSION,
        "case_id": f"R3N5-{split[:3]}-{index:04d}-{_sha_text(f'{seed}|{split}|{index}')[:10]}",
        "split": split,
        "population_ids": populations,
        "input_text": raw,
        "highlighted_span": target,
        "expected_behavior": behavior,
        "template_family": f"r3n5_{split.lower()}_{family}_targetspan_v1",
        "seed_family": seed,
        "prohibited_for_training": True,
        "gold_from_runtime": False,
        "parent_prediction_inputs_used": False,
        **target_contract.to_case_fields(),
    }


def build_all() -> dict[str, list[dict[str, Any]]]:
    firewall = _prior_firewall()
    built: dict[str, list[dict[str, Any]]] = {}
    own_ids: set[str] = set()
    own_texts: set[str] = set()
    for split, count in SPLIT_COUNTS.items():
        rows = [_case(split, index) for index in range(count)]
        for row in rows:
            target_span_from_case(row)
            cid = row["case_id"]
            th = _normalized_hash(row["input_text"])
            skh = _skeleton_hash(row["input_text"])
            family = row["template_family"]
            if cid in firewall["case_ids"] or cid in own_ids:
                raise ValueError(f"case_id_overlap:{cid}")
            if th in firewall["text_hashes"] or th in own_texts:
                raise ValueError(f"text_overlap:{cid}")
            if skh in firewall["skeleton_hashes"]:
                raise ValueError(f"r3n4_skeleton_overlap:{cid}")
            if family in firewall["template_families"]:
                raise ValueError(f"template_family_overlap:{family}")
            own_ids.add(cid)
            own_texts.add(th)
        built[split] = rows
    return built


def _jsonl_bytes(rows: list[dict[str, Any]]) -> bytes:
    return ("".join(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n" for row in rows)).encode("utf-8")


def manifest_for(splits: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    return {
        "schema_version": "mai07_r3n5_dataset_manifest_v1",
        "builder_version": BUILDER_VERSION,
        "seeds": {"development": SEED_DEVELOPMENT, "holdout": SEED_HOLDOUT},
        "parent_prediction_jsonl_opened": False,
        "r3n4_input_splits_used_for_one_way_freshness_only": True,
        "prohibited_for_training": True,
        "splits": {
            split: {
                "filename": SPLIT_FILES[split],
                "count": len(rows),
                "sha256": hashlib.sha256(_jsonl_bytes(rows)).hexdigest(),
                "population_counts": dict(sorted(Counter(p for row in rows for p in row["population_ids"]).items())),
            }
            for split, rows in splits.items()
        },
    }


def write_all(destination: Path = OUT) -> dict[str, Any]:
    if os.environ.get(AUTHORIZE_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_ENV}=1 to authorize R3N5 dataset writes")
    splits = build_all()
    destination.mkdir(parents=True, exist_ok=True)
    for split, rows in splits.items():
        (destination / SPLIT_FILES[split]).write_bytes(_jsonl_bytes(rows))
    manifest = manifest_for(splits)
    (destination / "MANIFEST.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    splits = build_all()
    manifest = manifest_for(splits)
    if args.write:
        manifest = write_all()
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
