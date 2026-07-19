"""MAI-07R3S active cutover tests."""

from __future__ import annotations

from oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    PREVIOUS_ACTIVE_RUNTIME_VERSION,
    RESOURCE_PACK_VERSION,
    RUNTIME_VERSION,
)
from oip.modules.language_runtime.transliteration.application.mai07_r3s_active_runtime import (
    ACTIVE_PACK_CONTENT_HASH,
    ACTIVE_RUNTIME_VERSION,
    cutover_identity_card,
    transliterate_active,
)
from oip.modules.language_runtime.transliteration.infrastructure.resource_repository import (
    ACTIVE_PACK_VERSION,
    load_resources,
)


def test_active_identity_after_cutover():
    assert RUNTIME_VERSION == ACTIVE_RUNTIME_VERSION == "mai-07.1.13-r3s-active"
    assert RESOURCE_PACK_VERSION == ACTIVE_PACK_VERSION == "mai-07.1.11-r3n6-chaincomplete"
    assert PREVIOUS_ACTIVE_RUNTIME_VERSION == "mai-07.1.3-r3f-sealnew"
    assert ENABLE_PROMOTION_OVERLAY is False
    card = cutover_identity_card()
    assert card["candidate_promoted"] is True
    assert card["mai_08"] == "PASSED_ENGINEERING"
    assert card["mai_09"] == "PASSED_ENGINEERING"
    assert card["mai_10"] == "PASSED_ENGINEERING"
    assert card["mai_11"] == "PASSED_ENGINEERING"
    assert card["mai_12"] == "PASSED_ENGINEERING"
    assert card["mai_13"] == "PASSED_ENGINEERING"
    assert card["mai_14"] == "PASSED_ENGINEERING"
    assert card["mai_15"] == "IN_PROGRESS"


def test_active_pack_hash_and_pipeline():
    res = load_resources(force_reload=True)
    assert res.content_hash == ACTIVE_PACK_CONTENT_HASH
    bundle = transliterate_active("mero hisab check")
    assert bundle.runtime_version == RUNTIME_VERSION
    assert len(bundle.span_results) > 0
