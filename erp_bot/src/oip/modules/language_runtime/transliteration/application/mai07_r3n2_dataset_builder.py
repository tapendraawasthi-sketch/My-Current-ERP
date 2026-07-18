"""MAI-07R3N2 fresh-holdout evaluation dataset builder.

Firewall:
- Blocks all R3N holdout lineage (case IDs, normalized texts, template families).
- Reconstructs Attempt-001 holdout romanized surface for overlap rejection.
- R3M corrective texts allowed in DEVELOPMENT only; blocked from holdout splits.
- R3L BEHAVIOR_EXPECTATIONS inputs blocked from all synthetics.
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
from .mai07_r3n_integrity_closure import reconstruct_attempt001_holdout
from .r3n2_scoring_contracts import (
    MINIMUM_DENOMINATORS,
    REQUIRED_POPULATIONS,
    SPLIT_SIZE_MINIMA,
    check_population_minima,
)

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3n2_fresh_holdout"
R3N_OUT = REPO / "evals" / "mai07_r3n_policy_conformance"
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

SEED_DEVELOPMENT = 20260720
SEED_HOLDOUT = 20260721
BUILDER_VERSION = "mai-07-r3n2-dataset.1.0.0"
SCHEMA = "mai07_r3n2_fresh_holdout_case_v1"
AUTHORIZE_ENV = "MAI07_AUTHORIZE_EVAL_WRITE"

EXPECTED_R3M_LANE_DISTRIBUTION = {
    "ENGLISH_IDENTITY_GUARD": 5,
    "IDENTITY_CANDIDATE_INVARIANT": 3,
    "ACRONYM_OR_IDENTIFIER_PROTECTION": 1,
}

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

HOLDOUT_SPLITS = frozenset(
    {
        "HOLDOUT_VALIDATION",
        "SAFETY_CHALLENGE",
        "CONTEXT_COUNTERFACTUAL",
        "OOV_CHALLENGE",
        "MONOTONIC_REGRESSION",
    }
)

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

REQUIRED_POPULATIONS_SET = frozenset(REQUIRED_POPULATIONS)

ENGLISH_TERMS = (
    "invoice",
    "payment",
    "ledger",
    "customer",
    "balance",
    "supplier",
    "voucher",
    "discount",
    "depreciation",
    "withholding",
    "amortization",
    "commission",
    "reconcile",
    "statement",
    "opening",
    "closing",
    "freight",
    "margin",
    "credit",
    "debit",
)

ROMANIZED_TERMS = (
    "pathau",
    "hernu",
    "aamdani",
    "bakaya",
    "bikri",
    "kharcha",
    "thulo",
    "sabai",
    "aaja",
    "baaki",
    "bhayo",
    "bholi",
    "bechyo",
    "bolnu",
    "bujhe",
    "aaunu",
    "aayo",
    "basnu",
    "bata",
    "bhada",
    "bhatta",
    "bijuli",
    "garera",
    "mero",
)

ROMANIZED_PARTICLES = ("aaja", "hijo", "mero", "lai", "bata", "ko", "ra")

ACRONYMS = ("VAT", "PAN", "ERP", "SKU", "FIFO", "GST", "TDS", "CGST", "HSN", "SGST")

COUNTERFACTUAL_WORDS = ("balance", "bank", "bill", "credit", "ledger", "payment")

WEAK_ROMANIZED_BLOCKLIST = frozenset({"sulka"})

UID_RE = re.compile(r"r3n2uid\d+", re.IGNORECASE)
DIGIT_RE = re.compile(r"\d+")


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def _skeleton(text: str) -> str:
    s = UID_RE.sub("UID", text.lower())
    s = DIGIT_RE.sub("", s)
    return " ".join(s.split())


def _seed_for_split(split: SplitName) -> int:
    return SEED_DEVELOPMENT if split == "DEVELOPMENT" else SEED_HOLDOUT


def _case_id_prefix(split: SplitName) -> str:
    return {
        "DEVELOPMENT": "R3N2-DEV",
        "HOLDOUT_VALIDATION": "R3N2-HLD",
        "SAFETY_CHALLENGE": "R3N2-SAF",
        "CONTEXT_COUNTERFACTUAL": "R3N2-CFX",
        "OOV_CHALLENGE": "R3N2-OOV",
        "MONOTONIC_REGRESSION": "R3N2-MON",
    }[split]


def _template_prefix(split: SplitName) -> str:
    return "r3n2_dev" if split == "DEVELOPMENT" else "r3n2_hld"


def _pick(seed: int, split: str, seq: int, family: str, choices: tuple[str, ...]) -> str:
    digest = hashlib.sha256(f"{seed}|{split}|{seq}|{family}".encode()).hexdigest()
    return choices[int(digest[:8], 16) % len(choices)]


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def _verify_r3m_lane_distribution() -> dict[str, int]:
    if not R3M_AUTHORITY.exists():
        raise FileNotFoundError(f"missing_r3m_authority:{R3M_AUTHORITY}")
    authority = json.loads(R3M_AUTHORITY.read_text(encoding="utf-8"))
    lane = authority.get("lane_distribution") or {}
    for key, expected in EXPECTED_R3M_LANE_DISTRIBUTION.items():
        if int(lane.get(key, 0)) != expected:
            raise ValueError(
                f"BLOCKED_PRECONDITION_FAILED:lane_distribution:{key}:"
                f"expected_{expected}:got_{lane.get(key, 0)}"
            )
    return {k: int(lane[k]) for k in EXPECTED_R3M_LANE_DISTRIBUTION}


def _load_r3l_blocked_texts() -> set[str]:
    blocked: set[str] = set()
    for row in _load_jsonl(R3L_BEHAVIOR):
        blocked.add(_norm(row["input_text"]))
    return blocked


def _load_r3m_corrective_texts() -> tuple[set[str], list[str]]:
    """Return normalized corrective input texts and their source_item_ids."""
    _verify_r3m_lane_distribution()
    if not R3M_PRIVATE.exists() or not R3L_BEHAVIOR.exists():
        raise FileNotFoundError("R3M closure or R3L behavior artifacts missing")
    authority = json.loads(R3M_AUTHORITY.read_text(encoding="utf-8"))
    eligible_ids = set(authority.get("eligible_ids") or [])
    behavior_by_id = {row["source_item_id"]: row for row in _load_jsonl(R3L_BEHAVIOR)}
    texts: set[str] = set()
    source_ids: list[str] = []
    for row in sorted(_load_jsonl(R3M_PRIVATE), key=lambda r: r["source_item_id"]):
        sid = row["source_item_id"]
        if sid not in eligible_ids:
            continue
        beh = behavior_by_id.get(sid)
        if beh is None:
            raise KeyError(f"missing_behavior_expectation:{sid}")
        texts.add(_norm(beh["input_text"]))
        source_ids.append(sid)
    if len(source_ids) != 9:
        raise ValueError(f"expected_9_code_corrective_cases:got_{len(source_ids)}")
    return texts, source_ids


def _load_r3n_blocked_sets() -> dict[str, Any]:
    """Load all R3N policy-conformance cases for overlap rejection."""
    all_rows: list[dict[str, Any]] = []
    sources: list[str] = []
    for path in sorted(R3N_OUT.glob("*.jsonl")):
        rel = path.relative_to(REPO).as_posix()
        sources.append(rel)
        all_rows.extend(_load_jsonl(path))

    case_ids: set[str] = set()
    texts: set[str] = set()
    families: set[str] = set()
    skeletons: set[str] = set()
    for row in all_rows:
        if "case_id" in row:
            case_ids.add(row["case_id"])
        if "input_text" in row:
            texts.add(_norm(row["input_text"]))
            skeletons.add(_skeleton(row["input_text"]))
        if row.get("template_family"):
            families.add(row["template_family"])

    holdout_path = R3N_OUT / "holdout_validation.jsonl"
    attempt001_rows: list[dict[str, Any]] = []
    if holdout_path.exists():
        current_holdout = _load_jsonl(holdout_path)
        attempt001_rows = reconstruct_attempt001_holdout(current_holdout)
        for row in attempt001_rows:
            texts.add(_norm(row["input_text"]))
            skeletons.add(_skeleton(row["input_text"]))

    return {
        "case_ids": case_ids,
        "normalized_texts": texts,
        "template_families": families,
        "skeletons": skeletons,
        "sources": sources,
        "attempt001_reconstructed_count": len(attempt001_rows),
    }


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
        if pid not in REQUIRED_POPULATIONS_SET:
            raise ValueError(f"unsupported_population:{pid}")
    prefix = _template_prefix(split)
    if not (template_family.startswith(f"{prefix}_") or template_family.startswith("r3n2_dev_") or template_family.startswith("r3n2_hld_")):
        raise ValueError(f"invalid_template_family:{template_family}")
    if template_family.startswith("r3n_dev_") or template_family.startswith("r3n_hld_"):
        raise ValueError(f"forbidden_r3n_template_family:{template_family}")

    seed = _seed_for_split(split)
    digest = hashlib.sha256(f"{seed}|{split}|{seq}|{template_family}".encode()).hexdigest()[:8]
    case_id = f"{_case_id_prefix(split)}-{seq:04d}-{digest}"
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


class _CaseBuilder:
    """Stateful builder with overlap/firewall enforcement."""

    def __init__(self, blocked: dict[str, Any]) -> None:
        self.blocked = blocked
        self.r3l_blocked = blocked["r3l_texts"]
        self.r3m_texts = blocked["r3m_corrective_texts"]
        self.used_texts: set[str] = set()
        self.used_skeletons: set[str] = set()
        self.seq_by_split: dict[SplitName, int] = {split: 0 for split in SPLIT_FILES}
        self.uid_seq = 0
        self.corrective_case_ids: list[str] = []
        self.cases: list[dict[str, Any]] = []

    def _next_uid(self) -> int:
        self.uid_seq += 1
        return self.uid_seq

    def _assert_fresh(
        self,
        case: dict[str, Any],
        *,
        allow_r3m_in_dev: bool = False,
    ) -> None:
        split = case["split"]
        normalized = _norm(case["input_text"])
        skeleton = _skeleton(case["input_text"])
        cid = case["case_id"]
        family = case["template_family"]

        if normalized in self.used_texts:
            raise ValueError(f"duplicate_case_text:{cid}")
        # Intra-dataset uniqueness is by exact normalized text (uid markers).
        # Skeleton near-dup check is against historical R3N only (below).
        if cid in self.blocked["r3n"]["case_ids"]:
            raise ValueError(f"r3n_case_id_overlap:{cid}")
        # Nine R3M corrective texts may reappear in R3N2 DEVELOPMENT only (new case IDs).
        # R3N holdout texts/families/skeletons remain blocked everywhere.
        skip_r3n_text = allow_r3m_in_dev and split == "DEVELOPMENT"
        if not skip_r3n_text and normalized in self.blocked["r3n"]["normalized_texts"]:
            raise ValueError(f"r3n_text_overlap:{cid}")
        if family in self.blocked["r3n"]["template_families"]:
            raise ValueError(f"r3n_family_overlap:{family}")
        if not skip_r3n_text and skeleton in self.blocked["r3n"]["skeletons"]:
            raise ValueError(f"r3n_near_duplicate_skeleton:{cid}")
        # R3L behavior texts of the nine corrective cases are allowed in DEVELOPMENT only.
        if normalized in self.r3l_blocked and not skip_r3n_text:
            raise ValueError(f"r3l_text_overlap:{cid}")

        is_holdout = split in HOLDOUT_SPLITS
        if is_holdout and normalized in self.r3m_texts:
            raise ValueError(f"r3m_text_in_holdout:{cid}")
        if not allow_r3m_in_dev and is_holdout:
            for word in case["input_text"].lower().split():
                if word in WEAK_ROMANIZED_BLOCKLIST:
                    raise ValueError(f"weak_romanized_in_holdout:{cid}:{word}")

        self.used_texts.add(normalized)
        self.used_skeletons.add(skeleton)

    def add(
        self,
        *,
        split: SplitName,
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
        allow_r3m_in_dev: bool = False,
    ) -> dict[str, Any]:
        self.seq_by_split[split] += 1
        case = _case(
            split=split,
            seq=self.seq_by_split[split],
            population_ids=population_ids,
            input_text=input_text,
            highlighted_span=highlighted_span,
            expected_behavior=expected_behavior,
            template_family=template_family,
            development_only=development_only or split == "DEVELOPMENT",
            pair_id=pair_id,
            pair_role=pair_role,
            source_item_id=source_item_id,
            corrective_lane=corrective_lane,
            notes=notes,
        )
        self._assert_fresh(case, allow_r3m_in_dev=allow_r3m_in_dev)
        self.cases.append(case)
        return case

    def add_with_uid(
        self,
        *,
        split: SplitName,
        population_ids: list[str],
        text_template: str,
        highlighted_span: str,
        expected_behavior: str,
        family_suffix: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        uid = self._next_uid()
        text = text_template.format(uid=f"r3n2uid{uid:05d}", seq=uid)
        family = f"{_template_prefix(split)}_{family_suffix}"
        return self.add(
            split=split,
            population_ids=population_ids,
            input_text=text,
            highlighted_span=highlighted_span,
            expected_behavior=expected_behavior,
            template_family=family,
            **kwargs,
        )


def _load_authorized_code_corrective_cases(builder: _CaseBuilder) -> None:
    _verify_r3m_lane_distribution()
    if not R3M_PRIVATE.exists() or not R3L_BEHAVIOR.exists():
        raise FileNotFoundError("R3M closure or R3L behavior artifacts missing")
    authority = json.loads(R3M_AUTHORITY.read_text(encoding="utf-8"))
    eligible_ids = set(authority.get("eligible_ids") or [])
    behavior_by_id = {row["source_item_id"]: row for row in _load_jsonl(R3L_BEHAVIOR)}
    loaded = 0
    for row in sorted(_load_jsonl(R3M_PRIVATE), key=lambda r: r["source_item_id"]):
        sid = row["source_item_id"]
        if sid not in eligible_ids:
            continue
        beh = behavior_by_id.get(sid)
        if beh is None:
            raise KeyError(f"missing_behavior_expectation:{sid}")
        case = builder.add(
            split="DEVELOPMENT",
            population_ids=["AUTHORIZED_CODE_CORRECTIVE"],
            input_text=beh["input_text"],
            highlighted_span=beh["highlighted_span"],
            expected_behavior="IDENTITY_TOP1",
            template_family="r3n2_dev_authorized_code_corrective",
            development_only=True,
            source_item_id=sid,
            corrective_lane=row.get("corrective_lane"),
            notes="Loaded from R3M_CODE_CORRECTIVE_PRIVATE_CASES joined with BEHAVIOR_EXPECTATIONS",
            allow_r3m_in_dev=True,
        )
        builder.corrective_case_ids.append(case["case_id"])
        loaded += 1
    if loaded != 9:
        raise ValueError(f"expected_9_code_corrective_cases:got_{loaded}")


def _generate_development_synthetics(builder: _CaseBuilder, target: int) -> None:
    """Fill DEVELOPMENT to ``target`` cases after corrective load."""
    split: SplitName = "DEVELOPMENT"
    seed = _seed_for_split(split)
    seq_base = builder.seq_by_split[split]
    dev_specs: list[tuple[list[str], str, str, str, str]] = [
        (["ENGLISH_IDENTITY_REQUIRED"], "english_identity", "IDENTITY_TOP1", "{term}", "please review the {term} report for {uid} today"),
        (["ROMANIZED_NEPALI_REQUIRED"], "romanized_nepali", "ROMANIZED_SCRIPT_AT_5", "{term}", "aaja {term} ko record hernu {uid}"),
        (["IDENTITY_RETENTION_REQUIRED"], "identity_retention", "IDENTITY_RETAINED", "{term}", "staff asked about {term} context {uid}"),
        (["ACRONYM_IDENTITY_REQUIRED"], "acronym", "ACRONYM_IDENTITY_TOP1", "{acr}", "please confirm {acr} code {uid}"),
        (["IDENTIFIER_PROTECTION_REQUIRED"], "identifier", "PROTECTED_IDENTITY", "SKU-{sku}", "lookup order SKU-{sku} in ledger {uid}"),
        (["PROTECTED_IDENTITY_REQUIRED"], "protected", "PROTECTED_IDENTITY", "PAN-{pan}", "verify PAN PAN-{pan} on invoice {uid}"),
        (["SHARED_OR_AMBIGUOUS"], "shared_ambiguous", "SHARED_CONSERVATIVE", "balance", "check balance {uid} in daily report"),
        (
            ["CANDIDATE_CAP_PRESSURE"],
            "cap_pressure",
            "CAP_OK",
            "ledger",
            "please review ledger voucher payment supplier customer discount commission statement reconcile opening closing export import {uid}",
        ),
        (["ENGLISH_GUARD_ANALOGUE"], "english_guard_analogue", "IDENTITY_TOP1", "{term}", "export the {term} summary before audit {uid}"),
        (["IDENTITY_INVARIANT_ANALOGUE"], "identity_invariant_analogue", "IDENTITY_RETAINED", "{term}", "optional transliteration for {term} may vary {uid}"),
        (["ACRONYM_IDENTIFIER_ANALOGUE"], "acronym_identifier_analogue", "ACRONYM_IDENTITY_TOP1", "{acr}", "validate {acr} column on gst worksheet {uid}"),
        (["MONOTONIC_PARENT_INCORRECT"], "monotonic_incorrect", "IDENTITY_TOP1", "ledger", "branch ledger: ledger entry ra aaja baaki milaaune {uid}"),
    ]
    idx = 0
    while len([c for c in builder.cases if c["split"] == split]) < target:
        spec = dev_specs[idx % len(dev_specs)]
        populations, suffix, behavior, span_tpl, text_tpl = spec
        seq = seq_base + idx + 1
        uid = builder._next_uid()
        if "ROMANIZED_NEPALI_REQUIRED" in populations:
            term = _pick(seed, split, seq, suffix, ROMANIZED_TERMS)
        else:
            term = _pick(seed, split, seq, suffix, ENGLISH_TERMS)
        acr = _pick(seed, split, seq, suffix + "_acr", ACRONYMS)
        sku = 44000 + uid
        pan = 9900000000 + uid
        span = span_tpl.format(term=term, acr=acr, sku=sku, pan=pan)
        text = text_tpl.format(term=term, acr=acr, sku=sku, pan=pan, uid=f"r3n2uid{uid:05d}")
        if any(w in text.lower().split() for w in WEAK_ROMANIZED_BLOCKLIST):
            idx += 1
            continue
        builder.add(
            split=split,
            population_ids=list(populations),
            input_text=text,
            highlighted_span=span if span in text else term,
            expected_behavior=behavior,
            template_family=f"r3n2_dev_{suffix}",
        )
        idx += 1


def _generate_holdout_validation(builder: _CaseBuilder, target: int) -> None:
    split: SplitName = "HOLDOUT_VALIDATION"
    seed = _seed_for_split(split)

    # 200 English identity; first 100 also ENGLISH_GUARD_ANALOGUE
    for i in range(200):
        uid = builder._next_uid()
        term = ENGLISH_TERMS[i % len(ENGLISH_TERMS)]
        pops = ["ENGLISH_IDENTITY_REQUIRED"]
        if i < 100:
            pops.append("ENGLISH_GUARD_ANALOGUE")
        text = f"please review the {term} report for r3n2uid{uid:05d} today"
        builder.add(
            split=split,
            population_ids=pops,
            input_text=text,
            highlighted_span=term,
            expected_behavior="IDENTITY_TOP1",
            template_family="r3n2_hld_english_identity",
        )

    # 200 Romanized — strong lexicon, no sulka
    res = load_resources(force_reload=False)
    lex_keys = sorted(k for k in res.lexicon if k.isalpha() and len(k) >= 4 and k not in WEAK_ROMANIZED_BLOCKLIST)
    for i in range(200):
        uid = builder._next_uid()
        term = ROMANIZED_TERMS[i % len(ROMANIZED_TERMS)]
        if i < len(lex_keys):
            term = lex_keys[i % len(lex_keys)]
        particle = ROMANIZED_PARTICLES[i % len(ROMANIZED_PARTICLES)]
        text = f"{particle} {term} ko record hernu r3n2uid{uid:05d}"
        builder.add(
            split=split,
            population_ids=["ROMANIZED_NEPALI_REQUIRED"],
            input_text=text,
            highlighted_span=term,
            expected_behavior="ROMANIZED_SCRIPT_AT_5",
            template_family="r3n2_hld_romanized_nepali",
        )

    # 100 triple-tag retention + invariant + cap
    for i in range(100):
        uid = builder._next_uid()
        term = _pick(seed, split, i, "retention_triple", ENGLISH_TERMS)
        text = (
            f"please review ledger voucher payment supplier customer discount commission "
            f"statement reconcile opening closing export import for {term} r3n2uid{uid:05d}"
        )
        builder.add(
            split=split,
            population_ids=[
                "IDENTITY_RETENTION_REQUIRED",
                "IDENTITY_INVARIANT_ANALOGUE",
                "CANDIDATE_CAP_PRESSURE",
            ],
            input_text=text,
            highlighted_span=term,
            expected_behavior="CAP_OK",
            template_family="r3n2_hld_cap_pressure",
        )

    # 50 retention-only
    for i in range(50):
        uid = builder._next_uid()
        term = _pick(seed, split, i + 100, "retention_only", ENGLISH_TERMS)
        text = f"optional transliteration for {term} may vary r3n2uid{uid:05d}"
        builder.add(
            split=split,
            population_ids=["IDENTITY_RETENTION_REQUIRED"],
            input_text=text,
            highlighted_span=term,
            expected_behavior="IDENTITY_RETAINED",
            template_family="r3n2_hld_identity_retention",
        )

    # 75 acronym + identifier analogue combo
    for i in range(75):
        uid = builder._next_uid()
        acr = ACRONYMS[i % len(ACRONYMS)]
        sku = 44100 + uid
        text = f"please confirm {acr} code SKU-{sku} r3n2uid{uid:05d}"
        builder.add(
            split=split,
            population_ids=[
                "ACRONYM_IDENTITY_REQUIRED",
                "IDENTIFIER_PROTECTION_REQUIRED",
                "ACRONYM_IDENTIFIER_ANALOGUE",
            ],
            input_text=text,
            highlighted_span=acr,
            expected_behavior="ACRONYM_IDENTITY_TOP1",
            template_family="r3n2_hld_acronym_identifier_analogue",
        )

    # 25 acronym-only
    for i in range(25):
        uid = builder._next_uid()
        acr = ACRONYMS[(i + 5) % len(ACRONYMS)]
        text = f"please confirm {acr} code r3n2uid{uid:05d}"
        builder.add(
            split=split,
            population_ids=["ACRONYM_IDENTITY_REQUIRED"],
            input_text=text,
            highlighted_span=acr,
            expected_behavior="ACRONYM_IDENTITY_TOP1",
            template_family="r3n2_hld_acronym",
        )

    # 25 identifier-only
    for i in range(25):
        uid = builder._next_uid()
        sku = 45000 + uid
        text = f"lookup order SKU-{sku} in ledger r3n2uid{uid:05d}"
        builder.add(
            split=split,
            population_ids=["IDENTIFIER_PROTECTION_REQUIRED"],
            input_text=text,
            highlighted_span=f"SKU-{sku}",
            expected_behavior="PROTECTED_IDENTITY",
            template_family="r3n2_hld_identifier",
        )

    # 100 protected
    for i in range(100):
        uid = builder._next_uid()
        pan = 8800000000 + uid
        text = f"verify PAN PAN-{pan} on invoice r3n2uid{uid:05d}"
        builder.add(
            split=split,
            population_ids=["PROTECTED_IDENTITY_REQUIRED"],
            input_text=text,
            highlighted_span=f"PAN-{pan}",
            expected_behavior="PROTECTED_IDENTITY",
            template_family="r3n2_hld_protected",
        )

    # 150 shared
    for i in range(150):
        uid = builder._next_uid()
        if i % 2 == 0:
            text = f"check balance r3n2uid{uid:05d} in daily report"
            span = "balance"
        else:
            term = ROMANIZED_TERMS[i % len(ROMANIZED_TERMS)]
            text = f"aaja {term} ko hisab hernu r3n2uid{uid:05d}"
            span = term
        builder.add(
            split=split,
            population_ids=["SHARED_OR_AMBIGUOUS"],
            input_text=text,
            highlighted_span=span,
            expected_behavior="SHARED_CONSERVATIVE",
            template_family="r3n2_hld_shared_ambiguous",
        )

    # Pad to target if under (from multi-tag overlap math)
    while len([c for c in builder.cases if c["split"] == split]) < target:
        uid = builder._next_uid()
        term = _pick(seed, split, uid, "holdout_pad", ENGLISH_TERMS)
        builder.add(
            split=split,
            population_ids=["ENGLISH_IDENTITY_REQUIRED"],
            input_text=f"please audit the {term} worksheet r3n2uid{uid:05d} today",
            highlighted_span=term,
            expected_behavior="IDENTITY_TOP1",
            template_family="r3n2_hld_english_identity",
        )


def _generate_safety_challenge(builder: _CaseBuilder, target: int) -> None:
    split: SplitName = "SAFETY_CHALLENGE"
    seed = _seed_for_split(split)
    kinds = (
        ("protected", ["PROTECTED_IDENTITY_REQUIRED"], "NO_RAW_MUTATION", "REF-{ref}", "protected reference REF-{ref} must stay intact r3n2uid{uid}"),
        ("english", ["ENGLISH_IDENTITY_REQUIRED"], "IDENTITY_TOP1", "{term}", "please print the {term} copy for supplier r3n2uid{uid}"),
        ("identifier", ["IDENTIFIER_PROTECTION_REQUIRED"], "PROTECTED_IDENTITY", "ORD/{ord}", "track shipment ORD/{ord} without rewriting r3n2uid{uid}"),
        ("acronym", ["ACRONYM_IDENTITY_REQUIRED"], "ACRONYM_IDENTITY_TOP1", "{acr}", "validate {acr} column on gst worksheet r3n2uid{uid}"),
    )
    idx = 0
    while len([c for c in builder.cases if c["split"] == split]) < target:
        kind, pops, behavior, span_tpl, text_tpl = kinds[idx % len(kinds)]
        uid = builder._next_uid()
        seq = builder.seq_by_split[split] + 1
        term = _pick(seed, split, seq, kind, ENGLISH_TERMS)
        acr = _pick(seed, split, seq, kind + "_a", ACRONYMS)
        ref = f"2026-{uid:05d}-A"
        ord_id = f"{8800 + uid}/X"
        span = span_tpl.format(term=term, acr=acr, ref=ref, ord=ord_id)
        text = text_tpl.format(term=term, acr=acr, ref=ref, ord=ord_id, uid=f"r3n2uid{uid:05d}")
        builder.add(
            split=split,
            population_ids=list(pops),
            input_text=text,
            highlighted_span=span if span in text else term,
            expected_behavior=behavior,
            template_family=f"r3n2_hld_safety_{kind}",
        )
        idx += 1


def _generate_counterfactuals(builder: _CaseBuilder, target: int) -> None:
    split: SplitName = "CONTEXT_COUNTERFACTUAL"
    pairs_needed = target // 2
    res = load_resources(force_reload=False)
    shared = sorted(
        tok
        for tok in set(res.english_identity) & (set(res.lexicon) | set(res.domain_terms))
        if tok.isalpha() and len(tok) >= 4
    )
    words = list(dict.fromkeys(list(COUNTERFACTUAL_WORDS) + shared))[:pairs_needed]
    if len(words) < pairs_needed:
        words.extend(COUNTERFACTUAL_WORDS * ((pairs_needed // len(COUNTERFACTUAL_WORDS)) + 1))
        words = words[:pairs_needed]

    for i, tok in enumerate(words):
        pair_id = f"r3n2_cfx_pair_{i:03d}"
        uid_en = builder._next_uid()
        uid_np = builder._next_uid()
        english_text = f"please verify the {tok} total in english report r3n2uid{uid_en:05d}"
        nepali_text = f"aaja {tok} ko hisab hernu r3n2uid{uid_np:05d}"
        builder.add(
            split=split,
            population_ids=["CONTEXT_COUNTERFACTUAL", "ENGLISH_IDENTITY_REQUIRED"],
            input_text=english_text,
            highlighted_span=tok,
            expected_behavior="IDENTITY_TOP1",
            template_family="r3n2_hld_counterfactual_english",
            pair_id=pair_id,
            pair_role="english_context",
        )
        builder.add(
            split=split,
            population_ids=["CONTEXT_COUNTERFACTUAL", "ROMANIZED_NEPALI_REQUIRED"],
            input_text=nepali_text,
            highlighted_span=tok,
            expected_behavior="ROMANIZED_SCRIPT_AT_5",
            template_family="r3n2_hld_counterfactual_nepali",
            pair_id=pair_id,
            pair_role="nepali_context",
        )


def _generate_oov(builder: _CaseBuilder, target: int) -> None:
    split: SplitName = "OOV_CHALLENGE"
    behaviors = ("IDENTITY_TOP1", "ROMANIZED_SCRIPT_AT_5", "IDENTITY_RETAINED")
    idx = 0
    while len([c for c in builder.cases if c["split"] == split]) < target:
        uid = builder._next_uid()
        morph = f"xyzblorp{uid:05d}anu"
        if idx % 3 == 0:
            text = f"customer asked about {morph} balance today r3n2uid{uid:05d}"
        elif idx % 3 == 1:
            text = f"aaja {morph} ko record hernu r3n2uid{uid:05d}"
        else:
            text = f"please verify {morph} export status r3n2uid{uid:05d}"
        builder.add(
            split=split,
            population_ids=["OOV"],
            input_text=text,
            highlighted_span=morph,
            expected_behavior=behaviors[idx % 3],
            template_family="r3n2_hld_oov_generalization",
        )
        idx += 1


def _generate_monotonic(builder: _CaseBuilder, target: int) -> None:
    split: SplitName = "MONOTONIC_REGRESSION"
    # Locked minimum requires 300 MONOTONIC_PARENT_CORRECT cases on this split.
    for i in range(target):
        uid = builder._next_uid()
        if i % 2 == 0:
            term = ENGLISH_TERMS[i % len(ENGLISH_TERMS)]
            text = f"monotonic parent english check for {term} r3n2uid{uid:05d}"
            span = term
            behavior = "IDENTITY_TOP1"
            family = "r3n2_hld_monotonic_correct"
        else:
            term = ROMANIZED_TERMS[i % len(ROMANIZED_TERMS)]
            text = f"aaja {term} ko monotonic parent check r3n2uid{uid:05d}"
            span = term
            behavior = "ROMANIZED_SCRIPT_AT_5"
            family = "r3n2_hld_monotonic_correct"
        builder.add(
            split=split,
            population_ids=["MONOTONIC_PARENT_CORRECT"],
            input_text=text,
            highlighted_span=span,
            expected_behavior=behavior,
            template_family=family,
        )


def build_all_cases() -> dict[SplitName, list[dict[str, Any]]]:
    r3l_blocked = _load_r3l_blocked_texts()
    r3m_texts, r3m_source_ids = _load_r3m_corrective_texts()
    r3n_blocked = _load_r3n_blocked_sets()
    blocked = {
        "r3l_texts": r3l_blocked,
        "r3m_corrective_texts": r3m_texts,
        "r3m_source_ids": r3m_source_ids,
        "r3n": r3n_blocked,
    }
    builder = _CaseBuilder(blocked)

    _load_authorized_code_corrective_cases(builder)
    _generate_development_synthetics(builder, SPLIT_SIZE_MINIMA["DEVELOPMENT"])
    _generate_holdout_validation(builder, SPLIT_SIZE_MINIMA["HOLDOUT_VALIDATION"])
    _generate_safety_challenge(builder, SPLIT_SIZE_MINIMA["SAFETY_CHALLENGE"])
    _generate_counterfactuals(builder, SPLIT_SIZE_MINIMA["CONTEXT_COUNTERFACTUAL"])
    _generate_oov(builder, SPLIT_SIZE_MINIMA["OOV_CHALLENGE"])
    _generate_monotonic(builder, SPLIT_SIZE_MINIMA["MONOTONIC_REGRESSION"])

    populations_seen: set[str] = set()
    for case in builder.cases:
        populations_seen.update(case["population_ids"])
    missing = REQUIRED_POPULATIONS_SET - populations_seen
    if missing:
        raise ValueError(f"missing_populations:{sorted(missing)}")

    by_split: dict[SplitName, list[dict[str, Any]]] = {split: [] for split in SPLIT_FILES}
    for case in sorted(builder.cases, key=lambda c: (c["split"], c["case_id"])):
        by_split[case["split"]].append(case)
    return by_split


def _population_counts(cases: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {p: 0 for p in sorted(REQUIRED_POPULATIONS_SET)}
    for case in cases:
        for pid in case["population_ids"]:
            counts[pid] = counts.get(pid, 0) + 1
    return counts


def _split_population_counts(cases: list[dict[str, Any]], split: SplitName) -> dict[str, int]:
    split_cases = [c for c in cases if c["split"] == split]
    return _population_counts(split_cases)


def multi_token_coverage_pct(cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Fraction of cases whose input has >=2 alphabetic tokens (excluding uid marker)."""

    def alpha_tokens(text: str) -> list[str]:
        cleaned = UID_RE.sub(" ", text)
        return re.findall(r"[A-Za-z]+", cleaned)

    multi = sum(1 for c in cases if len(alpha_tokens(c["input_text"])) >= 2)
    total = len(cases) or 1
    return {
        "multi_token_case_count": multi,
        "total_cases": len(cases),
        "multi_token_coverage_pct": round(100.0 * multi / total, 4),
    }


def freshness_firewall(cases: list[dict[str, Any]]) -> dict[str, Any]:
    flat = [c for rows in cases.values() for c in rows] if isinstance(cases, dict) else cases
    r3n = _load_r3n_blocked_sets()
    r3l_blocked = _load_r3l_blocked_texts()
    r3m_texts, r3m_source_ids = _load_r3m_corrective_texts()

    holdout_cases = [c for c in flat if c["split"] in HOLDOUT_SPLITS]
    dev = [c for c in flat if c["split"] == "DEVELOPMENT"]

    # Freshness zero-overlap proofs apply to holdout-family splits (and non-corrective synthetics).
    # The nine R3M corrective texts may honestly reappear in DEVELOPMENT only.
    hld_ids = {c["case_id"] for c in holdout_cases}
    hld_texts = {_norm(c["input_text"]) for c in holdout_cases}
    hld_families = {c["template_family"] for c in holdout_cases}
    hld_skeletons = {_skeleton(c["input_text"]) for c in holdout_cases}

    id_overlap = sorted(hld_ids & r3n["case_ids"])
    text_overlap = sorted(hld_texts & r3n["normalized_texts"])
    family_overlap = sorted(hld_families & r3n["template_families"])
    skeleton_overlap = sorted(hld_skeletons & r3n["skeletons"])
    r3l_holdout_overlap = sorted(hld_texts & r3l_blocked)
    r3m_in_holdout = sorted(hld_texts & r3m_texts)

    corrective_ids = {c["case_id"] for c in flat if "AUTHORIZED_CODE_CORRECTIVE" in c["population_ids"]}
    corrective_in_holdout = sorted(
        c["case_id"] for c in holdout_cases if c["case_id"] in corrective_ids
    )

    # Authorized DEVELOPMENT overlap with R3M/R3L corrective texts (honest reporting).
    dev_texts = {_norm(c["input_text"]) for c in dev}
    authorized_dev_r3n_text_overlap = sorted(dev_texts & r3n["normalized_texts"])
    authorized_dev_r3l_text_overlap = sorted(dev_texts & r3l_blocked)

    def tokens(s: str) -> set[str]:
        return {t.lower() for t in re.findall(r"[A-Za-z]+", s)}

    r3n_tok: set[str] = set()
    for t in r3n["normalized_texts"]:
        r3n_tok |= tokens(t)
    gen_tok: set[str] = set()
    for c in flat:
        gen_tok |= tokens(c["input_text"])
    vocab_overlap = r3n_tok & gen_tok

    dev_ids = {c["case_id"] for c in dev}
    hld_ids_set = hld_ids
    hld_texts_set = hld_texts
    dev_families = {c["template_family"] for c in dev}

    split_id_overlap = sorted(dev_ids & hld_ids_set)
    split_text_overlap = sorted(dev_texts & hld_texts_set)
    split_family_overlap = sorted(dev_families & hld_families)

    proof_passed = (
        len(id_overlap) == 0
        and len(text_overlap) == 0
        and len(family_overlap) == 0
        and len(skeleton_overlap) == 0
        and len(r3l_holdout_overlap) == 0
        and len(r3m_in_holdout) == 0
        and len(corrective_in_holdout) == 0
        and len(split_id_overlap) == 0
        and len(split_text_overlap) == 0
        and len(split_family_overlap) == 0
    )

    return {
        "schema_version": "mai07_r3n2_freshness_firewall_v1",
        "builder_version": BUILDER_VERSION,
        "r3n_sources": r3n["sources"],
        "attempt001_reconstructed_count": r3n["attempt001_reconstructed_count"],
        "zero_overlap_proofs": {
            "scope": "holdout_family_splits_and_dev_holdout_disjointness",
            "case_id_intersection_empty": len(id_overlap) == 0,
            "case_id_intersection": id_overlap,
            "normalized_text_intersection_empty": len(text_overlap) == 0,
            "normalized_text_intersection_count": len(text_overlap),
            "template_family_intersection_empty": len(family_overlap) == 0,
            "template_family_intersection": family_overlap,
            "skeleton_intersection_empty": len(skeleton_overlap) == 0,
            "skeleton_intersection_count": len(skeleton_overlap),
            "r3l_text_intersection_empty": len(r3l_holdout_overlap) == 0,
            "r3m_text_in_holdout_empty": len(r3m_in_holdout) == 0,
            "corrective_case_ids_in_holdout_empty": len(corrective_in_holdout) == 0,
            "corrective_case_ids_in_holdout": corrective_in_holdout,
            "dev_holdout_case_id_disjoint": len(split_id_overlap) == 0,
            "dev_holdout_text_disjoint": len(split_text_overlap) == 0,
            "dev_holdout_family_disjoint": len(split_family_overlap) == 0,
        },
        "authorized_development_corrective_overlap": {
            "r3n_text_overlap_count": len(authorized_dev_r3n_text_overlap),
            "r3l_text_overlap_count": len(authorized_dev_r3l_text_overlap),
            "note": (
                "Nine R3M corrective cases may reuse R3L/R3M source texts in DEVELOPMENT "
                "with new R3N2 case IDs; they must not appear in HOLDOUT."
            ),
        },
        "vocabulary_overlap_honest": {
            "vocabulary_overlap_token_count": len(vocab_overlap),
            "vocabulary_overlap_note": "Legitimate token overlap expected; not claimed zero.",
            "sample_overlap_tokens": sorted(vocab_overlap)[:40],
        },
        "r3m_corrective_source_ids": r3m_source_ids,
        "proof_passed": proof_passed,
    }


def check_minima(cases: dict[SplitName, list[dict[str, Any]]] | list[dict[str, Any]]) -> dict[str, Any]:
    if isinstance(cases, dict):
        flat = [c for rows in cases.values() for c in rows]
    else:
        flat = cases

    split_failures: list[dict[str, Any]] = []
    population_checks: dict[str, Any] = {}

    for split, minimum in SPLIT_SIZE_MINIMA.items():
        count = sum(1 for c in flat if c["split"] == split)
        if count < minimum:
            split_failures.append({"split": split, "have": count, "minimum": minimum})

    for split in ("HOLDOUT_VALIDATION", "CONTEXT_COUNTERFACTUAL", "OOV_CHALLENGE", "MONOTONIC_REGRESSION"):
        pop_counts = _split_population_counts(flat, split)  # type: ignore[arg-type]
        result = check_population_minima(pop_counts, split=split)  # type: ignore[arg-type]
        population_checks[split] = result
        if not result["ok"]:
            split_failures.extend(result["failures"])

    dev_corrective = sum(
        1 for c in flat if c["split"] == "DEVELOPMENT" and "AUTHORIZED_CODE_CORRECTIVE" in c["population_ids"]
    )
    if dev_corrective != 9:
        split_failures.append(
            {
                "population_id": "AUTHORIZED_CODE_CORRECTIVE",
                "have": dev_corrective,
                "minimum": 9,
            }
        )

    ok = len(split_failures) == 0 and all(v["ok"] for v in population_checks.values())
    return {
        "ok": ok,
        "verdict": None if ok else "BLOCKED_INSUFFICIENT_POPULATION",
        "split_size_failures": [f for f in split_failures if "split" in f],
        "population_failures": [f for f in split_failures if "population_id" in f and "split" not in f],
        "population_checks": population_checks,
        "minimum_denominators": dict(MINIMUM_DENOMINATORS),
        "split_size_minima": dict(SPLIT_SIZE_MINIMA),
    }


def _split_integrity(cases: list[dict[str, Any]]) -> dict[str, Any]:
    dev = [c for c in cases if c["split"] == "DEVELOPMENT"]
    hld = [c for c in cases if c["split"] in HOLDOUT_SPLITS]
    dev_ids = {c["case_id"] for c in dev}
    hld_ids = {c["case_id"] for c in hld}
    dev_texts = {_norm(c["input_text"]) for c in dev}
    hld_texts = {_norm(c["input_text"]) for c in hld}
    dev_families = {c["template_family"] for c in dev}
    hld_families = {c["template_family"] for c in hld}
    id_overlap = sorted(dev_ids & hld_ids)
    text_overlap_count = len(dev_texts & hld_texts)
    family_overlap = sorted(dev_families & hld_families)
    return {
        "schema_version": "mai07_r3n2_split_integrity_v1",
        "development_case_count": len(dev),
        "holdout_family_case_count": len(hld),
        "case_id_intersection_empty": len(id_overlap) == 0,
        "input_text_intersection_empty": text_overlap_count == 0,
        "template_family_disjoint_dev_holdout": len(family_overlap) == 0,
        "seeds": {"DEVELOPMENT": SEED_DEVELOPMENT, "HOLDOUT_FAMILY": SEED_HOLDOUT},
        "proof_passed": len(id_overlap) == 0 and text_overlap_count == 0 and len(family_overlap) == 0,
    }


def write_datasets(*, write: bool = False, output_dir: Path | None = None) -> dict[str, Any]:
    dest = Path(output_dir) if output_dir is not None else OUT
    if write and dest.resolve() == OUT.resolve():
        if os.environ.get(AUTHORIZE_ENV) != "1":
            raise PermissionError(
                f"Refusing canonical write to {OUT}. Set {AUTHORIZE_ENV}=1."
            )

    by_split = build_all_cases()
    flat = [c for rows in by_split.values() for c in rows]
    minima = check_minima(by_split)
    if not minima["ok"]:
        raise ValueError(f"{minima['verdict']}:{minima}")

    firewall = freshness_firewall(by_split)
    if not firewall["proof_passed"]:
        raise ValueError(f"freshness_firewall_failed:{firewall['zero_overlap_proofs']}")

    integrity = _split_integrity(flat)
    if not integrity["proof_passed"]:
        raise ValueError(f"split_integrity_failed:{integrity}")

    population_counts = _population_counts(flat)
    token_cov = multi_token_coverage_pct(flat)

    result: dict[str, Any] = {
        "dry_run": not write,
        "output_dir": str(dest.resolve()),
        "total_cases": len(flat),
        "totals_by_split": {split: len(by_split[split]) for split in SPLIT_FILES},
        "population_counts": population_counts,
        "minima_check": minima,
        "freshness_firewall_passed": firewall["proof_passed"],
        "split_integrity_passed": integrity["proof_passed"],
        "multi_token_coverage": token_cov,
    }

    if not write:
        result["freshness_firewall"] = firewall
        return result

    dest.mkdir(parents=True, exist_ok=True)
    split_hashes: dict[str, Any] = {}
    for split, filename in SPLIT_FILES.items():
        rows = sorted(by_split[split], key=lambda r: r["case_id"])
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

    manifest = {
        "schema_version": "mai07_r3n2_manifest_v1",
        "manifest_id": "MANIFEST",
        "builder_version": BUILDER_VERSION,
        "candidate_policy_version": "mai-07-r3n2.1.0.0",
        "parent_invalidated_rc": "MAI_07R3N_POLICY_CONFORMANCE_RELEASE_CANDIDATE_002",
        "seeds": {"DEVELOPMENT": SEED_DEVELOPMENT, "HOLDOUT_FAMILY": SEED_HOLDOUT},
        "splits": split_hashes,
        "totals": {split: split_hashes[split]["case_count"] for split in SPLIT_FILES},
        "population_counts": population_counts,
        "total_cases": len(flat),
        "prohibited_for_training": True,
        "frozen_v2_unused": True,
        "r3l_synthetic_overlap_blocked": True,
        "multi_token_coverage": token_cov,
    }
    manifest_body = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    (dest / "MANIFEST.json").write_text(manifest_body, encoding="utf-8", newline="\n")

    leakage = {
        "schema_version": "mai07_r3n2_leakage_integrity_v1",
        "report_id": "LEAKAGE_AND_SPLIT_INTEGRITY",
        "builder_version": BUILDER_VERSION,
        "split_integrity": integrity,
        "population_counts": population_counts,
        "populations_with_nonempty_denominators": all(v > 0 for v in population_counts.values()),
        "freshness_firewall_summary": {
            "proof_passed": firewall["proof_passed"],
            "corrective_case_ids_in_holdout_empty": firewall["zero_overlap_proofs"][
                "corrective_case_ids_in_holdout_empty"
            ],
        },
    }
    leakage_body = json.dumps(leakage, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    (dest / "LEAKAGE_AND_SPLIT_INTEGRITY.json").write_text(leakage_body, encoding="utf-8", newline="\n")

    firewall_body = json.dumps(firewall, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    (dest / "FRESHNESS_FIREWALL.json").write_text(firewall_body, encoding="utf-8", newline="\n")

    denominators = {
        "schema_version": "mai07_r3n2_population_denominators_v1",
        "builder_version": BUILDER_VERSION,
        "minimum_denominators": dict(MINIMUM_DENOMINATORS),
        "split_size_minima": dict(SPLIT_SIZE_MINIMA),
        "observed_population_counts": population_counts,
        "observed_split_counts": result["totals_by_split"],
        "minima_check": minima,
    }
    denom_body = json.dumps(denominators, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    (dest / "POPULATION_DENOMINATORS.json").write_text(denom_body, encoding="utf-8", newline="\n")

    result.update(
        {
            "manifest_sha256": _sha(manifest_body.encode("utf-8")),
            "leakage_sha256": _sha(leakage_body.encode("utf-8")),
            "freshness_firewall_sha256": _sha(firewall_body.encode("utf-8")),
            "manifest_path": str((dest / "MANIFEST.json").resolve()),
        }
    )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="MAI-07R3N2 fresh-holdout dataset builder")
    parser.add_argument(
        "--write",
        action="store_true",
        help=f"Write canonical datasets to {OUT} (requires {AUTHORIZE_ENV}=1)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Build in memory and verify minima + freshness firewall (default)",
    )
    parser.add_argument("--output", default="", help="Optional alternate output directory")
    args = parser.parse_args()

    if args.write:
        out = Path(args.output) if args.output else OUT
        result = write_datasets(write=True, output_dir=out)
        safe = {
            "ok": True,
            "output_dir": result["output_dir"],
            "total_cases": result["total_cases"],
            "totals": result["totals_by_split"],
            "population_counts": result["population_counts"],
            "freshness_firewall_passed": result["freshness_firewall_passed"],
            "split_integrity_passed": result["split_integrity_passed"],
            "minima_ok": result["minima_check"]["ok"],
            "manifest_sha256": result.get("manifest_sha256"),
            "files": {split: str((out / SPLIT_FILES[split]).resolve()) for split in SPLIT_FILES},
        }
        print(json.dumps(safe, ensure_ascii=False, indent=2, sort_keys=True))
        return 0

    # Default and --check: dry-run validation
    result = write_datasets(write=False)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if result["minima_check"]["ok"] and result["freshness_firewall_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
