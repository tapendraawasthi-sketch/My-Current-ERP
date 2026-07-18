"""Evaluate MAI-07R1 corrective development / holdout / safety splits."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from .eval_candidate_types import contains_devanagari
from .eval_c2_helpers import extract_primary_produced
from .eval_scoring import score_target_case
from .transliteration_service import attach_transliteration_to_frame


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def evaluate_ranker_dev_split(cases: list[dict[str, Any]]) -> dict[str, Any]:
    target_cases = [c for c in cases if c.get("acceptable_target_candidates")]
    t1 = r5 = 0
    mrr = 0.0
    eng_n = eng_h = 0
    name_n = name_h = 0
    prot_n = prot_h = 0
    forced = 0
    false_dev_eng = 0
    false_dev_eng_n = 0

    for c in target_cases:
        frame = analyze_language(c["input_text"])
        bundle = attach_transliteration_to_frame(frame, use_context=True).transliteration_bundle
        assert bundle is not None
        produced, src, err = extract_primary_produced(bundle)
        # Multiword inputs: score the first content span (primary), matching first-token target design.
        first_token = c["input_text"].split()[0] if c["input_text"].strip() else c["input_text"]
        source_surface = src.strip() if src and src.strip() else first_token
        if " " in c["input_text"].strip() and source_surface != first_token:
            source_surface = first_token
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
        (repo / "evals/mai07_ranker_dev/manifests/MAI_07R1_RANKER_DEV_V1.manifest.json").read_text(
            encoding="utf-8"
        )
    )
    results = {}
    for split, meta in man["splits"].items():
        cases = load_jsonl(repo / meta["path"])
        results[split] = evaluate_ranker_dev_split(cases)
    out = repo / "evals/mai07_ranker_dev/baselines" / "MAI_07R1_dev_holdout_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(results, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(results, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
