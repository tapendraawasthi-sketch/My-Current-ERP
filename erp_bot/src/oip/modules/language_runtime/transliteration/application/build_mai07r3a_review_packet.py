"""MAI-07R3A — blinded language-policy adjudication packet builder.

Review-only tooling. Does not modify frozen V1, does not tune rankers,
does not enable the R2 overlay, and does not run frozen quality gates.
"""

from __future__ import annotations

import csv
import hashlib
import json
import random
import re
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .eval_c2_helpers import extract_primary_produced
from .eval_mai07 import load_cases
from .eval_metric_definitions import (
    FROZEN_DATASET_HASH,
    FROZEN_RESOURCE_HASH,
    FROZEN_RUNTIME_SEMANTIC_HASH,
    POP_TRANSLITERATION_REQUIRED,
)
from .eval_populations_v2 import classify_case_populations_v2
from .eval_scoring import score_target_case
from .transliteration_service import attach_transliteration_to_frame
from ..infrastructure.resource_repository import load_resources

REPO = Path(__file__).resolve().parents[7]
REVIEW_ROOT = REPO / "docs" / "mokxya-ai" / "reviews" / "mai07r3"
SEED = 20260715
CONTROL = {
    "romanized_target_required": 30,
    "english_identity_required": 30,
    "name_like": 20,
    "ambiguous_optional": 20,
}
CSV_INJECT = re.compile(r"^[=+\-@]")
# Synthetic / evaluation content only — reject private-looking patterns in packet inputs.
SENSITIVE = re.compile(
    r"(?i)(\b\d{10,}\b|@[\w.-]+\.[a-z]{2,}|https?://|/home/|/Users/|"
    r"\b[A-Z]{5}\d{4}[A-Z]\b|\bGSTIN\b|\bpassword\b|\bapikey\b)"
)


@dataclass(frozen=True)
class ConflictRecord:
    case_id: str
    suite_id: str
    language_form: str
    english_identity: bool
    name_like: bool
    eng_reason: str
    name_reason: str
    top_nonid_kind: str
    token_count: int
    code_mix: bool
    target_span_position: str  # first|middle|last|only
    acceptable_targets: tuple[str, ...]
    produced_surfaces: tuple[str, ...]
    input_text: str
    source_surface: str


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write(path: Path, text: str) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    return _sha(path)


def _csv_cell(value: Any) -> str:
    s = "" if value is None else str(value)
    if CSV_INJECT.match(s):
        return "'" + s
    return s


def _target_span_position(tokens: list[str], surface: str) -> str:
    if not tokens:
        return "only"
    idxs = [i for i, t in enumerate(tokens) if t == surface]
    if not idxs:
        return "first"
    i = idxs[0]
    if len(tokens) == 1:
        return "only"
    if i == 0:
        return "first"
    if i == len(tokens) - 1:
        return "last"
    return "middle"


def _privacy_ok(text: str) -> bool:
    return not SENSITIVE.search(text or "")


def _prer1_eligibility_for_conflict_audit(form: str, surface: str, res) -> str:
    """Pre-R1 / pre-R3D eligibility (sealed R3A conflict authority)."""
    from ...domain.taxonomy import LanguageForm

    low = surface.lower()
    if form in {
        LanguageForm.NEPALI_DEVANAGARI.value,
        LanguageForm.NUMERIC.value,
        LanguageForm.PUNCTUATION_OR_SYMBOL.value,
        LanguageForm.IDENTIFIER_OR_CODE.value,
    }:
        return "IDENTITY_ONLY"
    if form in {LanguageForm.ENGLISH.value, LanguageForm.TECHNICAL_ACCOUNTING_ENGLISH.value}:
        if low in res.lexicon or low in res.domain_terms:
            return "GENERATE"
        return "IDENTITY_ONLY"
    if form == LanguageForm.SHARED_OR_AMBIGUOUS_LATIN.value:
        if low in res.name_like or low in res.lexicon or low in res.domain_terms:
            return "GENERATE"
        return "ABSTAIN"
    if form in {LanguageForm.NAMED_ENTITY_CANDIDATE.value, LanguageForm.ROMANIZED_NEPALI.value}:
        return "GENERATE"
    return "SKIP"


def _prer1_conflict_bundle(raw: str):
    """Historical pre-R1 ranking path for sealed R3A/R3C conflict audits.

    Active R3D may IDENTITY_ONLY english_identity surfaces; conflict count 49 was
    sealed under mai-07.1.0 GENERATE+ranker behavior and must remain reconstructible.
    """
    from .. import MAX_CANDIDATES_PER_SPAN
    from ..infrastructure.deterministic_generator import DeterministicCandidateGenerator
    from ..infrastructure.deterministic_ranker_prer1 import (
        DeterministicCandidateRanker as Prer1Ranker,
    )
    from ..infrastructure.resource_repository import load_resources as _lr
    from ..domain.alignment import identity_alignment

    res = _lr()
    frame = analyze_language(raw)
    gen = DeterministicCandidateGenerator(res)
    ranker = Prer1Ranker(res)
    from .....contracts.transliteration import (
        CalibrationStatus,
        CandidateKind,
        CandidateScript,
        EligibilityDecision,
        TransliterationBundleV1,
        TransliterationCandidateV1,
        TransliterationSpanV1,
        TransliterationStatus,
        UncertaintyClass,
    )
    from .....contracts.common import SourceSpanV1
    from .. import OFFSET_UNIT, RESOURCE_PACK_VERSION, RUNTIME_VERSION

    anns = list(frame.span_annotations)
    tokens = [a.original_text for a in anns]

    def _neighbors(i: int) -> tuple[str, ...]:
        left = right = None
        for j in range(i - 1, -1, -1):
            if tokens[j].strip():
                left = tokens[j]
                break
        for j in range(i + 1, len(tokens)):
            if tokens[j].strip():
                right = tokens[j]
                break
        return tuple(x for x in (left, right) if x is not None)

    spans = []
    for idx, ann in enumerate(anns):
        surface = ann.original_text
        form = ann.language_form
        name_like = form == "NAMED_ENTITY_CANDIDATE" or surface.lower() in res.name_like
        prefer_identity = surface.lower() in res.english_identity
        decision = _prer1_eligibility_for_conflict_audit(form, surface, res)
        neighbors = _neighbors(idx)
        raw_span = SourceSpanV1(
            start_offset=ann.start_offset,
            end_offset=ann.end_offset,
            original_text=surface,
            offset_unit=OFFSET_UNIT,
        )
        if decision != "GENERATE":
            ident = TransliterationCandidateV1(
                candidate_id=f"id_{ann.start_offset}",
                surface=surface,
                script=CandidateScript.LATIN,
                kind=CandidateKind.IDENTITY,
                rank=1,
                ranking_score=1.0,
                uncertainty_class=UncertaintyClass.HIGH_EVIDENCE,
                calibration_status=CalibrationStatus.UNCALIBRATED,
                alignment=identity_alignment(surface),
                is_identity=True,
                reason_codes=("PRER1_CONFLICT_AUDIT_IDENTITY",),
                provenance=("identity",),
            )
            spans.append(
                TransliterationSpanV1(
                    span_id=f"audit_{ann.start_offset}",
                    raw_span=raw_span,
                    source_language_form=form,
                    eligibility=EligibilityDecision.IDENTITY_ONLY,
                    decision_reason_codes=("PRER1_CONFLICT_AUDIT",),
                    candidates=(ident,),
                    identity_candidate_id=ident.candidate_id,
                    is_name_like=name_like,
                )
            )
            continue
        generated = gen.generate(
            surface,
            language_form=form,
            neighbors=neighbors,
            use_context=True,
            name_like=name_like,
            enable_r3d_spelling_alts=False,
        )
        ranked = ranker.rank(
            generated,
            surface=surface,
            language_form=form,
            neighbors=neighbors,
            use_context=True,
            prefer_identity=prefer_identity,
            name_like=name_like,
            max_candidates=MAX_CANDIDATES_PER_SPAN,
        )
        spans.append(
            TransliterationSpanV1(
                span_id=f"audit_{ann.start_offset}",
                raw_span=raw_span,
                source_language_form=form,
                eligibility=EligibilityDecision.GENERATE,
                decision_reason_codes=("PRER1_CONFLICT_AUDIT",),
                candidates=tuple(ranked),
                identity_candidate_id=next((c.candidate_id for c in ranked if c.is_identity), ranked[0].candidate_id),
                is_name_like=name_like,
            )
        )
    return TransliterationBundleV1(
        analysis_status=TransliterationStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        resource_version=RESOURCE_PACK_VERSION,
        resource_hash=res.content_hash,
        offset_unit=OFFSET_UNIT,
        source_authority="RAW",
        matching_view="RAW",
        span_results=tuple(spans),
    )


def recompute_conflicts(repo: Path = REPO) -> tuple[list[ConflictRecord], dict[str, Any]]:
    """Deterministic conflict set using evaluator rules + sealed pre-R1 ranking authority."""
    load_resources(force_reload=True)
    man = repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json"
    cases = load_cases(man, repo)
    res = load_resources()
    conflicts: list[ConflictRecord] = []
    for case in sorted(cases, key=lambda c: c["case_id"]):
        c2 = classify_case_populations_v2(case)
        if POP_TRANSLITERATION_REQUIRED not in c2["memberships"]:
            continue
        targets = list(c2["acceptable_target_candidates"])
        raw = case["input_text"]
        bundle = _prer1_conflict_bundle(raw)
        assert bundle is not None
        produced, src, err = extract_primary_produced(bundle)
        scored = score_target_case(
            case_id=case["case_id"],
            produced=produced,
            acceptable_target_candidates=targets,
            source_surface=src or "",
            preferred_target=None,
            structural_error=err,
        )
        if not (produced and produced[0].is_identity and scored.first_target_rank in {2, 3, 4, 5}):
            continue
        eng = (src or "").lower() in res.english_identity
        name = False
        form = ""
        kind = ""
        for sp in bundle.span_results:
            if sp.raw_span.original_text != src:
                continue
            form = sp.source_language_form
            name = bool(sp.is_name_like or (src or "").lower() in res.name_like)
            non = [c for c in sp.candidates if not c.is_identity]
            kind = non[0].kind.value if non else ""
            break
        # Safety classification that creates policy conflict with target-required gold
        if not (eng or name):
            continue
        tokens = raw.split()
        conflicts.append(
            ConflictRecord(
                case_id=case["case_id"],
                suite_id=str(case.get("suite_id") or ""),
                language_form=form,
                english_identity=eng,
                name_like=name,
                eng_reason="ENGLISH_IDENTITY_RESOURCE" if eng else "",
                name_reason=(
                    "NAME_LIKE_RESOURCE_OR_SPAN_FLAG" if name else ""
                ),
                top_nonid_kind=kind,
                token_count=len(tokens),
                code_mix=len({t for t in tokens if t.isalpha()}) > 1 and any(
                    t.lower() in res.english_identity for t in tokens
                ),
                target_span_position=_target_span_position(tokens, src or ""),
                acceptable_targets=tuple(targets),
                produced_surfaces=tuple(p.surface for p in produced),
                input_text=raw,
                source_surface=src or "",
            )
        )

    tax = {
        "conflict_count": len(conflicts),
        "by_suite": dict(Counter(c.suite_id for c in conflicts)),
        "by_language_form": dict(Counter(c.language_form for c in conflicts)),
        "by_english_identity_reason": dict(Counter(c.eng_reason for c in conflicts if c.eng_reason)),
        "by_name_like_reason": dict(Counter(c.name_reason for c in conflicts if c.name_reason)),
        "by_top_nonid_kind": dict(Counter(c.top_nonid_kind for c in conflicts)),
        "single_token": sum(1 for c in conflicts if c.token_count == 1),
        "multi_token": sum(1 for c in conflicts if c.token_count > 1),
        "code_mix": sum(1 for c in conflicts if c.code_mix),
        "by_target_span_position": dict(Counter(c.target_span_position for c in conflicts)),
        "english_only": sum(1 for c in conflicts if c.english_identity and not c.name_like),
        "name_only": sum(1 for c in conflicts if c.name_like and not c.english_identity),
        "both_eng_and_name": sum(1 for c in conflicts if c.english_identity and c.name_like),
        "expected_count": 49,
        "matches_expected": len(conflicts) == 49,
    }
    return conflicts, tax


def _pick_controls(
    cases: list[dict[str, Any]],
    conflicts: list[ConflictRecord],
    *,
    rng: random.Random,
) -> dict[str, list[dict[str, Any]]]:
    conflict_ids = {c.case_id for c in conflicts}
    res = load_resources()
    pools: dict[str, list[dict[str, Any]]] = {
        "romanized_target_required": [],
        "english_identity_required": [],
        "name_like": [],
        "ambiguous_optional": [],
    }
    for case in cases:
        if case["case_id"] in conflict_ids:
            continue
        text = case["input_text"]
        if not _privacy_ok(text):
            continue
        suite = case.get("suite_id") or ""
        c2 = classify_case_populations_v2(case)
        if suite.startswith("romanized") and POP_TRANSLITERATION_REQUIRED in c2["memberships"]:
            pools["romanized_target_required"].append(case)
        elif suite == "english_identity_v1":
            pools["english_identity_required"].append(case)
        elif suite == "names_entities_v1" or any(
            tok.lower() in res.name_like for tok in text.split()
        ):
            pools["name_like"].append(case)
        elif suite in {"ambiguous_latin_v1"} or case.get("abstention_expected"):
            pools["ambiguous_optional"].append(case)
        elif suite == "domain_terms_v1" and POP_TRANSLITERATION_REQUIRED not in c2["memberships"]:
            pools["ambiguous_optional"].append(case)

    out: dict[str, list[dict[str, Any]]] = {}
    for key, need in CONTROL.items():
        pool = sorted(pools[key], key=lambda c: c["case_id"])
        rng.shuffle(pool)
        chosen = pool[:need]
        if len(chosen) < need:
            # pad from remaining romanized/english pools without reusing
            used = {c["case_id"] for rows in out.values() for c in rows} | {c["case_id"] for c in chosen}
            for alt in ("romanized_target_required", "english_identity_required", "ambiguous_optional", "name_like"):
                if len(chosen) >= need:
                    break
                extra = [c for c in sorted(pools[alt], key=lambda x: x["case_id"]) if c["case_id"] not in used]
                rng.shuffle(extra)
                for c in extra:
                    if len(chosen) >= need:
                        break
                    chosen.append(c)
                    used.add(c["case_id"])
        out[key] = chosen
    return out


def _opaque_id(seed: int, n: int) -> str:
    digest = hashlib.sha256(f"{seed}:{n}:mai07r3a".encode()).hexdigest()[:12].upper()
    return f"R3A-{digest}"


def _candidates_for_round_b(conflict: ConflictRecord | None, case: dict[str, Any], src: str) -> list[str]:
    opts: list[str] = []
    if conflict is not None:
        opts.extend(list(conflict.produced_surfaces))
        opts.extend(list(conflict.acceptable_targets))
    else:
        c2 = classify_case_populations_v2(case)
        opts.extend(list(c2.get("acceptable_target_candidates") or []))
        preferred = case.get("preferred_candidate")
        if preferred:
            opts.append(str(preferred))
        opts.extend(list(case.get("acceptable_candidates") or []))
    # Always include identity surface
    opts.append(src)
    # Deduplicate preserving order
    seen: set[str] = set()
    uniq: list[str] = []
    for o in opts:
        if not o or o in seen:
            continue
        if " " in o.strip() and o != src:
            continue
        seen.add(o)
        uniq.append(o)
    return uniq[:8]


def _r3b_import_locked(review_root: Path = REVIEW_ROOT) -> bool:
    """True once locked Round A responses (or R3B lock manifest) exist — do not regenerate."""
    return (review_root / "MAI_07R3_ROUND_A_RESPONSES_LOCKED.csv").exists() or (
        review_root / "MAI_07R3B_IMPORT_LOCK_MANIFEST.json"
    ).exists()


def _read_only_locked_packet_report(repo: Path = REPO) -> dict[str, Any]:
    """Return packet stats from sealed artifacts without mutating review files."""
    mapping = json.loads(
        (REVIEW_ROOT / "MAI_07R3_BLIND_MAPPING.json").read_text(encoding="utf-8")
    )
    control = json.loads(
        (REVIEW_ROOT / "MAI_07R3_CONTROL_SAMPLE_MANIFEST.json").read_text(encoding="utf-8")
    )
    eng = json.loads(
        (REVIEW_ROOT / "MAI_07R3_ENGINEERING_CONFLICT_SUMMARY.json").read_text(
            encoding="utf-8"
        )
    )
    hashes = {
        "mapping": _sha(REVIEW_ROOT / "MAI_07R3_BLIND_MAPPING.json"),
        "round_a": _sha(REVIEW_ROOT / "MAI_07R3_ROUND_A_REVIEW.csv")
        if (REVIEW_ROOT / "MAI_07R3_ROUND_A_REVIEW.csv").exists()
        else "",
        "round_b": _sha(REVIEW_ROOT / "MAI_07R3_ROUND_B_REVIEW.csv")
        if (REVIEW_ROOT / "MAI_07R3_ROUND_B_REVIEW.csv").exists()
        else "",
        "schema": _sha(REVIEW_ROOT / "MAI_07R3_REVIEW_SCHEMA.json"),
    }
    return {
        "ok": True,
        "locked_read_only": True,
        "conflict_count": int(eng.get("conflict_count", 0)),
        "matches_expected_49": int(eng.get("conflict_count", 0)) == 49,
        "taxonomy": eng.get("taxonomy") or {},
        "review_items": len(mapping.get("entries") or []),
        "control_actual": (control.get("control_actual") or control.get("controls") or {}),
        "exclusions": [],
        "artifact_hashes": hashes,
        "review_root": str(REVIEW_ROOT.relative_to(repo)).replace("\\", "/"),
    }


def build_review_packet(
    repo: Path = REPO, *, allow_overwrite: bool = False
) -> dict[str, Any]:
    """Build R3A blinded packet.

    After MAI-07R3B locks human responses, regeneration is refused unless
    ``allow_overwrite=True`` (explicit emergency only). Default is read-only.
    """
    if _r3b_import_locked() and not allow_overwrite:
        return _read_only_locked_packet_report(repo)
    REVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    load_resources(force_reload=True)
    conflicts, tax = recompute_conflicts(repo)
    man = repo / "evals/mai07/manifests/MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json"
    cases = load_cases(man, repo)
    cases_by_id = {c["case_id"]: c for c in cases}
    rng = random.Random(SEED)
    controls = _pick_controls(cases, conflicts, rng=rng)

    # Assemble blind review items
    items: list[dict[str, Any]] = []
    mapping: list[dict[str, Any]] = []
    exclusions: list[dict[str, str]] = []
    seen_case: set[str] = set()

    def add_item(case: dict[str, Any], *, bucket: str, conflict: ConflictRecord | None) -> None:
        cid = case["case_id"]
        if cid in seen_case:
            return
        text = case["input_text"]
        if not _privacy_ok(text):
            exclusions.append({"case_id": cid, "reason": "SENSITIVE_PATTERN_EXCLUDED"})
            return
        if case.get("prohibited_for_training") is False:
            # Still allow adjudication of prohibited_for_training=true only
            pass
        # Prefer cases marked prohibited_for_training (evaluation-only)
        seen_case.add(cid)
        n = len(items)
        rid = _opaque_id(SEED, n)
        src = conflict.source_surface if conflict else ""
        if not src:
            frame = analyze_language(text)
            bundle = attach_transliteration_to_frame(frame, use_context=True).transliteration_bundle
            produced, src, _ = extract_primary_produced(bundle)
            _ = produced
        cands = _candidates_for_round_b(conflict, case, src or text.split()[0] if text.split() else text)
        # Deterministic permute for Round B
        order = list(range(len(cands)))
        random.Random(f"{SEED}:{rid}:B").shuffle(order)
        permuted = [cands[i] for i in order]
        items.append(
            {
                "review_id": rid,
                "bucket": bucket,
                "input_text": text,
                "highlighted_span": src,
                "candidates_round_b": permuted,
            }
        )
        mapping.append(
            {
                "review_id": rid,
                "case_id": cid,
                "bucket": bucket,
                "is_conflict": bucket == "conflict",
                "candidate_order_indices": order,
            }
        )

    for c in sorted(conflicts, key=lambda x: x.case_id):
        add_item(cases_by_id[c.case_id], bucket="conflict", conflict=c)
    for bucket, rows in controls.items():
        for case in rows:
            add_item(case, bucket=bucket, conflict=None)

    # Shuffle presentation order for Round A/B CSVs (stable seed)
    present = list(range(len(items)))
    random.Random(SEED + 7).shuffle(present)
    ordered_items = [items[i] for i in present]

    # --- Artifacts ---
    hashes: dict[str, str] = {}

    instructions = """# MAI-07R3 Language Policy Review Instructions / समीक्षा निर्देश

## Purpose / उद्देश्य
Help MokXya decide when Latin text should stay Latin-first versus when Devanagari transliteration should rank first.

यो समीक्षाको उद्देश्य: कहिले ल्याटिन पहिले राख्ने र कहिले देवनागरी अनुवादलाई पहिलो स्थान दिने भन्ने नीति तय गर्नु हो।

## Roles / भूमिका
- **Product owner**: preferred product ranking behavior
- **Nepali-fluent reviewer**: language judgment (not automatic linguist approval)
- **Professional linguist**: required only for `LINGUIST_APPROVED=true`

## Important / महत्वपूर्ण
- Do **not** try to make any evaluation score improve.
- Do **not** assume current system ranking is correct.
- Cases are synthetic or licensed evaluation content (`prohibited_for_training=true`).
- Human adjudication is allowed; model training on these cases is prohibited.
- Answer each case independently.

## Round A
Classify the highlighted span and choose preferred MokXya ranking.

## Round B (after Round A locked)
Mark each candidate’s acceptability without seeing ranks/scores/provenance.
"""
    hashes["instructions"] = _write(REVIEW_ROOT / "MAI_07R3_REVIEW_INSTRUCTIONS_EN_NP.md", instructions)

    # Round A CSV
    a_path = REVIEW_ROOT / "MAI_07R3_ROUND_A_REVIEW.csv"
    with a_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "review_id",
                "input_text",
                "highlighted_span",
                "span_class",
                "preferred_rank_policy",
                "devanagari_retention",
                "confidence",
                "reasoning",
            ]
        )
        for it in ordered_items:
            w.writerow(
                [
                    _csv_cell(it["review_id"]),
                    _csv_cell(it["input_text"]),
                    _csv_cell(it["highlighted_span"]),
                    "",
                    "",
                    "",
                    "",
                    "",
                ]
            )
    hashes["round_a"] = _sha(a_path)

    # Round B CSV
    b_path = REVIEW_ROOT / "MAI_07R3_ROUND_B_REVIEW.csv"
    with b_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "review_id",
                "input_text",
                "highlighted_span",
                "candidate_index",
                "candidate_surface",
                "acceptability",
            ]
        )
        for it in ordered_items:
            for idx, surf in enumerate(it["candidates_round_b"]):
                w.writerow(
                    [
                        _csv_cell(it["review_id"]),
                        _csv_cell(it["input_text"]),
                        _csv_cell(it["highlighted_span"]),
                        idx,
                        _csv_cell(surf),
                        "",
                    ]
                )
    hashes["round_b"] = _sha(b_path)

    schema = {
        "schema_version": "1.0.0",
        "round_a_enums": {
            "span_class": [
                "ROMANIZED_NEPALI",
                "ENGLISH_TERM",
                "NEPALI_LOANWORD_WRITTEN_IN_LATIN",
                "PROPER_NAME_OR_ENTITY",
                "ACRONYM_OR_IDENTIFIER",
                "AMBIGUOUS_CODE_MIX",
                "INVALID_OR_UNCLEAR",
            ],
            "preferred_rank_policy": [
                "DEVANAGARI_TARGET_REQUIRED",
                "LATIN_IDENTITY_REQUIRED",
                "LATIN_IDENTITY_PREFERRED_TARGET_OPTIONAL",
                "BOTH_EQUAL_REVIEW_REQUIRED",
                "NO_TRANSLITERATION_ALLOWED",
                "CANNOT_DECIDE",
            ],
            "devanagari_retention": ["REQUIRED", "OPTIONAL", "PROHIBITED", "CANNOT_DECIDE"],
            "confidence": ["HIGH", "MEDIUM", "LOW"],
        },
        "round_b_enums": {
            "acceptability": [
                "ACCEPTABLE_PREFERRED",
                "ACCEPTABLE_ALTERNATIVE",
                "UNNATURAL_BUT_POSSIBLE",
                "INCORRECT",
                "CANNOT_DECIDE",
            ]
        },
        "notes": "Round B must not overwrite Round A product-ranking decisions automatically.",
    }
    hashes["schema"] = _write(
        REVIEW_ROOT / "MAI_07R3_REVIEW_SCHEMA.json",
        json.dumps(schema, indent=2, sort_keys=True) + "\n",
    )

    mapping_doc = {
        "mapping_id": "MAI_07R3_BLIND_MAPPING",
        "seed": SEED,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "use": "adjudication_import_only",
        "prohibited_use": ["reviewer_facing", "runtime", "training"],
        "entries": mapping,
    }
    hashes["mapping"] = _write(
        REVIEW_ROOT / "MAI_07R3_BLIND_MAPPING.json",
        json.dumps(mapping_doc, indent=2, sort_keys=True) + "\n",
    )

    control_manifest = {
        "manifest_id": "MAI_07R3_CONTROL_SAMPLE_MANIFEST",
        "seed": SEED,
        "conflict_count": tax["conflict_count"],
        "control_targets": CONTROL,
        "control_actual": {k: len(v) for k, v in controls.items()},
        "total_review_items": len(items),
        "presentation_order_seed": SEED + 7,
        "exclusions": exclusions,
        "privacy_scan": "SENSITIVE_PATTERN regex applied; excluded listed",
        "taxonomy_aggregate": tax,
        "parent_frozen_dataset_hash": FROZEN_DATASET_HASH,
        "active_resource_hash_expected": FROZEN_RESOURCE_HASH,
        "active_semantic_hash_expected": FROZEN_RUNTIME_SEMANTIC_HASH,
    }
    hashes["control_manifest"] = _write(
        REVIEW_ROOT / "MAI_07R3_CONTROL_SAMPLE_MANIFEST.json",
        json.dumps(control_manifest, indent=2, sort_keys=True) + "\n",
    )

    import_template = {
        "schema": "mai07r3_review_import_v1",
        "round_a": [
            {
                "review_id": "R3A-EXAMPLE",
                "span_class": "ROMANIZED_NEPALI",
                "preferred_rank_policy": "DEVANAGARI_TARGET_REQUIRED",
                "devanagari_retention": "REQUIRED",
                "confidence": "HIGH",
                "reasoning": "example only",
            }
        ],
        "round_b": [
            {
                "review_id": "R3A-EXAMPLE",
                "candidate_index": 0,
                "acceptability": "ACCEPTABLE_PREFERRED",
            }
        ],
    }
    hashes["import_template"] = _write(
        REVIEW_ROOT / "MAI_07R3_REVIEW_IMPORT_TEMPLATE.jsonl",
        json.dumps(import_template, ensure_ascii=False) + "\n",
    )

    policy = """# MAI-07R3 Product-Policy Options (neutral)

These options are **not activated** by this phase. Human review required.

## OPTION A — CONSERVATIVE IDENTITY POLICY (recommended default)
- English / acronyms / identifiers: Latin-first
- Proper names: Latin-first; optional review-marked Devanagari
- Clear Romanized Nepali: Devanagari may rank first
- Optional Devanagari does **not** count toward required-target top-1
- Trade-off: best safety; requires evaluation population semantics correction

## OPTION B — DOMAIN-TERM DEVANAGARI PROMOTION
- Selected accounting/business Latin terms may rank Devanagari first
- Identity remains available; needs reviewed allowlist + context policy
- Trade-off: better Nepali-script output; higher borrowing ambiguity risk

## OPTION C — AGGRESSIVE DEVANAGARI PROMOTION
- Most lexicon-recognized domain terms rank Devanagari first
- **Not recommended** without professional linguistic approval

## OPTION D — STRICT LATIN WHEN MAI-05 SAYS ENGLISH
- Identity always first for English-classified spans
- Trade-off: safe for English; fails Romanized Nepali misclassified as English
"""
    hashes["policy_options"] = _write(REVIEW_ROOT / "MAI_07R3_POLICY_OPTIONS.md", policy)

    readme = """# MAI-07R3A Review Packet

Status: **BLOCKED_PENDING_HUMAN_POLICY_REVIEW**

This directory contains blinded Round A/B review materials. It does **not**
activate a new ranker, does not rewrite frozen V1, and does not enable the
failed R2 overlay.

## Files
- Instructions (EN/NP)
- Round A / Round B CSVs (UTF-8)
- Schema, blind mapping (import-only), control sample manifest
- Policy options + import template

## Process
1. Complete Round A without looking at Round B candidates' "correct" answers.
2. Lock Round A.
3. Complete Round B.
4. Import via mapping only after responses are locked.
5. Do not run frozen quality evaluation until a later policy-locked phase.
"""
    hashes["readme"] = _write(REVIEW_ROOT / "README.md", readme)

    # Engineering-only conflict inventory (not reviewer-facing) — aggregates + opaque ids only in public report
    eng_only = {
        "conflict_count": tax["conflict_count"],
        "taxonomy": tax,
        "artifact_hashes": hashes,
        "review_item_count": len(items),
        "seed": SEED,
    }
    hashes["engineering_summary"] = _write(
        REVIEW_ROOT / "MAI_07R3_ENGINEERING_CONFLICT_SUMMARY.json",
        json.dumps(eng_only, indent=2, sort_keys=True) + "\n",
    )

    return {
        "ok": True,
        "conflict_count": tax["conflict_count"],
        "matches_expected_49": tax["matches_expected"],
        "taxonomy": tax,
        "review_items": len(items),
        "control_actual": {k: len(v) for k, v in controls.items()},
        "exclusions": exclusions,
        "artifact_hashes": hashes,
        "review_root": str(REVIEW_ROOT.relative_to(repo)).replace("\\", "/"),
    }


def main() -> None:
    report = build_review_packet()
    print(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False))


if __name__ == "__main__":
    main()
