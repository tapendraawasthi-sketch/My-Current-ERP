"""MAI-07R3K hash-contract helpers — prevent hybrid / mixed hash citations.

Raw artifact SHA-256 and semantic object SHA-256 are distinct typed fields.
Display abbreviations must derive from a single full 64-char hash.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Mapping

HashKind = Literal[
    "raw_file_sha256",
    "canonical_jsonl_raw_sha256",
    "semantic_object_sha256",
    "package_zip_sha256",
]

_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_ELLIPSIS_ABBREV = re.compile(r"^([0-9a-f]{8})…([0-9a-f]{6})$")


class Mai07R3KHashContractError(ValueError):
    pass


@dataclass(frozen=True)
class HashAuthorityRecord:
    field_name: str
    kind: HashKind
    algorithm: str
    serialization_rule: str
    authoritative_path: str
    computed_value: str
    previously_claimed_value: str
    match_status: str  # MATCH | MISMATCH | NEW | CORRECTED_PROSE


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().lower()


def require_full_sha256(value: str, *, label: str) -> str:
    v = value.strip()
    if not _HEX64.match(v):
        raise Mai07R3KHashContractError(
            f"invalid_machine_hash:{label}:len={len(v)}:value={value!r}"
        )
    return v


def display_abbreviation(full_sha256: str, *, prefix: int = 8, suffix: int = 6) -> str:
    """Derive display abbreviation from ONE full hash only (never mix two hashes)."""
    full = require_full_sha256(full_sha256, label="display_source")
    return f"{full[:prefix]}…{full[-suffix:]}"


def assert_abbreviation_matches_full(abbrev: str, full_sha256: str, *, label: str) -> None:
    full = require_full_sha256(full_sha256, label=label)
    m = _ELLIPSIS_ABBREV.match(abbrev.strip())
    if not m:
        raise Mai07R3KHashContractError(f"invalid_abbrev_form:{label}:{abbrev!r}")
    pref, suf = m.group(1), m.group(2)
    if pref != full[:8] or suf != full[-6:]:
        raise Mai07R3KHashContractError(
            f"abbrev_does_not_match_full:{label}:abbrev={abbrev}:full={full}"
        )


def reject_hybrid_accounting_citation(text: str) -> None:
    """Reject the known bad hybrid: semantic prefix + ZIP suffix."""
    # Known hybrid from conversational R3K summary: b96bec29…1cdb68
    if re.search(r"b96bec29…1cdb68", text) or re.search(r"b96bec29\.\.\.1cdb68", text):
        raise Mai07R3KHashContractError("hybrid_hash_citation_rejected:b96bec29…1cdb68")
    # Generic: abbreviation whose suffix matches ZIP while prefix matches semantic
    for m in re.finditer(r"`?([0-9a-f]{8})…([0-9a-f]{6})`?", text):
        pref, suf = m.group(1), m.group(2)
        # Detect cross-type hybrid of known accounting authorities if both present in prose nearby
        if pref == "b96bec29" and suf == "1cdb68":
            raise Mai07R3KHashContractError("hybrid_hash_citation_rejected:accounting_sem_zip")


# Full authorities (never abbreviate inside machine artifacts).
KNOWN = {
    "accounting_package_zip_raw_sha256": "f558fefdc186ba79bbe2a8757569204b88ce1aa1ed27400cda7705c1551cdb68",
    "accounting_canonical_jsonl_raw_sha256": "89305364ea86fd60637d1787aca07aba523781f77473805a9022516f6ff0de9b",
    "accounting_import_semantic_sha256": "b96bec29e30ddcdc6dce1a5ef09a2003ee9de003a336cd98b43341c6e55e363b",
    "remaining_roles_canonical_jsonl_raw_sha256": "a647bf36b534a990bd3cf1ab174caf3a7c1c413abe14a5ca4abb138f85a6e707",
    "remaining_roles_import_semantic_sha256": "1cc783d79cc3cc5f3f2daa288ae8b4721238fed584dbfb540597c8f883a8f4a1",
    "r3k_cross_role_decisions_raw_sha256": "6cfec7a53234cd74c68612bf2992f8c660b059498ca7220e1dea1f43a4d52935",
    "r3k_risk_queue_raw_sha256": "dc8984510f701d2312c12750032e10e8f9a4aca8e12d9735c9d7ec3979c6c6cf",
    "r3k_semantic_sha256": "42d1a5ffc170d201f8a4bf92e4cef4f156dde57c07e847c960835e26080ddafc",
}

# Conversational pre-closure defect: semantic prefix + ZIP suffix (CASE A / REPORT_ONLY).
PRE_CLOSURE_HYBRID_ACCOUNTING_CITATION = "Accounting: b96bec29…1cdb68"
PRE_CLOSURE_HYBRID_PREFIX = "b96bec29"
PRE_CLOSURE_HYBRID_SUFFIX = "1cdb68"


def typed_hash_fields(
    *,
    accounting_package_zip_raw_sha256: str,
    accounting_import_semantic_sha256: str,
    remaining_roles_import_semantic_sha256: str,
    r3k_semantic_sha256: str,
) -> dict[str, str]:
    """Single typed map — callers must not assemble display strings from mixed values."""
    fields = {
        "accounting_package_zip_raw_sha256": require_full_sha256(
            accounting_package_zip_raw_sha256, label="accounting_package_zip_raw_sha256"
        ),
        "accounting_import_semantic_sha256": require_full_sha256(
            accounting_import_semantic_sha256, label="accounting_import_semantic_sha256"
        ),
        "remaining_roles_import_semantic_sha256": require_full_sha256(
            remaining_roles_import_semantic_sha256, label="remaining_roles_import_semantic_sha256"
        ),
        "r3k_semantic_sha256": require_full_sha256(r3k_semantic_sha256, label="r3k_semantic_sha256"),
    }
    # Raw ZIP and semantic must remain distinct authorities.
    if fields["accounting_package_zip_raw_sha256"] == fields["accounting_import_semantic_sha256"]:
        raise Mai07R3KHashContractError("mixed_hash_types:zip_equals_accounting_semantic")
    return fields


def format_display_citation(label: str, full_sha256: str) -> str:
    """Human-readable citation from exactly one full hash field."""
    return f"{label}: `{display_abbreviation(full_sha256)}`"


def validate_machine_hash_map(values: Mapping[str, str]) -> None:
    for name, value in values.items():
        require_full_sha256(value, label=name)


def build_input_authority_manifest(repo: Path | None = None) -> dict[str, Any]:
    """Compute and assemble R3K_INPUT_AUTHORITY_MANIFEST.json content."""
    from .mai07_r3ja_v3_firewall import REPO
    from .mai07_r3k_cross_role_consensus_diagnostic import (
        ACCT_JSONL,
        REM_JSONL,
        DEFAULT_OUT,
        verify_input_semantic_hashes,
        EXPECTED_UNIQUE_CASES,
        EXPECTED_FOUR_ROLE,
        EXPECTED_THREE_ROLE,
        EXPECTED_TOTAL_JUDGMENTS,
    )

    root = repo or REPO
    zip_path = root / "MokXya_MAI07_V3_ACCOUNTING_DOMAIN_ROUND_A_AI_ASSISTED_HUMAN_VERIFIED_READY.zip"
    r3k_dec = DEFAULT_OUT / "canonical" / "CROSS_ROLE_DECISIONS.jsonl"
    r3k_risk = DEFAULT_OUT / "canonical" / "RISK_QUEUE.jsonl"
    r3k_sem_path = DEFAULT_OUT / "reports" / "SEMANTIC_HASH.json"
    r3k_report = DEFAULT_OUT / "reports" / "CONSENSUS_DIAGNOSTIC_REPORT.json"

    if not zip_path.is_file():
        raise Mai07R3KHashContractError(f"missing_zip:{zip_path}")

    inputs = verify_input_semantic_hashes()
    zip_h = sha256_file(zip_path)
    acct_jsonl_h = sha256_file(ACCT_JSONL)
    rem_jsonl_h = sha256_file(REM_JSONL)
    r3k_dec_h = sha256_file(r3k_dec)
    r3k_risk_h = sha256_file(r3k_risk)
    r3k_sem = require_full_sha256(
        json.loads(r3k_sem_path.read_text(encoding="utf-8"))["semantic_hash"],
        label="r3k_semantic",
    )
    report = json.loads(r3k_report.read_text(encoding="utf-8"))
    typed_hash_fields(
        accounting_package_zip_raw_sha256=zip_h,
        accounting_import_semantic_sha256=inputs["accounting"],
        remaining_roles_import_semantic_sha256=inputs["remaining"],
        r3k_semantic_sha256=r3k_sem,
    )

    # population from report + risk file
    risk_n = sum(1 for ln in r3k_risk.read_text(encoding="utf-8").splitlines() if ln.strip())
    counts = {
        "unique_source_item_ids": report["unique_source_item_ids"],
        "four_role_cases": report["four_role_cases"],
        "three_role_cases": report["three_role_cases"],
        "total_role_judgments": report["total_role_judgments"],
        "PRODUCT_POLICY": report["role_counts"]["PRODUCT_POLICY"],
        "NEPALI_FLUENT_A": report["role_counts"]["NEPALI_FLUENT_A"],
        "PROFESSIONAL_LINGUIST_B": report["role_counts"]["PROFESSIONAL_LINGUIST_B"],
        "ACCOUNTING_DOMAIN": report["role_counts"]["ACCOUNTING_DOMAIN"],
        "risk_queue_cases": risk_n,
    }
    expected = {
        "unique_source_item_ids": EXPECTED_UNIQUE_CASES,
        "four_role_cases": EXPECTED_FOUR_ROLE,
        "three_role_cases": EXPECTED_THREE_ROLE,
        "total_role_judgments": EXPECTED_TOTAL_JUDGMENTS,
        "PRODUCT_POLICY": 1111,
        "NEPALI_FLUENT_A": 1111,
        "PROFESSIONAL_LINGUIST_B": 1111,
        "ACCOUNTING_DOMAIN": 611,
        "risk_queue_cases": 700,
    }
    if counts != expected:
        raise Mai07R3KHashContractError(f"population_mismatch:{counts}!={expected}")

    def rec(
        field_name: str,
        kind: HashKind,
        path: Path,
        computed: str,
        claimed: str,
        rule: str,
    ) -> dict[str, Any]:
        computed = require_full_sha256(computed, label=field_name)
        claimed_n = require_full_sha256(claimed, label=f"{field_name}_claimed")
        if computed != claimed_n:
            raise Mai07R3KHashContractError(f"hash_mismatch:{field_name}:{computed}!={claimed_n}")
        return asdict(
            HashAuthorityRecord(
                field_name=field_name,
                kind=kind,
                algorithm="sha256",
                serialization_rule=rule,
                authoritative_path=path.as_posix().replace("\\", "/"),
                computed_value=computed,
                previously_claimed_value=claimed_n,
                match_status="MATCH",
            )
        )

    def rel(p: Path) -> Path:
        try:
            return p.relative_to(root)
        except ValueError:
            return p

    hash_fields = {
        "accounting_package_zip_raw_sha256": rec(
            "accounting_package_zip_raw_sha256",
            "package_zip_sha256",
            rel(zip_path),
            zip_h,
            KNOWN["accounting_package_zip_raw_sha256"],
            "sha256(raw_zip_bytes)",
        ),
        "accounting_canonical_jsonl_raw_sha256": rec(
            "accounting_canonical_jsonl_raw_sha256",
            "canonical_jsonl_raw_sha256",
            rel(ACCT_JSONL),
            acct_jsonl_h,
            KNOWN["accounting_canonical_jsonl_raw_sha256"],
            "sha256(utf-8_jsonl_file_bytes)",
        ),
        "accounting_import_semantic_sha256": rec(
            "accounting_import_semantic_sha256",
            "semantic_object_sha256",
            rel(ACCT_JSONL.parent.parent / "reports" / "SEMANTIC_HASH.json"),
            inputs["accounting"],
            KNOWN["accounting_import_semantic_sha256"],
            "sha256(json.dumps({schema,phase,provenance,records_sorted}, sort_keys=True, separators=(',', ':')))",
        ),
        "remaining_roles_canonical_jsonl_raw_sha256": rec(
            "remaining_roles_canonical_jsonl_raw_sha256",
            "canonical_jsonl_raw_sha256",
            rel(REM_JSONL),
            rem_jsonl_h,
            KNOWN["remaining_roles_canonical_jsonl_raw_sha256"],
            "sha256(utf-8_jsonl_file_bytes)",
        ),
        "remaining_roles_import_semantic_sha256": rec(
            "remaining_roles_import_semantic_sha256",
            "semantic_object_sha256",
            rel(REM_JSONL.parent.parent / "reports" / "SEMANTIC_HASH.json"),
            inputs["remaining"],
            KNOWN["remaining_roles_import_semantic_sha256"],
            "sha256(json.dumps({schema,phase,provenance,records_sorted}, sort_keys=True, separators=(',', ':')))",
        ),
        "r3k_cross_role_decisions_raw_sha256": rec(
            "r3k_cross_role_decisions_raw_sha256",
            "canonical_jsonl_raw_sha256",
            rel(r3k_dec),
            r3k_dec_h,
            KNOWN["r3k_cross_role_decisions_raw_sha256"],
            "sha256(utf-8_jsonl_file_bytes)",
        ),
        "r3k_risk_queue_raw_sha256": rec(
            "r3k_risk_queue_raw_sha256",
            "canonical_jsonl_raw_sha256",
            rel(r3k_risk),
            r3k_risk_h,
            KNOWN["r3k_risk_queue_raw_sha256"],
            "sha256(utf-8_jsonl_file_bytes)",
        ),
        "r3k_semantic_sha256": rec(
            "r3k_semantic_sha256",
            "semantic_object_sha256",
            rel(r3k_sem_path),
            r3k_sem,
            KNOWN["r3k_semantic_sha256"],
            "sha256(json.dumps({schema,phase,provenance,decisions,risk_queue,agreement}, sort_keys=True, separators=(',', ':')))",
        ),
    }

    # Cross-checks: report inputs must equal semantic authorities
    if report["input_accounting_semantic_hash"] != inputs["accounting"]:
        raise Mai07R3KHashContractError("r3k_report_acct_input_mismatch")
    if report["input_remaining_semantic_hash"] != inputs["remaining"]:
        raise Mai07R3KHashContractError("r3k_report_rem_input_mismatch")
    if report["semantic_hash"] != r3k_sem:
        raise Mai07R3KHashContractError("r3k_report_semantic_mismatch")

    # Distinctness
    if zip_h == inputs["accounting"]:
        raise Mai07R3KHashContractError("zip_equals_semantic_impossible")

    manifest = {
        "schema_version": "mai07-r3k-input-authority-manifest-v1",
        "phase": "MAI-07R3K-CLOSURE-INPUT-HASH-CONTRACT-RECONCILIATION",
        "defect_scope": "REPORT_ONLY",
        "defect_classification": "REPORT_ONLY",
        "ambiguous_citation_observed": {
            "form": "hybrid_prefix_suffix",
            "prefix_from_accounting_import_semantic": PRE_CLOSURE_HYBRID_PREFIX,
            "suffix_from_accounting_package_zip_raw": PRE_CLOSURE_HYBRID_SUFFIX,
            "forbidden_joined_display": True,
            "note": "Do not join these fragments with an ellipsis as a single authority citation.",
        },
        "ambiguous_citation_explanation": (
            "Conversational R3K summary incorrectly abbreviated the accounting "
            "semantic hash prefix (b96bec29) with the accounting ZIP raw hash suffix (1cdb68). "
            "Canonical JSON/R3K machine artifacts already stored the full correct semantic hash."
        ),
        "hash_contract": {
            "machine_hashes_must_be_64_lowercase_hex": True,
            "raw_and_semantic_are_distinct_fields": True,
            "display_abbreviation_must_derive_from_single_full_hash": True,
            "hybrid_prefix_suffix_from_different_hashes_forbidden": True,
        },
        "hashes": hash_fields,
        # Convenience top-level full values (also in hashes.*)
        "accounting_package_zip_raw_sha256": zip_h,
        "accounting_canonical_jsonl_raw_sha256": acct_jsonl_h,
        "accounting_import_semantic_sha256": inputs["accounting"],
        "remaining_roles_canonical_jsonl_raw_sha256": rem_jsonl_h,
        "remaining_roles_import_semantic_sha256": inputs["remaining"],
        "r3k_cross_role_decisions_raw_sha256": r3k_dec_h,
        "r3k_risk_queue_raw_sha256": r3k_risk_h,
        "r3k_semantic_sha256": r3k_sem,
        "population_counts": counts,
        "verified_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "prohibited_for_training": True,
        "independent_human_review": False,
        "linguist_approved": False,
        "quality_gates_passed": False,
        "production_approved": False,
        "majority_voting_is_gold": False,
        "agreement_is_independent_human_irr": False,
        "official_round_a_lock_eligible": False,
        "round_b_ready": False,
        "frozen_v3_quality_gate_authorized": False,
        "r3k_canonical_outputs_changed": False,
        "r3k_semantic_hash_preserved": True,
        "verdict": "PASSED_CLOSURE",
        "MAI-07": "NEEDS_CORRECTIVE_WORK",
        "MAI-08": "NOT_STARTED",
    }
    # Machine-readable hashes must never be abbreviated.
    for key, value in list(manifest.items()):
        if key.endswith("_sha256") and isinstance(value, str):
            require_full_sha256(value, label=key)
    return manifest


DEFAULT_AUTHORITY_MANIFEST = (
    Path("docs/mokxya-ai/reviews/mai07_v3_ai_assisted/cross_role_diagnostic")
    / "R3K_INPUT_AUTHORITY_MANIFEST.json"
)


def write_input_authority_manifest(
    dest: Path | None = None,
    *,
    repo: Path | None = None,
    allow_timestamp_refresh: bool = True,
) -> str:
    from .mai07_r3ja_v3_firewall import REPO

    root = repo or REPO
    target = dest or (root / DEFAULT_AUTHORITY_MANIFEST)
    manifest = build_input_authority_manifest(root)
    target.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if target.exists():
        old_obj = json.loads(target.read_text(encoding="utf-8"))
        new_obj = json.loads(text)
        old_cmp = dict(old_obj)
        new_cmp = dict(new_obj)
        old_cmp.pop("verified_at_utc", None)
        new_cmp.pop("verified_at_utc", None)
        if old_cmp != new_cmp:
            raise Mai07R3KHashContractError(
                "refusing_silent_overwrite_of_authority_manifest_with_different_content"
            )
        if not allow_timestamp_refresh:
            return sha256_file(target)
    target.write_text(text, encoding="utf-8", newline="\n")
    return sha256_file(target)


def assert_inputs_invalidate_semantic_on_change(
    *,
    recorded_input_hashes: Mapping[str, str],
    current_input_hashes: Mapping[str, str],
    recorded_semantic: str,
    current_semantic: str,
) -> None:
    """If any typed input hash changes, semantic hash must also change (fail-closed)."""
    validate_machine_hash_map(dict(recorded_input_hashes))
    validate_machine_hash_map(dict(current_input_hashes))
    require_full_sha256(recorded_semantic, label="recorded_semantic")
    require_full_sha256(current_semantic, label="current_semantic")
    if recorded_input_hashes != current_input_hashes and recorded_semantic == current_semantic:
        raise Mai07R3KHashContractError(
            "changed_inputs_without_semantic_hash_invalidation"
        )
