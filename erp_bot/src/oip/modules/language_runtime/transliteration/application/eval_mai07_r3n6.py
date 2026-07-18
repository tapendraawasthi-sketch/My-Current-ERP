"""Governed R3N6 lock, fresh one-shot evaluation, and complete output chain."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import platform
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

from .....contracts.transliteration import TransliterationBundleV1

from ...infrastructure.compact_resource_repository import (
    CompactResources,
    RESOURCES_DIR as LANGUAGE_RESOURCES_DIR,
)
from ...normalization.infrastructure.norm_resource_repository import (
    CompactNormResources,
    RESOURCES_DIR as NORMALIZATION_RESOURCES_DIR,
)
from .. import ENABLE_PROMOTION_OVERLAY, RUNTIME_VERSION
from ..infrastructure.seal_contract_v2 import (
    SEAL_CONTRACT_VERSION,
    semantic_json_hash,
    sha256_file,
)
from ..infrastructure.resource_repository import load_resources
from .build_mai07r3n6_pack import (
    ALLOWED_FILES,
    DEST as CANDIDATE_PACK_DIR,
    EXPECTED_SOURCE_CONTENT_HASH,
    PACK_VERSION,
    check_existing as check_pack,
)
from .eval_mai07_r3n6_audit_scorer import (
    SCORER_ID as AUDIT_SCORER_ID,
    compare_canonical_audit,
    compare_case_observations,
    observe_case_audit,
    score_observations_audit,
)
from .eval_mai07_r3n6_canonical_scorer import (
    SCORER_ID as CANONICAL_SCORER_ID,
    observe_case,
    score_observations,
)
from .eval_mai07_r3n6_development import (
    REPORT_PATH as DEVELOPMENT_REPORT_PATH,
    score_development,
)
from .mai07_r3n6_candidate_runtime import (
    CANDIDATE_POLICY_VERSION,
    CANDIDATE_RUNTIME_VERSION,
    PARENT_INVALIDATED_R3N5_ATTEMPT,
    PARENT_INVALIDATED_R3N5_LOCK_SEMANTIC,
    PARENT_INVALIDATED_R3N5_RUNTIME_VERSION,
    PARENT_INVALIDATED_R3N5_VERDICT,
    PARENT_RESOURCE_HASH,
    PARENT_RUNTIME_VERSION,
    assert_active_default_immutable,
    transliterate_r3n6,
)
from .mai07_r3n6_dataset_builder import (
    EXPECTED_BEHAVIOR_ENUM,
    SPLIT_COUNTS,
    SPLIT_FILES,
    assert_exact_corpus_authority,
)
from .r3n5_target_span_contract import TargetSpanContractError, target_span_from_case
from .r3n6_output_binding import (
    CHAIN_SCHEMA_VERSION,
    JSON_KIND,
    JSONL_KIND,
    build_output_binding_manifest,
    output_manifest_semantic_sha256,
    verify_complete_r3n6_chain,
)
from .r3n6_scoring_contracts import (
    ALLOWED_EXPECTED_BEHAVIORS,
    CONTRACT_VERSION,
    MINIMUM_DENOMINATORS,
    REQUIRED_GATE_SPEC,
    REQUIRED_METRIC_KEYS,
    REQUIRED_POPULATIONS,
    REQUIRED_REPORT_GATE_KEYS,
    SCORER_VERSION,
    observation_persistence_status,
    require_exact_threshold_gate_spec,
)
from .rc_lock_chain import (
    bind_predictions,
    build_locked_rc,
    compute_rc_semantic_body_sha256,
    create_attempt,
    create_lock_record,
    create_qualification_result,
    verify_locked_rc,
    write_json_immutable,
)

REPO = Path(__file__).resolve().parents[7]
ERP_BOT_ROOT = REPO / "erp_bot"
APP = Path(__file__).resolve().parent
OUT = REPO / "evals" / "mai07_r3n6_fresh_holdout"
REPORTS = OUT / "reports"
MANIFEST_PATH = OUT / "MANIFEST.json"
THRESHOLDS_PATH = OUT / "MAI_07R3N6_THRESHOLDS.json"
R3N5_INVALIDATION_PATH = (
    REPO
    / "evals/mai07_r3n5_fresh_holdout/MAI_07R3N5_INTEGRITY_INVALIDATION.json"
)
PROTOCOL_PATH = (
    REPO
    / "docs/mokxya-ai/decisions/ADR_0020_R3N5_INVALIDATION_AND_R3N6_COMPLETE_EVIDENCE_PROTOCOL.md"
)
REQUIREMENTS_PATH = ERP_BOT_ROOT / "requirements.txt"

# RC_001 crashed pre-score. RC_002 locked-not-attempted. RC_003 scored all splits
# then failed complete-chain binding (verifier rejected NOT_APPLICABLE pass gates /
# missing expected_cases_by_split). RC_004 is the harness-only re-lock.
RC_ID = "MAI_07R3N6_FRESH_HOLDOUT_RELEASE_CANDIDATE_004"
ATTEMPT_ID = "MAI_07R3N6_HOLDOUT_ATTEMPT_004"
RC_001_ID = "MAI_07R3N6_FRESH_HOLDOUT_RELEASE_CANDIDATE_001"
ATTEMPT_001_ID = "MAI_07R3N6_HOLDOUT_ATTEMPT_001"
RC_002_ID = "MAI_07R3N6_FRESH_HOLDOUT_RELEASE_CANDIDATE_002"
RC_003_ID = "MAI_07R3N6_FRESH_HOLDOUT_RELEASE_CANDIDATE_003"
ATTEMPT_003_ID = "MAI_07R3N6_HOLDOUT_ATTEMPT_003"
ATTEMPT_001_CRASH_PATH = OUT / f"{ATTEMPT_001_ID}.CRASHED_PRE_SCORE.json"
RC_001_LOCKED_PATH = OUT / f"{RC_001_ID}.LOCKED_NOT_RUN.json"
RC_002_LOCKED_PATH = OUT / f"{RC_002_ID}.LOCKED_NOT_RUN.json"
RC_002_DISPOSITION_PATH = OUT / f"{RC_002_ID}.LOCKED_NOT_ATTEMPTED.json"
RC_003_LOCKED_PATH = OUT / f"{RC_003_ID}.LOCKED_NOT_RUN.json"
ATTEMPT_003_DISPOSITION_PATH = (
    OUT / f"{ATTEMPT_003_ID}.SCORED_CHAIN_BINDING_FAILED.json"
)
LOCKED_PATH = OUT / f"{RC_ID}.LOCKED_NOT_RUN.json"
LOCK_RECORD_PATH = OUT / f"{RC_ID}.LOCK_RECORD.json"
ATTEMPT_INTENT_PATH = OUT / f"{ATTEMPT_ID}.ATTEMPT_INTENT.json"
ATTEMPT_PATH = OUT / f"{ATTEMPT_ID}.ATTEMPT_RESULT.json"
QUALIFICATION_PATH = OUT / f"{RC_ID}.QUALIFICATION_RESULT.json"
OUTPUT_BINDING_PATH = OUT / f"{RC_ID}.OUTPUT_BINDING_MANIFEST.json"
CHAIN_PATH = OUT / f"{RC_ID}.CHAIN_MANIFEST.json"

AUTHORIZE_LOCK_ENV = "MAI07_AUTHORIZE_R3N6_LOCK"
AUTHORIZE_HOLDOUT_ENV = "MAI07_AUTHORIZE_R3N6_HOLDOUT"

HOLDOUT_SPLITS = (
    "HOLDOUT_VALIDATION",
    "SAFETY_CHALLENGE",
    "CONTEXT_COUNTERFACTUAL",
    "OOV_CHALLENGE",
    "MONOTONIC_REGRESSION",
    "IDENTITY_ANCHOR_CHALLENGE",
)

R3N5_INVALIDATION_VERDICT = (
    "INVALIDATED_INCOMPLETE_INDEPENDENT_SCORING_AND_OUTPUT_BINDING_NEW_RC_REQUIRED"
)
R3N5_INVALIDATION_RAW_SHA256 = (
    "8d7b26bbcd813c79d8a4568acf096dfe7455ef1e1b1df3ab7367c811a293a1e2"
)
R3N5_INVALIDATION_SEMANTIC_SHA256 = (
    "204665a84c076c5193038b11ae058b746b66101c2fb33332d32716d7dc2d5353"
)
R3N5_INVALIDATED_RC_ID = "MAI_07R3N5_FRESH_HOLDOUT_RELEASE_CANDIDATE_001"
R3N5_INVALIDATED_LOCK_RAW_SHA256 = (
    "743c34b9f7235c6fb6e32990ee413be89f76c4ee6508df1f220d9e94773dcb07"
)

ONE_SHOT_COMMAND = (
    "python -m erp_bot.src.oip.modules.language_runtime.transliteration."
    "application.eval_mai07_r3n6 --one-shot"
)

SOURCE_PATHS = tuple(
    path
    for path in """erp_bot/src/__init__.py
erp_bot/src/oip/__init__.py
erp_bot/src/oip/application/__init__.py
erp_bot/src/oip/application/bus/__init__.py
erp_bot/src/oip/application/bus/command_bus.py
erp_bot/src/oip/application/bus/event_bus.py
erp_bot/src/oip/application/bus/query_bus.py
erp_bot/src/oip/application/commands/__init__.py
erp_bot/src/oip/application/dto/__init__.py
erp_bot/src/oip/application/dto/intelligence_request.py
erp_bot/src/oip/application/dto/intelligence_response.py
erp_bot/src/oip/application/ports/__init__.py
erp_bot/src/oip/application/ports/inbound/__init__.py
erp_bot/src/oip/application/ports/inbound/intelligence_ingress_port.py
erp_bot/src/oip/application/ports/outbound/__init__.py
erp_bot/src/oip/application/ports/outbound/audit_sink_port.py
erp_bot/src/oip/application/ports/outbound/erp_gateway_port.py
erp_bot/src/oip/application/ports/outbound/event_publisher_port.py
erp_bot/src/oip/application/ports/outbound/inbox_port.py
erp_bot/src/oip/application/ports/outbound/lineage_repository_port.py
erp_bot/src/oip/application/ports/outbound/outbox_port.py
erp_bot/src/oip/application/services/__init__.py
erp_bot/src/oip/application/services/audit_service.py
erp_bot/src/oip/application/services/lineage_service.py
erp_bot/src/oip/config/__init__.py
erp_bot/src/oip/config/settings.py
erp_bot/src/oip/contracts/__init__.py
erp_bot/src/oip/contracts/common.py
erp_bot/src/oip/contracts/dialogue.py
erp_bot/src/oip/contracts/draft_preview.py
erp_bot/src/oip/contracts/errors.py
erp_bot/src/oip/contracts/event_frame.py
erp_bot/src/oip/contracts/evidence.py
erp_bot/src/oip/contracts/language.py
erp_bot/src/oip/contracts/normalization.py
erp_bot/src/oip/contracts/plan_tools.py
erp_bot/src/oip/contracts/registry.py
erp_bot/src/oip/contracts/request.py
erp_bot/src/oip/contracts/response.py
erp_bot/src/oip/contracts/sse.py
erp_bot/src/oip/contracts/transliteration.py
erp_bot/src/oip/domain/__init__.py
erp_bot/src/oip/domain/constitution/__init__.py
erp_bot/src/oip/domain/constitution/config_guard.py
erp_bot/src/oip/domain/events.py
erp_bot/src/oip/domain/value_objects.py
erp_bot/src/oip/infrastructure/__init__.py
erp_bot/src/oip/infrastructure/messaging/outbox_dispatcher.py
erp_bot/src/oip/infrastructure/observability/correlation.py
erp_bot/src/oip/infrastructure/observability/logging.py
erp_bot/src/oip/infrastructure/observability/mai03_context.py
erp_bot/src/oip/infrastructure/observability/mai03_identity.py
erp_bot/src/oip/infrastructure/observability/mai03_redaction.py
erp_bot/src/oip/infrastructure/observability/metrics.py
erp_bot/src/oip/infrastructure/observability/tracing.py
erp_bot/src/oip/infrastructure/persistence/audit_sqlite.py
erp_bot/src/oip/infrastructure/persistence/outbox_sqlite.py
erp_bot/src/oip/integration/__init__.py
erp_bot/src/oip/integration/contracts/__init__.py
erp_bot/src/oip/integration/contracts/erp_commands.py
erp_bot/src/oip/integration/contracts/erp_events.py
erp_bot/src/oip/integration/contracts/snapshots.py
erp_bot/src/oip/kernel/__init__.py
erp_bot/src/oip/kernel/facade.py
erp_bot/src/oip/modules/__init__.py
erp_bot/src/oip/modules/language_runtime/__init__.py
erp_bot/src/oip/modules/language_runtime/application/__init__.py
erp_bot/src/oip/modules/language_runtime/application/language_analyzer.py
erp_bot/src/oip/modules/language_runtime/application/language_form_classifier.py
erp_bot/src/oip/modules/language_runtime/domain/__init__.py
erp_bot/src/oip/modules/language_runtime/domain/offsets.py
erp_bot/src/oip/modules/language_runtime/domain/protected.py
erp_bot/src/oip/modules/language_runtime/domain/script.py
erp_bot/src/oip/modules/language_runtime/domain/taxonomy.py
erp_bot/src/oip/modules/language_runtime/infrastructure/__init__.py
erp_bot/src/oip/modules/language_runtime/infrastructure/compact_resource_repository.py
erp_bot/src/oip/modules/language_runtime/normalization/__init__.py
erp_bot/src/oip/modules/language_runtime/normalization/application/__init__.py
erp_bot/src/oip/modules/language_runtime/normalization/application/normalization_service.py
erp_bot/src/oip/modules/language_runtime/normalization/domain/__init__.py
erp_bot/src/oip/modules/language_runtime/normalization/domain/integrity.py
erp_bot/src/oip/modules/language_runtime/normalization/domain/offset_ops.py
erp_bot/src/oip/modules/language_runtime/normalization/domain/reconstruction.py
erp_bot/src/oip/modules/language_runtime/normalization/infrastructure/__init__.py
erp_bot/src/oip/modules/language_runtime/normalization/infrastructure/norm_resource_repository.py
erp_bot/src/oip/modules/language_runtime/transliteration/__init__.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/build_mai07r3n4_pack.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/build_mai07r3n5_pack.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/build_mai07r3n6_pack.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_mai07_r3n4_audit_scorer.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_mai07_r3n4_canonical_scorer.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_mai07_r3n6.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_mai07_r3n6_audit_scorer.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_mai07_r3n6_canonical_scorer.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/eval_mai07_r3n6_development.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/mai07_r3n4_candidate_runtime.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/mai07_r3n5_candidate_runtime.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/mai07_r3n5_integrity_invalidation.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/mai07_r3n6_candidate_runtime.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/mai07_r3n6_dataset_builder.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/r3h2_scoring_contracts.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/r3n4_candidate_finalization.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/r3n4_finalization_path_registry.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/r3n4_identity_anchor.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/r3n4_scoring_contracts.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/r3n5_target_span_contract.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/r3n6_output_binding.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/r3n6_scoring_contracts.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/rc_lock_chain.py
erp_bot/src/oip/modules/language_runtime/transliteration/application/transliteration_service.py
erp_bot/src/oip/modules/language_runtime/transliteration/domain/alignment.py
erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/deterministic_generator.py
erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/deterministic_ranker.py
erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/english_identity_guard.py
erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/r3d_safety_gate.py
erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/resource_repository.py
erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/seal_contract_v2.py
erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure/target_promotion_overlay.py
erp_bot/src/oip/modules/orchestrator/__init__.py
erp_bot/src/oip/modules/orchestrator/application/dto/workflow_context.py
erp_bot/src/oip/modules/orchestrator/application/ports/orchestrator_port.py
erp_bot/src/oip/modules/orchestrator/application/ports/workflow_engine_port.py
erp_bot/src/oip/modules/orchestrator/application/ports/workflow_repository_port.py
erp_bot/src/oip/modules/orchestrator/application/projectors/orchestrator_projectors.py
erp_bot/src/oip/modules/orchestrator/application/read_models/orchestrator_read_models.py
erp_bot/src/oip/modules/orchestrator/application/services/orchestrator_service.py
erp_bot/src/oip/modules/orchestrator/domain/entities.py
erp_bot/src/oip/modules/orchestrator/domain/events.py
erp_bot/src/oip/modules/orchestrator/domain/value_objects.py
erp_bot/src/oip/shared/__init__.py
erp_bot/src/oip/shared/edition.py
erp_bot/src/oip/shared/exceptions.py
erp_bot/src/oip/shared/ids.py""".splitlines()
    if path
)

# Compatibility view for older focused tests; lock authority uses SOURCE_PATHS.
SOURCE_NAMES = tuple(
    sorted(
        {
            Path(path).name
            for path in SOURCE_PATHS
            if "/transliteration/application/" in path
        }
    )
)


def _load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"json_object_required:{path}")
    return value


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(
        path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        if not line.strip():
            continue
        row = json.loads(line)
        if not isinstance(row, dict):
            raise ValueError(f"jsonl_object_required:{path}:{line_number}")
        rows.append(row)
    return rows


def _parse_jsonl_bytes(raw: bytes, *, label: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(f"jsonl_utf8_required:{label}") from exc
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        value = json.loads(line)
        if not isinstance(value, dict):
            raise ValueError(f"jsonl_object_required:{label}:{line_number}")
        rows.append(value)
    return rows


def _load_split(split: str) -> list[dict[str, Any]]:
    return _load_jsonl(OUT / SPLIT_FILES[split])


def _source_hashes() -> dict[str, str]:
    if tuple(sorted(SOURCE_PATHS)) != SOURCE_PATHS:
        raise RuntimeError("r3n6_source_paths_must_be_sorted")
    if len(set(SOURCE_PATHS)) != len(SOURCE_PATHS):
        raise RuntimeError("r3n6_source_paths_must_be_unique")
    hashes: dict[str, str] = {}
    for relative in SOURCE_PATHS:
        path = REPO / relative
        if not path.is_file():
            raise FileNotFoundError(f"r3n6_governed_source_missing:{relative}")
        hashes[relative] = sha256_file(path)
    return hashes


def _population_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    return dict(
        Counter(pop for row in rows for pop in row.get("population_ids", []))
    )


def _validate_manifest() -> dict[str, Any]:
    manifest = _load_json(MANIFEST_PATH)
    errors: list[str] = []
    expected_splits = set(SPLIT_FILES)
    if set(manifest.get("splits", {})) != expected_splits:
        errors.append("split_keyset")
    if manifest.get("parent_prediction_jsonl_opened") is not False:
        errors.append("parent_prediction_firewall")
    if manifest.get("parent_score_report_opened") is not False:
        errors.append("parent_score_report_firewall")
    if manifest.get("r3n5_input_splits_used_for_one_way_freshness_only") is not True:
        errors.append("one_way_freshness_flag")
    all_case_ids: set[str] = set()
    physical_splits: dict[str, list[dict[str, Any]]] = {}
    for split in sorted(expected_splits):
        metadata = manifest.get("splits", {}).get(split, {})
        filename = metadata.get("filename")
        if filename != SPLIT_FILES[split]:
            errors.append(f"split_filename:{split}")
            continue
        path = OUT / filename
        if not path.is_file() or sha256_file(path) != metadata.get("sha256"):
            errors.append(f"split_hash:{split}")
            continue
        rows = _load_split(split)
        physical_splits[split] = rows
        if len(rows) != SPLIT_COUNTS[split]:
            errors.append(f"exact_split_count:{split}")
        if len(rows) != int(metadata.get("count", -1)):
            errors.append(f"split_count:{split}")
        if _population_counts(rows) != metadata.get("population_counts"):
            errors.append(f"population_counts:{split}")
        for row in rows:
            case_id = row.get("case_id")
            if not isinstance(case_id, str) or case_id in all_case_ids:
                errors.append(f"duplicate_or_invalid_case_id:{split}:{case_id}")
            else:
                all_case_ids.add(case_id)
            if row.get("split") != split:
                errors.append(f"case_split:{case_id}")
            if row.get("expected_behavior") not in EXPECTED_BEHAVIOR_ENUM:
                errors.append(f"unknown_expected_behavior:{case_id}")
            try:
                target_span_from_case(row)
            except TargetSpanContractError:
                errors.append(f"target_contract:{case_id}")
    if set(physical_splits) == expected_splits:
        try:
            assert_exact_corpus_authority(physical_splits, manifest)
        except (KeyError, TypeError, ValueError) as exc:
            errors.append(f"deterministic_corpus_authority:{exc}")
    holdout_counts = _population_counts(_load_split("HOLDOUT_VALIDATION"))
    support_only = {
        "CONTEXT_COUNTERFACTUAL",
        "OOV",
        "MONOTONIC_PARENT_CORRECT",
        "IDENTITY_ANCHOR_CHALLENGE",
    }
    for population, minimum in MINIMUM_DENOMINATORS.items():
        if population not in support_only and holdout_counts.get(population, 0) < minimum:
            errors.append(f"population_floor:{population}")
    support_map = {
        "CONTEXT_COUNTERFACTUAL": "CONTEXT_COUNTERFACTUAL",
        "OOV_CHALLENGE": "OOV",
        "MONOTONIC_REGRESSION": "MONOTONIC_PARENT_CORRECT",
        "IDENTITY_ANCHOR_CHALLENGE": "IDENTITY_ANCHOR_CHALLENGE",
    }
    for split, population in support_map.items():
        count = _population_counts(_load_split(split)).get(population, 0)
        if count < MINIMUM_DENOMINATORS[population]:
            errors.append(f"support_floor:{split}:{population}")
    return {"ok": not errors, "errors": errors, "manifest": manifest}


def _parent_r3n5_invalidation() -> dict[str, Any]:
    artifact = _load_json(R3N5_INVALIDATION_PATH)
    raw_sha256 = sha256_file(R3N5_INVALIDATION_PATH)
    semantic_sha256 = semantic_json_hash(artifact)
    raw_snapshot = artifact.get("raw_sha256_snapshot", {})
    locked_snapshot = (
        raw_snapshot.get("lock", {}) if isinstance(raw_snapshot, dict) else {}
    )
    ok = bool(
        raw_sha256 == R3N5_INVALIDATION_RAW_SHA256
        and semantic_sha256 == R3N5_INVALIDATION_SEMANTIC_SHA256
        and artifact.get("schema_version")
        == "mai07_r3n5_integrity_invalidation_v1"
        and artifact.get("record_type") == "APPEND_ONLY_FORENSIC_INVALIDATION"
        and artifact.get("verdict") == R3N5_INVALIDATION_VERDICT
        and artifact.get("all_checks_passed") is True
        and artifact.get("r3n5_engineering_verdict_retained") is False
        and artifact.get("new_release_candidate_required") is True
        and artifact.get("next_governed_phase")
        == "MAI-07R3N6-FRESH-HOLDOUT-COMPLETE-EVIDENCE-CORRECTIVE"
        and artifact.get("subject_attempt_id") == PARENT_INVALIDATED_R3N5_ATTEMPT
        and artifact.get("subject_rc_id") == R3N5_INVALIDATED_RC_ID
        and locked_snapshot.get("raw_sha256")
        == R3N5_INVALIDATED_LOCK_RAW_SHA256
        and PARENT_INVALIDATED_R3N5_LOCK_SEMANTIC
        == "80bb914f01cc365582177592516ec2bb9e519f4f17a3456b1a2bd48d053af907"
        and PARENT_INVALIDATED_R3N5_VERDICT == R3N5_INVALIDATION_VERDICT
    )
    return {
        "ok": ok,
        "runtime_version": PARENT_INVALIDATED_R3N5_RUNTIME_VERSION,
        "rc_id": R3N5_INVALIDATED_RC_ID,
        "attempt_id": PARENT_INVALIDATED_R3N5_ATTEMPT,
        "lock_semantic_sha256": PARENT_INVALIDATED_R3N5_LOCK_SEMANTIC,
        "lock_raw_sha256": R3N5_INVALIDATED_LOCK_RAW_SHA256,
        "verdict": R3N5_INVALIDATION_VERDICT,
        "artifact_path": R3N5_INVALIDATION_PATH.relative_to(REPO).as_posix(),
        "artifact_raw_sha256": raw_sha256,
        "artifact_semantic_sha256": semantic_sha256,
        "candidate_promoted": False,
    }


def _validate_governance_protocol() -> dict[str, Any]:
    if not PROTOCOL_PATH.is_file():
        return {"ok": False, "errors": ["missing_protocol"]}
    text = PROTOCOL_PATH.read_text(encoding="utf-8")
    required_literals = (
        "INVALIDATED_INCOMPLETE_INDEPENDENT_SCORING_AND_OUTPUT_BINDING_NEW_RC_REQUIRED",
        "Compute `split_expected_pass` separately in canonical and audit scorers.",
        "Compare every metric and gate with no ignored metric",
        "Persist both",
        "immutable attempt-intent record with atomic create-new semantics",
        "Bind all 15 verdict-bearing outputs at attempt time",
        "recompute both scorer reports and both agreement objects",
        "final verified chain is the sole engineering-verdict authority",
        "MAI-08 remains `NOT_STARTED`",
    )
    missing = [literal for literal in required_literals if literal not in text]
    return {
        "ok": not missing,
        "errors": [f"missing_protocol_literal:{literal}" for literal in missing],
        "path": PROTOCOL_PATH.relative_to(REPO).as_posix(),
        "raw_sha256": sha256_file(PROTOCOL_PATH),
    }


def expected_output_artifact_names() -> frozenset[str]:
    names = {"attempt_intent", "attempt_result", "qualification"}
    for split in HOLDOUT_SPLITS:
        stem = split.lower()
        names.add(f"{stem}_score_report")
        names.add(f"{stem}_predictions")
    return frozenset(names)


def _relative(path: Path) -> str:
    return path.resolve().relative_to(REPO.resolve()).as_posix()


def _runtime_environment_evidence() -> dict[str, Any]:
    """Return the exact interpreter/dependency identity used by this process."""

    errors: list[str] = []
    if not REQUIREMENTS_PATH.is_file():
        errors.append("missing_requirements")
    distributions: dict[str, str | None] = {}
    for distribution in ("pydantic", "pydantic-core"):
        try:
            distributions[distribution] = importlib.metadata.version(distribution)
        except importlib.metadata.PackageNotFoundError:
            distributions[distribution] = None
            errors.append(f"missing_distribution:{distribution}")
    return {
        "ok": not errors,
        "errors": errors,
        "requirements_path": _relative(REQUIREMENTS_PATH),
        "requirements_raw_sha256": (
            sha256_file(REQUIREMENTS_PATH) if REQUIREMENTS_PATH.is_file() else None
        ),
        "python_implementation": sys.implementation.name,
        "python_implementation_version": ".".join(
            str(part) for part in sys.implementation.version[:3]
        ),
        "python_cache_tag": sys.implementation.cache_tag,
        "python_version": platform.python_version(),
        "sys_version": sys.version,
        "platform": platform.platform(),
        "distributions": distributions,
    }


def _compact_resource_pack_evidence(
    resources_dir: Path, *, label: str
) -> dict[str, Any]:
    """Validate and bind an inherited compact JSON resource pack exactly."""

    errors: list[str] = []
    manifest_path = resources_dir / "manifest.json"
    manifest: dict[str, Any] = {}
    manifest_raw: bytes | None = None
    try:
        manifest_raw = manifest_path.read_bytes()
        parsed = json.loads(manifest_raw.decode("utf-8"))
        if not isinstance(parsed, dict):
            errors.append("manifest_object_required")
        else:
            manifest = parsed
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        errors.append(f"manifest_unreadable:{type(exc).__name__}")

    listed = manifest.get("files")
    if (
        not isinstance(listed, list)
        or not listed
        or not all(isinstance(name, str) and name for name in listed)
        or len(set(listed)) != len(listed)
    ):
        errors.append("manifest_file_list_invalid")
        names: list[str] = []
    else:
        names = [str(name) for name in listed]
    if any(Path(name).name != name or Path(name).suffix != ".json" for name in names):
        errors.append("manifest_file_name_invalid")

    try:
        physical_names = sorted(
            path.name for path in resources_dir.iterdir() if path.is_file()
        )
    except OSError as exc:
        physical_names = []
        errors.append(f"resource_directory_unreadable:{type(exc).__name__}")
    if set(physical_names) != {"manifest.json", *names}:
        errors.append("resource_file_set_mismatch")

    resource_hashes: dict[str, str] = {}
    content_hasher = hashlib.sha256()
    for name in sorted(names):
        try:
            raw = (resources_dir / name).read_bytes()
            parsed_resource = json.loads(raw.decode("utf-8"))
            if not isinstance(parsed_resource, dict):
                errors.append(f"resource_object_required:{name}")
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            errors.append(f"resource_unreadable:{name}:{type(exc).__name__}")
            continue
        resource_hashes[name] = hashlib.sha256(raw).hexdigest()
        content_hasher.update(name.encode("utf-8"))
        content_hasher.update(b"\0")
        content_hasher.update(raw)
    computed_content_hash = content_hasher.hexdigest()
    if len(resource_hashes) != len(names):
        errors.append("resource_hash_set_incomplete")
    if manifest.get("content_hash") != computed_content_hash:
        errors.append("content_hash_mismatch")
    for field in (
        "resource_id",
        "resource_pack_version",
        "schema_version",
        "content_hash",
    ):
        if not isinstance(manifest.get(field), str) or not manifest.get(field):
            errors.append(f"manifest_identity_missing:{field}")

    return {
        "ok": not errors,
        "errors": errors,
        "label": label,
        "resource_id": manifest.get("resource_id"),
        "resource_pack_version": manifest.get("resource_pack_version"),
        "schema_version": manifest.get("schema_version"),
        "content_hash": computed_content_hash,
        "manifest_path": _relative(manifest_path),
        "manifest_raw_sha256": (
            hashlib.sha256(manifest_raw).hexdigest()
            if manifest_raw is not None
            else None
        ),
        "manifest_semantic_sha256": (
            semantic_json_hash(manifest) if manifest else None
        ),
        "files": sorted(names),
        "resource_raw_sha256": resource_hashes,
    }


def _load_attested_compact_payloads(
    resources_dir: Path,
    *,
    locked_evidence: dict[str, Any],
    expected_snapshot: dict[str, Any],
    snapshot_prefix: str,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    """Read one compact pack into memory and verify every consumed byte."""

    manifest_raw = (resources_dir / "manifest.json").read_bytes()
    manifest_raw_sha256 = hashlib.sha256(manifest_raw).hexdigest()
    if (
        manifest_raw_sha256 != locked_evidence.get("manifest_raw_sha256")
        or manifest_raw_sha256
        != expected_snapshot.get(f"{snapshot_prefix}_manifest_raw_sha256")
    ):
        raise RuntimeError(f"attested_{snapshot_prefix}_manifest_bytes_mismatch")
    manifest = json.loads(manifest_raw.decode("utf-8"))
    if not isinstance(manifest, dict):
        raise RuntimeError(f"attested_{snapshot_prefix}_manifest_object_required")
    if semantic_json_hash(manifest) != expected_snapshot.get(
        f"{snapshot_prefix}_manifest_semantic_sha256"
    ):
        raise RuntimeError(f"attested_{snapshot_prefix}_manifest_semantic_mismatch")

    names = manifest.get("files")
    if (
        not isinstance(names, list)
        or not names
        or not all(isinstance(name, str) and Path(name).name == name for name in names)
        or len(set(names)) != len(names)
        or sorted(names) != locked_evidence.get("files")
    ):
        raise RuntimeError(f"attested_{snapshot_prefix}_file_set_mismatch")
    expected_hashes = expected_snapshot.get(
        f"{snapshot_prefix}_resource_raw_sha256"
    )
    if (
        not isinstance(expected_hashes, dict)
        or expected_hashes != locked_evidence.get("resource_raw_sha256")
        or set(expected_hashes) != set(names)
    ):
        raise RuntimeError(f"attested_{snapshot_prefix}_resource_hash_authority")

    payloads: dict[str, dict[str, Any]] = {}
    content_hasher = hashlib.sha256()
    for name in sorted(names):
        raw = (resources_dir / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != expected_hashes.get(name):
            raise RuntimeError(
                f"attested_{snapshot_prefix}_resource_bytes_mismatch:{name}"
            )
        value = json.loads(raw.decode("utf-8"))
        if not isinstance(value, dict):
            raise RuntimeError(
                f"attested_{snapshot_prefix}_resource_object_required:{name}"
            )
        payloads[name] = value
        content_hasher.update(name.encode("utf-8"))
        content_hasher.update(b"\0")
        content_hasher.update(raw)
    content_hash = content_hasher.hexdigest()
    if (
        content_hash != manifest.get("content_hash")
        or content_hash != locked_evidence.get("content_hash")
        or content_hash != expected_snapshot.get(f"{snapshot_prefix}_content_sha256")
    ):
        raise RuntimeError(f"attested_{snapshot_prefix}_content_hash_mismatch")
    return manifest, payloads


def _build_attested_language_resources(
    manifest: dict[str, Any], payloads: dict[str, dict[str, Any]]
) -> CompactResources:
    def entries(name: str) -> list[Any]:
        value = payloads.get(name, {}).get("entries")
        if not isinstance(value, list):
            raise RuntimeError(f"attested_language_entries_invalid:{name}")
        return value

    return CompactResources(
        manifest=manifest,
        romanized=frozenset(
            str(value).lower()
            for value in entries("high_confidence_romanized_nepali.json")
        ),
        english_accounting=frozenset(
            str(value).lower()
            for value in entries("high_confidence_english_accounting.json")
        ),
        ambiguous_latin=frozenset(
            str(value).lower() for value in entries("ambiguous_latin.json")
        ),
        named_entity_candidates=frozenset(
            str(value).lower()
            for value in entries("named_entity_candidates.json")
        ),
        protected_prefixes=tuple(entries("protected_prefixes.json")),
        version=str(manifest["resource_pack_version"]),
        content_hash=str(manifest["content_hash"]),
    )


def _build_attested_normalization_resources(
    manifest: dict[str, Any], payloads: dict[str, dict[str, Any]]
) -> CompactNormResources:
    whitespace = payloads.get("whitespace_equivalence.json", {}).get("map")
    digits = payloads.get("digit_equivalence.json", {}).get("map")
    punctuation = payloads.get("punctuation_candidates.json", {}).get("entries")
    abbreviations = payloads.get("abbreviation_candidates.json", {}).get("entries")
    repetition = payloads.get("repetition_thresholds.json", {}).get("thresholds")
    security = payloads.get("security_categories.json", {}).get("categories")
    if not all(
        isinstance(value, dict)
        for value in (
            whitespace,
            digits,
            punctuation,
            abbreviations,
            repetition,
            security,
        )
    ):
        raise RuntimeError("attested_normalization_payload_contract_invalid")
    return CompactNormResources(
        manifest=manifest,
        whitespace_map={str(key): str(value) for key, value in whitespace.items()},
        digit_map={str(key): str(value) for key, value in digits.items()},
        punctuation_candidates={
            str(key): list(value) for key, value in punctuation.items()
        },
        abbreviations={
            str(key).lower(): list(value) for key, value in abbreviations.items()
        },
        repetition_min_run=int(repetition.get("min_run", 3)),
        security_categories={str(key): list(value) for key, value in security.items()},
        version=str(manifest["resource_pack_version"]),
        content_hash=str(manifest["content_hash"]),
    )


def _pack_evidence() -> dict[str, Any]:
    verification = check_pack()
    manifest_path = CANDIDATE_PACK_DIR / "manifest.json"
    manifest = _load_json(manifest_path) if manifest_path.is_file() else {}
    return {
        "ok": verification.get("ok") is True,
        "errors": list(verification.get("errors", [])),
        "pack_version": verification.get("pack_version"),
        "content_hash": verification.get("content_hash"),
        "manifest_path": _relative(manifest_path),
        "manifest_raw_sha256": (
            sha256_file(manifest_path) if manifest_path.is_file() else None
        ),
        "manifest_semantic_sha256": (
            semantic_json_hash(manifest) if manifest else None
        ),
    }


def _expected_chain_paths() -> dict[str, str]:
    return {
        "locked_not_run_path": _relative(LOCKED_PATH),
        "lock_record_path": _relative(LOCK_RECORD_PATH),
        "attempt_intent_path": _relative(ATTEMPT_INTENT_PATH),
        "holdout_attempt_path": _relative(ATTEMPT_PATH),
        "qualification_path": _relative(QUALIFICATION_PATH),
        "output_binding_manifest_path": _relative(OUTPUT_BINDING_PATH),
    }


def _expected_artifact_authority() -> dict[str, tuple[str, str]]:
    return {
        name: (_relative(path), kind)
        for name, (path, kind) in _output_artifacts().items()
    }


def _expected_split_file_authority() -> dict[str, str]:
    return {
        split: _relative(OUT / SPLIT_FILES[split]) for split in HOLDOUT_SPLITS
    }


def _holdout_artifact_paths() -> tuple[Path, ...]:
    paths: list[Path] = [
        ATTEMPT_INTENT_PATH,
        ATTEMPT_PATH,
        QUALIFICATION_PATH,
        OUTPUT_BINDING_PATH,
        CHAIN_PATH,
    ]
    for split in HOLDOUT_SPLITS:
        paths.append(REPORTS / f"{split.lower()}_score_report.json")
        paths.append(REPORTS / f"{split.lower()}_predictions.jsonl")
    return tuple(paths)


def preflight() -> dict[str, Any]:
    assert_active_default_immutable()
    pack = _pack_evidence()
    language_pack = _compact_resource_pack_evidence(
        LANGUAGE_RESOURCES_DIR, label="MAI05_LANGUAGE_RESOURCES"
    )
    normalization_pack = _compact_resource_pack_evidence(
        NORMALIZATION_RESOURCES_DIR, label="MAI06_NORMALIZATION_RESOURCES"
    )
    runtime_environment = _runtime_environment_evidence()
    dataset = _validate_manifest()
    parent = _parent_r3n5_invalidation()
    protocol = _validate_governance_protocol()
    thresholds = _load_json(THRESHOLDS_PATH)
    threshold_minima_ok = thresholds.get("minimum_denominators") == MINIMUM_DENOMINATORS
    threshold_lock_ok = thresholds.get("locked_before_holdout") is True
    threshold_identity_ok = thresholds.get("threshold_id") == "MAI_07R3N6_THRESHOLDS_V1"
    try:
        require_exact_threshold_gate_spec(thresholds)
    except (TypeError, ValueError) as exc:
        threshold_gate_spec_ok = False
        threshold_gate_spec_error = str(exc)
    else:
        threshold_gate_spec_ok = True
        threshold_gate_spec_error = None
    expected_behavior_authority_ok = (
        EXPECTED_BEHAVIOR_ENUM <= ALLOWED_EXPECTED_BEHAVIORS
    )
    development = score_development(write=False)
    audit_observations_persisted = (
        development.get("observation_persistence", {}).get("ok") is True
    )
    no_holdout_artifacts = not any(
        path.exists() for path in _holdout_artifact_paths()
    )
    return {
        "ok": bool(
            pack.get("ok")
            and language_pack.get("ok")
            and normalization_pack.get("ok")
            and runtime_environment.get("ok")
            and dataset["ok"]
            and parent["ok"]
            and protocol["ok"]
            and threshold_minima_ok
            and threshold_lock_ok
            and threshold_identity_ok
            and threshold_gate_spec_ok
            and expected_behavior_authority_ok
            and development.get("ok")
            and development.get("split_expected_pass") is True
            and audit_observations_persisted
            and no_holdout_artifacts
            and RUNTIME_VERSION == PARENT_RUNTIME_VERSION
            and ENABLE_PROMOTION_OVERLAY is False
        ),
        "pack": pack,
        "language_resource_pack": language_pack,
        "normalization_resource_pack": normalization_pack,
        "runtime_environment": runtime_environment,
        "dataset": {"ok": dataset["ok"], "errors": dataset["errors"]},
        "parent_r3n5_invalidation": parent,
        "governance_protocol": protocol,
        "threshold_minima_ok": threshold_minima_ok,
        "threshold_lock_ok": threshold_lock_ok,
        "threshold_identity_ok": threshold_identity_ok,
        "threshold_gate_spec_ok": threshold_gate_spec_ok,
        "threshold_gate_spec_error": threshold_gate_spec_error,
        "expected_behavior_authority_ok": expected_behavior_authority_ok,
        "development_ok": development.get("ok"),
        "canonical_audit_agreement": development.get("agreement"),
        "case_agreement": development.get("case_agreement"),
        "split_expected_pass": development.get("split_expected_pass"),
        "audit_observations_persisted": audit_observations_persisted,
        "no_holdout_artifacts": no_holdout_artifacts,
    }


def _locked_body() -> dict[str, Any]:
    manifest = _load_json(MANIFEST_PATH)
    thresholds = _load_json(THRESHOLDS_PATH)
    development = _load_json(DEVELOPMENT_REPORT_PATH)
    pack = _pack_evidence()
    language_pack = _compact_resource_pack_evidence(
        LANGUAGE_RESOURCES_DIR, label="MAI05_LANGUAGE_RESOURCES"
    )
    normalization_pack = _compact_resource_pack_evidence(
        NORMALIZATION_RESOURCES_DIR, label="MAI06_NORMALIZATION_RESOURCES"
    )
    runtime_environment = _runtime_environment_evidence()
    source_hashes = _source_hashes()
    population_payload = {
        "required_populations": list(REQUIRED_POPULATIONS),
        "minimum_denominators": MINIMUM_DENOMINATORS,
    }
    return {
        "schema_version": "2.0.0",
        "manifest_id": RC_ID,
        "seal_contract_version": SEAL_CONTRACT_VERSION,
        "ENABLE_PROMOTION_OVERLAY": False,
        "overlay_enabled": False,
        "default_active": False,
        "candidate_promoted": False,
        "active_default_runtime_unchanged": PARENT_RUNTIME_VERSION,
        "active_default_resource_hash": PARENT_RESOURCE_HASH,
        "candidate_runtime_version": CANDIDATE_RUNTIME_VERSION,
        "candidate_policy_version": CANDIDATE_POLICY_VERSION,
        "candidate_resource_pack_version": PACK_VERSION,
        "candidate_resource_content_sha256": pack["content_hash"],
        "candidate_resource_pack_evidence": pack,
        "language_resource_pack_evidence": language_pack,
        "normalization_resource_pack_evidence": normalization_pack,
        "runtime_environment": runtime_environment,
        "correction_scope": "COMPLETE_INDEPENDENT_SCORING_AND_OUTPUT_BINDING",
        "parent_invalidated_r3n5_lineage": _parent_r3n5_invalidation(),
        "governance_protocol": {
            "path": PROTOCOL_PATH.relative_to(REPO).as_posix(),
            "raw_sha256": sha256_file(PROTOCOL_PATH),
            "status": "ACCEPTED_BEFORE_R3N6_LOCK",
        },
        "target_authority": {
            "schema_version": "mai07_r3n5_target_span_v1",
            "offset_unit": "UNICODE_CODE_POINT",
            "source_sha256": source_hashes[
                "erp_bot/src/oip/modules/language_runtime/transliteration/"
                "application/r3n5_target_span_contract.py"
            ],
        },
        "dataset_manifest": manifest,
        "dataset_manifest_sha256": sha256_file(MANIFEST_PATH),
        "threshold_manifest": thresholds,
        "threshold_manifest_sha256": sha256_file(THRESHOLDS_PATH),
        "population_definition_hash": hashlib.sha256(
            json.dumps(
                population_payload, sort_keys=True, separators=(",", ":")
            ).encode("utf-8")
        ).hexdigest(),
        "minimum_denominator_policy": MINIMUM_DENOMINATORS,
        "expected_behavior_enum": sorted(ALLOWED_EXPECTED_BEHAVIORS),
        "required_threshold_gate_spec": REQUIRED_GATE_SPEC,
        "required_report_metric_keys": sorted(REQUIRED_METRIC_KEYS),
        "required_report_gate_keys": sorted(REQUIRED_REPORT_GATE_KEYS),
        "scorer_version": SCORER_VERSION,
        "scoring_contract_version": CONTRACT_VERSION,
        "source_hashes": source_hashes,
        "development_report_raw_sha256": sha256_file(DEVELOPMENT_REPORT_PATH),
        "development_report_semantic_sha256": semantic_json_hash(development),
        "development_all_required_pass": development.get("ok") is True,
        "development_canonical_audit_agreement": development.get(
            "agreement", {}
        ).get("ok")
        is True,
        "development_case_agreement": development.get("case_agreement", {}).get(
            "ok"
        )
        is True,
        "development_split_expected_pass": development.get(
            "split_expected_pass"
        )
        is True,
        "audit_observations_persisted": development.get(
            "observation_persistence", {}
        ).get("ok")
        is True,
        "complete_metric_gate_comparison_required": True,
        "split_expected_pass_independently_scored": True,
        "attempt_intent_written_before_holdout": True,
        "output_binding_schema_version": "mai07_r3n6_output_binding_v1",
        "required_output_artifact_names": sorted(expected_output_artifact_names()),
        "all_verdict_outputs_attempt_time_bound": True,
        "holdout_not_run": True,
        "r3n5_predictions_used_for_candidate_or_dataset": False,
        "prohibited_for_training": True,
        "quality_gates_passed": False,
        "linguist_approved": False,
        "production_approved": False,
        "MAI-07": "NEEDS_CORRECTIVE_WORK",
        "MAI-08": "NOT_STARTED",
        "rc_lineage": {
            "rc_id": RC_ID,
            "attempt_id": ATTEMPT_ID,
            "prior_rc_ids": [RC_001_ID, RC_002_ID, RC_003_ID],
            "prior_attempt_ids": [ATTEMPT_001_ID, ATTEMPT_003_ID],
            "prior_attempt_001_disposition": "CRASHED_PRE_SCORE_HARNESS_UNPACK",
            "prior_rc_002_disposition": "LOCKED_NOT_ATTEMPTED_LOCK_RECORD_AUTHORITY_MISMATCH",
            "prior_attempt_003_disposition": (
                "SCORED_COMPLETE_CHAIN_BINDING_FAILED_VERIFIER_NOT_APPLICABLE"
            ),
            "prior_predictions_written": True,
            "prior_scores_written": True,
            "prior_chain_written": False,
            "threshold_or_runtime_behavior_changed": False,
            "harness_fix": (
                "attested_5tuple_unpack; chain expected_cases_by_split; "
                "NOT_APPLICABLE gate outcome accepted when pass=true"
            ),
        },
    }


def lock_rc() -> dict[str, Any]:
    if os.environ.get(AUTHORIZE_LOCK_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_LOCK_ENV}=1 to create immutable R3N6 lock")
    if LOCKED_PATH.exists() or LOCK_RECORD_PATH.exists():
        raise FileExistsError("r3n6_lock_already_exists")
    os.environ["MAI07_AUTHORIZE_R3N6_DEVELOPMENT_WRITE"] = "1"
    development = score_development(write=True)
    if not development.get("ok"):
        return {"ok": False, "verdict": "FAILED_DEVELOPMENT"}
    ready = preflight()
    if not ready["ok"]:
        return {"ok": False, "verdict": "BLOCKED_PREFLIGHT", "preflight": ready}
    body = _locked_body()
    with tempfile.TemporaryDirectory(prefix="mai07_r3n6_lock_dry_") as temporary:
        dry_path = Path(temporary) / "LOCKED_NOT_RUN.json"
        build_locked_rc(body, output_path=dry_path)
        verification = verify_locked_rc(_load_json(dry_path))
        if not verification["ok"]:
            return {
                "ok": False,
                "verdict": "INVALID_DRY_LOCK",
                "verification": verification,
            }
    result = build_locked_rc(body, output_path=LOCKED_PATH)
    locked_body = _load_json(LOCKED_PATH)
    final_verification = verify_locked_rc(locked_body)
    if not final_verification["ok"]:
        raise RuntimeError(
            f"immutable_lock_verification_failed:{final_verification['errors']}"
        )
    record = create_lock_record(
        rc_id=RC_ID,
        locked_path=LOCKED_PATH,
        locked_body=locked_body,
        parent_lock_semantic=PARENT_INVALIDATED_R3N5_LOCK_SEMANTIC,
        provenance="MAI_07R3N6_APPEND_ONLY_COMPLETE_OUTPUT_CHAIN",
    )
    write_json_immutable(LOCK_RECORD_PATH, record)
    return {
        "ok": True,
        "verdict": "LOCKED_NOT_RUN",
        "semantic_sha256": result["rc_manifest_semantic_sha256"],
        "physical_raw_sha256": sha256_file(LOCKED_PATH),
        "prior_rc_ids": [RC_001_ID, RC_002_ID, RC_003_ID],
        "prior_attempt_ids": [ATTEMPT_001_ID, ATTEMPT_003_ID],
    }


def _expected_metric_passes(report: dict[str, Any], count: int) -> bool:
    metric = report.get("metrics", {}).get("split_expected_pass", {})
    return bool(
        metric.get("numerator") == count
        and metric.get("denominator") == count
        and metric.get("scorer_version") == SCORER_VERSION
    )


_OBSERVATION_BOOLEAN_FIELDS = frozenset(
    {
        "target_contract_valid",
        "runtime_contract_valid",
        "span_found",
        "identity_top1",
        "identity_retained",
        "exact_raw_identity",
        "exactly_one_identity",
        "finalizer_idempotence",
        "serialization_roundtrip",
        "path_finalized",
        "anchor_valid",
        "false_devanagari_top1",
        "devanagari_at_5",
        "raw_text_unchanged",
        "caps_ok",
    }
)
_OBSERVATION_EVIDENCE_FIELDS = frozenset(
    {
        "case_input_text_sha256",
        "case_target_source_text_sha256",
        "case_target_raw_surface_sha256",
        "runtime_bundle_semantic_sha256",
        "runtime_bundle",
    }
)
_COMMON_OBSERVATION_FIELDS = frozenset(
    {
        "case_id",
        "populations",
        "expected_behavior",
        "candidate_count",
        *_OBSERVATION_BOOLEAN_FIELDS,
        *_OBSERVATION_EVIDENCE_FIELDS,
    }
)
_CANONICAL_OBSERVATION_FIELDS = frozenset(
    {*_COMMON_OBSERVATION_FIELDS, "parent_identity_top1"}
)
_AUDIT_OBSERVATION_FIELDS = _COMMON_OBSERVATION_FIELDS


def _bind_runtime_evidence(
    case: dict[str, Any], bundle: TransliterationBundleV1, observation: dict[str, Any]
) -> dict[str, Any]:
    bundle_payload = bundle.model_dump(mode="json")
    return {
        **observation,
        "case_input_text_sha256": hashlib.sha256(
            case["input_text"].encode("utf-8")
        ).hexdigest(),
        "case_target_source_text_sha256": case["target_source_text_sha256"],
        "case_target_raw_surface_sha256": case["target_raw_surface_sha256"],
        "runtime_bundle_semantic_sha256": semantic_json_hash(bundle_payload),
        "runtime_bundle": bundle_payload,
    }


def _validate_persisted_observation(
    case: dict[str, Any], observation: dict[str, Any], side: str
) -> list[str]:
    errors: list[str] = []
    expected_fields = (
        _CANONICAL_OBSERVATION_FIELDS
        if side == "canonical"
        else _AUDIT_OBSERVATION_FIELDS
    )
    if set(observation) != set(expected_fields):
        errors.append("keyset")
    if observation.get("case_id") != case.get("case_id"):
        errors.append("case_id")
    populations = observation.get("populations")
    if not isinstance(populations, list) or not all(
        isinstance(value, str) for value in populations
    ):
        errors.append("populations_type")
    for field in _OBSERVATION_BOOLEAN_FIELDS:
        if type(observation.get(field)) is not bool:
            errors.append(f"boolean_type:{field}")
    candidate_count = observation.get("candidate_count")
    if type(candidate_count) is not int or candidate_count < 0:
        errors.append("candidate_count_type")
    if side == "canonical" and observation.get("parent_identity_top1") not in (
        None,
        True,
        False,
    ):
        errors.append("parent_identity_top1_type")
    expected_hash_fields = {
        "case_input_text_sha256": hashlib.sha256(
            str(case.get("input_text", "")).encode("utf-8")
        ).hexdigest(),
        "case_target_source_text_sha256": case.get("target_source_text_sha256"),
        "case_target_raw_surface_sha256": case.get("target_raw_surface_sha256"),
    }
    for field, expected in expected_hash_fields.items():
        if observation.get(field) != expected:
            errors.append(field)
    bundle_payload = observation.get("runtime_bundle")
    if not isinstance(bundle_payload, dict):
        errors.append("runtime_bundle_type")
        return errors
    if observation.get("runtime_bundle_semantic_sha256") != semantic_json_hash(
        bundle_payload
    ):
        errors.append("runtime_bundle_semantic_sha256")
    try:
        bundle = TransliterationBundleV1.model_validate(bundle_payload)
    except (TypeError, ValueError):
        errors.append("runtime_bundle_contract")
    else:
        if bundle.runtime_version != CANDIDATE_RUNTIME_VERSION:
            errors.append("runtime_bundle_version")
        if bundle.resource_hash != EXPECTED_SOURCE_CONTENT_HASH:
            errors.append("runtime_bundle_resource_hash")
    return errors


def _write_json_exclusive(path: Path, payload: dict[str, Any]) -> str:
    """Atomically create a JSON claim; the path must not already exist."""

    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(
        payload, ensure_ascii=False, indent=2, sort_keys=True
    ) + "\n"
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(encoded)
    return sha256_file(path)


def _authorize_split_scoring(
    split: str, *, intent_raw_sha256: str
) -> dict[str, Any]:
    if split not in HOLDOUT_SPLITS:
        raise ValueError(f"unknown_r3n6_holdout_split:{split}")
    if os.environ.get(AUTHORIZE_HOLDOUT_ENV) != "1":
        raise PermissionError(f"Set {AUTHORIZE_HOLDOUT_ENV}=1 before scoring")
    if not LOCKED_PATH.is_file() or not LOCK_RECORD_PATH.is_file():
        raise PermissionError("r3n6_scoring_requires_complete_lock")
    if not ATTEMPT_INTENT_PATH.is_file():
        raise PermissionError("r3n6_scoring_requires_exclusive_attempt_intent")
    if any(
        path.exists()
        for path in (ATTEMPT_PATH, QUALIFICATION_PATH, OUTPUT_BINDING_PATH, CHAIN_PATH)
    ):
        raise PermissionError("r3n6_attempt_already_finalizing_or_consumed")
    actual_intent_raw = sha256_file(ATTEMPT_INTENT_PATH)
    if actual_intent_raw != intent_raw_sha256:
        raise PermissionError("r3n6_attempt_intent_capability_mismatch")
    intent = _load_json(ATTEMPT_INTENT_PATH)
    locked = _load_json(LOCKED_PATH)
    lock_semantic = compute_rc_semantic_body_sha256(locked)
    lock_raw = sha256_file(LOCKED_PATH)
    required_intent = {
        "record_type": "HOLDOUT_ATTEMPT_INTENT",
        "attempt_id": ATTEMPT_ID,
        "rc_id": RC_ID,
        "parent_lock_semantic_sha256": lock_semantic,
        "parent_lock_raw_sha256": lock_raw,
        "split": "HOLDOUT_VALIDATION",
        "command": ONE_SHOT_COMMAND,
        "status": "LOCKED_NOT_RUN",
        "all_splits": list(HOLDOUT_SPLITS),
        "claim_created_exclusively": True,
        "lock_record_path": _relative(LOCK_RECORD_PATH),
        "lock_record_raw_sha256": sha256_file(LOCK_RECORD_PATH),
    }
    mismatches = [
        field
        for field, expected in required_intent.items()
        if intent.get(field) != expected
    ]
    if mismatches:
        raise PermissionError(
            "r3n6_attempt_intent_contract_mismatch:" + ",".join(mismatches)
        )
    locked_inputs = _verify_locked_inputs(locked)
    if not locked_inputs["ok"]:
        raise PermissionError(
            f"r3n6_locked_input_drift:{locked_inputs['errors']}"
        )
    if intent.get("locked_input_snapshot") != locked_inputs["snapshot"]:
        raise PermissionError("r3n6_intent_locked_input_snapshot_drift")
    return {
        "intent": intent,
        "locked": locked,
        "locked_input_snapshot": locked_inputs["snapshot"],
    }


def _load_attested_attempt_inputs(
    *,
    locked: dict[str, Any],
    expected_snapshot: dict[str, Any],
    resource_snapshot_dir: Path,
) -> tuple[
    dict[str, list[dict[str, Any]]],
    dict[str, Any],
    Any,
    CompactResources,
    CompactNormResources,
]:
    """Load exactly the bytes named by the lock into immutable memory/temp state."""

    thresholds_raw = THRESHOLDS_PATH.read_bytes()
    if hashlib.sha256(thresholds_raw).hexdigest() != expected_snapshot.get(
        "threshold_manifest_raw_sha256"
    ):
        raise RuntimeError("attested_threshold_bytes_mismatch")
    thresholds = json.loads(thresholds_raw.decode("utf-8"))
    if not isinstance(thresholds, dict) or thresholds != locked.get(
        "threshold_manifest"
    ):
        raise RuntimeError("attested_threshold_content_mismatch")
    require_exact_threshold_gate_spec(thresholds)

    cases_by_split: dict[str, list[dict[str, Any]]] = {}
    expected_split_hashes = expected_snapshot.get("dataset_split_raw_sha256", {})
    locked_split_metadata = locked.get("dataset_manifest", {}).get("splits", {})
    for split in HOLDOUT_SPLITS:
        path = OUT / SPLIT_FILES[split]
        raw = path.read_bytes()
        raw_sha256 = hashlib.sha256(raw).hexdigest()
        metadata = locked_split_metadata.get(split, {})
        if (
            raw_sha256 != expected_split_hashes.get(split)
            or raw_sha256 != metadata.get("sha256")
        ):
            raise RuntimeError(f"attested_split_bytes_mismatch:{split}")
        cases = _parse_jsonl_bytes(raw, label=split)
        if len(cases) != metadata.get("count") or len(cases) != SPLIT_COUNTS[split]:
            raise RuntimeError(f"attested_split_count_mismatch:{split}")
        cases_by_split[split] = cases

    manifest_raw = (CANDIDATE_PACK_DIR / "manifest.json").read_bytes()
    if hashlib.sha256(manifest_raw).hexdigest() != expected_snapshot.get(
        "candidate_pack_manifest_raw_sha256"
    ):
        raise RuntimeError("attested_pack_manifest_bytes_mismatch")
    pack_manifest = json.loads(manifest_raw.decode("utf-8"))
    if not isinstance(pack_manifest, dict):
        raise RuntimeError("attested_pack_manifest_object_required")
    manifest_files = pack_manifest.get("files")
    sealed_hashes = pack_manifest.get("seal_v2", {}).get(
        "resource_file_hashes"
    )
    if set(manifest_files or []) != set(ALLOWED_FILES) or not isinstance(
        sealed_hashes, dict
    ) or set(sealed_hashes) != set(ALLOWED_FILES):
        raise RuntimeError("attested_pack_file_set_mismatch")
    expected_resource_hashes = expected_snapshot.get(
        "candidate_pack_resource_raw_sha256", {}
    )
    resource_snapshot_dir.mkdir(parents=True, exist_ok=True)
    (resource_snapshot_dir / "manifest.json").write_bytes(manifest_raw)
    for name in ALLOWED_FILES:
        raw = (CANDIDATE_PACK_DIR / name).read_bytes()
        raw_sha256 = hashlib.sha256(raw).hexdigest()
        if (
            raw_sha256 != sealed_hashes.get(name)
            or raw_sha256 != expected_resource_hashes.get(name)
        ):
            raise RuntimeError(f"attested_pack_resource_bytes_mismatch:{name}")
        (resource_snapshot_dir / name).write_bytes(raw)
    resources = load_resources(resources_dir=resource_snapshot_dir)

    language_manifest, language_payloads = _load_attested_compact_payloads(
        LANGUAGE_RESOURCES_DIR,
        locked_evidence=locked.get("language_resource_pack_evidence", {}),
        expected_snapshot=expected_snapshot,
        snapshot_prefix="language_pack",
    )
    language_resources = _build_attested_language_resources(
        language_manifest, language_payloads
    )
    normalization_manifest, normalization_payloads = (
        _load_attested_compact_payloads(
            NORMALIZATION_RESOURCES_DIR,
            locked_evidence=locked.get(
                "normalization_resource_pack_evidence", {}
            ),
            expected_snapshot=expected_snapshot,
            snapshot_prefix="normalization_pack",
        )
    )
    normalization_resources = _build_attested_normalization_resources(
        normalization_manifest, normalization_payloads
    )

    post_load = _verify_locked_inputs(locked)
    if not post_load["ok"] or post_load["snapshot"] != expected_snapshot:
        raise RuntimeError(
            f"locked_input_drift_during_attested_load:{post_load['errors']}"
        )
    return (
        cases_by_split,
        thresholds,
        resources,
        language_resources,
        normalization_resources,
    )


def _score_split_once(*args: Any, **kwargs: Any) -> dict[str, Any]:
    """Fail closed: holdout scoring exists only inside one_shot_holdout()."""

    del args, kwargs
    raise PermissionError("r3n6_holdout_scoring_requires_internal_single_use_session")


def _write_jsonl_immutable(path: Path, rows: list[dict[str, Any]]) -> None:
    if path.exists():
        raise FileExistsError(f"refusing to overwrite immutable artifact: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(
            json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            + "\n"
            for row in rows
        ),
        encoding="utf-8",
        newline="\n",
    )


def _verify_locked_inputs(locked: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    expected_lock_keys = set(_locked_body()) | {
        "status",
        "locked",
        "locked_before_holdout",
        "rc_manifest_semantic_sha256",
        "manifest_sha256",
        "rc_manifest_raw_sha256",
    }
    if set(locked) != expected_lock_keys:
        errors.append("locked_keyset_mismatch")
    verified = verify_locked_rc(
        locked, expected_semantic=locked.get("rc_manifest_semantic_sha256")
    )
    errors.extend(verified["errors"])
    if locked.get("manifest_id") != RC_ID:
        errors.append("locked_rc_id_mismatch")
    if locked.get("candidate_runtime_version") != CANDIDATE_RUNTIME_VERSION:
        errors.append("locked_runtime_mismatch")
    critical_lock_authority = {
        "schema_version": "2.0.0",
        "status": "LOCKED_NOT_RUN",
        "locked": True,
        "locked_before_holdout": True,
        "ENABLE_PROMOTION_OVERLAY": False,
        "overlay_enabled": False,
        "default_active": False,
        "candidate_promoted": False,
        "active_default_runtime_unchanged": PARENT_RUNTIME_VERSION,
        "active_default_resource_hash": PARENT_RESOURCE_HASH,
        "candidate_resource_pack_version": PACK_VERSION,
        "correction_scope": "COMPLETE_INDEPENDENT_SCORING_AND_OUTPUT_BINDING",
        "complete_metric_gate_comparison_required": True,
        "split_expected_pass_independently_scored": True,
        "attempt_intent_written_before_holdout": True,
        "output_binding_schema_version": "mai07_r3n6_output_binding_v1",
        "all_verdict_outputs_attempt_time_bound": True,
        "r3n5_predictions_used_for_candidate_or_dataset": False,
        "quality_gates_passed": False,
        "linguist_approved": False,
        "production_approved": False,
        "holdout_not_run": True,
        "prohibited_for_training": True,
        "MAI-07": "NEEDS_CORRECTIVE_WORK",
        "MAI-08": "NOT_STARTED",
    }
    for field, expected in critical_lock_authority.items():
        if locked.get(field) != expected:
            errors.append(f"locked_authority_field_drift:{field}")
    current_sources = _source_hashes()
    if locked.get("source_hashes") != current_sources:
        errors.append("locked_source_hash_drift")
    physical_manifest = _load_json(MANIFEST_PATH)
    if locked.get("dataset_manifest") != physical_manifest:
        errors.append("locked_dataset_manifest_content_drift")
    manifest_raw = sha256_file(MANIFEST_PATH)
    if locked.get("dataset_manifest_sha256") != manifest_raw:
        errors.append("dataset_manifest_hash_drift")
    physical_thresholds = _load_json(THRESHOLDS_PATH)
    if locked.get("threshold_manifest") != physical_thresholds:
        errors.append("locked_threshold_manifest_content_drift")
    threshold_raw = sha256_file(THRESHOLDS_PATH)
    if locked.get("threshold_manifest_sha256") != threshold_raw:
        errors.append("threshold_manifest_hash_drift")
    if physical_thresholds.get("threshold_id") != "MAI_07R3N6_THRESHOLDS_V1":
        errors.append("threshold_identity_drift")
    if physical_thresholds.get("locked_before_holdout") is not True:
        errors.append("threshold_lock_flag_drift")
    if physical_thresholds.get("minimum_denominators") != MINIMUM_DENOMINATORS:
        errors.append("threshold_minimum_denominators_drift")
    try:
        require_exact_threshold_gate_spec(physical_thresholds)
    except (TypeError, ValueError) as exc:
        errors.append(f"threshold_gate_contract_drift:{exc}")
    if locked.get("required_threshold_gate_spec") != REQUIRED_GATE_SPEC:
        errors.append("locked_required_threshold_gate_spec_drift")
    if locked.get("required_report_metric_keys") != sorted(REQUIRED_METRIC_KEYS):
        errors.append("locked_required_metric_keyset_drift")
    if locked.get("required_report_gate_keys") != sorted(
        REQUIRED_REPORT_GATE_KEYS
    ):
        errors.append("locked_required_gate_keyset_drift")
    if locked.get("expected_behavior_enum") != sorted(
        ALLOWED_EXPECTED_BEHAVIORS
    ):
        errors.append("locked_expected_behavior_enum_drift")
    protocol = locked.get("governance_protocol", {})
    protocol_raw = sha256_file(PROTOCOL_PATH)
    if protocol.get("raw_sha256") != protocol_raw:
        errors.append("governance_protocol_hash_drift")
    if not _validate_governance_protocol()["ok"]:
        errors.append("governance_protocol_contract_drift")
    dataset = _validate_manifest()
    if not dataset["ok"]:
        errors.extend(f"dataset:{item}" for item in dataset["errors"])
    parent = _parent_r3n5_invalidation()
    recorded_parent = locked.get("parent_invalidated_r3n5_lineage", {})
    if parent.get("ok") is not True:
        errors.append("parent_invalidation_authority_invalid")
    if recorded_parent != parent:
        errors.append("parent_invalidation_lineage_not_exact")
    for field in (
        "artifact_raw_sha256",
        "artifact_semantic_sha256",
        "verdict",
        "rc_id",
        "attempt_id",
        "lock_semantic_sha256",
        "lock_raw_sha256",
        "runtime_version",
    ):
        if recorded_parent.get(field) != parent.get(field):
            errors.append(f"parent_invalidation_drift:{field}")
    pack = _pack_evidence()
    if not pack["ok"]:
        errors.extend(f"candidate_pack:{item}" for item in pack["errors"])
    if locked.get("candidate_resource_pack_evidence") != pack:
        errors.append("candidate_pack_evidence_drift")
    if locked.get("candidate_resource_content_sha256") != pack.get(
        "content_hash"
    ):
        errors.append("candidate_pack_content_hash_drift")
    language_pack = _compact_resource_pack_evidence(
        LANGUAGE_RESOURCES_DIR, label="MAI05_LANGUAGE_RESOURCES"
    )
    normalization_pack = _compact_resource_pack_evidence(
        NORMALIZATION_RESOURCES_DIR, label="MAI06_NORMALIZATION_RESOURCES"
    )
    for field, current, prefix in (
        ("language_resource_pack_evidence", language_pack, "language_pack"),
        (
            "normalization_resource_pack_evidence",
            normalization_pack,
            "normalization_pack",
        ),
    ):
        if not current["ok"]:
            errors.extend(f"{prefix}:{item}" for item in current["errors"])
        if locked.get(field) != current:
            errors.append(f"{prefix}_evidence_drift")
    runtime_environment = _runtime_environment_evidence()
    if not runtime_environment["ok"]:
        errors.extend(
            f"runtime_environment:{item}"
            for item in runtime_environment["errors"]
        )
    if locked.get("runtime_environment") != runtime_environment:
        errors.append("runtime_environment_drift")

    development = _load_json(DEVELOPMENT_REPORT_PATH)
    development_raw = sha256_file(DEVELOPMENT_REPORT_PATH)
    development_semantic = semantic_json_hash(development)
    if locked.get("development_report_raw_sha256") != development_raw:
        errors.append("development_report_raw_drift")
    if locked.get("development_report_semantic_sha256") != development_semantic:
        errors.append("development_report_semantic_drift")
    development_authority = {
        "development_all_required_pass": development.get("ok") is True,
        "development_canonical_audit_agreement": development.get(
            "agreement", {}
        ).get("ok")
        is True,
        "development_case_agreement": development.get(
            "case_agreement", {}
        ).get("ok")
        is True,
        "development_split_expected_pass": development.get(
            "split_expected_pass"
        )
        is True,
        "audit_observations_persisted": development.get(
            "observation_persistence", {}
        ).get("ok")
        is True,
    }
    if not all(development_authority.values()):
        errors.append("development_authority_not_all_pass")
    for field, expected in development_authority.items():
        if locked.get(field) is not expected:
            errors.append(f"locked_development_authority_drift:{field}")

    lock_raw = sha256_file(LOCKED_PATH)
    lock_semantic = compute_rc_semantic_body_sha256(locked)
    raw_contract_body = {
        key: value
        for key, value in locked.items()
        if key != "rc_manifest_raw_sha256"
    }
    raw_contract = hashlib.sha256(
        (
            json.dumps(
                raw_contract_body,
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n"
        ).encode("utf-8")
    ).hexdigest()
    if locked.get("rc_manifest_raw_sha256") != raw_contract:
        errors.append("locked_raw_contract_mismatch")
    lock_record = _load_json(LOCK_RECORD_PATH)
    expected_lock_record_keys = {
        "schema_version",
        "record_type",
        "rc_id",
        "provenance",
        "locked_at_utc",
        "locked_body_path",
        "locked_rc_body",
        "parent_lock_semantic_sha256",
        "rc_manifest_semantic_sha256",
        "rc_manifest_raw_sha256",
        "seal_contract_version",
    }
    if set(lock_record) != expected_lock_record_keys:
        errors.append("lock_record_keyset_mismatch")
    if lock_record.get("schema_version") != "2.0.0":
        errors.append("lock_record_schema_mismatch")
    if lock_record.get("record_type") != "LOCK_RECORD":
        errors.append("lock_record_type_mismatch")
    if lock_record.get("rc_id") != RC_ID:
        errors.append("lock_record_rc_id_mismatch")
    if Path(str(lock_record.get("locked_body_path", ""))).resolve() != LOCKED_PATH.resolve():
        errors.append("lock_record_path_mismatch")
    if lock_record.get("locked_rc_body") != locked:
        errors.append("lock_record_embedded_body_mismatch")
    if lock_record.get("rc_manifest_raw_sha256") != lock_raw:
        errors.append("lock_record_physical_hash_drift")
    if lock_record.get("rc_manifest_semantic_sha256") != lock_semantic:
        errors.append("lock_record_semantic_hash_drift")
    if lock_record.get("parent_lock_semantic_sha256") != (
        PARENT_INVALIDATED_R3N5_LOCK_SEMANTIC
    ):
        errors.append("lock_record_parent_semantic_mismatch")
    if lock_record.get("provenance") != (
        "MAI_07R3N6_APPEND_ONLY_COMPLETE_OUTPUT_CHAIN"
    ):
        errors.append("lock_record_provenance_mismatch")
    if lock_record.get("seal_contract_version") != SEAL_CONTRACT_VERSION:
        errors.append("lock_record_seal_contract_mismatch")
    lock_record_raw = sha256_file(LOCK_RECORD_PATH)

    snapshot = {
        "lock_raw_sha256": lock_raw,
        "lock_semantic_sha256": lock_semantic,
        "lock_record_raw_sha256": lock_record_raw,
        "lock_record_semantic_sha256": semantic_json_hash(lock_record),
        "source_hashes_semantic_sha256": semantic_json_hash(current_sources),
        "dataset_manifest_raw_sha256": manifest_raw,
        "dataset_manifest_semantic_sha256": semantic_json_hash(physical_manifest),
        "dataset_split_raw_sha256": {
            split: sha256_file(OUT / SPLIT_FILES[split])
            for split in sorted(SPLIT_FILES)
        },
        "threshold_manifest_raw_sha256": threshold_raw,
        "threshold_manifest_semantic_sha256": semantic_json_hash(
            physical_thresholds
        ),
        "development_report_raw_sha256": development_raw,
        "development_report_semantic_sha256": development_semantic,
        "governance_protocol_raw_sha256": protocol_raw,
        "parent_invalidation_raw_sha256": parent["artifact_raw_sha256"],
        "parent_invalidation_semantic_sha256": parent[
            "artifact_semantic_sha256"
        ],
        "candidate_pack_content_sha256": pack["content_hash"],
        "candidate_pack_manifest_raw_sha256": pack["manifest_raw_sha256"],
        "candidate_pack_manifest_semantic_sha256": pack[
            "manifest_semantic_sha256"
        ],
        "candidate_pack_resource_raw_sha256": {
            name: sha256_file(CANDIDATE_PACK_DIR / name)
            for name in sorted(ALLOWED_FILES)
        },
        "language_pack_content_sha256": language_pack["content_hash"],
        "language_pack_manifest_raw_sha256": language_pack[
            "manifest_raw_sha256"
        ],
        "language_pack_manifest_semantic_sha256": language_pack[
            "manifest_semantic_sha256"
        ],
        "language_pack_resource_raw_sha256": language_pack[
            "resource_raw_sha256"
        ],
        "normalization_pack_content_sha256": normalization_pack[
            "content_hash"
        ],
        "normalization_pack_manifest_raw_sha256": normalization_pack[
            "manifest_raw_sha256"
        ],
        "normalization_pack_manifest_semantic_sha256": normalization_pack[
            "manifest_semantic_sha256"
        ],
        "normalization_pack_resource_raw_sha256": normalization_pack[
            "resource_raw_sha256"
        ],
        "runtime_environment_semantic_sha256": semantic_json_hash(
            runtime_environment
        ),
        "requirements_raw_sha256": runtime_environment[
            "requirements_raw_sha256"
        ],
    }
    return {"ok": not errors, "errors": errors, "snapshot": snapshot}


def _output_artifacts() -> dict[str, tuple[Path, str]]:
    artifacts: dict[str, tuple[Path, str]] = {
        "attempt_intent": (ATTEMPT_INTENT_PATH, JSON_KIND),
        "attempt_result": (ATTEMPT_PATH, JSON_KIND),
        "qualification": (QUALIFICATION_PATH, JSON_KIND),
    }
    for split in HOLDOUT_SPLITS:
        stem = split.lower()
        artifacts[f"{stem}_score_report"] = (
            REPORTS / f"{stem}_score_report.json",
            JSON_KIND,
        )
        artifacts[f"{stem}_predictions"] = (
            REPORTS / f"{stem}_predictions.jsonl",
            JSONL_KIND,
        )
    return artifacts


def _recompute_persisted_reports(
    cases: list[dict[str, Any]],
    canonical_observations: list[dict[str, Any]],
    audit_observations: list[dict[str, Any]],
    thresholds: dict[str, Any],
    split: str,
    *,
    replay_resources: Any | None = None,
    replay_language_resources: CompactResources | None = None,
    replay_normalization_resources: CompactNormResources | None = None,
) -> dict[str, Any]:
    """Rebuild observations, reports, and comparisons from persisted bundles."""

    if not (
        len(cases)
        == len(canonical_observations)
        == len(audit_observations)
    ):
        raise ValueError("persisted_runtime_evidence_count_mismatch")
    rebuilt_canonical: list[dict[str, Any]] = []
    rebuilt_audit: list[dict[str, Any]] = []
    for case, canonical_row, audit_row in zip(
        cases, canonical_observations, audit_observations, strict=True
    ):
        canonical_errors = _validate_persisted_observation(
            case, canonical_row, "canonical"
        )
        audit_errors = _validate_persisted_observation(case, audit_row, "audit")
        if canonical_errors or audit_errors:
            raise ValueError(
                "persisted_observation_contract:"
                f"{case.get('case_id')}:{canonical_errors}:{audit_errors}"
            )
        if canonical_row["runtime_bundle"] != audit_row["runtime_bundle"]:
            raise ValueError(
                f"canonical_audit_runtime_bundle_mismatch:{case.get('case_id')}"
            )
        bundle = TransliterationBundleV1.model_validate(
            canonical_row["runtime_bundle"]
        )
        if replay_resources is not None:
            replayed_bundle = transliterate_r3n6(
                case["input_text"],
                resources=replay_resources,
                language_resources=replay_language_resources,
                normalization_resources=replay_normalization_resources,
            )
            if replayed_bundle.model_dump(mode="json") != bundle.model_dump(
                mode="json"
            ):
                raise ValueError(
                    f"runtime_verification_replay_mismatch:{case.get('case_id')}"
                )
        canonical_rebuilt = _bind_runtime_evidence(
            case, bundle, observe_case(case, bundle)
        )
        audit_rebuilt = _bind_runtime_evidence(
            case, bundle, observe_case_audit(case, bundle)
        )
        if canonical_rebuilt != canonical_row:
            raise ValueError(
                f"canonical_observation_not_bundle_derived:{case.get('case_id')}"
            )
        if audit_rebuilt != audit_row:
            raise ValueError(
                f"audit_observation_not_bundle_derived:{case.get('case_id')}"
            )
        rebuilt_canonical.append(canonical_rebuilt)
        rebuilt_audit.append(audit_rebuilt)

    canonical = score_observations(
        cases,
        rebuilt_canonical,
        thresholds=thresholds,
        split=split,
    )
    audit = score_observations_audit(
        cases,
        rebuilt_audit,
        thresholds=thresholds,
        split=split,
    )
    return {
        "canonical": canonical,
        "audit": audit,
        "agreement": compare_canonical_audit(canonical, audit),
        "case_agreement": compare_case_observations(
            rebuilt_canonical, rebuilt_audit
        ),
    }


def _verify_chain_body(chain: dict[str, Any]) -> dict[str, Any]:
    if not LOCKED_PATH.is_file() or not LOCK_RECORD_PATH.is_file():
        return {"ok": False, "errors": ["missing_lock_authority"]}
    locked_inputs = _verify_locked_inputs(_load_json(LOCKED_PATH))
    expected_cases_by_split = {
        split: _load_jsonl(OUT / SPLIT_FILES[split]) for split in HOLDOUT_SPLITS
    }
    verified = verify_complete_r3n6_chain(
        chain,
        repo=REPO,
        expected_rc_id=RC_ID,
        expected_attempt_id=ATTEMPT_ID,
        expected_paths=_expected_chain_paths(),
        expected_artifacts=_expected_artifact_authority(),
        expected_scorer_version=SCORER_VERSION,
        expected_runtime_version=CANDIDATE_RUNTIME_VERSION,
        expected_canonical_scorer_id=CANONICAL_SCORER_ID,
        expected_audit_scorer_id=AUDIT_SCORER_ID,
        expected_splits=HOLDOUT_SPLITS,
        expected_split_files=_expected_split_file_authority(),
        expected_cases_by_split=expected_cases_by_split,
        expected_dataset_manifest_path=_relative(MANIFEST_PATH),
        expected_required_metrics=set(REQUIRED_METRIC_KEYS),
        expected_required_gates=set(REQUIRED_REPORT_GATE_KEYS),
        expected_command=ONE_SHOT_COMMAND,
        expected_locked_input_snapshot=locked_inputs["snapshot"],
        report_recomputer=_recompute_persisted_reports,
        observation_validator=_validate_persisted_observation,
    )
    if not locked_inputs["ok"]:
        verified["errors"] = [
            *locked_inputs["errors"],
            *verified.get("errors", []),
        ]
        verified["ok"] = False
    return verified


def verify_chain() -> dict[str, Any]:
    if not CHAIN_PATH.is_file():
        return {"ok": False, "errors": ["missing_chain"]}
    return _verify_chain_body(_load_json(CHAIN_PATH))


def one_shot_holdout() -> dict[str, Any]:
    if os.environ.get(AUTHORIZE_HOLDOUT_ENV) != "1":
        raise PermissionError(
            f"Set {AUTHORIZE_HOLDOUT_ENV}=1 to execute the one-shot holdout"
        )
    if not LOCKED_PATH.is_file() or not LOCK_RECORD_PATH.is_file():
        return {
            "verdict": "BLOCKED_PRECONDITION_FAILED",
            "reason": "missing_complete_lock",
        }
    if any(path.exists() for path in _holdout_artifact_paths()):
        return {
            "verdict": "BLOCKED_PRECONDITION_FAILED",
            "reason": "attempt_already_consumed",
        }
    locked = _load_json(LOCKED_PATH)
    locked_inputs = _verify_locked_inputs(locked)
    if not locked_inputs["ok"]:
        return {
            "verdict": "BLOCKED_PRECONDITION_FAILED",
            "reason": "locked_input_drift",
            "errors": locked_inputs["errors"],
        }
    lock_semantic = locked["rc_manifest_semantic_sha256"]
    physical_raw = sha256_file(LOCKED_PATH)
    intent = create_attempt(
        attempt_id=ATTEMPT_ID,
        rc_id=RC_ID,
        lock_semantic_sha256=lock_semantic,
        lock_raw_sha256=physical_raw,
        command=ONE_SHOT_COMMAND,
        split="HOLDOUT_VALIDATION",
    )
    intent.update(
        {
            "record_type": "HOLDOUT_ATTEMPT_INTENT",
            "all_splits": list(HOLDOUT_SPLITS),
            "complete_output_binding_required": True,
            "claim_created_exclusively": True,
            "lock_record_path": _relative(LOCK_RECORD_PATH),
            "lock_record_raw_sha256": sha256_file(LOCK_RECORD_PATH),
            "locked_input_snapshot": locked_inputs["snapshot"],
        }
    )
    try:
        intent_raw_sha256 = _write_json_exclusive(ATTEMPT_INTENT_PATH, intent)
    except FileExistsError:
        return {
            "verdict": "BLOCKED_PRECONDITION_FAILED",
            "reason": "attempt_claim_lost_or_already_consumed",
        }

    authorization = _authorize_split_scoring(
        "HOLDOUT_VALIDATION", intent_raw_sha256=intent_raw_sha256
    )
    if authorization["locked_input_snapshot"] != locked_inputs["snapshot"]:
        raise RuntimeError("r3n6_session_authority_snapshot_mismatch")

    results: dict[str, dict[str, Any]] = {}
    with tempfile.TemporaryDirectory(
        prefix="mai07_r3n6_attested_resources_"
    ) as temporary:
        (
            cases_by_split,
            thresholds,
            verified_resources,
            language_resources,
            normalization_resources,
        ) = _load_attested_attempt_inputs(
            locked=locked,
            expected_snapshot=locked_inputs["snapshot"],
            resource_snapshot_dir=Path(temporary),
        )
        remaining_splits = set(HOLDOUT_SPLITS)

        def score_internal_once(split: str) -> dict[str, Any]:
            if split not in remaining_splits:
                raise RuntimeError(f"r3n6_split_session_already_consumed:{split}")
            remaining_splits.remove(split)
            cases = cases_by_split[split]
            bundles = [
                transliterate_r3n6(
                    case["input_text"],
                    resources=verified_resources,
                    language_resources=language_resources,
                    normalization_resources=normalization_resources,
                )
                for case in cases
            ]
            canonical_obs = [
                _bind_runtime_evidence(
                    case, bundle, observe_case(case, bundle)
                )
                for case, bundle in zip(cases, bundles, strict=True)
            ]
            audit_obs = [
                _bind_runtime_evidence(
                    case, bundle, observe_case_audit(case, bundle)
                )
                for case, bundle in zip(cases, bundles, strict=True)
            ]
            canonical = score_observations(
                cases, canonical_obs, thresholds=thresholds, split=split
            )
            audit = score_observations_audit(
                cases, audit_obs, thresholds=thresholds, split=split
            )
            aggregate_agreement = compare_canonical_audit(canonical, audit)
            case_agreement = compare_case_observations(
                canonical_obs, audit_obs
            )
            expected_pass = bool(
                _expected_metric_passes(canonical, len(cases))
                and _expected_metric_passes(audit, len(cases))
            )
            persistence = observation_persistence_status(
                cases,
                canonical.get("observations"),
                audit.get("observations"),
            )
            observations_persisted = persistence["ok"] is True
            ok = bool(
                canonical.get("ok")
                and audit.get("ok")
                and aggregate_agreement.get("ok")
                and case_agreement.get("ok")
                and expected_pass
                and observations_persisted
            )
            predictions = [
                {
                    **observation,
                    "runtime": CANDIDATE_RUNTIME_VERSION,
                    "scorer_version": SCORER_VERSION,
                    "split": split,
                }
                for observation in canonical_obs
            ]
            current_inputs = _verify_locked_inputs(locked)
            if (
                not current_inputs["ok"]
                or current_inputs["snapshot"] != locked_inputs["snapshot"]
            ):
                raise RuntimeError(
                    "r3n6_locked_input_drift_during_scoring:"
                    f"{current_inputs['errors']}"
                )
            return {
                "ok": ok,
                "phase": "MAI-07R3N6",
                "split": split,
                "case_count": len(cases),
                "canonical": canonical,
                "audit": audit,
                "agreement": aggregate_agreement,
                "case_agreement": case_agreement,
                "split_expected_pass": expected_pass,
                "audit_observations_persisted": observations_persisted,
                "observation_persistence": persistence,
                "predictions": predictions,
            }

        for split in HOLDOUT_SPLITS:
            results[split] = score_internal_once(split)
        if remaining_splits:
            raise RuntimeError(
                f"r3n6_unconsumed_session_splits:{sorted(remaining_splits)}"
            )

    post_score_inputs = _verify_locked_inputs(locked)
    if (
        not post_score_inputs["ok"]
        or post_score_inputs["snapshot"] != locked_inputs["snapshot"]
    ):
        raise RuntimeError(
            f"r3n6_locked_input_drift_before_publication:{post_score_inputs['errors']}"
        )

    for split in HOLDOUT_SPLITS:
        result = results[split]
        predictions = result.pop("predictions")
        stem = split.lower()
        prediction_path = REPORTS / f"{stem}_predictions.jsonl"
        report_path = REPORTS / f"{stem}_score_report.json"
        _write_jsonl_immutable(prediction_path, predictions)
        write_json_immutable(report_path, result)

    holdout_ok = all(result["ok"] for result in results.values())
    verdict = (
        "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC"
        if holdout_ok
        else "FAILED_HOLDOUT_QUALITY"
    )
    primary_predictions_path = REPORTS / "holdout_validation_predictions.jsonl"
    primary_predictions = _load_jsonl(primary_predictions_path)
    bound_attempt = bind_predictions(
        intent,
        pred_path=primary_predictions_path,
        preds=primary_predictions,
    )
    bound_attempt.update(
        {
            "record_type": "HOLDOUT_ATTEMPT_PROVISIONAL_RESULT",
            "status": "COMPLETED_PENDING_CHAIN_BINDING",
            "attempt_intent_path": _relative(ATTEMPT_INTENT_PATH),
            "attempt_intent_raw_sha256": intent_raw_sha256,
            "all_split_results": {
                split: result["ok"] for split, result in results.items()
            },
            "numerical_verdict": verdict,
            "engineering_verdict": "PENDING_COMPLETE_CHAIN_BINDING",
            "release_authority": False,
            "complete_output_binding_required": True,
            "locked_input_snapshot": locked_inputs["snapshot"],
        }
    )
    write_json_immutable(ATTEMPT_PATH, bound_attempt)

    qualification = create_qualification_result(
        rc_id=RC_ID,
        lock_semantic_sha256=lock_semantic,
        gate_all_pass=holdout_ok,
        attempt_id=ATTEMPT_ID,
        metrics_summary=results["HOLDOUT_VALIDATION"]["canonical"]["metrics"],
    )
    qualification.update(
        {
            "record_type": "PROVISIONAL_QUALIFICATION_RESULT",
            "status": (
                "PASSED_HOLDOUT_PENDING_CHAIN_BINDING"
                if holdout_ok
                else "FAILED_HOLDOUT_QUALITY_PENDING_CHAIN_BINDING"
            ),
            "numerical_verdict": verdict,
            "engineering_verdict": "PENDING_COMPLETE_CHAIN_BINDING",
            "release_authority": False,
            "parent_lock_raw_sha256": physical_raw,
            "split": "HOLDOUT_VALIDATION",
            "all_splits": list(HOLDOUT_SPLITS),
            "command": ONE_SHOT_COMMAND,
            "attempt_intent_path": _relative(ATTEMPT_INTENT_PATH),
            "attempt_intent_raw_sha256": intent_raw_sha256,
            "candidate_promoted": False,
            "all_split_results": {
                split: result["ok"] for split, result in results.items()
            },
            "output_binding_manifest_required": True,
            "audit_observations_persisted": all(
                result.get("audit_observations_persisted") is True
                for result in results.values()
            ),
            "locked_input_snapshot": locked_inputs["snapshot"],
            "MAI-07": "NEEDS_CORRECTIVE_WORK",
            "MAI-08": "NOT_STARTED",
        }
    )
    write_json_immutable(QUALIFICATION_PATH, qualification)

    output_manifest = build_output_binding_manifest(
        repo=REPO,
        rc_id=RC_ID,
        attempt_id=ATTEMPT_ID,
        verdict=verdict,
        lock_semantic_sha256=lock_semantic,
        lock_raw_sha256=physical_raw,
        artifacts=_output_artifacts(),
        required_artifact_names=set(expected_output_artifact_names()),
    )
    write_json_immutable(OUTPUT_BINDING_PATH, output_manifest)
    chain = {
        "schema_version": CHAIN_SCHEMA_VERSION,
        "record_type": "COMPLETE_ATTEMPT_CHAIN",
        "rc_id": RC_ID,
        "attempt_id": ATTEMPT_ID,
        **_expected_chain_paths(),
        "locked_semantic_sha256": lock_semantic,
        "locked_raw_sha256": physical_raw,
        "lock_record_raw_sha256": sha256_file(LOCK_RECORD_PATH),
        "output_binding_manifest_semantic_sha256": output_manifest_semantic_sha256(
            output_manifest
        ),
        "output_binding_manifest_raw_sha256": sha256_file(OUTPUT_BINDING_PATH),
        "verdict": verdict,
        "consumed": True,
        "attempt_time_output_binding": True,
        "attempt_time_input_reverification": True,
        "locked_input_snapshot": locked_inputs["snapshot"],
        "engineering_verdict_authority": True,
        "release_authority": "FINAL_COMPLETE_CHAIN_ONLY",
    }
    prepublication_verification = _verify_chain_body(chain)
    if not prepublication_verification["ok"]:
        raise RuntimeError(
            "chain_prepublication_verification_failed:"
            f"{prepublication_verification['errors']}"
        )
    _write_json_exclusive(CHAIN_PATH, chain)
    chain_verification = verify_chain()
    if not chain_verification["ok"]:
        raise RuntimeError(
            f"chain_verification_failed:{chain_verification['errors']}"
        )
    return {
        "verdict": verdict,
        "results": {split: result["ok"] for split, result in results.items()},
        "chain_verified": True,
        "output_artifact_count": len(output_manifest["artifacts"]),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--lock", action="store_true")
    parser.add_argument("--one-shot", action="store_true")
    parser.add_argument("--verify-chain", action="store_true")
    args = parser.parse_args()
    if args.preflight:
        result = preflight()
    elif args.lock:
        result = lock_rc()
    elif args.one_shot:
        result = one_shot_holdout()
    elif args.verify_chain:
        result = verify_chain()
    else:
        raise SystemExit("require --preflight, --lock, --one-shot, or --verify-chain")
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result.get(
        "ok", result.get("verdict") == "PASSED_FRESH_HOLDOUT_CORRECTIVE_RC"
    ) else 1


if __name__ == "__main__":
    raise SystemExit(main())
