from __future__ import annotations

from erp_bot.src.oip.modules.language_runtime.transliteration.application.build_mai07r3n4_pack import (
    ALLOWED_FILES,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.build_mai07r3n5_pack import (
    DEST,
    SOURCE,
    check_existing,
    check_twice,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n5_candidate_runtime import (
    CANDIDATE_RUNTIME_VERSION,
    load_r3n5_resources,
)


def test_r3n5_pack_is_sealed_and_dual_build_deterministic():
    existing = check_existing()
    dual = check_twice()
    assert existing["ok"] is True
    assert dual["ok"] is True
    assert dual["dual_build_identical"] is True
    assert existing["content_hash"] == dual["content_hash"]
    assert existing["pack_version"] == CANDIDATE_RUNTIME_VERSION


def test_r3n5_resource_bytes_match_r3n4_parent():
    for name in ALLOWED_FILES:
        parent = SOURCE / name
        candidate = DEST / name
        if parent.is_file():
            assert candidate.read_bytes() == parent.read_bytes(), name


def test_r3n5_resources_load_only_explicitly():
    resources = load_r3n5_resources()
    assert resources is not None
