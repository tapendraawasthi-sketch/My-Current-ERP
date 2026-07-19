"""MAI-08 slice 1 — candidate-only typo/code-mix + slot-family gold stability."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from oip.modules.language_runtime.application.language_analyzer import analyze_language
from oip.modules.language_runtime.normalization.application.normalization_service import (
    attach_normalization_to_frame,
)
from oip.modules.language_runtime.typo_robustness import RUNTIME_VERSION
from oip.modules.language_runtime.typo_robustness.application.typo_code_mix_service import (
    attach_typo_code_mix_to_frame,
    build_typo_code_mix_bundle,
)
from oip.contracts.common import SourceSpanV1
from oip.contracts.language import LanguageFrameV1
from oip.contracts.typo_code_mix import TypoCodeMixCandidateKind

REPO = Path(__file__).resolve().parents[4]
EVALS = REPO / "evals" / "mai08" / "frozen"


def _load_jsonl(name: str) -> list[dict]:
    path = EVALS / name
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def test_runtime_version_and_candidates_never_applied():
    frame = analyze_language("ram lai qty 5 kg chammall bechyo amt 500")
    frame = attach_normalization_to_frame(frame)
    updated = attach_typo_code_mix_to_frame(frame)
    assert updated.raw_text == frame.raw_text
    bundle = updated.typo_code_mix_bundle
    assert bundle is not None
    assert bundle.runtime_version == RUNTIME_VERSION == "mai-08.0.1-slice1"
    assert bundle.silent_applications == 0
    assert bundle.candidate_count == len(bundle.candidates)
    assert all(not c.applied for c in bundle.candidates)
    kinds = {c.kind for c in bundle.candidates}
    assert TypoCodeMixCandidateKind.ABBREVIATION_EXPAND in kinds
    assert TypoCodeMixCandidateKind.TYPO_VARIANT in kinds
    assert updated.analyzer_versions.get("typo_code_mix") == RUNTIME_VERSION


def test_protected_spans_skip_candidates():
    raw = "INV-12345 qty 2"
    # Protect the whole invoice token region if present as identifier-like span
    frame = LanguageFrameV1.not_run(raw)
    # Protect "qty" so abbreviation candidate must not fire on it
    qty_start = raw.index("qty")
    frame = frame.model_copy(
        update={
            "protected_spans": (
                SourceSpanV1(
                    start_offset=qty_start,
                    end_offset=qty_start + 3,
                    original_text="qty",
                ),
            )
        }
    )
    bundle = build_typo_code_mix_bundle(raw, language_frame=frame)
    for c in bundle.candidates:
        if c.kind == TypoCodeMixCandidateKind.ABBREVIATION_EXPAND:
            assert c.original_surface.lower() != "qty"


def test_code_mix_feature_attached():
    frame = analyze_language("राम lai 5 kg चामल bechyo 500")
    updated = attach_typo_code_mix_to_frame(frame)
    bundle = updated.typo_code_mix_bundle
    assert bundle is not None
    assert "code_mix_pattern" in bundle.code_mix_features
    assert any(c.kind == TypoCodeMixCandidateKind.CODE_MIX_FEATURE for c in bundle.candidates)


def test_slot_stable_code_mix_family_gold():
    rows = _load_jsonl("slot_stable_code_mix_v1.jsonl")
    by_family: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_family[row["family_id"]].append(row)
    stable = 0
    total = 0
    for family_id, members in by_family.items():
        total += 1
        intents = {m["gold_slots"]["intent"] for m in members}
        amounts = {m["gold_slots"].get("amount") for m in members}
        qtys = {m["gold_slots"].get("quantity") for m in members if "quantity" in m["gold_slots"]}
        # Family gold core slots must agree (surfaces may differ by script/lang)
        if len(intents) == 1 and len(amounts) == 1 and (not qtys or len(qtys) == 1):
            stable += 1
        # Bundle attach must not mutate raw for every variant
        for m in members:
            f = attach_typo_code_mix_to_frame(analyze_language(m["raw_text"]))
            assert f.raw_text == m["raw_text"]
            assert f.typo_code_mix_bundle and f.typo_code_mix_bundle.silent_applications == 0
    assert total > 0
    assert stable / total >= 0.95


def test_slot_stable_typo_abbr_family_gold():
    rows = _load_jsonl("slot_stable_typo_abbr_v1.jsonl")
    by_family: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_family[row["family_id"]].append(row)
    stable = 0
    total = 0
    for _family_id, members in by_family.items():
        total += 1
        intents = {m["gold_slots"]["intent"] for m in members}
        amounts = {m["gold_slots"].get("amount") for m in members}
        if len(intents) == 1 and len(amounts) == 1:
            stable += 1
        for m in members:
            f = attach_typo_code_mix_to_frame(analyze_language(m["raw_text"]))
            assert f.raw_text == m["raw_text"]
            assert f.typo_code_mix_bundle.silent_applications == 0
    assert total > 0
    assert stable / total >= 0.95


def test_manifest_exists():
    manifest = REPO / "evals" / "mai08" / "manifests" / "MAI_08_SLICE1.manifest.json"
    data = json.loads(manifest.read_text(encoding="utf-8"))
    assert data["runtime_version"] == "mai-08.0.1-slice1"
    assert len(data["files"]) == 4
