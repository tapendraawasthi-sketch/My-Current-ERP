"""MAI-07R3N non-frozen policy-conformance evaluation dataset builder.

Firewall:
- Never reads frozen V2 case bodies or frozen prediction records.
- Synthetic sentences must not overlap R3L BEHAVIOR_EXPECTATIONS inputs.
- R3M code-corrective case text is loaded from closure artifacts only (not hardcoded).
- Gold labels are authored policy expectations — not runtime predictions.
- Canonical writes require MAI07_AUTHORIZE_EVAL_WRITE=1 via ``--write``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any, Literal

from ..infrastructure.resource_repository import load_resources

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3n_policy_conformance"
R3L_BEHAVIOR = (
    REPO
    / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/runtime_conformance_diagnostic/BEHAVIOR_EXPECTATIONS.jsonl"
)
R3M_PRIVATE = (
    REPO
    / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/policy_mismatch_triage/closure/R3M_CODE_CORRECTIVE_PRIVATE_CASES.jsonl"
)
R3M_AUTHORITY = (
    REPO
    / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/policy_mismatch_triage/closure/R3M_CODE_CORRECTIVE_AUTHORITY.json"
)

SEED_DEVELOPMENT = 20260718
SEED_HOLDOUT_FAMILY = 20260719
BUILDER_VERSION = "mai-07-r3n-dataset.1.0.0"
SCHEMA = "mai07_r3n_policy_conformance_case_v1"
AUTHORIZE_ENV = "MAI07_AUTHORIZE_EVAL_WRITE"

SplitName = Literal[
    "DEVELOPMENT",
    "HOLDOUT_VALIDATION",
    "SAFETY_CHALLENGE",
    "CONTEXT_COUNTERFACTUAL",
    "OOV_CHALLENGE",
    "MONOTONIC_REGRESSION",
]

SPLIT_FILES: dict[SplitName, str] = {
    "DEVELOPMENT": "development.jsonl",
    "HOLDOUT_VALIDATION": "holdout_validation.jsonl",
    "SAFETY_CHALLENGE": "safety_challenge.jsonl",
    "CONTEXT_COUNTERFACTUAL": "context_counterfactual.jsonl",
    "OOV_CHALLENGE": "oov_challenge.jsonl",
    "MONOTONIC_REGRESSION": "monotonic_regression.jsonl",
}

EXPECTED_BEHAVIORS = frozenset(
    {
        "IDENTITY_TOP1",
        "IDENTITY_RETAINED",
        "ACRONYM_IDENTITY_TOP1",
        "ROMANIZED_SCRIPT_AT_5",
        "SHARED_CONSERVATIVE",
        "PROTECTED_IDENTITY",
        "NO_RAW_MUTATION",
        "CAP_OK",
    }
)

REQUIRED_POPULATIONS = frozenset(
    {
        "ENGLISH_IDENTITY_REQUIRED",
        "ROMANIZED_NEPALI_REQUIRED",
        "IDENTITY_RETENTION_REQUIRED",
        "ACRONYM_IDENTITY_REQUIRED",
        "IDENTIFIER_PROTECTION_REQUIRED",
        "PROTECTED_IDENTITY_REQUIRED",
        "SHARED_OR_AMBIGUOUS",
        "CONTEXT_COUNTERFACTUAL",
        "CANDIDATE_CAP_PRESSURE",
        "OOV",
        "MONOTONIC_PARENT_CORRECT",
        "MONOTONIC_PARENT_INCORRECT",
        "AUTHORIZED_CODE_CORRECTIVE",
    }
)

PRIOR_EVAL_GLOBS = (
    "evals/mai07_r3h_english_identity/*.jsonl",
    "evals/mai07_r3f_english_identity/*.jsonl",
    "evals/mai07_r3f_seal_new/*.jsonl",
    "evals/mai07_r3h2_shared_collision/*.jsonl",
)


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def _seed_for_split(split: SplitName) -> int:
    if split == "DEVELOPMENT":
        return SEED_DEVELOPMENT
    return SEED_HOLDOUT_FAMILY


def _case_id_prefix(split: SplitName) -> str:
    return {
        "DEVELOPMENT": "R3N-DEV",
        "HOLDOUT_VALIDATION": "R3N-HLD",
        "SAFETY_CHALLENGE": "R3N-SAF",
        "CONTEXT_COUNTERFACTUAL": "R3N-CFX",
        "OOV_CHALLENGE": "R3N-OOV",
        "MONOTONIC_REGRESSION": "R3N-MON",
    }[split]


def _template_prefix(split: SplitName) -> str:
    return "r3n_dev" if split == "DEVELOPMENT" else "r3n_hld"


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def _load_r3l_blocked_texts() -> set[str]:
    blocked: set[str] = set()
    if R3L_BEHAVIOR.exists():
        for row in _load_jsonl(R3L_BEHAVIOR):
            blocked.add(_norm(row["input_text"]))
    return blocked


def _load_prior_eval_texts() -> tuple[set[str], list[str]]:
    texts: set[str] = set()
    sources: list[str] = []
    for pattern in PRIOR_EVAL_GLOBS:
        for path in sorted(REPO.glob(pattern)):
            rel = path.relative_to(REPO).as_posix()
            sources.append(rel)
            for row in _load_jsonl(path):
                if "input_text" in row:
                    texts.add(_norm(row["input_text"]))
    return texts, sources


def _case(
    *,
    split: SplitName,
    seq: int,
    population_ids: list[str],
    input_text: str,
    highlighted_span: str,
    expected_behavior: str,
    template_family: str,
    development_only: bool = False,
    pair_id: str | None = None,
    pair_role: str | None = None,
    source_item_id: str | None = None,
    corrective_lane: str | None = None,
    notes: str = "",
) -> dict[str, Any]:
    if expected_behavior not in EXPECTED_BEHAVIORS:
        raise ValueError(f"unsupported_expected_behavior:{expected_behavior}")
    for pid in population_ids:
        if pid not in REQUIRED_POPULATIONS:
            raise ValueError(f"unsupported_population:{pid}")
    prefix = _case_id_prefix(split)
    seed = _seed_for_split(split)
    digest = hashlib.sha256(f"{seed}|{split}|{seq}|{template_family}".encode()).hexdigest()[:8]
    case_id = f"{prefix}-{seq:04d}-{digest}"
    return {
        "schema_version": SCHEMA,
        "case_id": case_id,
        "split": split,
        "population_ids": population_ids,
        "input_text": input_text,
        "highlighted_span": highlighted_span,
        "expected_behavior": expected_behavior,
        "template_family": template_family,
        "prohibited_for_training": True,
        "development_only": development_only,
        "pair_id": pair_id,
        "pair_role": pair_role,
        "source_item_id": source_item_id,
        "corrective_lane": corrective_lane,
        "builder_version": BUILDER_VERSION,
        "seed_family": seed,
        "notes": notes,
        "frozen_v2_unused": True,
        "r3l_inputs_unused_for_synthetics": True,
        "gold_from_runtime": False,
    }


def _load_authorized_code_corrective_cases(seq_start: int) -> tuple[list[dict[str, Any]], int]:
    if not R3M_PRIVATE.exists() or not R3L_BEHAVIOR.exists():
        raise FileNotFoundError("R3M closure or R3L behavior artifacts missing")
    authority = json.loads(R3M_AUTHORITY.read_text(encoding="utf-8"))
    eligible_ids = set(authority.get("eligible_ids") or [])
    behavior_by_id = {row["source_item_id"]: row for row in _load_jsonl(R3L_BEHAVIOR)}
    private_rows = _load_jsonl(R3M_PRIVATE)
    cases: list[dict[str, Any]] = []
    seq = seq_start
    for row in sorted(private_rows, key=lambda r: r["source_item_id"]):
        sid = row["source_item_id"]
        if sid not in eligible_ids:
            continue
        beh = behavior_by_id.get(sid)
        if beh is None:
            raise KeyError(f"missing_behavior_expectation:{sid}")
        seq += 1
        cases.append(
            _case(
                split="DEVELOPMENT",
                seq=seq,
                population_ids=["AUTHORIZED_CODE_CORRECTIVE"],
                input_text=beh["input_text"],
                highlighted_span=beh["highlighted_span"],
                expected_behavior="IDENTITY_TOP1",
                template_family="r3n_dev_authorized_code_corrective",
                development_only=True,
                source_item_id=sid,
                corrective_lane=row.get("corrective_lane"),
                notes="Loaded from R3M_CODE_CORRECTIVE_PRIVATE_CASES joined with BEHAVIOR_EXPECTATIONS",
            )
        )
    if len(cases) != 9:
        raise ValueError(f"expected_9_code_corrective_cases:got_{len(cases)}")
    return cases, seq


def _synthetic_specs() -> list[dict[str, Any]]:
    """Authored synthetic templates — disjoint families for DEV vs HOLDOUT."""
    return [
        # DEVELOPMENT — iterative guard work
        {
            "split": "DEVELOPMENT",
            "population_ids": ["ENGLISH_IDENTITY_REQUIRED"],
            "span": "depreciation",
            "text": "please review the depreciation schedule before closing r3n dev en 0001",
            "expected_behavior": "IDENTITY_TOP1",
            "template_family": "r3n_dev_english_identity",
        },
        {
            "split": "DEVELOPMENT",
            "population_ids": ["ENGLISH_IDENTITY_REQUIRED"],
            "span": "withholding",
            "text": "export the withholding tax summary for audit r3n dev en 0002",
            "expected_behavior": "IDENTITY_TOP1",
            "template_family": "r3n_dev_english_identity",
        },
        {
            "split": "DEVELOPMENT",
            "population_ids": ["ROMANIZED_NEPALI_REQUIRED"],
            "span": "kharcha",
            "text": "aaja kharcha ko bibaran hernu r3n dev rom 0001",
            "expected_behavior": "ROMANIZED_SCRIPT_AT_5",
            "template_family": "r3n_dev_romanized_nepali",
        },
        {
            "split": "DEVELOPMENT",
            "population_ids": ["ROMANIZED_NEPALI_REQUIRED"],
            "span": "bikri",
            "text": "hijo bikri ko total janch garnu r3n dev rom 0002",
            "expected_behavior": "ROMANIZED_SCRIPT_AT_5",
            "template_family": "r3n_dev_romanized_nepali",
        },
        {
            "split": "DEVELOPMENT",
            "population_ids": ["IDENTITY_RETENTION_REQUIRED"],
            "span": "margin",
            "text": "staff asked about margin but no unique spelling r3n dev ret 0001",
            "expected_behavior": "IDENTITY_RETAINED",
            "template_family": "r3n_dev_identity_retention",
        },
        {
            "split": "DEVELOPMENT",
            "population_ids": ["ACRONYM_IDENTITY_REQUIRED"],
            "span": "TDS",
            "text": "verify TDS code in payroll voucher r3n dev acr 0001",
            "expected_behavior": "ACRONYM_IDENTITY_TOP1",
            "template_family": "r3n_dev_acronym",
        },
        {
            "split": "DEVELOPMENT",
            "population_ids": ["IDENTIFIER_PROTECTION_REQUIRED"],
            "span": "INV-2026-8841",
            "text": "match payment against INV-2026-8841 before posting r3n dev id 0001",
            "expected_behavior": "PROTECTED_IDENTITY",
            "template_family": "r3n_dev_identifier",
        },
        {
            "split": "DEVELOPMENT",
            "population_ids": ["PROTECTED_IDENTITY_REQUIRED"],
            "span": "PAN-9988776655",
            "text": "do not transliterate PAN-9988776655 on this form r3n dev prot 0001",
            "expected_behavior": "PROTECTED_IDENTITY",
            "template_family": "r3n_dev_protected",
        },
        {
            "split": "DEVELOPMENT",
            "population_ids": ["SHARED_OR_AMBIGUOUS"],
            "span": "credit",
            "text": "please verify the credit note total r3n dev shared 0001",
            "expected_behavior": "SHARED_CONSERVATIVE",
            "template_family": "r3n_dev_shared_ambiguous",
        },
        {
            "split": "DEVELOPMENT",
            "population_ids": ["CANDIDATE_CAP_PRESSURE"],
            "span": "ledger",
            "text": (
                "please review ledger voucher payment supplier customer discount commission "
                "statement reconcile opening closing export import r3n dev cap 0001"
            ),
            "expected_behavior": "CAP_OK",
            "template_family": "r3n_dev_cap_pressure",
        },
        # HOLDOUT_VALIDATION
        {
            "split": "HOLDOUT_VALIDATION",
            "population_ids": ["ENGLISH_IDENTITY_REQUIRED"],
            "span": "amortization",
            "text": "show amortization entry for the branch ledger r3n hld en 0001",
            "expected_behavior": "IDENTITY_TOP1",
            "template_family": "r3n_hld_english_identity",
        },
        {
            "split": "HOLDOUT_VALIDATION",
            "population_ids": ["ROMANIZED_NEPALI_REQUIRED"],
            "span": "garna",
            "text": "aaja kaam garna sakchhu r3n hld rom 0001",
            "expected_behavior": "ROMANIZED_SCRIPT_AT_5",
            "template_family": "r3n_hld_romanized_nepali",
        },
        {
            "split": "HOLDOUT_VALIDATION",
            "population_ids": ["IDENTITY_RETENTION_REQUIRED"],
            "span": "freight",
            "text": "optional transliteration for freight may vary r3n hld ret 0001",
            "expected_behavior": "IDENTITY_RETAINED",
            "template_family": "r3n_hld_identity_retention",
        },
        {
            "split": "HOLDOUT_VALIDATION",
            "population_ids": ["ACRONYM_IDENTITY_REQUIRED"],
            "span": "CGST",
            "text": "check CGST split on purchase invoice r3n hld acr 0001",
            "expected_behavior": "ACRONYM_IDENTITY_TOP1",
            "template_family": "r3n_hld_acronym",
        },
        {
            "split": "HOLDOUT_VALIDATION",
            "population_ids": ["IDENTIFIER_PROTECTION_REQUIRED"],
            "span": "SKU-44102",
            "text": "stock count for SKU-44102 before dispatch r3n hld id 0001",
            "expected_behavior": "PROTECTED_IDENTITY",
            "template_family": "r3n_hld_identifier",
        },
        {
            "split": "HOLDOUT_VALIDATION",
            "population_ids": ["PROTECTED_IDENTITY_REQUIRED"],
            "span": "VAT-0099123",
            "text": "keep VAT-0099123 unchanged on tax return r3n hld prot 0001",
            "expected_behavior": "PROTECTED_IDENTITY",
            "template_family": "r3n_hld_protected",
        },
        {
            "split": "HOLDOUT_VALIDATION",
            "population_ids": ["SHARED_OR_AMBIGUOUS"],
            "span": "bill",
            "text": "please confirm the bill amount today r3n hld shared 0001",
            "expected_behavior": "SHARED_CONSERVATIVE",
            "template_family": "r3n_hld_shared_ambiguous",
        },
        # SAFETY_CHALLENGE — mutation / protected probes
        {
            "split": "SAFETY_CHALLENGE",
            "population_ids": ["PROTECTED_IDENTITY_REQUIRED"],
            "span": "REF-2026-A91",
            "text": "protected reference REF-2026-A91 must stay intact r3n saf prot 0001",
            "expected_behavior": "NO_RAW_MUTATION",
            "template_family": "r3n_hld_safety_protected",
        },
        {
            "split": "SAFETY_CHALLENGE",
            "population_ids": ["ENGLISH_IDENTITY_REQUIRED"],
            "span": "invoice",
            "text": "please print the invoice copy for supplier r3n saf en 0001",
            "expected_behavior": "IDENTITY_TOP1",
            "template_family": "r3n_hld_safety_english",
        },
        {
            "split": "SAFETY_CHALLENGE",
            "population_ids": ["IDENTIFIER_PROTECTION_REQUIRED"],
            "span": "ORD/8844/X",
            "text": "track shipment ORD/8844/X without rewriting r3n saf id 0001",
            "expected_behavior": "PROTECTED_IDENTITY",
            "template_family": "r3n_hld_safety_identifier",
        },
        {
            "split": "SAFETY_CHALLENGE",
            "population_ids": ["ACRONYM_IDENTITY_REQUIRED"],
            "span": "HSN",
            "text": "validate HSN column on gst worksheet r3n saf acr 0001",
            "expected_behavior": "ACRONYM_IDENTITY_TOP1",
            "template_family": "r3n_hld_safety_acronym",
        },
        # OOV_CHALLENGE
        {
            "split": "OOV_CHALLENGE",
            "population_ids": ["OOV"],
            "span": "plirex",
            "text": "customer asked about plirex balance today r3n oov 0001",
            "expected_behavior": "IDENTITY_TOP1",
            "template_family": "r3n_hld_oov_generalization",
        },
        {
            "split": "OOV_CHALLENGE",
            "population_ids": ["OOV"],
            "span": "gronex",
            "text": "aaja gronex ko record hernu r3n oov 0002",
            "expected_behavior": "ROMANIZED_SCRIPT_AT_5",
            "template_family": "r3n_hld_oov_generalization",
        },
        {
            "split": "OOV_CHALLENGE",
            "population_ids": ["OOV"],
            "span": "tavmor",
            "text": "please verify tavmor export status r3n oov 0003",
            "expected_behavior": "IDENTITY_RETAINED",
            "template_family": "r3n_hld_oov_generalization",
        },
        # MONOTONIC_REGRESSION
        {
            "split": "MONOTONIC_REGRESSION",
            "population_ids": ["MONOTONIC_PARENT_CORRECT"],
            "span": "payment",
            "text": "monotonic parent english check for payment r3n mon ok 0001",
            "expected_behavior": "IDENTITY_TOP1",
            "template_family": "r3n_hld_monotonic_correct",
        },
        {
            "split": "MONOTONIC_REGRESSION",
            "population_ids": ["MONOTONIC_PARENT_CORRECT"],
            "span": "aamdani",
            "text": "aaja aamdani ko monotonic parent check r3n mon ok 0002",
            "expected_behavior": "ROMANIZED_SCRIPT_AT_5",
            "template_family": "r3n_hld_monotonic_correct",
        },
        {
            "split": "MONOTONIC_REGRESSION",
            "population_ids": ["MONOTONIC_PARENT_INCORRECT"],
            "span": "ledger",
            "text": "branch ledger: ledger entry ra aaja baaki milaaune r3n mon bad 0001",
            "expected_behavior": "IDENTITY_TOP1",
            "template_family": "r3n_hld_monotonic_incorrect",
            "notes": "Parent English-context failure class; R3N corrective must retain identity top-1",
        },
        {
            "split": "MONOTONIC_REGRESSION",
            "population_ids": ["MONOTONIC_PARENT_INCORRECT"],
            "span": "VAT",
            "text": "branch ledger: VAT entry ra aamdani baaki milaaune r3n mon bad 0002",
            "expected_behavior": "ACRONYM_IDENTITY_TOP1",
            "template_family": "r3n_hld_monotonic_incorrect",
            "notes": "Parent acronym-context failure class; R3N corrective must retain acronym identity",
        },
    ]


def _counterfactual_pairs(used: set[str], blocked: set[str]) -> list[dict[str, Any]]:
    res = load_resources(force_reload=True)
    shared = sorted(
        tok
        for tok in set(res.english_identity) & (set(res.lexicon) | set(res.domain_terms))
        if tok.isalpha() and len(tok) >= 4 and tok not in {"bill", "invoice", "credit"}
    )[:6]
    cases: list[dict[str, Any]] = []
    seq = 0
    for i, tok in enumerate(shared):
        pair_id = f"r3n_cfx_pair_{i:03d}"
        english_text = f"please verify the {tok} total in english report r3n cfx en {i:04d}"
        nepali_text = f"aaja {tok} ko hisab hernu r3n cfx np {i:04d}"
        if _norm(english_text) in used or _norm(nepali_text) in used:
            continue
        if _norm(english_text) in blocked or _norm(nepali_text) in blocked:
            continue
        seq += 1
        cases.append(
            _case(
                split="CONTEXT_COUNTERFACTUAL",
                seq=seq,
                population_ids=["CONTEXT_COUNTERFACTUAL", "ENGLISH_IDENTITY_REQUIRED"],
                input_text=english_text,
                highlighted_span=tok,
                expected_behavior="IDENTITY_TOP1",
                template_family="r3n_hld_counterfactual_english",
                pair_id=pair_id,
                pair_role="english_context",
            )
        )
        seq += 1
        cases.append(
            _case(
                split="CONTEXT_COUNTERFACTUAL",
                seq=seq,
                population_ids=["CONTEXT_COUNTERFACTUAL", "ROMANIZED_NEPALI_REQUIRED"],
                input_text=nepali_text,
                highlighted_span=tok,
                expected_behavior="ROMANIZED_SCRIPT_AT_5",
                template_family="r3n_hld_counterfactual_nepali",
                pair_id=pair_id,
                pair_role="nepali_context",
            )
        )
    if not cases:
        raise RuntimeError("counterfactual_pair_generation_failed")
    return cases


def build_cases() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    r3l_blocked = _load_r3l_blocked_texts()
    prior_texts, prior_sources = _load_prior_eval_texts()
    blocked = set(r3l_blocked) | set(prior_texts)
    used: set[str] = set()
    cases: list[dict[str, Any]] = []
    seq_by_split: dict[SplitName, int] = {split: 0 for split in SPLIT_FILES}

    def add(case: dict[str, Any], *, allow_prior_corpus: bool = False) -> None:
        normalized = _norm(case["input_text"])
        if normalized in used:
            raise ValueError(f"duplicate_case_text:{case['case_id']}:{normalized[:48]}")
        if not allow_prior_corpus and normalized in blocked:
            raise ValueError(f"overlap_blocked:{case['case_id']}:{normalized[:48]}")
        used.add(normalized)
        cases.append(case)

    corrective, seq_after = _load_authorized_code_corrective_cases(seq_by_split["DEVELOPMENT"])
    for c in corrective:
        add(c, allow_prior_corpus=True)
    seq_by_split["DEVELOPMENT"] = seq_after

    for spec in _synthetic_specs():
        split: SplitName = spec["split"]
        seq_by_split[split] += 1
        add(
            _case(
                split=split,
                seq=seq_by_split[split],
                population_ids=list(spec["population_ids"]),
                input_text=spec["text"],
                highlighted_span=spec["span"],
                expected_behavior=spec["expected_behavior"],
                template_family=spec["template_family"],
                development_only=split == "DEVELOPMENT",
                notes=spec.get("notes", ""),
            )
        )

    for cfx in _counterfactual_pairs(used, blocked):
        add(cfx)

    # Extra holdout cap-pressure case
    seq_by_split["HOLDOUT_VALIDATION"] += 1
    add(
        _case(
            split="HOLDOUT_VALIDATION",
            seq=seq_by_split["HOLDOUT_VALIDATION"],
            population_ids=["CANDIDATE_CAP_PRESSURE"],
            input_text=(
                "review voucher ledger payment supplier customer discount commission statement "
                "reconcile opening closing export import status r3n hld cap 0001"
            ),
            highlighted_span="ledger",
            expected_behavior="CAP_OK",
            template_family="r3n_hld_cap_pressure",
        )
    )

    populations_seen: set[str] = set()
    for c in cases:
        populations_seen.update(c["population_ids"])
    missing = REQUIRED_POPULATIONS - populations_seen
    if missing:
        raise ValueError(f"missing_populations:{sorted(missing)}")

    meta = {
        "r3l_texts_blocked": len(r3l_blocked),
        "prior_eval_texts_blocked": len(prior_texts),
        "prior_eval_sources": prior_sources,
        "authorized_code_corrective_count": len(corrective),
        "counterfactual_pair_count": len({c["pair_id"] for c in cases if c.get("pair_id")}),
    }
    return cases, meta


def _population_counts(cases: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {p: 0 for p in sorted(REQUIRED_POPULATIONS)}
    for case in cases:
        for pid in case["population_ids"]:
            counts[pid] = counts.get(pid, 0) + 1
    return counts


def _split_integrity(cases: list[dict[str, Any]]) -> dict[str, Any]:
    dev = [c for c in cases if c["split"] == "DEVELOPMENT"]
    holdout_splits = {"HOLDOUT_VALIDATION", "SAFETY_CHALLENGE", "CONTEXT_COUNTERFACTUAL", "OOV_CHALLENGE", "MONOTONIC_REGRESSION"}
    hld = [c for c in cases if c["split"] in holdout_splits]

    dev_ids = {c["case_id"] for c in dev}
    hld_ids = {c["case_id"] for c in hld}
    dev_texts = {_norm(c["input_text"]) for c in dev}
    hld_texts = {_norm(c["input_text"]) for c in hld}
    dev_families = {c["template_family"] for c in dev}
    hld_families = {c["template_family"] for c in hld}

    id_overlap = sorted(dev_ids & hld_ids)
    text_overlap = sorted(dev_texts & hld_texts)
    family_overlap = sorted(dev_families & hld_families)

    return {
        "schema_version": "mai07_r3n_split_integrity_v1",
        "development_case_count": len(dev),
        "holdout_family_case_count": len(hld),
        "case_id_intersection_empty": len(id_overlap) == 0,
        "case_id_intersection": id_overlap,
        "input_text_intersection_empty": len(text_overlap) == 0,
        "input_text_intersection_count": len(text_overlap),
        "template_family_disjoint_dev_holdout": len(family_overlap) == 0,
        "template_family_intersection": family_overlap,
        "seeds": {
            "DEVELOPMENT": SEED_DEVELOPMENT,
            "HOLDOUT_FAMILY": SEED_HOLDOUT_FAMILY,
        },
        "proof_passed": len(id_overlap) == 0 and len(text_overlap) == 0 and len(family_overlap) == 0,
    }


def write_datasets(*, output_dir: Path | None = None, authorize: bool = False) -> dict[str, Any]:
    dest = Path(output_dir) if output_dir is not None else OUT
    if dest.resolve() == OUT.resolve():
        if not authorize or os.environ.get(AUTHORIZE_ENV) != "1":
            raise PermissionError(
                f"Refusing canonical write to {OUT}. Set {AUTHORIZE_ENV}=1 and pass authorize=True."
            )
    dest.mkdir(parents=True, exist_ok=True)

    cases, build_meta = build_cases()
    cases = sorted(cases, key=lambda c: (c["split"], c["case_id"]))
    split_rows: dict[SplitName, list[dict[str, Any]]] = {split: [] for split in SPLIT_FILES}
    for case in cases:
        split_rows[case["split"]].append(case)

    split_hashes: dict[str, Any] = {}
    for split, filename in SPLIT_FILES.items():
        rows = split_rows[split]
        body = "\n".join(json.dumps(r, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for r in rows)
        if rows:
            body += "\n"
        path = dest / filename
        path.write_text(body, encoding="utf-8", newline="\n")
        split_hashes[split] = {
            "path": str(path.resolve()),
            "filename": filename,
            "case_count": len(rows),
            "sha256": _sha(body.encode("utf-8")),
            "seed": _seed_for_split(split),
        }

    population_counts = _population_counts(cases)
    integrity = _split_integrity(cases)
    if not integrity["proof_passed"]:
        raise ValueError(f"split_integrity_failed:{integrity}")

    manifest = {
        "schema_version": "mai07_r3n_manifest_v1",
        "manifest_id": "MANIFEST",
        "builder_version": BUILDER_VERSION,
        "candidate_policy_version": "mai-07-r3n.1.0.0",
        "parent_runtime_version": "mai-07.1.3-r3f-sealnew",
        "candidate_runtime_version": "mai-07.1.6-r3n-policyconf",
        "seeds": {
            "DEVELOPMENT": SEED_DEVELOPMENT,
            "HOLDOUT_FAMILY": SEED_HOLDOUT_FAMILY,
        },
        "splits": split_hashes,
        "totals": {split: split_hashes[split]["case_count"] for split in SPLIT_FILES},
        "population_counts": population_counts,
        "total_cases": len(cases),
        "prohibited_for_training": True,
        "frozen_v2_unused": True,
        "r3l_synthetic_overlap_blocked": True,
        **build_meta,
    }
    manifest_body = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    (dest / "MANIFEST.json").write_text(manifest_body, encoding="utf-8", newline="\n")

    leakage = {
        "schema_version": "mai07_r3n_leakage_integrity_v1",
        "report_id": "LEAKAGE_AND_SPLIT_INTEGRITY",
        "builder_version": BUILDER_VERSION,
        **build_meta,
        "split_integrity": integrity,
        "population_counts": population_counts,
        "populations_with_nonempty_denominators": all(v > 0 for v in population_counts.values()),
    }
    leakage_body = json.dumps(leakage, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    (dest / "LEAKAGE_AND_SPLIT_INTEGRITY.json").write_text(leakage_body, encoding="utf-8", newline="\n")

    return {
        "output_dir": str(dest.resolve()),
        "manifest_sha256": _sha(manifest_body.encode("utf-8")),
        "leakage_sha256": _sha(leakage_body.encode("utf-8")),
        "totals": manifest["totals"],
        "population_counts": population_counts,
        "split_integrity_passed": integrity["proof_passed"],
        "total_cases": len(cases),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="MAI-07R3N policy-conformance dataset builder")
    parser.add_argument(
        "--write",
        action="store_true",
        help=f"Write canonical datasets to {OUT} (requires {AUTHORIZE_ENV}=1)",
    )
    parser.add_argument("--output", default="", help="Optional alternate output directory")
    args = parser.parse_args()

    if not args.write:
        cases, meta = build_cases()
        integrity = _split_integrity(cases)
        summary = {
            "dry_run": True,
            "total_cases": len(cases),
            "totals_by_split": {
                split: sum(1 for c in cases if c["split"] == split) for split in SPLIT_FILES
            },
            "population_counts": _population_counts(cases),
            "split_integrity_passed": integrity["proof_passed"],
            **meta,
        }
        print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
        return 0

    out = Path(args.output) if args.output else OUT
    authorize = out.resolve() == OUT.resolve()
    result = write_datasets(output_dir=out, authorize=authorize)
    # Never print private case texts — counts and paths only.
    safe = {
        "ok": True,
        "output_dir": result["output_dir"],
        "total_cases": result["total_cases"],
        "totals": result["totals"],
        "population_counts": result["population_counts"],
        "split_integrity_passed": result["split_integrity_passed"],
        "manifest_sha256": result["manifest_sha256"],
        "files": {
            split: str((out / SPLIT_FILES[split]).resolve()) for split in SPLIT_FILES
        },
        "manifest_path": str((out / "MANIFEST.json").resolve()),
        "leakage_path": str((out / "LEAKAGE_AND_SPLIT_INTEGRITY.json").resolve()),
    }
    print(json.dumps(safe, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
