"""MAI-12 slice 2 — KB rebuildability assessment."""

from __future__ import annotations

from src.oip.contracts.language_data_governance import KbRebuildStatus
from src.oip.modules.language_runtime.data_governance import RUNTIME_VERSION
from src.oip.modules.language_runtime.data_governance.application.governance_service import (
    assert_catalog_training_safe,
    build_language_data_catalog,
)
from src.oip.modules.language_runtime.data_governance.application.rebuildability_service import (
    assess_kb_rebuildability,
    recipe_as_markdown,
)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-12.0.2-slice2"


def test_rebuildability_not_blocked_in_this_checkout() -> None:
    report = assess_kb_rebuildability()
    assert report.pipeline_scripts_present is True
    assert report.config_present is True
    assert report.rebuild_status != KbRebuildStatus.BLOCKED
    assert report.rebuild_status in {
        KbRebuildStatus.FULL_REBUILD_READY,
        KbRebuildStatus.INCREMENTAL_FROM_PROCESSED,
        KbRebuildStatus.INDEX_PRESENT_SOURCES_MISSING,
    }
    assert any(s.step_id == "5_lexical_index" for s in report.recipe_steps)
    assert "build_retrieval_indexes.py" in " ".join(s.command for s in report.recipe_steps)


def test_recipe_markdown() -> None:
    md = recipe_as_markdown(assess_kb_rebuildability())
    assert "KB Rebuild Recipe" in md
    assert "build_retrieval_indexes.py" in md


def test_catalog_includes_rebuild_report() -> None:
    catalog = build_language_data_catalog()
    assert catalog.kb_rebuildability is not None
    assert catalog.kb_rebuildability.runtime_version == RUNTIME_VERSION
    assert catalog.frozen_training_violations == 0
    assert catalog.hash_mismatches == 0
    assert catalog.missing_required == 0
    assert_catalog_training_safe(catalog)


def test_registry_includes_pipeline_assets() -> None:
    catalog = build_language_data_catalog()
    ids = {a.asset_id for a in catalog.assets}
    assert "kb_config" in ids
    assert "kb_build_retrieval_indexes" in ids
    assert "kb_pipeline_orchestrator" in ids
