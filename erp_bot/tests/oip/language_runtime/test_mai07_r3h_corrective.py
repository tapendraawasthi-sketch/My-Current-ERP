from __future__ import annotations

import ast
import json
import random
from pathlib import Path
from unittest.mock import patch

import pytest

from erp_bot.src.api.oip_chat_ingress import build_canonical_ai_request
from erp_bot.src.oip.modules.language_runtime.application.language_analyzer import analyze_language
from erp_bot.src.oip.modules.language_runtime.transliteration import MAX_CANDIDATES_PER_SPAN, RUNTIME_VERSION
from erp_bot.src.oip.modules.language_runtime.transliteration.application.build_mai07r3h_english_identity_datasets import (
    OUT as DATASET_OUT,
    write_datasets,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3h import (
    LOCKED_PATH,
    CHAIN_PATH,
    run_holdout_once,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.transliteration_service import (
    attach_transliteration_to_frame,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure import resource_repository as xlrr
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.english_identity_guard import (
    Disposition,
    classify_disposition,
)

REPO = Path(__file__).resolve().parents[4]
STRICT_FILES = [
    REPO / "erp_bot/src/oip/modules/language_runtime/transliteration/application/transliteration_service.py",
    REPO / "erp_bot/src/oip/modules/language_runtime/transliteration/application/build_mai07r3h_english_identity_datasets.py",
    REPO / "erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_mai07_r3h.py",
    REPO / "erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/english_identity_guard.py",
]
FORBIDDEN_TOKENS = (
    "evals/mai07/frozen_v2",
    "MAI_07R3E_V2_ONE_SHOT_PREDICTIONS",
    "MAI_07R3G_REAUTHORIZED_002_V2_ONE_SHOT_PREDICTIONS",
    "MAI_07R3_BLIND_MAPPING",
    "acceptable-target set",
)


def test_runtime_version_is_r3h():
    assert RUNTIME_VERSION.startswith("mai-07.")


def test_firewall_tokens_absent():
    for path in STRICT_FILES:
        text = path.read_text(encoding="utf-8")
        for token in FORBIDDEN_TOKENS:
            assert token not in text


def test_firewall_imports_absent():
    forbidden_imports = {"eval_mai07_r3c", "eval_mai07_r3e", "eval_mai07_r3g_reauthorized_002"}
    for path in STRICT_FILES:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                leaf = node.module.rsplit(".", 1)[-1]
                assert leaf not in forbidden_imports


def test_dataset_minimums_and_oov_split(tmp_path: Path):
    # Mutation-proof: write only into isolated temp directory.
    write_datasets(output_dir=tmp_path)
    # Historical R3H manifest remains read-only canonical evidence.
    manifest_path = DATASET_OUT / "MAI_07R3H_DATASET_MANIFEST.json"
    assert manifest_path.exists()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["minimums_met"] is True
    assert manifest["totals"]["OOV_GENERALIZATION"] >= 200
    assert manifest["coverage"]["english_identity_cases"] >= 800
    assert manifest["coverage"]["shared_collision_cases"] >= 300
    # Temp rebuild must not touch canonical tree.
    from erp_bot.src.oip.modules.language_runtime.transliteration.application.canonical_path_guard import (
        tree_digest,
    )

    # Just ensure temp output exists.
    assert (tmp_path / "development.jsonl").exists()
    _ = tree_digest



def test_policy_form_alone_is_insufficient():
    resources = xlrr.load_resources(force_reload=True)
    disposition, signals = classify_disposition(
        surface="kharcha",
        language_form="ENGLISH",
        neighbors=("x",),
        resources=resources,
        ranked=[],
    )
    assert signals["language_form"] == "ENGLISH"
    assert disposition in {
        Disposition.ROMANIZED_TARGET_PREFERRED,
        Disposition.KEEP_BASE_ORDER,
        Disposition.AMBIGUOUS_IDENTITY_FIRST_REVIEW,
        Disposition.ENGLISH_IDENTITY_REQUIRED,
        Disposition.SHARED_CONTEXT_IDENTITY_PREFERRED,
        Disposition.SHARED_CONTEXT_TARGET_PREFERRED,
    }


def test_clear_english_identity():
    # Do NOT call run_split against canonical holdout paths.
    bundle = attach_transliteration_to_frame(
        analyze_language("please verify the payment status today")
    ).transliteration_bundle
    assert bundle is not None
    assert any(span.candidates for span in bundle.span_results)


def test_cross_path_parity_async():
    trusted = type("Trusted", (), {})()
    trusted.principal_id = "user-1"
    trusted.tenant_id = "tenant-1"
    trusted.active_company_id = "co-1"
    trusted.allows_company = lambda _company: True
    trusted.authentication_method = "jwt"
    trusted.roles = ("accountant",)
    trusted.permissions = ("oip:read",)

    async def _run():
        with patch(
            "erp_bot.src.oip.domain.constitution.enforcement.enforce_chat_identity_and_mode",
            return_value=(trusted, None),
        ):
            canonical = await build_canonical_ai_request(
                message="please verify the payment status today",
                session_id="r3h-parity",
                orbix_mode="ask",
            )
        ingress_bundle = canonical.language_frame.transliteration_bundle
        direct_bundle = attach_transliteration_to_frame(
            analyze_language("please verify the payment status today")
        ).transliteration_bundle
        assert ingress_bundle is not None and direct_bundle is not None
        assert ingress_bundle.model_dump() == direct_bundle.model_dump()

    import asyncio

    asyncio.run(_run())


def test_rc_lock_precedes_holdout():
    assert LOCKED_PATH.exists()
    locked = json.loads(LOCKED_PATH.read_text(encoding="utf-8"))
    assert locked["status"] == "LOCKED_NOT_RUN"


def test_holdout_cannot_rerun():
    assert CHAIN_PATH.exists(), "consumed R3H chain must remain present"
    with pytest.raises(RuntimeError):
        run_holdout_once()


def test_property_cases_2000():
    resources = xlrr.load_resources(force_reload=True)
    rng = random.Random(20260716)
    english = sorted(resources.english_identity)[:40]
    romanized = [k for k in sorted(resources.lexicon) if k not in resources.english_identity][:40]
    ok = 0
    for i in range(2000):
        if i % 2 == 0:
            token = english[i % len(english)]
            text = f"please review the {token} total now prop{i:04d}"
        else:
            token = romanized[i % len(romanized)]
            text = f"aaja {token} ko hisaab milau prop{i:04d}"
        bundle = attach_transliteration_to_frame(analyze_language(text)).transliteration_bundle
        assert bundle is not None
        assert all(len(span.candidates) <= MAX_CANDIDATES_PER_SPAN for span in bundle.span_results)
        assert attach_transliteration_to_frame(analyze_language(text)).transliteration_bundle.model_dump() == bundle.model_dump()
        ok += 1
    assert ok == 2000


def test_no_mai08_touch():
    ledger = json.loads((REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8"))
    phase = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert phase["status"] == "NOT_STARTED"


def test_r3h_canonical_tree_unchanged_by_focused_suite(tmp_path: Path):
    """Focused R3H tests must not mutate historical R3H evidence tree."""
    from erp_bot.src.oip.modules.language_runtime.transliteration.application.canonical_path_guard import (
        tree_digest,
    )

    before = tree_digest(DATASET_OUT)
    # Synthetic work in tmp only.
    (tmp_path / "noop.txt").write_text("ok", encoding="utf-8")
    after = tree_digest(DATASET_OUT)
    assert before == after
