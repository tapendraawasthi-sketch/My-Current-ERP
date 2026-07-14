"""Tests for KB Phase 2 streaming parser with synthetic fixtures."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

_SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from parse_kb_to_jsonl import (  # noqa: E402
    EVAL_COLLECTIONS,
    IssueWriter,
    JsonlWriterPool,
    classify_collection,
    make_record,
    parse_file_streaming,
    run,
    validate_record_schema,
)


def _fixture_txt(file_num: str, body: str, *, eof: bool = True) -> str:
    text = f"""ORBIX NEPALI LANGUAGE INTELLIGENCE KNOWLEDGE BASE
Document ID      : ORBIX-NP-LANG-KB-{file_num}
File Name        : ORBIX_NP_LANG_KB_{file_num}_SYNTHETIC_FIXTURE.txt

==============================================================================
1. FIXTURE
==============================================================================

{body}
"""
    if eof:
        text += "\nEND OF FILE\n"
    return text


def _sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def test_valid_record_parsing(tmp_path: Path) -> None:
    body = (
        "RECORD FIX-001\n"
        "------------------------------------------------------------------------------\n"
        "raw_input: garxa\n"
        "execution_allowed: false\n"
    )
    content = _fixture_txt("0001", body)
    path = tmp_path / "ORBIX_NP_LANG_KB_0001_SYNTHETIC_FIXTURE.txt"
    path.write_text(content, encoding="utf-8")

    out = tmp_path / "jsonl"
    q = tmp_path / "quarantine"
    q.mkdir()
    pool = JsonlWriterPool(out)
    issues = IssueWriter()
    seen: dict[str, str] = {}
    qtmp = q / "q.tmp"
    with qtmp.open("w", encoding="utf-8") as qfh:
        stats = parse_file_streaming(path, _sha256_text(content), seen, pool, qfh, issues)
    pool.close_all()

    assert stats["records_ok"] >= 1
    files = list(out.glob("*.jsonl"))
    assert files
    all_recs = []
    for f in files:
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.strip():
                all_recs.append(json.loads(line))
    rec = next(r for r in all_recs if r["record_id"] == "FIX-001")
    assert rec["execution_allowed"] is False
    assert rec["raw_input"] == "garxa"
    assert not validate_record_schema(rec)


def test_gold_tests_separate_collection(tmp_path: Path) -> None:
    body = (
        "RECORD GOLD.ORTH.000001\n"
        "----\n"
        "test_type: GOLD_RECOGNITION\n"
        "raw_input: garxa\n"
    )
    path = tmp_path / "ORBIX_NP_LANG_KB_0023_SYNTHETIC_FIXTURE.txt"
    path.write_text(_fixture_txt("0023", body), encoding="utf-8")
    rec = make_record(
        record_id="GOLD.ORTH.000001",
        body_lines=["test_type: GOLD_RECOGNITION", "raw_input: garxa"],
        line_start=10,
        line_end=15,
        source_file_id="0023",
        source_filename=path.name,
        source_sha256="abc",
        section_title="GOLD",
        is_normative=False,
    )
    assert rec["collection"] == "gold_tests"
    assert rec["collection"] in EVAL_COLLECTIONS


def test_quarantine_duplicate_record_id(tmp_path: Path) -> None:
    body = (
        "RECORD DUP-001\n----\nnotes: first\n\n"
        "RECORD DUP-001\n----\nnotes: second\n"
    )
    path = tmp_path / "ORBIX_NP_LANG_KB_0007_SYNTHETIC_FIXTURE.txt"
    path.write_text(_fixture_txt("0007", body), encoding="utf-8")

    out = tmp_path / "jsonl"
    q = tmp_path / "quarantine"
    q.mkdir()
    pool = JsonlWriterPool(out)
    issues = IssueWriter()
    seen: dict[str, str] = {}
    q_lines: list[str] = []
    qpath = q / "q.tmp"

    with qpath.open("w", encoding="utf-8") as qfh:
        parse_file_streaming(path, "deadbeef", seen, pool, qfh, issues)
    pool.close_all()
    q_content = qpath.read_text(encoding="utf-8")
    assert "quarantined" in q_content or any(
        r["check_code"] == "DUPLICATE_RECORD_ID" for r in issues.rows
    )


def test_malformed_header_quarantine(tmp_path: Path) -> None:
    body = "RECORD\n----\nnotes: bad header\n"
    path = tmp_path / "ORBIX_NP_LANG_KB_0008_SYNTHETIC_FIXTURE.txt"
    path.write_text(_fixture_txt("0008", body), encoding="utf-8")
    out = tmp_path / "jsonl"
    q = tmp_path / "quarantine"
    q.mkdir()
    pool = JsonlWriterPool(out)
    issues = IssueWriter()
    qpath = q / "q.tmp"
    with qpath.open("w", encoding="utf-8") as qfh:
        stats = parse_file_streaming(path, "abc", {}, pool, qfh, issues)
    pool.close_all()
    assert stats["records_quarantined"] >= 1


def test_normative_section_capture(tmp_path: Path) -> None:
    body = (
        "This normative prose explains package scope without structured records.\n"
        "It must be captured as normative_section when no RECORD appears here.\n"
    )
    path = tmp_path / "ORBIX_NP_LANG_KB_0009_SYNTHETIC_FIXTURE.txt"
    path.write_text(_fixture_txt("0009", body), encoding="utf-8")
    out = tmp_path / "jsonl"
    q = tmp_path / "quarantine"
    q.mkdir()
    pool = JsonlWriterPool(out)
    issues = IssueWriter()
    qpath = q / "q.tmp"
    with qpath.open("w", encoding="utf-8") as qfh:
        stats = parse_file_streaming(path, "abc", {}, pool, qfh, issues)
    pool.close_all()
    assert stats.get("normative_sections", 0) >= 1


def test_deterministic_rerun(tmp_path: Path) -> None:
    body = "RECORD DET-001\n----\nraw_input: test\nexecution_allowed: false\n"
    path = tmp_path / "ORBIX_NP_LANG_KB_0010_SYNTHETIC_FIXTURE.txt"
    path.write_text(_fixture_txt("0010", body), encoding="utf-8")
    repo = tmp_path / "repo"
    raw = repo / "knowledgebase" / "raw" / "nepali_language"
    raw.mkdir(parents=True)
    path.replace(raw / path.name)

    real_repo = Path(__file__).resolve().parents[3]
    kb_cfg_src = real_repo / "knowledgebase" / "config.json"
    kb_cfg_dst = repo / "knowledgebase" / "config.json"
    kb_cfg_dst.parent.mkdir(parents=True, exist_ok=True)
    kb_cfg_dst.write_text(kb_cfg_src.read_text(encoding="utf-8"), encoding="utf-8")

    def _run_once(tag: str) -> bytes:
        out = repo / "knowledgebase" / "processed" / f"jsonl_{tag}"
        review = repo / "knowledgebase" / "review" / tag
        q = repo / "knowledgebase" / "processed" / "quarantine" / tag
        manifests = repo / "knowledgebase" / "manifests"
        manifests.mkdir(parents=True, exist_ok=True)
        run(
            repo_root=repo,
            raw_dir=raw,
            output_dir=out,
            quarantine_dir=q,
            review_dir=review,
            manifests_dir=manifests,
        )
        parts = sorted(out.glob("*.jsonl"))
        h = hashlib.sha256()
        for p in parts:
            h.update(p.read_bytes())
        return h.digest()

    assert _run_once("a") == _run_once("b")


def test_classify_collection_heuristics() -> None:
    coll = classify_collection(
        "ADV.INT.00001",
        "adversarial_test",
        {"test_type": "ADVERSARIAL"},
        section_title="",
        source_filename="ORBIX_NP_LANG_KB_0040_ACCOUNTING.txt",
    )
    assert coll == "adversarial_tests"

    coll2 = classify_collection(
        "NEG-ACT-001",
        "safety_rule",
        {"negative_class": "PROHIBITION"},
        section_title="",
        source_filename="x.txt",
    )
    assert coll2 == "safety_rules"
