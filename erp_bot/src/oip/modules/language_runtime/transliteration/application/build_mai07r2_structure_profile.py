"""Aggregate frozen MAI-07 structure histograms (no text / IDs / surfaces)."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from ...application.language_analyzer import analyze_language
from ..infrastructure.resource_repository import load_resources
from .eval_mai07 import load_cases
from .transliteration_service import attach_transliteration_to_frame

REPO = Path(__file__).resolve().parents[7]
OUT = REPO / "evals" / "mai07_ranker_r2" / "profiles" / "MAI_07_FROZEN_STRUCTURE_PROFILE_V1.json"
MANIFEST = REPO / "evals" / "mai07" / "manifests" / "MAI_07_ROMANIZED_TRANSLITERATION_V1.manifest.json"


def _inc(counter: Counter[str], key: str, n: int = 1) -> None:
    counter[str(key)] += n


def _bucket_token_count(n: int) -> str:
    if n <= 1:
        return "1"
    if n == 2:
        return "2"
    if n <= 4:
        return "3-4"
    if n <= 6:
        return "5-6"
    return "7+"


def _bucket_int(n: int) -> str:
    if n == 0:
        return "0"
    if n == 1:
        return "1"
    if n <= 3:
        return "2-3"
    if n <= 5:
        return "4-5"
    return "6+"


def build_profile() -> dict[str, Any]:
    cases = load_cases(MANIFEST, REPO)
    res = load_resources(force_reload=True)

    suite_hist: Counter[str] = Counter()
    token_count_hist: Counter[str] = Counter()
    language_form_hist: Counter[str] = Counter()
    span_count_hist: Counter[str] = Counter()
    eligibility_hist: Counter[str] = Counter()
    span_candidate_count_hist: Counter[str] = Counter()
    case_candidate_total_hist: Counter[str] = Counter()
    eligible_span_per_case_hist: Counter[str] = Counter()
    protected_span_hist: Counter[str] = Counter()
    name_like_span_hist: Counter[str] = Counter()
    ambiguous_span_hist: Counter[str] = Counter()
    flag_hist: Counter[str] = Counter()

    for case in cases:
        suite = case.get("suite_id", "unknown")
        _inc(suite_hist, suite)
        text = case.get("input_text", "")
        tokens = [t for t in text.split() if t.strip()]
        _inc(token_count_hist, _bucket_token_count(len(tokens)))

        if case.get("context_challenge"):
            _inc(flag_hist, "context_challenge")
        if case.get("abstention_expected"):
            _inc(flag_hist, "abstention_expected")
        if case.get("identity_expected"):
            _inc(flag_hist, "identity_expected")
        if case.get("protected_spans"):
            _inc(flag_hist, "has_protected_spans")

        frame = analyze_language(text)
        for ann in frame.span_annotations:
            _inc(language_form_hist, ann.language_form)

        bundle = attach_transliteration_to_frame(frame, use_context=True).transliteration_bundle
        if bundle is None:
            continue

        span_n = len(bundle.span_results)
        _inc(span_count_hist, _bucket_int(span_n))
        _inc(eligible_span_per_case_hist, _bucket_int(bundle.eligible_span_count))
        _inc(case_candidate_total_hist, _bucket_int(bundle.candidate_count))

        for sp in bundle.span_results:
            _inc(eligibility_hist, sp.eligibility.value if hasattr(sp.eligibility, "value") else str(sp.eligibility))
            _inc(span_candidate_count_hist, _bucket_int(len(sp.candidates)))
            if sp.is_protected:
                _inc(protected_span_hist, "protected")
            else:
                _inc(protected_span_hist, "not_protected")
            if sp.is_name_like:
                _inc(name_like_span_hist, "name_like")
            else:
                _inc(name_like_span_hist, "not_name_like")
            if sp.is_ambiguous:
                _inc(ambiguous_span_hist, "ambiguous")
            else:
                _inc(ambiguous_span_hist, "not_ambiguous")

    return {
        "profile_id": "MAI_07_FROZEN_STRUCTURE_PROFILE_V1",
        "source_manifest_id": "MAI_07_ROMANIZED_TRANSLITERATION_V1",
        "source_dataset_hash": json.loads(MANIFEST.read_text(encoding="utf-8")).get("dataset_hash"),
        "case_count": len(cases),
        "resource_pack_version": res.version,
        "resource_content_hash": res.content_hash,
        "histograms": {
            "suite_id": dict(sorted(suite_hist.items())),
            "input_token_count_bucket": dict(sorted(token_count_hist.items())),
            "span_language_form": dict(sorted(language_form_hist.items())),
            "case_span_count_bucket": dict(sorted(span_count_hist.items())),
            "case_eligible_span_count_bucket": dict(sorted(eligible_span_per_case_hist.items())),
            "case_total_candidate_count_bucket": dict(sorted(case_candidate_total_hist.items())),
            "span_eligibility_decision": dict(sorted(eligibility_hist.items())),
            "span_candidate_count_bucket": dict(sorted(span_candidate_count_hist.items())),
            "span_protected_flag": dict(sorted(protected_span_hist.items())),
            "span_name_like_flag": dict(sorted(name_like_span_hist.items())),
            "span_ambiguous_flag": dict(sorted(ambiguous_span_hist.items())),
            "case_boolean_flags": dict(sorted(flag_hist.items())),
        },
        "privacy": {
            "contains_input_text": False,
            "contains_case_ids": False,
            "contains_candidate_surfaces": False,
        },
    }


def main() -> None:
    profile = build_profile()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(profile, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": True,
                "path": str(OUT.relative_to(REPO)).replace("\\", "/"),
                "case_count": profile["case_count"],
                "resource_content_hash": profile["resource_content_hash"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
