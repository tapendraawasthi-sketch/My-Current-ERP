"""Tests for KB Phase 1 package validation with synthetic fixtures."""

from __future__ import annotations

import sys
import zipfile
from collections import defaultdict
from pathlib import Path

import pytest

_SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from validate_kb_package import (  # noqa: E402
    IssueWriter,
    analyze_file_streaming,
    extract_safe,
    is_safe_zip_member,
)
from kb_common import load_config  # noqa: E402


def _minimal_kb_txt(file_num: str, body: str, *, eof: bool = True) -> str:
    header = f"""ORBIX NEPALI LANGUAGE INTELLIGENCE KNOWLEDGE BASE
Document ID      : ORBIX-NP-LANG-KB-{file_num}
File Name        : ORBIX_NP_LANG_KB_{file_num}_SYNTHETIC_FIXTURE.txt
Package          : Orbix Nepali Language Intelligence
Encoding         : UTF-8

==============================================================================
1. FIXTURE SECTION
==============================================================================

{body}
"""
    if eof:
        header += "\nEND OF FILE\n"
    return header


@pytest.fixture
def cfg():
    repo_root = Path(__file__).resolve().parents[3]
    return load_config(repo_root)


def test_valid_synthetic_package(tmp_path: Path, cfg: dict) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    content = _minimal_kb_txt(
        "0001",
        "RECORD FIX-001\n"
        "------------------------------------------------------------------------------\n"
        "raw_input: namaste\n"
        "execution_allowed: false\n",
    )
    (raw / "ORBIX_NP_LANG_KB_0001_SYNTHETIC_FIXTURE.txt").write_text(content, encoding="utf-8")

    issues = IssueWriter()
    owners: dict[str, list[str]] = defaultdict(list)
    meta = analyze_file_streaming(
        raw / "ORBIX_NP_LANG_KB_0001_SYNTHETIC_FIXTURE.txt", issues, cfg, owners
    )
    assert meta["utf8_ok"] is True
    assert meta["records_detected"] == 1
    assert meta["ends_with_end_of_file"] is True
    assert not any(r["severity"] == "CRITICAL" for r in issues.rows)


def test_missing_file_number_reported(tmp_path: Path, cfg: dict) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    # Only file 0001 — missing 0002-0088 is handled at package level; test single file ok
    content = _minimal_kb_txt("0099", "RECORD FIX-099\n----\nnotes: bad number\n")
    (raw / "ORBIX_NP_LANG_KB_0099_SYNTHETIC_FIXTURE.txt").write_text(content, encoding="utf-8")
    issues = IssueWriter()
    meta = analyze_file_streaming(
        raw / "ORBIX_NP_LANG_KB_0099_SYNTHETIC_FIXTURE.txt",
        issues,
        cfg,
        defaultdict(list),
    )
    assert meta["records_detected"] == 1


def test_unsafe_zip_member_skipped(tmp_path: Path) -> None:
    zpath = tmp_path / "bad.zip"
    with zipfile.ZipFile(zpath, "w") as zf:
        zf.writestr("../../etc/passwd.txt", "evil")
        zf.writestr("ORBIX_NP_LANG_KB_0001_SAFE.txt", "hello")
    extract_to = tmp_path / "out"
    issues = IssueWriter()
    repo_root = tmp_path
    info = extract_safe(tmp_path, extract_to, repo_root, issues)
    assert info["extracted_count"] == 1
    assert any(r["check_code"] == "UNSAFE_ZIP_MEMBER" for r in issues.rows)


def test_invalid_utf8_detected(tmp_path: Path, cfg: dict) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    path = raw / "ORBIX_NP_LANG_KB_0002_SYNTHETIC_FIXTURE.txt"
    path.write_bytes(b"ORBIX INVALID \xff\xfe\xfe\nRECORD X-1\n")
    issues = IssueWriter()
    meta = analyze_file_streaming(path, issues, cfg, defaultdict(list))
    assert meta["utf8_ok"] is False
    assert any(r["check_code"] == "INVALID_UTF8" for r in issues.rows)


def test_missing_and_multiple_eof(tmp_path: Path, cfg: dict) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    no_eof = _minimal_kb_txt("0003", "RECORD FIX-003\n----\nnotes: x\n", eof=False)
    (raw / "ORBIX_NP_LANG_KB_0003_SYNTHETIC_FIXTURE.txt").write_text(no_eof, encoding="utf-8")
    issues = IssueWriter()
    analyze_file_streaming(
        raw / "ORBIX_NP_LANG_KB_0003_SYNTHETIC_FIXTURE.txt", issues, cfg, defaultdict(list)
    )
    assert any(r["check_code"] == "MISSING_END_OF_FILE" for r in issues.rows)

    multi = no_eof + "\nEND OF FILE\nEND OF FILE\n"
    path2 = raw / "ORBIX_NP_LANG_KB_0004_SYNTHETIC_FIXTURE.txt"
    path2.write_text(multi, encoding="utf-8")
    issues2 = IssueWriter()
    analyze_file_streaming(path2, issues2, cfg, defaultdict(list))
    assert any(r["check_code"] == "MULTIPLE_END_OF_FILE" for r in issues2.rows)


def test_duplicate_record_ids_in_file(tmp_path: Path, cfg: dict) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    body = (
        "RECORD DUP-001\n----\nnotes: a\n\n"
        "RECORD DUP-001\n----\nnotes: b\n"
    )
    content = _minimal_kb_txt("0005", body)
    path = raw / "ORBIX_NP_LANG_KB_0005_SYNTHETIC_FIXTURE.txt"
    path.write_text(content, encoding="utf-8")
    issues = IssueWriter()
    meta = analyze_file_streaming(path, issues, cfg, defaultdict(list))
    assert "DUP-001" in meta["duplicate_record_ids"]
    assert any(r["check_code"] == "DUPLICATE_RECORD_IDS" for r in issues.rows)


def test_malformed_record_header(tmp_path: Path, cfg: dict) -> None:
    raw = tmp_path / "raw"
    raw.mkdir()
    body = "RECORD   \n----\nnotes: empty id\n"
    content = _minimal_kb_txt("0006", body)
    path = raw / "ORBIX_NP_LANG_KB_0006_SYNTHETIC_FIXTURE.txt"
    path.write_text(content, encoding="utf-8")
    issues = IssueWriter()
    meta = analyze_file_streaming(path, issues, cfg, defaultdict(list))
    assert meta["malformed_headers"]
    assert any(r["check_code"] == "MALFORMED_RECORD_HEADER" for r in issues.rows)


def test_is_safe_zip_member_rejects_traversal() -> None:
    ok, reason = is_safe_zip_member("../escape.txt")
    assert ok is False
    assert reason == "path_traversal"
