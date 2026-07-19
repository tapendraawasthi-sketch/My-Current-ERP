"""MAI-12 slice 1 — language data catalog and training gates."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.oip.contracts.language_data_governance import (
    LanguageDataAssetV1,
    LanguageDataRole,
)
from src.oip.modules.language_runtime.data_governance import RUNTIME_VERSION
from src.oip.modules.language_runtime.data_governance.application.governance_service import (
    assert_catalog_training_safe,
    build_language_data_catalog,
    find_repo_root,
)


def test_runtime_version() -> None:
    assert RUNTIME_VERSION == "mai-12.0.1-slice1"


def test_frozen_asset_cannot_be_training_eligible() -> None:
    with pytest.raises(ValidationError):
        LanguageDataAssetV1(
            asset_id="x",
            path="evals/x.jsonl",
            role=LanguageDataRole.FROZEN_EVAL,
            training_eligible=True,
        )


def test_catalog_scans_repo() -> None:
    root = find_repo_root()
    catalog = build_language_data_catalog(repo_root=root)
    assert catalog.runtime_version == RUNTIME_VERSION
    assert catalog.assets
    ids = {a.asset_id for a in catalog.assets}
    assert "mai11_slice2_manifest" in ids
    assert "mai10_seed_concepts" in ids
    # Required manifests must be present.
    required = [a for a in catalog.assets if a.asset_id.endswith("_manifest")]
    assert all(a.presence.value == "PRESENT" for a in required)
    assert catalog.frozen_training_violations == 0
    assert catalog.hash_mismatches == 0
    assert catalog.missing_required == 0
    assert_catalog_training_safe(catalog)


def test_source_archives_optional() -> None:
    catalog = build_language_data_catalog()
    archives = [a for a in catalog.assets if a.role is LanguageDataRole.SOURCE_ARCHIVE]
    assert archives
    for a in archives:
        assert a.training_eligible is False
        assert a.presence.value in {"PRESENT", "MISSING"}


def test_frozen_eval_assets_not_training_eligible() -> None:
    catalog = build_language_data_catalog()
    for a in catalog.assets:
        if a.role is LanguageDataRole.FROZEN_EVAL:
            assert a.training_eligible is False
