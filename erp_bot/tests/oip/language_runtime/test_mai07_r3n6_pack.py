from __future__ import annotations

import json
import shutil
import stat
from collections.abc import Callable
from pathlib import Path

import pytest

from erp_bot.src.oip.modules.language_runtime.transliteration import (
    ENABLE_PROMOTION_OVERLAY,
    RUNTIME_VERSION,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application import (
    build_mai07r3n6_pack as pack_builder,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.build_mai07r3n6_pack import (
    DEST,
    PACK_VERSION,
    SOURCE_PACK_VERSION,
    check_existing,
    check_twice,
)
from erp_bot.src.oip.modules.language_runtime.transliteration.application.mai07_r3n6_candidate_runtime import (
    CANDIDATE_POLICY_VERSION,
    CANDIDATE_RUNTIME_VERSION,
    DEFAULT_ACTIVE,
    PARENT_INVALIDATED_R3N5_VERDICT,
    assert_active_default_immutable,
    candidate_identity_card,
)


def _copy_parent(destination: Path) -> Path:
    copied = Path(shutil.copytree(pack_builder.SOURCE, destination))
    _make_tree_writable(copied)
    return copied


def _make_tree_writable(directory: Path) -> None:
    for path in directory.iterdir():
        path.chmod(stat.S_IREAD | stat.S_IWRITE)


def _rewrite_manifest(
    directory: Path,
    mutate: Callable[[dict], None],
    *,
    reseal: bool = False,
) -> None:
    manifest_path = directory / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest.pop("seal_v2", None)
    mutate(manifest)
    pack_builder._write_json(manifest_path, manifest)
    if reseal:
        manifest["seal_v2"] = pack_builder.build_resource_seal_fields(
            resources_dir=directory, manifest=manifest
        )
        pack_builder._write_json(manifest_path, manifest)


@pytest.fixture
def valid_candidate(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    destination = tmp_path / "candidate"
    pack_builder._materialize(destination)
    _make_tree_writable(destination)
    monkeypatch.setattr(pack_builder, "DEST", destination)
    return destination


def test_r3n6_pack_dual_build_is_identical_and_non_default():
    result = check_twice()
    assert result["ok"] is True
    assert result["dual_build_identical"] is True
    assert result["pack_version"] == "mai-07.1.11-r3n6-chaincomplete"
    assert result["content_hash"] == (
        "8b57db0fee6e157911112b8046f44bd38b1138f821d63bdc8c0ca843c1c62106"
    )
    assert result["default_active"] is False


def test_r3n6_candidate_identity_isolated_from_active_runtime():
    assert PACK_VERSION == CANDIDATE_RUNTIME_VERSION
    assert SOURCE_PACK_VERSION == "mai-07.1.10-r3n5-targetspan"
    assert CANDIDATE_POLICY_VERSION == "mai-07-r3n6.1.0.0"
    assert DEFAULT_ACTIVE is False
    assert RUNTIME_VERSION == "mai-07.1.13-r3s-active"
    assert ENABLE_PROMOTION_OVERLAY is False
    assert "INVALIDATED_INCOMPLETE_INDEPENDENT_SCORING" in (
        PARENT_INVALIDATED_R3N5_VERDICT
    )
    assert_active_default_immutable()
    card = candidate_identity_card()
    assert card["candidate_promoted"] is False
    assert card["default_active"] is False
    assert card["correction_scope"] == (
        "COMPLETE_INDEPENDENT_SCORING_AND_OUTPUT_BINDING"
    )


@pytest.mark.skipif(not DEST.is_dir(), reason="R3N6 pack has not been sealed yet")
def test_existing_r3n6_pack_seal_and_manifest():
    result = check_existing()
    assert result["ok"] is True
    manifest = json.loads((DEST / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["resource_pack_version"] == PACK_VERSION
    assert manifest["default_active"] is False
    assert manifest["content_hash"] == result["content_hash"]


def test_materialization_rejects_parent_with_missing_resource(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    parent = _copy_parent(tmp_path / "parent")
    (parent / pack_builder.ALLOWED_FILES[0]).unlink()
    monkeypatch.setattr(pack_builder, "SOURCE", parent)

    with pytest.raises(RuntimeError, match="file_set_mismatch"):
        pack_builder._materialize(tmp_path / "candidate")


def test_materialization_rejects_parent_with_extra_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    parent = _copy_parent(tmp_path / "parent")
    (parent / "unexpected.json").write_text("{}\n", encoding="utf-8")
    monkeypatch.setattr(pack_builder, "SOURCE", parent)

    with pytest.raises(RuntimeError, match="file_set_mismatch"):
        pack_builder._materialize(tmp_path / "candidate")


def test_materialization_rejects_parent_with_tampered_resource(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    parent = _copy_parent(tmp_path / "parent")
    resource = parent / pack_builder.ALLOWED_FILES[0]
    resource.write_bytes(resource.read_bytes() + b"\n")
    monkeypatch.setattr(pack_builder, "SOURCE", parent)

    with pytest.raises(RuntimeError, match="expected_content_hash_mismatch"):
        pack_builder._materialize(tmp_path / "candidate")


def test_materialization_rejects_parent_with_bad_seal(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    parent = _copy_parent(tmp_path / "parent")
    manifest_path = parent / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["seal_v2"]["resource_file_count"] = 0
    pack_builder._write_json(manifest_path, manifest)
    monkeypatch.setattr(pack_builder, "SOURCE", parent)

    with pytest.raises(RuntimeError, match="seal_v2_mismatch"):
        pack_builder._materialize(tmp_path / "candidate")


def test_materialization_rejects_parent_with_bad_provenance(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    parent = _copy_parent(tmp_path / "parent")
    _rewrite_manifest(
        parent,
        lambda manifest: manifest.__setitem__("provenance", "untrusted"),
        reseal=True,
    )
    monkeypatch.setattr(pack_builder, "SOURCE", parent)

    with pytest.raises(RuntimeError, match="provenance_mismatch"):
        pack_builder._materialize(tmp_path / "candidate")


def test_existing_rejects_missing_resource(valid_candidate: Path):
    (valid_candidate / pack_builder.ALLOWED_FILES[0]).unlink()

    result = pack_builder.check_existing()

    assert result["ok"] is False
    assert any(error.startswith("file_set_mismatch") for error in result["errors"])


def test_existing_rejects_extra_file(valid_candidate: Path):
    (valid_candidate / "unexpected.json").write_text("{}\n", encoding="utf-8")

    result = pack_builder.check_existing()

    assert result["ok"] is False
    assert any(error.startswith("file_set_mismatch") for error in result["errors"])


def test_existing_rejects_resealed_resource_that_differs_from_parent(
    valid_candidate: Path,
):
    resource = valid_candidate / pack_builder.ALLOWED_FILES[0]
    resource.write_bytes(resource.read_bytes() + b"\n")

    def update_content_hash(manifest: dict) -> None:
        manifest["content_hash"] = pack_builder.resource_content_sha256(
            resources_dir=valid_candidate,
            file_names=list(pack_builder.ALLOWED_FILES),
        )

    _rewrite_manifest(valid_candidate, update_content_hash, reseal=True)

    result = pack_builder.check_existing()

    assert result["ok"] is False
    assert "expected_content_hash_mismatch" in result["errors"]
    assert any(
        error.startswith("parent_resource_byte_mismatch:")
        for error in result["errors"]
    )


def test_existing_rejects_bad_r3n6_seal(valid_candidate: Path):
    manifest_path = valid_candidate / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["seal_v2"]["resource_content_sha256"] = "0" * 64
    pack_builder._write_json(manifest_path, manifest)

    result = pack_builder.check_existing()

    assert result["ok"] is False
    assert "seal_v2_mismatch" in result["errors"]


def test_existing_rejects_resealed_bad_r3n6_provenance(valid_candidate: Path):
    _rewrite_manifest(
        valid_candidate,
        lambda manifest: manifest.__setitem__("provenance", "untrusted"),
        reseal=True,
    )

    result = pack_builder.check_existing()

    assert result["ok"] is False
    assert "provenance_mismatch" in result["errors"]
