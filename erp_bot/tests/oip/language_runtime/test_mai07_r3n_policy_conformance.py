"""MAI-07R3N policy-conformance corrective — PASSED_CORRECTIVE_RC governance tests.

Never hardcode the nine private case source texts. Load private authority via JSON
for counts/lanes only; text-based checks use synthetic strings. Failure messages
must not print private case full texts beyond case_id/lane.
"""

from __future__ import annotations

import ast
import json
import os
import random
import string
from pathlib import Path

import pytest

from erp_bot.src.oip.modules.language_runtime.domain.taxonomy import LanguageForm
from erp_bot.src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    MAX_CANDIDATES_PER_SPAN,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.build_mai07r3n_pack import (
    check_existing,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.eval_mai07_r3n import (
    AUTHORIZE_ENV,
    CHAIN_PATH,
    LOCKED_PATH,
    OUT as EVAL_OUT,
    RC_ID,
    load_thresholds,
    score_split,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n_candidate_runtime import (
    CANDIDATE_RUNTIME_VERSION,
    DEFAULT_ACTIVE,
    PARENT_RESOURCE_HASH,
    PARENT_RUNTIME_VERSION,
    assert_active_default_immutable,
    candidate_identity_card,
    analyze_language_r3n,
    load_r3n_resources,
    transliterate_r3n,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.r3n_scoring_contracts import (
    metric_required_when_empty,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.infrastructure.english_identity_guard import (
    Disposition,
    classify_disposition,
)

REPO = Path(__file__).resolve().parents[4]
OUT = REPO / "evals/mai07_r3n_policy_conformance"
assert OUT == EVAL_OUT
CLOSURE_DIR = (
    REPO
    / "docs/mokxya-ai/reviews/mai07_v3_ai_assisted/policy_mismatch_triage/closure"
)
AUTHORITY_PATH = CLOSURE_DIR / "R3M_CODE_CORRECTIVE_AUTHORITY.json"
CLOSURE_HASH_PATH = CLOSURE_DIR / "R3M_CLOSURE_SEMANTIC_HASH.json"
APP_DIR = (
    REPO
    / "erp_bot/src/oip/modules/language_runtime/transliteration/application"
)
XL_ROOT = REPO / "erp_bot/src/oip/modules/language_runtime/transliteration"
RUNTIME_FIREWALL_FILES = (
    APP_DIR / "mai07_r3n_candidate_runtime.py",
    XL_ROOT / "infrastructure" / "english_identity_guard.py",
    XL_ROOT / "resources" / "r3n_policy_conformance_policy.json",
)
EXPECTED_PARENT_RESOURCE_HASH = (
    "1617425373bf525968b5af2a3b1cc8b8e5ad83e68457cfbbb47c73c78c84e930"
)


def _load_authority() -> dict:
    return json.loads(AUTHORITY_PATH.read_text(encoding="utf-8"))


def _authorized_dev_rows() -> list[dict]:
    rows = []
    for line in (OUT / "development.jsonl").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        pops = row.get("population_ids") or []
        if "AUTHORIZED_CODE_CORRECTIVE" in pops:
            rows.append(row)
    return rows


def _r3n_resources():
    return load_r3n_resources()


# ---------------------------------------------------------------------------
# 1. Authority hashes / code-corrective counts
# ---------------------------------------------------------------------------


def test_authority_hashes_and_code_case_lanes():
    assert AUTHORITY_PATH.is_file()
    authority = _load_authority()
    assert authority["eligible_count"] == 9
    assert len(authority["eligible_ids"]) == 9
    assert authority["resource_queue_count"] == 0
    lanes = authority["lane_distribution"]
    assert lanes["ENGLISH_IDENTITY_GUARD"] == 5
    assert lanes["IDENTITY_CANDIDATE_INVARIANT"] == 3
    assert lanes["ACRONYM_OR_IDENTIFIER_PROTECTION"] == 1

    if CLOSURE_HASH_PATH.is_file():
        hash_doc = json.loads(CLOSURE_HASH_PATH.read_text(encoding="utf-8"))
        assert hash_doc.get("algorithm") == "sha256"
        sem = hash_doc.get("closure_semantic_hash")
        assert isinstance(sem, str) and len(sem) == 64
        assert all(c in string.hexdigits for c in sem)
        for key in ("r3l_semantic_sha256_preserved", "r3m_semantic_sha256_preserved"):
            if key in hash_doc:
                assert len(hash_doc[key]) == 64


# ---------------------------------------------------------------------------
# 2–3. Active default unchanged / candidate explicit activation
# ---------------------------------------------------------------------------


def test_active_default_unchanged():
    assert RUNTIME_VERSION == "mai-07.1.3-r3f-sealnew"
    assert RUNTIME_VERSION == PARENT_RUNTIME_VERSION
    assert RESOURCE_PACK_VERSION == "mai-07.1.3-r3f-sealnew"
    assert DEFAULT_ACTIVE is False
    assert ENABLE_PROMOTION_OVERLAY is False
    assert_active_default_immutable()
    card = candidate_identity_card()
    assert card["default_active"] is False
    assert card["overlay_enabled"] is False


def test_candidate_explicit_activation():
    assert CANDIDATE_RUNTIME_VERSION == "mai-07.1.6-r3n-policyconf"
    card = candidate_identity_card()
    assert card["candidate_runtime_version"] == "mai-07.1.6-r3n-policyconf"
    assert card["parent_runtime_version"] == PARENT_RUNTIME_VERSION
    res = _r3n_resources()
    assert res is not None


# ---------------------------------------------------------------------------
# 4. Identity retained on synthetic romanized / english spans
# ---------------------------------------------------------------------------


def test_identity_retained_synthetic_romanized_and_english():
    res = _r3n_resources()
    eng_bundle = transliterate_r3n("please review the payment status today", resources=res)
    payment = next(s for s in eng_bundle.span_results if s.raw_span.original_text.lower() == "payment")
    assert payment.candidates
    assert payment.candidates[0].is_identity is True
    assert any(c.is_identity for c in payment.candidates)

    rom_bundle = transliterate_r3n("aaja kharcha hernu milau", resources=res)
    kharcha = next(s for s in rom_bundle.span_results if s.raw_span.original_text.lower() == "kharcha")
    assert kharcha.candidates
    assert any(c.is_identity for c in kharcha.candidates)


# ---------------------------------------------------------------------------
# 5. Structural identifier coalesce
# ---------------------------------------------------------------------------


def test_structural_identifier_coalesce_and_ordinary_short_tokens():
    res = _r3n_resources()
    for text, token in (
        ("please match SKU-44102 before posting", "SKU-44102"),
        ("open ORD/8844/X today for review", "ORD/8844/X"),
    ):
        frame = analyze_language_r3n(text)
        id_anns = [a for a in frame.span_annotations if a.original_text == token]
        assert id_anns, f"expected coalesced identifier span for {token}"
        assert id_anns[0].language_form == LanguageForm.IDENTIFIER_OR_CODE.value
        bundle = transliterate_r3n(text, resources=res)
        spans = [s for s in bundle.span_results if s.raw_span.original_text == token]
        assert spans and spans[0].candidates
        assert spans[0].candidates[0].is_identity is True

    for text, token in (("ram le kaam garyo", "ram"), ("garna chahinchha aaja", "garna")):
        frame = analyze_language_r3n(text)
        anns = [a for a in frame.span_annotations if a.original_text.lower() == token]
        assert anns
        assert anns[0].language_form != LanguageForm.IDENTIFIER_OR_CODE.value
        assert "ACRONYM" not in (anns[0].language_form or "")
        assert not anns[0].protected_reason


# ---------------------------------------------------------------------------
# 6. English form alone insufficient
# ---------------------------------------------------------------------------


def test_english_form_alone_insufficient():
    res = _r3n_resources()
    cfg = res.english_identity_guard
    assert cfg.get("english_form_alone_insufficient") is True

    disposition, signals = classify_disposition(
        surface="kharcha",
        language_form="ENGLISH",
        neighbors=(),
        resources=res,
        ranked=[],
    )
    assert signals.get("r3n_policy") is True
    assert disposition is not Disposition.ENGLISH_IDENTITY_REQUIRED
    # Strong romanized context should prefer target / keep base — not English-from-form-alone.
    rom_bundle = transliterate_r3n("aaja kharcha hernu", resources=res)
    kharcha = next(s for s in rom_bundle.span_results if s.raw_span.original_text.lower() == "kharcha")
    assert kharcha.candidates
    assert kharcha.candidates[0].is_identity is False


# ---------------------------------------------------------------------------
# 7. Protected precedence / raw immutability
# ---------------------------------------------------------------------------


def test_protected_precedence_raw_immutability():
    text = "please match SKU-44102 before posting r3nraw"
    frame = analyze_language_r3n(text)
    assert frame.raw_text == text
    res = _r3n_resources()
    bundle = transliterate_r3n(text, resources=res)
    reconstructed = "".join(s.raw_span.original_text for s in bundle.span_results)
    assert reconstructed == text
    assert bundle.matching_view == "RAW"
    assert all(len(s.candidates) <= MAX_CANDIDATES_PER_SPAN for s in bundle.span_results)


# ---------------------------------------------------------------------------
# 8. Candidate cap <= 5
# ---------------------------------------------------------------------------


def test_candidate_cap_at_most_five():
    res = _r3n_resources()
    text = (
        "please review ledger voucher payment supplier customer discount "
        "commission statement reconcile opening closing export import"
    )
    bundle = transliterate_r3n(text, resources=res)
    assert MAX_CANDIDATES_PER_SPAN == 5
    for span in bundle.span_results:
        assert len(span.candidates) <= 5


# ---------------------------------------------------------------------------
# 9. Determinism
# ---------------------------------------------------------------------------


def test_determinism_same_input_twice():
    res = _r3n_resources()
    text = "please review the payment status and aaja kharcha hernu"
    a = transliterate_r3n(text, resources=res)
    b = transliterate_r3n(text, resources=res)
    flags_a = [
        (s.raw_span.original_text, bool(s.candidates and s.candidates[0].is_identity))
        for s in a.span_results
    ]
    flags_b = [
        (s.raw_span.original_text, bool(s.candidates and s.candidates[0].is_identity))
        for s in b.span_results
    ]
    assert flags_a == flags_b


# ---------------------------------------------------------------------------
# 10. Firewall — private IDs/texts absent from runtime/config sources
# ---------------------------------------------------------------------------


def test_firewall_private_ids_and_texts_absent_from_runtime_sources():
    authority = _load_authority()
    private_ids = set(authority["eligible_ids"])
    assert len(private_ids) == 9

    authorized = _authorized_dev_rows()
    assert len(authorized) == 9
    private_texts = {row["input_text"] for row in authorized if row.get("input_text")}
    assert len(private_texts) == 9

    for path in RUNTIME_FIREWALL_FILES:
        assert path.is_file(), path.name
        blob = path.read_text(encoding="utf-8")
        for sid in private_ids:
            assert sid not in blob, f"private source_item_id leaked into {path.name}"
        for _txt in private_texts:
            assert _txt not in blob, f"private input_text leaked into {path.name}"


# ---------------------------------------------------------------------------
# 11. Development / holdout disjoint
# ---------------------------------------------------------------------------


def test_development_holdout_disjoint_case_ids_and_families():
    manifest = json.loads((OUT / "MANIFEST.json").read_text(encoding="utf-8"))
    leakage = json.loads((OUT / "LEAKAGE_AND_SPLIT_INTEGRITY.json").read_text(encoding="utf-8"))
    integrity = leakage["split_integrity"]
    assert integrity["case_id_intersection_empty"] is True
    assert integrity["case_id_intersection"] == []
    assert integrity["template_family_disjoint_dev_holdout"] is True
    assert integrity["template_family_intersection"] == []
    assert integrity["proof_passed"] is True
    assert manifest["frozen_v2_unused"] is True


# ---------------------------------------------------------------------------
# 12. Frozen-data firewall (AST imports)
# ---------------------------------------------------------------------------


def test_frozen_data_firewall_runtime_modules_no_eval_or_review_imports():
    forbidden_substr = ("evals", "docs.mokxya", "mokxya_ai.reviews", "reviews.mai07")
    for path in (
        APP_DIR / "mai07_r3n_candidate_runtime.py",
        XL_ROOT / "infrastructure" / "english_identity_guard.py",
    ):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            modules: list[str] = []
            if isinstance(node, ast.Import):
                modules.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules.append(node.module)
            for mod in modules:
                low = mod.lower().replace("\\", "/").replace("/", ".")
                assert "evals" not in low.split(".")
                assert "docs.mokxya" not in low
                assert "reviews.mai07" not in low
                for frag in forbidden_substr:
                    if frag == "evals":
                        continue
                    assert frag not in low

    # All *r3n* application modules: runtime subset already checked; builder may read R3M/R3L.
    for path in sorted(APP_DIR.glob("*r3n*.py")):
        if path.name in {"mai07_r3n_candidate_runtime.py"}:
            src = path.read_text(encoding="utf-8")
            assert "evals/" not in src or "never" in src.lower()
            assert "docs/mokxya-ai/reviews/" not in src


# ---------------------------------------------------------------------------
# 13. Empty required population policy
# ---------------------------------------------------------------------------


def test_empty_required_population_metric_policy():
    assert metric_required_when_empty("authorized_code_corrective", "HOLDOUT_VALIDATION") is False
    assert metric_required_when_empty("authorized_code_corrective", "DEVELOPMENT") is True


# ---------------------------------------------------------------------------
# 14. Canonical / audit agreement on DEVELOPMENT
# ---------------------------------------------------------------------------


def test_canonical_audit_agreement_development():
    result = score_split("DEVELOPMENT", write=False)
    assert result["agreement"]["ok"] is True
    assert result["canonical"]["ok"] is True or result["ok"] is True
    assert result["agreement"].get("mismatches", []) == [] or result["agreement"]["ok"] is True


# ---------------------------------------------------------------------------
# 15–16. Lock-before-holdout / one-shot consumed
# ---------------------------------------------------------------------------


def test_lock_before_holdout_rc002_passed():
    assert LOCKED_PATH.is_file()
    assert CHAIN_PATH.is_file()
    assert RC_ID == "MAI_07R3N_POLICY_CONFORMANCE_RELEASE_CANDIDATE_002"
    assert LOCKED_PATH.name.startswith(RC_ID)
    chain = json.loads(CHAIN_PATH.read_text(encoding="utf-8"))
    assert chain["rc_id"] == RC_ID
    assert chain["verdict"] == "PASSED_CORRECTIVE_RC"
    _ = load_thresholds()


def test_one_shot_consumed():
    chain = json.loads(CHAIN_PATH.read_text(encoding="utf-8"))
    assert chain["consumed"] is True
    assert chain["verdict"] == "PASSED_CORRECTIVE_RC"


# ---------------------------------------------------------------------------
# 17. Tests cannot mutate canonical without authorize env
# ---------------------------------------------------------------------------


def test_cannot_mutate_canonical_without_authorize(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv(AUTHORIZE_ENV, raising=False)
    assert os.environ.get(AUTHORIZE_ENV) != "1"
    with pytest.raises(PermissionError):
        score_split("DEVELOPMENT", write=True)


# ---------------------------------------------------------------------------
# 18. Governance flags
# ---------------------------------------------------------------------------


def test_governance_flags_qualification_result():
    qual_path = OUT / f"{RC_ID}.QUALIFICATION_RESULT.json"
    qual = json.loads(qual_path.read_text(encoding="utf-8"))
    assert qual["QUALITY_GATES_PASSED"] is False
    assert qual["LINGUIST_APPROVED"] is False
    assert qual["PRODUCTION_APPROVED"] is False
    assert qual["candidate_promoted"] is False
    assert qual["MAI-08"] == "NOT_STARTED"

    ledger = json.loads((REPO / "docs/mokxya-ai/MAI_PHASE_LEDGER.json").read_text(encoding="utf-8"))
    phase = next(p for p in ledger["phases"] if p["id"] == "MAI-08")
    assert phase["status"] == "NOT_STARTED"


# ---------------------------------------------------------------------------
# 19. Property test — 2000 seeded synthetic strings
# ---------------------------------------------------------------------------


def test_property_2000_seeded_synthetic_strings():
    res = _r3n_resources()
    rng = random.Random(20260718)
    alphabet = string.ascii_letters + string.digits + "-"
    ok = 0
    for i in range(2000):
        length = rng.randint(3, 24)
        token = "".join(rng.choice(alphabet) for _ in range(length))
        # Avoid leading/trailing hyphen-only edge cases that confuse tokenization.
        if token.strip("-") == "":
            token = f"x{i}y"
        text = f"please check {token} once r3nprop{i:04d}"
        bundle = transliterate_r3n(text, resources=res)
        assert bundle is not None
        reconstructed = "".join(s.raw_span.original_text for s in bundle.span_results)
        assert reconstructed == text
        assert all(len(s.candidates) <= 5 for s in bundle.span_results)
        ok += 1
    assert ok == 2000


# ---------------------------------------------------------------------------
# 20. Pack check_existing + parent resource hash
# ---------------------------------------------------------------------------


def test_pack_check_existing_and_parent_resource_hash():
    report = check_existing()
    assert report["ok"] is True
    assert report["pack_version"] == CANDIDATE_RUNTIME_VERSION
    assert PARENT_RESOURCE_HASH == EXPECTED_PARENT_RESOURCE_HASH
    assert candidate_identity_card()["parent_resource_hash"] == EXPECTED_PARENT_RESOURCE_HASH
    imm_path = OUT / "reports" / "IMMUTABILITY_REPORT.json"
    if imm_path.is_file():
        imm = json.loads(imm_path.read_text(encoding="utf-8"))
        assert imm["parent_resource_hash"] == EXPECTED_PARENT_RESOURCE_HASH
        assert imm["candidate_promoted"] is False
        assert imm["active_ok"] is True
