"""MAI-07R3D monotonic differential vs pre-R1 ranker path (non-frozen cases only)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .eval_mai07_r3d import extract_for_case, load_split
from .transliteration_service import attach_transliteration_to_frame
from ..infrastructure.deterministic_generator import DeterministicCandidateGenerator
from ..infrastructure.deterministic_ranker_prer1 import DeterministicCandidateRanker as Prer1Ranker
from ..infrastructure.resource_repository import load_resources
from .. import MAX_CANDIDATES_PER_SPAN

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_r3d_corrective" / "reports"


def _prer1_primary(text: str, case: dict[str, Any]) -> list[dict[str, Any]]:
    """Approximate pre-R1 ranking on the primary token using historical ranker + current generator."""
    res = load_resources()
    frame = analyze_language(text)
    primary = (case.get("primary_token") or text.split()[0]).lower()
    gen = DeterministicCandidateGenerator(res)
    ranker = Prer1Ranker(res)
    for ann in frame.span_annotations:
        if ann.original_text.lower() != primary:
            continue
        form = ann.language_form
        name_like = form == "NAMED_ENTITY_CANDIDATE" or ann.original_text.lower() in res.name_like
        prefer_identity = ann.original_text.lower() in res.english_identity
        generated = gen.generate(
            ann.original_text,
            language_form=form,
            neighbors=(),
            use_context=True,
            name_like=name_like,
        )
        ranked = ranker.rank(
            generated,
            surface=ann.original_text,
            language_form=form,
            prefer_identity=prefer_identity,
            name_like=name_like,
            max_candidates=MAX_CANDIDATES_PER_SPAN,
        )
        return [
            {"surface": c.surface, "is_identity": c.is_identity, "rank": c.rank}
            for c in ranked
        ]
    return []


def run_differential(split: str = "DEVELOPMENT") -> dict[str, Any]:
    cases = load_split(split)
    promotions = 0
    demotions = 0
    protected_harm = 0
    english_harm = 0
    target_harm = 0
    records: list[dict[str, Any]] = []

    for case in cases:
        text = case["input_text"]
        frame = analyze_language(text)
        r3d_bundle = attach_transliteration_to_frame(frame, use_context=True).transliteration_bundle
        assert r3d_bundle is not None
        r3d_views, source, _ = extract_for_case(r3d_bundle, case)
        prer1 = _prer1_primary(text, case)
        r3d = [{"surface": v.surface, "is_identity": v.is_identity, "rank": v.rank} for v in r3d_views]
        targets = set(case.get("acceptable_devanagari_targets") or [])
        res = load_resources()
        primary = (case.get("primary_token") or text.split()[0]).lower()
        eng_anchor = primary in res.english_identity or bool(case.get("identity_expected"))

        prer1_top_id = bool(prer1 and prer1[0].get("is_identity"))
        r3d_top_id = bool(r3d and r3d[0].get("is_identity"))
        prer1_target_top = any((not x["is_identity"]) and x["surface"] in targets for x in prer1[:1]) if targets else False
        r3d_target_top = any((not x["is_identity"]) and x["surface"] in targets for x in r3d[:1]) if targets else False
        prer1_target_r5 = any((not x["is_identity"]) and x["surface"] in targets for x in prer1[:5]) if targets else False
        r3d_target_r5 = any((not x["is_identity"]) and x["surface"] in targets for x in r3d[:5]) if targets else False

        kind = case.get("suite_kind", "")
        harm = False
        if kind.startswith("protected"):
            # Protected must remain identity/code-point intact under R3D
            if r3d and (not r3d[0]["is_identity"] or r3d[0]["surface"] != source):
                protected_harm += 1
                harm = True
        if kind in {"english_identity", "english_accounting", "acronym"} and prer1_top_id and not r3d_top_id:
            english_harm += 1
            harm = True
        # Option A: confirmed English identity surfaces must not be counted as target demotions
        # when R3D correctly forces identity-only.
        if targets and not eng_anchor:
            if prer1_target_top and not r3d_target_top:
                target_harm += 1
                demotions += 1
                harm = True
            elif prer1_target_r5 and not r3d_target_r5:
                target_harm += 1
                demotions += 1
                harm = True
            if (not prer1_target_top) and r3d_target_top:
                promotions += 1
        if kind in {"proper_name"} and prer1_top_id and not r3d_top_id:
            english_harm += 1  # counted as name identity harm under english_harm bucket
            harm = True

        if harm or promotions or demotions:
            records.append(
                {
                    "case_id": case["case_id"],
                    "suite_kind": kind,
                    "harm": harm,
                    "prer1_top_identity": prer1_top_id,
                    "r3d_top_identity": r3d_top_id,
                    "prer1_target_top1": prer1_target_top,
                    "r3d_target_top1": r3d_target_top,
                }
            )

    harm_count = protected_harm + english_harm + target_harm
    report = {
        "split": split,
        "promotions": promotions,
        "demotions": demotions,
        "protected_harm": protected_harm,
        "english_or_name_identity_harm": english_harm,
        "correct_target_harm": target_harm,
        "harm_count": harm_count,
        "sample_records_sanitized": records[:20],
        "note": "No frozen V2 case text; non-frozen corrective cases only.",
    }
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"MAI_07R3D_{split}_DIFFERENTIAL.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report


def main() -> int:
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--split", default="DEVELOPMENT")
    args = p.parse_args()
    print(json.dumps(run_differential(args.split), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
