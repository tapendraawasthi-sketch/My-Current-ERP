"""Build the MAI-07R3N6 fresh target-span evaluation corpus.

R3N6 may read the sealed R3N5 *input split* JSONL files only to build a
one-way freshness firewall.  Prediction JSONL and score reports are never
opened.  Every authored target remains governed by the unchanged R3N5 raw
code-point target-span authority.

Writes always require an explicit output directory.  A write to the canonical
R3N6 directory additionally requires an environment authorization flag.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any

from .r3n5_target_span_contract import create_target_span, target_span_from_case

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3n6_fresh_holdout"
R3N5_OUT = REPO / "evals" / "mai07_r3n5_fresh_holdout"
AUTHORIZE_ENV = "MAI07_AUTHORIZE_R3N6_EVAL_WRITE"
BUILDER_VERSION = "mai-07-r3n6-dataset.1.0.0"
SCHEMA_VERSION = "mai07_r3n6_fresh_holdout_case_v1"
TEMPLATE_FAMILY_VERSION = "r3n6_targetspan_v1"
SEED_DEVELOPMENT = 20260730
SEED_HOLDOUT = 20260731

EXPECTED_BEHAVIOR_ENUM = frozenset(
    {
        "ACRONYM_IDENTITY_TOP1",
        "IDENTITY_RETAINED",
        "IDENTITY_TOP1",
        "PROTECTED_IDENTITY",
        "ROMANIZED_SCRIPT_AT_5",
    }
)

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

# These surfaces are deliberately disjoint from R3N5.  Development and
# holdout additionally have mutually exclusive target pools.  The split is a
# release authority: development observations cannot disclose any holdout
# target surface or target/behaviour pair.
DEVELOPMENT_ENGLISH = (
    "account",
    "receipt",
    "credit",
    "debit",
    "journal",
    "inventory",
)
HOLDOUT_ENGLISH = (
    "expense",
    "income",
    "payroll",
    "banking",
    "transfer",
    "quotation",
)
DEVELOPMENT_ROMANIZED = (
    "Baaki",
    "Aamdani",
    "Bikri",
    "Kharcha",
    "Hernu",
    "Bhayo",
)
HOLDOUT_ROMANIZED = (
    "Bholi",
    "Garera",
    "Mero",
    "Sabai",
    "Aaja",
    "Bakaya",
)
DEVELOPMENT_ACRONYMS = ("GST", "POS", "CRM")
HOLDOUT_ACRONYMS = ("API", "CSV", "IBAN")
DEVELOPMENT_IDENTIFIERS = ("SKU-3107/NP", "REF-7310/KT")
HOLDOUT_IDENTIFIERS = ("PAN-31/CD", "LOT-8/Q")
DEVELOPMENT_UNICODE_IDENTITIES = ("R\u00e9sum\u00e9", "Z\u00fcrich")
HOLDOUT_UNICODE_IDENTITIES = ("E\u0301tude", "Bogot\u00e1")

# Support splits are separate evaluation authorities and may draw from the
# complete R3N6-safe inventory.  Only DEVELOPMENT and HOLDOUT_VALIDATION must
# be mutually opaque.
ENGLISH = DEVELOPMENT_ENGLISH + HOLDOUT_ENGLISH
ROMANIZED = DEVELOPMENT_ROMANIZED + HOLDOUT_ROMANIZED
ACRONYMS = DEVELOPMENT_ACRONYMS + HOLDOUT_ACRONYMS
IDENTIFIERS = DEVELOPMENT_IDENTIFIERS + HOLDOUT_IDENTIFIERS
UNICODE_IDENTITIES = DEVELOPMENT_UNICODE_IDENTITIES + HOLDOUT_UNICODE_IDENTITIES

_DIGITS = re.compile(r"\d+")
_CASE_CODE = re.compile(r"r[a-z]+x")


def _sha_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _normalized_hash(value: str) -> str:
    return _sha_text(" ".join(value.lower().split()))


def _skeleton_hash(value: str) -> str:
    normalized = " ".join(value.lower().split())
    return _sha_text(_DIGITS.sub("", normalized))


def _context_template_signature(row: dict[str, Any]) -> str:
    target = target_span_from_case(row)
    raw_text = str(row["input_text"])
    template = (
        raw_text[: target.raw_start]
        + "{TARGET}"
        + raw_text[target.raw_end_exclusive :]
    )
    return _CASE_CODE.sub("{CODE}", template)


def _alpha_code(value: int) -> str:
    """Return an injective letters-only code for freshness-safe case text."""
    chars: list[str] = []
    n = value + 1
    while n:
        n, rem = divmod(n - 1, 26)
        chars.append(chr(97 + rem))
    # Boundary markers prevent a variable-length base-26 code from colliding
    # with a padded representation at alphabet rollover boundaries.
    return "r" + "".join(reversed(chars)) + "x"


def _r3n5_input_paths() -> tuple[Path, ...]:
    """Return the complete allowlist of prior input-split authorities."""
    return tuple(R3N5_OUT / filename for filename in SPLIT_FILES.values())


def _r3n5_input_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in _r3n5_input_paths():
        if path.name not in SPLIT_FILES.values():
            raise ValueError(f"non_input_authority_path:{path}")
        if not path.is_file():
            raise FileNotFoundError(f"missing_r3n5_split_authority:{path}")
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            raw_text = str(row["input_text"])
            declared_source_hash = str(row["target_source_text_sha256"])
            if declared_source_hash != _sha_text(raw_text):
                raise ValueError(f"stale_r3n5_target_source_hash:{row.get('case_id', '')}")
            rows.append(row)
    return rows


def _r3n5_firewall() -> dict[str, set[str]]:
    rows = _r3n5_input_rows()
    return {
        "case_ids": {str(row["case_id"]) for row in rows},
        "input_texts": {str(row["input_text"]) for row in rows},
        "text_hashes": {_normalized_hash(str(row["input_text"])) for row in rows},
        "skeleton_hashes": {_skeleton_hash(str(row["input_text"])) for row in rows},
        "target_source_hashes": {str(row["target_source_text_sha256"]) for row in rows},
        "target_surface_hashes": {str(row["target_raw_surface_sha256"]) for row in rows},
        "template_families": {str(row.get("template_family", "")) for row in rows},
    }


def _primary_evaluation_populations(index: int) -> list[str]:
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


def _holdout_populations(index: int) -> list[str]:
    return _primary_evaluation_populations(index)


def _development_populations(index: int) -> list[str]:
    populations = _primary_evaluation_populations(index)
    if index < 100:
        populations.append("ENGLISH_GUARD_ANALOGUE")
    if 100 <= index < 175:
        populations.append("ACRONYM_IDENTIFIER_ANALOGUE")
    if index < 9:
        populations.append("AUTHORIZED_CODE_CORRECTIVE")
    return populations


def _seeded_pick(
    values: tuple[str, ...],
    *,
    seed: int,
    namespace: str,
    index: int,
) -> str:
    if not values:
        raise ValueError(f"empty_seeded_pool:{namespace}")
    digest = hashlib.sha256(f"{seed}|{namespace}|{index}".encode("utf-8")).digest()
    return values[int.from_bytes(digest[:8], "big") % len(values)]


def _development_target_for(index: int) -> tuple[str, str, str, list[str]]:
    populations = _development_populations(index)
    if 200 <= index < 400:
        target = _seeded_pick(
            DEVELOPMENT_ROMANIZED,
            seed=SEED_DEVELOPMENT,
            namespace="development-romanized",
            index=index,
        )
        return target, "ROMANIZED_SCRIPT_AT_5", "romanized", populations
    if 400 <= index < 550:
        target = _seeded_pick(
            DEVELOPMENT_UNICODE_IDENTITIES,
            seed=SEED_DEVELOPMENT,
            namespace="development-unicode",
            index=index,
        )
        return target, "IDENTITY_RETAINED", "unicode", populations
    if 550 <= index < 650:
        target = _seeded_pick(
            DEVELOPMENT_ACRONYMS,
            seed=SEED_DEVELOPMENT,
            namespace="development-acronym",
            index=index,
        )
        return target, "ACRONYM_IDENTITY_TOP1", "acronym", populations
    if 650 <= index < 750:
        target = _seeded_pick(
            DEVELOPMENT_IDENTIFIERS,
            seed=SEED_DEVELOPMENT,
            namespace="development-identifier",
            index=index,
        )
        return target, "IDENTITY_TOP1", "identifier", populations
    target = _seeded_pick(
        DEVELOPMENT_ENGLISH,
        seed=SEED_DEVELOPMENT,
        namespace="development-english",
        index=index,
    )
    return target, "IDENTITY_RETAINED", "identity", populations


def _holdout_target_for(index: int) -> tuple[str, str, str, list[str]]:
    populations = _holdout_populations(index)
    if 200 <= index < 400:
        target = _seeded_pick(
            HOLDOUT_ROMANIZED,
            seed=SEED_HOLDOUT,
            namespace="holdout-romanized",
            index=index,
        )
        return target, "ROMANIZED_SCRIPT_AT_5", "romanized", populations
    if 400 <= index < 550:
        target = _seeded_pick(
            HOLDOUT_UNICODE_IDENTITIES,
            seed=SEED_HOLDOUT,
            namespace="holdout-unicode",
            index=index,
        )
        return target, "IDENTITY_RETAINED", "unicode", populations
    if 550 <= index < 650:
        target = _seeded_pick(
            HOLDOUT_ACRONYMS,
            seed=SEED_HOLDOUT,
            namespace="holdout-acronym",
            index=index,
        )
        return target, "ACRONYM_IDENTITY_TOP1", "acronym", populations
    if 650 <= index < 750:
        target = _seeded_pick(
            HOLDOUT_IDENTIFIERS,
            seed=SEED_HOLDOUT,
            namespace="holdout-identifier",
            index=index,
        )
        return target, "IDENTITY_TOP1", "identifier", populations
    target = _seeded_pick(
        HOLDOUT_ENGLISH,
        seed=SEED_HOLDOUT,
        namespace="holdout-english",
        index=index,
    )
    return target, "IDENTITY_RETAINED", "identity", populations


def _support_target_for(split: str, index: int) -> tuple[str, str, str, list[str]]:
    if split == "IDENTITY_ANCHOR_CHALLENGE":
        return IDENTIFIERS[0], "IDENTITY_RETAINED", "anchor", [
            "IDENTITY_ANCHOR_CHALLENGE",
            "CANDIDATE_CAP_PRESSURE",
        ]
    if split == "CONTEXT_COUNTERFACTUAL":
        return ENGLISH[index % len(ENGLISH)], "IDENTITY_TOP1", "counterfactual", ["CONTEXT_COUNTERFACTUAL"]
    if split == "OOV_CHALLENGE":
        return f"rx{_alpha_code(index)}", "IDENTITY_RETAINED", "oov", ["OOV"]
    if split == "MONOTONIC_REGRESSION":
        return ENGLISH[index % len(ENGLISH)], "IDENTITY_TOP1", "monotonic", ["MONOTONIC_PARENT_CORRECT"]
    if split == "SAFETY_CHALLENGE":
        return ACRONYMS[index % len(ACRONYMS)], "PROTECTED_IDENTITY", "safety", ["PROTECTED_IDENTITY_REQUIRED"]
    raise ValueError(f"unknown_r3n6_split:{split}")


def _case_code(split: str, index: int, seed: int) -> str:
    split_index = list(SPLIT_FILES).index(split)
    return _alpha_code(seed * 100_000 + split_index * 10_000 + index)


def _materialize_case(
    *,
    split: str,
    index: int,
    seed: int,
    target: str,
    behavior: str,
    family: str,
    populations: list[str],
    prefix_label: str,
    suffix_label: str,
) -> dict[str, Any]:
    if behavior not in EXPECTED_BEHAVIOR_ENUM:
        raise ValueError(f"unknown_expected_behavior:{split}:{index}:{behavior}")
    code = _case_code(split, index, seed)
    prefix = f"{prefix_label}-{code} "
    # Whitespace on each side ensures the immutable target interval is exactly
    # one analyzer span; punctuation remains outside target bounds.
    raw_text = f"{prefix}{target} {suffix_label}-{code}"
    start = len(prefix)
    target_contract = create_target_span(
        raw_text,
        raw_start=start,
        raw_end_exclusive=start + len(target),
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "builder_version": BUILDER_VERSION,
        "case_id": f"R3N6-{split[:3]}-{index:04d}-{_sha_text(f'{seed}|{split}|{index}')[:10]}",
        "split": split,
        "population_ids": populations,
        "input_text": raw_text,
        "highlighted_span": target,
        "expected_behavior": behavior,
        "template_family": (
            f"{TEMPLATE_FAMILY_VERSION}_{split.lower()}_{family}_{prefix_label}_{suffix_label}"
        ),
        "seed_family": seed,
        "prohibited_for_training": True,
        "gold_from_runtime": False,
        "parent_prediction_inputs_used": False,
        **target_contract.to_case_fields(),
    }


def _development_case(index: int) -> dict[str, Any]:
    target, behavior, family, populations = _development_target_for(index)
    return _materialize_case(
        split="DEVELOPMENT",
        index=index,
        seed=SEED_DEVELOPMENT,
        target=target,
        behavior=behavior,
        family=family,
        populations=populations,
        prefix_label="development-sample",
        suffix_label="development-proof",
    )


def _holdout_case(index: int) -> dict[str, Any]:
    target, behavior, family, populations = _holdout_target_for(index)
    return _materialize_case(
        split="HOLDOUT_VALIDATION",
        index=index,
        seed=SEED_HOLDOUT,
        target=target,
        behavior=behavior,
        family=family,
        populations=populations,
        prefix_label="holdout-validation",
        suffix_label="holdout-evidence",
    )


def _support_case(split: str, index: int) -> dict[str, Any]:
    target, behavior, family, populations = _support_target_for(split, index)
    return _materialize_case(
        split=split,
        index=index,
        seed=SEED_HOLDOUT,
        target=target,
        behavior=behavior,
        family=family,
        populations=populations,
        prefix_label="support-challenge",
        suffix_label="support-evidence",
    )


def _case(split: str, index: int) -> dict[str, Any]:
    if split == "DEVELOPMENT":
        return _development_case(index)
    if split == "HOLDOUT_VALIDATION":
        return _holdout_case(index)
    return _support_case(split, index)


def _validate_exact_split_contract(splits: dict[str, list[dict[str, Any]]]) -> None:
    if set(splits) != set(SPLIT_COUNTS):
        missing = sorted(set(SPLIT_COUNTS) - set(splits))
        extra = sorted(set(splits) - set(SPLIT_COUNTS))
        raise ValueError(f"r3n6_split_set_mismatch:missing={missing}:extra={extra}")

    for split, expected_count in SPLIT_COUNTS.items():
        rows = splits[split]
        if len(rows) != expected_count:
            raise ValueError(
                f"r3n6_split_count_mismatch:{split}:expected={expected_count}:actual={len(rows)}"
            )
        for index, row in enumerate(rows):
            if row.get("split") != split:
                raise ValueError(f"r3n6_row_split_mismatch:{split}:{index}")
            behavior = str(row.get("expected_behavior", ""))
            if behavior not in EXPECTED_BEHAVIOR_ENUM:
                raise ValueError(
                    f"unknown_expected_behavior:{split}:{index}:{behavior}"
                )


def _validate_development_holdout_independence(
    splits: dict[str, list[dict[str, Any]]],
) -> None:
    development = splits["DEVELOPMENT"]
    holdout = splits["HOLDOUT_VALIDATION"]

    development_surfaces = {
        str(row["target_raw_surface_sha256"]) for row in development
    }
    holdout_surfaces = {
        str(row["target_raw_surface_sha256"]) for row in holdout
    }
    if not development_surfaces.isdisjoint(holdout_surfaces):
        raise ValueError("development_holdout_target_surface_overlap")

    development_pairs = {
        (str(row["highlighted_span"]), str(row["expected_behavior"]))
        for row in development
    }
    holdout_pairs = {
        (str(row["highlighted_span"]), str(row["expected_behavior"]))
        for row in holdout
    }
    if not development_pairs.isdisjoint(holdout_pairs):
        raise ValueError("development_holdout_target_behavior_pair_overlap")

    development_templates = {
        _context_template_signature(row) for row in development
    }
    holdout_templates = {_context_template_signature(row) for row in holdout}
    if not development_templates.isdisjoint(holdout_templates):
        raise ValueError("development_holdout_context_template_overlap")


def build_all() -> dict[str, list[dict[str, Any]]]:
    firewall = _r3n5_firewall()
    built: dict[str, list[dict[str, Any]]] = {}
    own_ids: set[str] = set()
    own_input_texts: set[str] = set()
    own_source_hashes: set[str] = set()

    for split, count in SPLIT_COUNTS.items():
        rows = [_case(split, index) for index in range(count)]
        for row in rows:
            target = target_span_from_case(row)
            case_id = str(row["case_id"])
            input_text = str(row["input_text"])
            normalized_hash = _normalized_hash(input_text)
            skeleton_hash = _skeleton_hash(input_text)
            source_hash = str(row["target_source_text_sha256"])
            surface_hash = str(row["target_raw_surface_sha256"])
            template_family = str(row["template_family"])

            if source_hash != _sha_text(input_text):
                raise ValueError(f"target_source_hash_mismatch:{case_id}")
            if target.raw_surface_sha256 != surface_hash:
                raise ValueError(f"target_surface_hash_mismatch:{case_id}")
            if case_id in firewall["case_ids"] or case_id in own_ids:
                raise ValueError(f"case_id_overlap:{case_id}")
            if input_text in firewall["input_texts"] or input_text in own_input_texts:
                raise ValueError(f"input_text_overlap:{case_id}")
            if normalized_hash in firewall["text_hashes"]:
                raise ValueError(f"normalized_text_overlap:{case_id}")
            if skeleton_hash in firewall["skeleton_hashes"]:
                raise ValueError(f"r3n5_skeleton_overlap:{case_id}")
            if source_hash in firewall["target_source_hashes"] or source_hash in own_source_hashes:
                raise ValueError(f"target_source_hash_overlap:{case_id}")
            if surface_hash in firewall["target_surface_hashes"]:
                raise ValueError(f"r3n5_target_surface_overlap:{case_id}")
            if template_family in firewall["template_families"]:
                raise ValueError(f"template_family_overlap:{template_family}")

            own_ids.add(case_id)
            own_input_texts.add(input_text)
            own_source_hashes.add(source_hash)
        built[split] = rows

    _validate_exact_split_contract(built)
    _validate_development_holdout_independence(built)
    return built


def _jsonl_bytes(rows: list[dict[str, Any]]) -> bytes:
    return (
        "".join(
            json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
            for row in rows
        )
    ).encode("utf-8")


def assert_exact_build_all_output(
    splits: dict[str, list[dict[str, Any]]],
) -> dict[str, list[dict[str, Any]]]:
    """Fail closed unless ``splits`` are byte-exact deterministic build output."""
    _validate_exact_split_contract(splits)
    _validate_development_holdout_independence(splits)
    expected = build_all()
    for split in SPLIT_COUNTS:
        if _jsonl_bytes(splits[split]) != _jsonl_bytes(expected[split]):
            raise ValueError(f"r3n6_split_not_exact_build_output:{split}")
    return copy.deepcopy(expected)


def assert_exact_build_all_manifest(
    manifest: dict[str, Any],
    *,
    splits: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """Fail closed unless a manifest exactly describes deterministic output."""
    expected_splits = (
        build_all() if splits is None else assert_exact_build_all_output(splits)
    )
    expected_manifest = manifest_for(expected_splits)
    if manifest != expected_manifest:
        raise ValueError("r3n6_manifest_not_exact_build_output")
    return copy.deepcopy(expected_manifest)


def assert_exact_corpus_authority(
    splits: dict[str, list[dict[str, Any]]],
    manifest: dict[str, Any],
) -> dict[str, Any]:
    """Verify exact corpus bytes, manifest semantics, counts, and firewalls."""
    return assert_exact_build_all_manifest(manifest, splits=splits)


def manifest_for(splits: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    _validate_exact_split_contract(splits)
    _validate_development_holdout_independence(splits)
    return {
        "schema_version": "mai07_r3n6_dataset_manifest_v1",
        "builder_version": BUILDER_VERSION,
        "template_family_version": TEMPLATE_FAMILY_VERSION,
        "seeds": {"development": SEED_DEVELOPMENT, "holdout": SEED_HOLDOUT},
        "parent_prediction_jsonl_opened": False,
        "parent_score_report_opened": False,
        "r3n5_input_splits_used_for_one_way_freshness_only": True,
        "r3n5_freshness_dimensions": [
            "case_id",
            "input_text",
            "target_source_text_sha256",
            "template_family",
            "target_raw_surface_sha256",
        ],
        "expected_behavior_enum": sorted(EXPECTED_BEHAVIOR_ENUM),
        "development_holdout_target_surfaces_disjoint": True,
        "development_holdout_target_behavior_pairs_disjoint": True,
        "development_holdout_context_templates_disjoint": True,
        "prohibited_for_training": True,
        "splits": {
            split: {
                "filename": SPLIT_FILES[split],
                "count": len(rows),
                "sha256": hashlib.sha256(_jsonl_bytes(rows)).hexdigest(),
                "population_counts": dict(
                    sorted(Counter(population for row in rows for population in row["population_ids"]).items())
                ),
            }
            for split, rows in splits.items()
        },
    }


def write_all(output_dir: Path) -> dict[str, Any]:
    destination = Path(output_dir)
    if destination.resolve() == OUT.resolve() and os.environ.get(AUTHORIZE_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_ENV}=1 to authorize canonical R3N6 dataset writes")

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
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()

    splits = build_all()
    manifest = manifest_for(splits)
    if args.write:
        if args.output_dir is None:
            parser.error("--write requires an explicit --output-dir")
        manifest = write_all(args.output_dir)
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
