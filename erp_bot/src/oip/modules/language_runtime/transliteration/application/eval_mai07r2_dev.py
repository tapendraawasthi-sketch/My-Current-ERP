"""Evaluate MAI-07R2 overlay development / holdout / safety splits."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .. import MAX_CANDIDATES_PER_SPAN
from ..infrastructure.deterministic_generator import DeterministicCandidateGenerator
from ..infrastructure.deterministic_ranker import DeterministicCandidateRanker
from ..infrastructure.resource_repository import load_resources
from ..infrastructure.target_promotion_overlay import OverlayDecision, TargetPromotionOverlay
from .build_mai07r2_ranker_dev import _neighbors, base_rank_primary_span
from .eval_candidate_types import contains_devanagari
from .eval_c2_helpers import extract_primary_produced, produced_views_from_span
from .eval_scoring import score_target_case
from .transliteration_service import attach_transliteration_to_frame


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def _source_surface(case: dict[str, Any], bundle_src: str) -> str:
    first_token = case["input_text"].split()[0] if case["input_text"].strip() else case["input_text"]
    source_surface = bundle_src.strip() if bundle_src and bundle_src.strip() else first_token
    if " " in case["input_text"].strip() and source_surface != first_token:
        source_surface = first_token
    return source_surface


def _overlay_rank_primary(
    input_text: str,
) -> tuple[list[Any], OverlayDecision, tuple[str, ...], str | None]:
    res = load_resources(force_reload=True)
    gen = DeterministicCandidateGenerator(res)
    ranker = DeterministicCandidateRanker(res)
    overlay = TargetPromotionOverlay(res)
    frame = analyze_language(input_text)
    for idx, ann in enumerate(frame.span_annotations):
        surface = ann.original_text
        if not surface.strip():
            continue
        form = ann.language_form
        prefer_identity = surface.lower() in res.english_identity
        name_like = surface.lower() in res.name_like
        is_prot = bool(ann.protected_reason)
        generated = gen.generate(
            surface,
            language_form=form,
            neighbors=_neighbors(frame, idx),
            use_context=True,
            name_like=name_like,
        )
        ranked_base = ranker.rank(
            generated,
            surface=surface,
            language_form=form,
            neighbors=_neighbors(frame, idx),
            use_context=True,
            prefer_identity=prefer_identity,
            name_like=name_like,
            max_candidates=MAX_CANDIDATES_PER_SPAN,
        )
        ranked, decision, reasons = overlay.apply(
            ranked_base,
            surface=surface,
            language_form=form,
            neighbors=_neighbors(frame, idx),
            name_like=name_like,
            prefer_identity=prefer_identity,
            is_protected=is_prot,
        )
        return ranked, decision, reasons, None
    return [], OverlayDecision.ABSTAIN_FROM_PROMOTION, ("BLOCK_NO_CANDIDATES",), "empty_candidate_list"


def evaluate_ranker_r2_split(cases: list[dict[str, Any]]) -> dict[str, Any]:
    target_cases = [c for c in cases if c.get("acceptable_target_candidates")]
    t1 = r5 = base_t1 = 0
    mrr = base_mrr = 0.0
    eng_n = eng_h = 0
    name_n = name_h = 0
    prot_n = prot_h = 0
    forced = 0
    false_dev_eng = false_dev_eng_n = 0

    promo_ops = promo_done = promo_correct = promo_harm = 0
    id_first_stratum = id_first_lift = 0

    for c in target_cases:
        frame = analyze_language(c["input_text"])
        bundle = attach_transliteration_to_frame(frame, use_context=True).transliteration_bundle
        assert bundle is not None
        produced, src, err = extract_primary_produced(bundle)
        source_surface = _source_surface(c, src)
        scored = score_target_case(
            case_id=c["case_id"],
            produced=produced,
            acceptable_target_candidates=c["acceptable_target_candidates"],
            source_surface=source_surface,
            preferred_target=c.get("preferred_target_candidate"),
            structural_error=err,
        )
        t1 += int(scored.top1_hit)
        r5 += int(scored.recall_at_5)
        mrr += scored.reciprocal_rank_num / scored.reciprocal_rank_den

        base_ranked, _bs, _be = base_rank_primary_span(c["input_text"])
        base_views, _ = produced_views_from_span(
            type("Sp", (), {"candidates": base_ranked})()
        )
        base_scored = score_target_case(
            case_id=c["case_id"],
            produced=base_views,
            acceptable_target_candidates=c["acceptable_target_candidates"],
            source_surface=source_surface,
            preferred_target=c.get("preferred_target_candidate"),
        )
        base_t1 += int(base_scored.top1_hit)
        base_mrr += base_scored.reciprocal_rank_num / base_scored.reciprocal_rank_den

        ov_ranked, decision, _reasons, _ = _overlay_rank_primary(c["input_text"])
        if base_ranked and ov_ranked:
            base_top_id = base_ranked[0].candidate_id
            ov_top_id = ov_ranked[0].candidate_id
            base_id_first = base_ranked[0].is_identity
            has_eligible = any(
                (not cand.is_identity)
                and contains_devanagari(cand.surface)
                and cand.kind.value not in {"GRAPHEME", "ABSTENTION", "IDENTITY"}
                for cand in base_ranked[1:5]
            )
            if base_id_first and has_eligible:
                promo_ops += 1
            if decision is OverlayDecision.PROMOTE_EXISTING_TARGET and ov_top_id != base_top_id:
                promo_done += 1
                ov_views, _ = produced_views_from_span(type("Sp", (), {"candidates": ov_ranked})())
                ov_scored = score_target_case(
                    case_id=c["case_id"],
                    produced=ov_views,
                    acceptable_target_candidates=c["acceptable_target_candidates"],
                    source_surface=source_surface,
                    preferred_target=c.get("preferred_target_candidate"),
                )
                if ov_scored.top1_hit:
                    promo_correct += 1
                elif base_scored.top1_hit:
                    promo_harm += 1
                else:
                    promo_harm += 1

        if c.get("identity_first_target_behind_base"):
            id_first_stratum += 1
            if scored.top1_hit and not base_scored.top1_hit:
                id_first_lift += 1

    for c in cases:
        cat = c.get("category", "")
        frame = analyze_language(c["input_text"])
        bundle = attach_transliteration_to_frame(frame, use_context=True).transliteration_bundle
        assert bundle is not None
        if cat == "english_identity" or (
            c.get("identity_expected_top1") and cat in {"english_identity", "acronym", "acronym_pad"}
        ):
            eng_n += 1
            false_dev_eng_n += 1
            ok = False
            for sp in bundle.span_results:
                if not sp.candidates:
                    continue
                if sp.candidates[0].is_identity:
                    ok = True
                if (
                    not sp.candidates[0].is_identity
                    and contains_devanagari(sp.candidates[0].surface)
                ):
                    false_dev_eng += 1
                    break
            if ok:
                eng_h += 1
        if cat == "name_like":
            name_n += 1
            if any(sp.candidates and sp.candidates[0].is_identity for sp in bundle.span_results):
                name_h += 1
            for sp in bundle.span_results:
                if (
                    sp.candidates
                    and not sp.candidates[0].is_identity
                    and not sp.candidates[0].requires_review
                ):
                    forced += 1
        if cat.startswith("protected") or cat == "protected_or_identifier":
            prot_n += 1
            if any(sp.candidates and sp.candidates[0].is_identity for sp in bundle.span_results):
                prot_h += 1

    n = len(target_cases)
    return {
        "total_cases": len(cases),
        "target_population_n": n,
        "target_top1": (t1 / n) if n else 1.0,
        "target_top1_counts": f"{t1}/{n}",
        "target_recall_at_5": (r5 / n) if n else 1.0,
        "target_mrr": (mrr / n) if n else 1.0,
        "base_target_top1": (base_t1 / n) if n else 1.0,
        "base_target_top1_counts": f"{base_t1}/{n}",
        "base_target_mrr": (base_mrr / n) if n else 1.0,
        "overlay_lift_top1": ((t1 - base_t1) / n) if n else 0.0,
        "promotion_opportunities": promo_ops,
        "promotions_applied": promo_done,
        "promotion_coverage": (promo_done / promo_ops) if promo_ops else 0.0,
        "promotion_precision": (promo_correct / promo_done) if promo_done else 0.0,
        "promotion_harm_count": promo_harm,
        "promotion_harm_rate": (promo_harm / promo_done) if promo_done else 0.0,
        "identity_first_stratum_n": id_first_stratum,
        "identity_first_stratum_lift_n": id_first_lift,
        "identity_first_stratum_lift_rate": (id_first_lift / id_first_stratum)
        if id_first_stratum
        else 0.0,
        "english_identity_top1": (eng_h / eng_n) if eng_n else 1.0,
        "english_identity_counts": f"{eng_h}/{eng_n}",
        "false_devanagari_preference_on_english": (false_dev_eng / false_dev_eng_n)
        if false_dev_eng_n
        else 0.0,
        "name_identity_top1": (name_h / name_n) if name_n else 1.0,
        "protected_identity_accuracy": (prot_h / prot_n) if prot_n else 1.0,
        "proper_name_forced_transliteration_count": forced,
    }


def main() -> None:
    repo = Path(__file__).resolve().parents[7]
    man = json.loads(
        (repo / "evals/mai07_ranker_r2/manifests/MAI_07R2_RANKER_DEV_V1.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    results = {}
    for split, meta in man["splits"].items():
        cases = load_jsonl(repo / meta["path"])
        results[split] = evaluate_ranker_r2_split(cases)
    out = repo / "evals" / "mai07_ranker_r2" / "baselines" / "MAI_07R2_dev_holdout_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(results, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(results, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
