#!/usr/bin/env python3
"""KB Phase 1 — Safe extraction, master manifest, and integrity validation (streaming)."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from kb_common import (
    FILENAME_RE,
    RECORD_HEADER_RE,
    REPO_ROOT,
    atomic_write_bytes,
    atomic_write_json,
    atomic_write_text,
    is_safe_zip_member,
    load_config,
    parse_file_id,
    rel_to_repo,
    setup_logging,
    sha256_bytes,
    sha256_file,
    update_phase,
    utc_now_iso,
)

logger = setup_logging("validate_kb_package")

DOC_ID_RE = re.compile(
    r"Document\s+ID\s*:\s*(ORBIX-NP-LANG-KB-(\d{4}))", re.IGNORECASE
)
FILE_NAME_FIELD_RE = re.compile(r"File\s+Name\s*:\s*(\S+\.txt)", re.IGNORECASE)
STAT_KEY_RE = re.compile(r"^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*(\d+)\s*$")
DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
LATIN_WORD_RE = re.compile(r"[A-Za-z]{2,}")
EOF_LINE_RE = re.compile(r"(?i)^\s*END OF FILE\s*$")
BINARY_RATIO_THRESHOLD = 0.30
ROMAN_HINTS = (
    "cha", "chha", "gareko", "kina", "becha", "udhar", "kharcha",
    "talab", "bikri", "kharid", "paisa", "rupees", "npr", "vat", "tds",
)


class IssueWriter:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []

    def add(
        self,
        severity: str,
        file_id: str,
        filename: str,
        check_code: str,
        message: str,
        record_id: str = "",
        line_number: str | int = "",
        recommended_action: str = "",
    ) -> None:
        self.rows.append(
            {
                "severity": severity,
                "file_id": file_id,
                "filename": filename,
                "check_code": check_code,
                "message": message,
                "record_id": record_id,
                "line_number": str(line_number),
                "recommended_action": recommended_action,
            }
        )


def extract_safe(
    source_dir: Path,
    extract_to: Path,
    repo_root: Path,
    issues: IssueWriter,
) -> dict[str, Any]:
    extract_to.mkdir(parents=True, exist_ok=True)
    zips = sorted(p for p in source_dir.iterdir() if p.suffix.lower() == ".zip")
    extracted: list[dict[str, Any]] = []
    for zpath in zips:
        with zipfile.ZipFile(zpath, "r") as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                name = info.filename
                safe, reason = is_safe_zip_member(name)
                if info.create_system == 3:
                    mode = (info.external_attr >> 16) & 0o170000
                    if mode == 0o120000:
                        safe, reason = False, "symbolic_link"
                if not safe:
                    issues.add(
                        "CRITICAL",
                        "",
                        zpath.name,
                        "UNSAFE_ZIP_MEMBER",
                        f"Skipped unsafe member {name}: {reason}",
                        recommended_action="Do not extract; investigate archive",
                    )
                    continue
                out_name = Path(name.replace("\\", "/")).name
                out_path = extract_to / out_name
                if out_path.resolve().parent != extract_to.resolve():
                    issues.add(
                        "CRITICAL",
                        "",
                        zpath.name,
                        "UNSAFE_ZIP_MEMBER",
                        f"Output path escape blocked for {name}",
                        recommended_action="Do not extract",
                    )
                    continue
                if out_path.exists():
                    issues.add(
                        "ERROR",
                        parse_file_id(out_name) or "",
                        out_name,
                        "DUPLICATE_OUTPUT_PATH",
                        f"Duplicate extraction target from {zpath.name}",
                        recommended_action="Resolve duplicate members before re-extract",
                    )
                    continue
                # Stream extract
                h = hashlib.sha256()
                size = 0
                fd_path = out_path.with_suffix(out_path.suffix + ".partial")
                with zf.open(info, "r") as src, fd_path.open("wb") as dst:
                    while True:
                        chunk = src.read(1024 * 1024)
                        if not chunk:
                            break
                        dst.write(chunk)
                        h.update(chunk)
                        size += len(chunk)
                fd_path.replace(out_path)
                extracted.append(
                    {
                        "zip": rel_to_repo(repo_root, zpath),
                        "member": name,
                        "output": rel_to_repo(repo_root, out_path),
                        "sha256": h.hexdigest(),
                        "size": size,
                    }
                )
    return {"extracted_count": len(extracted), "extracted": extracted}


def analyze_file_streaming(
    path: Path,
    issues: IssueWriter,
    cfg: dict[str, Any],
    record_owners: dict[str, list[str]],
) -> dict[str, Any]:
    filename = path.name
    file_id = parse_file_id(filename) or ""
    size = path.stat().st_size
    result: dict[str, Any] = {
        "file_id": file_id,
        "filename": filename,
        "relative_path": "",
        "size_bytes": size,
        "sha256": "",
        "line_count": 0,
        "is_regular_file": path.is_file() and not path.is_symlink(),
        "utf8_ok": False,
        "end_of_file_count": 0,
        "ends_with_end_of_file": False,
        "document_id": None,
        "internal_file_id": None,
        "declared_filename": None,
        "records_detected": 0,
        "unique_record_ids": 0,
        "duplicate_record_ids": [],
        "malformed_headers": [],
        "empty_record_blocks": 0,
        "first_record_id": None,
        "last_record_id": None,
        "record_prefix_distribution": {},
        "declared_statistics": {},
        "statistic_classifications": {},
        "language_signals": {},
        "null_byte_count": 0,
        "replacement_char_count": 0,
        "binary_looking": False,
        "abnormally_long_lines": 0,
        "suspiciously_small": False,
        "max_line_length": 0,
        "before_sha256": None,
        "after_sha256": None,
    }

    if not FILENAME_RE.match(filename):
        issues.add(
            "ERROR", file_id, filename, "FILENAME_PREFIX_MISMATCH",
            "Filename does not match ORBIX_NP_LANG_KB_NNNN_* pattern",
            recommended_action="Rename or quarantine file",
        )

    if size == 0:
        issues.add(
            "CRITICAL", file_id, filename, "ZERO_BYTE_FILE",
            "File is empty", recommended_action="Obtain valid source file",
        )
        return result

    min_bytes = int(cfg["thresholds"]["min_file_bytes"])
    if size < min_bytes:
        result["suspiciously_small"] = True
        issues.add(
            "WARNING", file_id, filename, "SUSPICIOUSLY_SMALL",
            f"File size {size} < threshold {min_bytes}",
            recommended_action="Review for truncation",
        )

    # Binary / null sample
    with path.open("rb") as fh:
        sample = fh.read(8192)
    result["null_byte_count"] = sample.count(b"\x00")
    # Full null count via chunked scan (bounded)
    nulls = 0
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
            nulls += chunk.count(b"\x00")
    result["null_byte_count"] = nulls
    result["sha256"] = h.hexdigest()
    result["before_sha256"] = result["sha256"]
    if nulls:
        issues.add(
            "ERROR", file_id, filename, "NULL_BYTES",
            f"Found {nulls} null bytes",
            recommended_action="Investigate binary corruption",
        )
    if sample:
        non_text = sum(
            1 for b in sample if b < 9 or (13 < b < 32 and b != 10) or b == 0x7F
        )
        if non_text / len(sample) > BINARY_RATIO_THRESHOLD:
            result["binary_looking"] = True
            issues.add(
                "ERROR", file_id, filename, "BINARY_LOOKING",
                "Sample content looks binary",
                recommended_action="Quarantine and review",
            )

    # Streaming text analysis
    max_line = int(cfg["thresholds"]["max_line_length"])
    record_ids: list[str] = []
    prefixes: Counter[str] = Counter()
    declared: dict[str, int] = {}
    malformed: list[dict[str, Any]] = []
    empty_blocks = 0
    current_id: str | None = None
    current_body_chars = 0
    current_start = 0
    line_no = 0
    last_nonempty = ""
    eof_count = 0
    replacement = 0
    dev_chars = 0
    latin_words = 0
    mixed_lines = 0
    header_buf: list[str] = []
    in_header = True
    roman_hits = Counter()

    def flush_record() -> None:
        nonlocal empty_blocks, current_id, current_body_chars
        if current_id is None:
            return
        if current_body_chars == 0:
            empty_blocks += 1
            issues.add(
                "WARNING", file_id, filename, "EMPTY_RECORD_BLOCK",
                f"Empty record block for {current_id}",
                record_id=current_id, line_number=current_start,
                recommended_action="Review record content",
            )
        current_id = None
        current_body_chars = 0

    try:
        with path.open("r", encoding="utf-8", errors="strict", newline="") as fh:
            for raw_line in fh:
                line_no += 1
                line = raw_line.rstrip("\r\n")
                if line.strip():
                    last_nonempty = line.strip()
                replacement += line.count("\ufffd")
                ln = len(line)
                if ln > result["max_line_length"]:
                    result["max_line_length"] = ln
                if ln > max_line:
                    result["abnormally_long_lines"] += 1
                    if result["abnormally_long_lines"] <= 3:
                        issues.add(
                            "WARNING", file_id, filename, "ABNORMAL_LINE_LENGTH",
                            f"Line length {ln} exceeds {max_line}",
                            line_number=line_no,
                            recommended_action="Review for truncated/minified content",
                        )

                if in_header and line_no <= 80:
                    header_buf.append(line)
                elif in_header and line_no > 80:
                    in_header = False

                if EOF_LINE_RE.match(line):
                    eof_count += 1

                # Language signals (cheap per-line)
                has_dev = bool(DEVANAGARI_RE.search(line))
                lat = LATIN_WORD_RE.findall(line)
                if has_dev:
                    dev_chars += len(DEVANAGARI_RE.findall(line))
                if lat:
                    latin_words += len(lat)
                if has_dev and lat:
                    mixed_lines += 1
                lower = line.casefold()
                for hnt in ROMAN_HINTS:
                    if re.search(rf"\b{re.escape(hnt)}\b", lower):
                        roman_hits[hnt] += 1

                # Stats
                sm = STAT_KEY_RE.match(line)
                if sm:
                    key, val = sm.group(1), int(sm.group(2))
                    kl = key.lower()
                    if any(
                        tok in kl
                        for tok in (
                            "record", "count", "generated", "example", "gold",
                            "adversarial", "query", "rule", "lexicon", "test", "total",
                        )
                    ):
                        declared[key] = val

                # Records
                if line.startswith("RECORD"):
                    m = RECORD_HEADER_RE.match(line)
                    if not m:
                        malformed.append({"line": line_no, "text": line[:120]})
                        issues.add(
                            "ERROR", file_id, filename, "MALFORMED_RECORD_HEADER",
                            f"Malformed record header: {line[:80]}",
                            line_number=line_no,
                            recommended_action="Quarantine record at parse time",
                        )
                    else:
                        flush_record()
                        current_id = m.group(1)
                        current_start = line_no
                        current_body_chars = 0
                        record_ids.append(current_id)
                        pref = current_id.split("-")[0] if "-" in current_id else current_id[:4]
                        prefixes[pref] += 1
                        record_owners[current_id].append(file_id)
                    continue
                if current_id is not None and line.strip():
                    current_body_chars += len(line.strip())
            flush_record()
        result["utf8_ok"] = True
    except UnicodeDecodeError as exc:
        issues.add(
            "CRITICAL", file_id, filename, "INVALID_UTF8",
            f"UTF-8 decode failed: {exc}",
            recommended_action="Repair source encoding before indexing",
        )
        result["after_sha256"] = sha256_file(path)
        return result

    result["line_count"] = line_no
    result["end_of_file_count"] = eof_count
    result["ends_with_end_of_file"] = last_nonempty.upper() == "END OF FILE"
    result["replacement_char_count"] = replacement
    if replacement:
        issues.add(
            "WARNING", file_id, filename, "REPLACEMENT_CHARS",
            f"Found {replacement} U+FFFD characters",
            recommended_action="Review encoding damage",
        )
    if eof_count == 0:
        issues.add(
            "ERROR", file_id, filename, "MISSING_END_OF_FILE",
            "No END OF FILE marker found", recommended_action="Confirm truncation",
        )
    elif eof_count > 1:
        issues.add(
            "ERROR", file_id, filename, "MULTIPLE_END_OF_FILE",
            f"Found {eof_count} END OF FILE markers",
            recommended_action="Inspect concatenation",
        )
    if not result["ends_with_end_of_file"]:
        issues.add(
            "ERROR", file_id, filename, "END_OF_FILE_NOT_FINAL",
            "Final non-whitespace text does not end with END OF FILE",
            recommended_action="Confirm truncation",
        )

    header_text = "\n".join(header_buf)
    doc_m = DOC_ID_RE.search(header_text)
    if doc_m:
        result["document_id"] = doc_m.group(1)
        result["internal_file_id"] = doc_m.group(2)
        if file_id and result["internal_file_id"] != file_id:
            issues.add(
                "ERROR", file_id, filename, "FILENAME_INTERNAL_ID_MISMATCH",
                f"Filename ID {file_id} != document ID {result['internal_file_id']}",
                recommended_action="Quarantine until identity resolved",
            )
    else:
        issues.add(
            "WARNING", file_id, filename, "DOCUMENT_ID_MISSING",
            "Document ID marker not detected in header",
            recommended_action="Confirm header format",
        )

    fn_m = FILE_NAME_FIELD_RE.search(header_text)
    if fn_m:
        result["declared_filename"] = fn_m.group(1).strip()
        if result["declared_filename"] != filename:
            issues.add(
                "ERROR", file_id, filename, "DECLARED_FILENAME_MISMATCH",
                f"Declared File Name {result['declared_filename']} != actual {filename}",
                recommended_action="Investigate packaging error",
            )

    result["records_detected"] = len(record_ids)
    result["unique_record_ids"] = len(set(record_ids))
    dup_counts = [rid for rid, c in Counter(record_ids).items() if c > 1]
    result["duplicate_record_ids"] = dup_counts[:50]
    if dup_counts:
        issues.add(
            "ERROR", file_id, filename, "DUPLICATE_RECORD_IDS",
            f"Duplicate record IDs within file: {dup_counts[:20]}",
            recommended_action="Do not silently rewrite; flag for review",
        )
    result["malformed_headers"] = malformed[:20]
    result["empty_record_blocks"] = empty_blocks
    if record_ids:
        result["first_record_id"] = record_ids[0]
        result["last_record_id"] = record_ids[-1]
    result["record_prefix_distribution"] = dict(prefixes)
    result["declared_statistics"] = declared
    classifications: dict[str, str] = {}
    for key, val in declared.items():
        kl = key.lower()
        if kl in {
            "generated_records", "record_count", "total_records",
        } or (kl.startswith("generated_") and kl.endswith("_records")):
            if val == result["records_detected"]:
                classifications[key] = "verified"
            else:
                classifications[key] = "mismatch"
                issues.add(
                    "WARNING", file_id, filename, "DECLARED_COUNT_MISMATCH",
                    f"{key}={val} but detected records={result['records_detected']}",
                    recommended_action="Report; do not auto-rewrite",
                )
        else:
            classifications[key] = "not_automatically_verifiable"
    result["statistic_classifications"] = classifications
    result["language_signals"] = {
        "devanagari_detected": dev_chars > 0,
        "devanagari_char_count": dev_chars,
        "latin_word_count": latin_words,
        "mixed_script_line_count": mixed_lines,
        "likely_romanized_nepali_detected": sum(roman_hits.values()) >= 3,
        "romanized_hint_hits": int(sum(roman_hits.values())),
        "replacement_character_count": replacement,
        "null_byte_count": nulls,
    }

    after = sha256_file(path)
    result["after_sha256"] = after
    if after != result["before_sha256"]:
        issues.add(
            "CRITICAL", file_id, filename, "RAW_FILE_MUTATED",
            "SHA-256 changed during validation",
            recommended_action="Abort; raw files must be immutable",
        )
    logger.info(
        "Validated %s records=%d size_mb=%.2f",
        filename, result["records_detected"], size / (1024 * 1024),
    )
    return result


def write_inventory_csv(path: Path, files: list[dict[str, Any]]) -> None:
    fields = [
        "file_id", "filename", "size_bytes", "sha256", "line_count",
        "records_detected", "unique_record_ids", "end_of_file_count",
        "utf8_ok", "document_id", "devanagari_detected",
        "likely_romanized_nepali_detected",
    ]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for f in files:
        row = {
            **f,
            "devanagari_detected": f.get("language_signals", {}).get("devanagari_detected"),
            "likely_romanized_nepali_detected": f.get("language_signals", {}).get(
                "likely_romanized_nepali_detected"
            ),
        }
        w.writerow(row)
    atomic_write_text(path, buf.getvalue())


def write_issues_csv(path: Path, issues: IssueWriter) -> None:
    fields = [
        "severity", "file_id", "filename", "check_code", "message",
        "record_id", "line_number", "recommended_action",
    ]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields)
    w.writeheader()
    for row in issues.rows:
        w.writerow(row)
    atomic_write_text(path, buf.getvalue())


def build_report_md(summary: dict[str, Any]) -> str:
    return "\n".join(
        [
            "# Package Validation Report (Phase 1)",
            "",
            f"Generated: {summary['generated_at']}",
            f"Status: **{summary['status']}**",
            "",
            "## Counts",
            "",
            f"- Numbered files found: {summary['numbered_file_count']}",
            f"- Expected: 88",
            f"- Missing IDs: {summary['missing_file_ids'] or 'none'}",
            f"- Duplicate IDs: {summary['duplicate_file_ids'] or 'none'}",
            f"- Zero-byte files: {summary['zero_byte_files']}",
            f"- UTF-8 failures: {summary['utf8_failures']}",
            f"- Critical issues: {summary['issue_counts'].get('CRITICAL', 0)}",
            f"- Error issues: {summary['issue_counts'].get('ERROR', 0)}",
            f"- Warning issues: {summary['issue_counts'].get('WARNING', 0)}",
            f"- Duplicate whole-file hashes: {summary['duplicate_hash_groups'] or 'none'}",
            f"- Cross-file reused record IDs: {summary['cross_file_record_reuse_count']}",
            f"- Total records detected: {summary['total_records_detected']}",
            "",
            "## Raw integrity",
            "",
            f"- All before/after SHA-256 matched: **{summary['raw_files_unchanged']}**",
            "",
            "## Notes",
            "",
            "- Structural warnings do not block Phase 2 if all 88 files exist.",
            "- Critical corruption blocks production index creation.",
            "- Language signals are detectors only — not human language approval.",
            "",
        ]
    )


def run(
    *,
    repo_root: Path,
    source_dir: Path,
    extract_to: Path,
    output_dir: Path,
    skip_extraction: bool,
) -> int:
    cfg = load_config(repo_root)
    update_phase(
        "1",
        name="Safe Extraction, Master Manifest, Integrity Validation",
        status="in_progress",
        start=True,
        next_phase="2",
    )
    issues = IssueWriter()
    extraction_info: dict[str, Any] = {"skipped": skip_extraction}

    if not skip_extraction:
        extract_to.mkdir(parents=True, exist_ok=True)
        for existing in extract_to.glob("*.txt"):
            existing.unlink()
        for existing in extract_to.glob("*.partial"):
            existing.unlink()
        extraction_info = extract_safe(source_dir, extract_to, repo_root, issues)
        raw_root = extract_to
    else:
        raw_root = source_dir
        if not list(raw_root.glob("ORBIX_NP_LANG_KB_????_*.txt")):
            if list(extract_to.glob("ORBIX_NP_LANG_KB_????_*.txt")):
                raw_root = extract_to

    numbered_files = sorted(
        [
            p for p in raw_root.glob("ORBIX_NP_LANG_KB_*.txt")
            if FILENAME_RE.match(p.name) and parse_file_id(p.name)
        ],
        key=lambda p: parse_file_id(p.name) or "",
    )

    record_owners: dict[str, list[str]] = defaultdict(list)
    file_results: list[dict[str, Any]] = []
    for path in numbered_files:
        meta = analyze_file_streaming(path, issues, cfg, record_owners)
        meta["relative_path"] = rel_to_repo(repo_root, path)
        # Do not keep full record id lists in manifest — too large
        file_results.append(meta)

    ids = [f["file_id"] for f in file_results]
    expected = [f"{i:04d}" for i in range(1, 89)]
    missing = [e for e in expected if e not in ids]
    dup_ids = [i for i, c in Counter(ids).items() if c > 1]
    if missing:
        issues.add(
            "CRITICAL", "", "", "MISSING_FILE_NUMBERS",
            f"Missing file IDs: {missing}",
            recommended_action="Obtain missing sources",
        )
    if dup_ids:
        issues.add(
            "CRITICAL", "", "", "DUPLICATE_FILE_NUMBERS",
            f"Duplicate file IDs: {dup_ids}",
            recommended_action="Resolve duplicates before indexing",
        )
    if len(numbered_files) != 88:
        issues.add(
            "CRITICAL", "", "", "FILE_COUNT_MISMATCH",
            f"Expected 88 numbered files, found {len(numbered_files)}",
            recommended_action="Fix package membership",
        )

    by_hash: dict[str, list[str]] = defaultdict(list)
    for f in file_results:
        if f["sha256"]:
            by_hash[f["sha256"]].append(f["filename"])
    dup_hash_groups = {h: names for h, names in by_hash.items() if len(names) > 1}
    for h, names in dup_hash_groups.items():
        issues.add(
            "ERROR", "", ",".join(names), "DUPLICATE_FULL_FILE_HASH",
            f"Identical content hash {h[:12]}… across {names}",
            recommended_action="Confirm intentional duplication",
        )

    cross_reuse = {
        rid: sorted(set(owners))
        for rid, owners in record_owners.items()
        if len(set(owners)) > 1
    }
    if cross_reuse:
        issues.add(
            "WARNING", "", "", "CROSS_FILE_RECORD_ID_REUSE",
            f"{len(cross_reuse)} record IDs reused across files (not auto-rewritten)",
            recommended_action="Report only; human review",
        )

    issue_counts = Counter(r["severity"] for r in issues.rows)
    critical = issue_counts.get("CRITICAL", 0)
    raw_unchanged = bool(file_results) and all(
        f.get("before_sha256") and f["before_sha256"] == f.get("after_sha256")
        for f in file_results
    )

    if missing or dup_ids or len(numbered_files) != 88:
        status = "blocked"
    elif critical:
        utf8_fail = any(not f["utf8_ok"] for f in file_results)
        zero = any(f["size_bytes"] == 0 for f in file_results)
        mutated = not raw_unchanged
        status = "blocked" if (utf8_fail or zero or mutated) else "passed_with_warnings"
    elif issue_counts.get("ERROR", 0) or issue_counts.get("WARNING", 0):
        status = "passed_with_warnings"
    else:
        status = "passed"

    manifests_dir = repo_root / cfg["paths"]["manifests_dir"]
    manifests_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    docs_dir = repo_root / cfg["paths"]["docs_dir"]
    docs_dir.mkdir(parents=True, exist_ok=True)

    # Slim file entries for master manifest (drop huge nested lists already capped)
    slim_files = []
    for f in file_results:
        slim = dict(f)
        slim.pop("malformed_headers", None)
        slim_files.append(slim)

    manifest = {
        "generated_at": utc_now_iso(),
        "package_code": cfg["package_code"],
        "package_name": cfg["package_name"],
        "status": status,
        "file_count": len(file_results),
        "expected_file_count": 88,
        "missing_file_ids": missing,
        "duplicate_file_ids": dup_ids,
        "duplicate_full_file_hashes": dup_hash_groups,
        "cross_file_record_reuse_count": len(cross_reuse),
        "cross_file_record_reuse_sample": dict(list(cross_reuse.items())[:50]),
        "extraction": {
            "skipped": skip_extraction,
            "extracted_count": extraction_info.get("extracted_count"),
        },
        "raw_files_unchanged": raw_unchanged,
        "files": slim_files,
    }

    summary = {
        "generated_at": utc_now_iso(),
        "status": status,
        "numbered_file_count": len(file_results),
        "missing_file_ids": missing,
        "duplicate_file_ids": dup_ids,
        "zero_byte_files": sum(1 for f in file_results if f["size_bytes"] == 0),
        "utf8_failures": sum(1 for f in file_results if not f["utf8_ok"]),
        "issue_counts": dict(issue_counts),
        "duplicate_hash_groups": dup_hash_groups,
        "cross_file_record_reuse_count": len(cross_reuse),
        "raw_files_unchanged": raw_unchanged,
        "total_records_detected": sum(f["records_detected"] for f in file_results),
    }

    inv_csv = manifests_dir / "orbix_np_lang_kb_inventory.csv"
    man_json = manifests_dir / "orbix_np_lang_kb_manifest.json"
    sums = manifests_dir / "SHA256SUMS.txt"
    sum_json = output_dir / "package_validation_summary.json"
    report_md = output_dir / "package_validation_report.md"
    err_csv = output_dir / "package_validation_errors.csv"
    phase_doc = docs_dir / "KB_PHASE_1_PACKAGE_VALIDATION.md"

    atomic_write_json(man_json, manifest)
    write_inventory_csv(inv_csv, file_results)
    atomic_write_text(
        sums,
        "\n".join(f"{f['sha256']}  {f['relative_path']}" for f in file_results) + "\n",
    )
    atomic_write_json(sum_json, summary)
    atomic_write_text(report_md, build_report_md(summary))
    write_issues_csv(err_csv, issues)
    atomic_write_text(
        phase_doc,
        build_report_md(summary)
        + "\n## Validation checks performed\n\n"
        + "\n".join(
            f"- {c}"
            for c in [
                "88 numbered files 0001-0088",
                "UTF-8 decode (streaming)",
                "END OF FILE marker",
                "filename / document identity",
                "record headers and duplicate IDs",
                "declared statistics where verifiable",
                "language signals (non-approving)",
                "raw SHA-256 before/after immutability",
            ]
        )
        + "\n",
    )

    update_phase(
        "1",
        name="Safe Extraction, Master Manifest, Integrity Validation",
        status=status,
        finish=True,
        commands=[
            "python knowledgebase/scripts/validate_kb_package.py "
            f"--source-dir \"{source_dir}\" --extract-to \"{extract_to}\" "
            f"--output-dir \"{output_dir}\""
            + (" --skip-extraction" if skip_extraction else "")
        ],
        tests=["knowledgebase/tests/package_validation"],
        outputs=[
            rel_to_repo(repo_root, man_json),
            rel_to_repo(repo_root, inv_csv),
            rel_to_repo(repo_root, sums),
            rel_to_repo(repo_root, sum_json),
            rel_to_repo(repo_root, report_md),
            rel_to_repo(repo_root, err_csv),
            rel_to_repo(repo_root, phase_doc),
        ],
        findings=[
            f"Files: {len(file_results)}",
            f"Total records detected: {summary['total_records_detected']}",
            f"Raw unchanged: {raw_unchanged}",
        ],
        blockers=["Phase 1 blocked due to critical package issues"] if status == "blocked" else [],
        warnings=[r["message"] for r in issues.rows if r["severity"] == "WARNING"][:30],
        next_phase="2" if status in {"passed", "passed_with_warnings"} else "blocked",
    )
    logger.info("Phase 1 status=%s files=%d", status, len(file_results))
    return 0 if status in {"passed", "passed_with_warnings"} else 1


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    parser = argparse.ArgumentParser(
        description="Validate and safely extract Orbix NP Language KB package"
    )
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--source-dir", type=Path, default=None)
    parser.add_argument("--extract-to", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument("--skip-extraction", action="store_true")
    args = parser.parse_args(argv)
    repo_root = args.repo_root.resolve()
    source_dir = (
        args.source_dir.resolve()
        if args.source_dir
        else (repo_root / cfg["paths"]["source_dir"]).resolve()
    )
    extract_to = (
        args.extract_to.resolve()
        if args.extract_to
        else (repo_root / cfg["paths"]["raw_dir"]).resolve()
    )
    output_dir = (
        args.output_dir.resolve()
        if args.output_dir
        else (repo_root / cfg["paths"]["review_dir"]).resolve()
    )
    try:
        return run(
            repo_root=repo_root,
            source_dir=source_dir,
            extract_to=extract_to,
            output_dir=output_dir,
            skip_extraction=args.skip_extraction,
        )
    except Exception as exc:
        logger.exception("Phase 1 failed: %s", exc)
        update_phase(
            "1",
            name="Safe Extraction, Master Manifest, Integrity Validation",
            status="failed",
            finish=True,
            blockers=[str(exc)],
            next_phase="blocked",
        )
        return 2


if __name__ == "__main__":
    sys.exit(main())
