"""Shared utilities for Orbix NP Language KB processing scripts."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator

REPO_ROOT = Path(__file__).resolve().parents[2]
KB_ROOT = REPO_ROOT / "knowledgebase"
CONFIG_PATH = KB_ROOT / "config.json"
PHASE_STATUS_PATH = KB_ROOT / "review" / "phase_status.json"

FILENAME_RE = re.compile(
    r"^ORBIX_NP_LANG_KB_(\d{4})_[A-Z0-9_]+\.txt$", re.IGNORECASE
)
RECORD_HEADER_RE = re.compile(r"^RECORD\s+(\S+)\s*$")
END_OF_FILE_RE = re.compile(r"(?im)^\s*END OF FILE\s*$")
STAT_LINE_RE = re.compile(
    r"^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*(\d+)\s*$", re.MULTILINE
)
DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
LATIN_WORD_RE = re.compile(r"[A-Za-z]{2,}")

ALLOWED_ZIP_EXTENSIONS = {".txt"}
EXECUTABLE_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".ps1",
    ".sh",
    ".dll",
    ".so",
    ".dylib",
    ".jar",
    ".msi",
    ".com",
    ".scr",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def setup_logging(name: str, level: int = logging.INFO) -> logging.Logger:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    return logging.getLogger(name)


def load_config(repo_root: Path | None = None) -> dict[str, Any]:
    root = repo_root or REPO_ROOT
    path = root / "knowledgebase" / "config.json"
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def resolve_path(repo_root: Path, relative: str) -> Path:
    return (repo_root / relative).resolve()


def rel_to_repo(repo_root: Path, path: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def atomic_write_text(path: Path, content: str, encoding: str = "utf-8") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent)
    )
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding=encoding, newline="\n") as fh:
            fh.write(content)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_path, path)
    except Exception:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise


def atomic_write_json(path: Path, data: Any, indent: int = 2) -> None:
    atomic_write_text(
        path,
        json.dumps(data, ensure_ascii=False, indent=indent, sort_keys=False) + "\n",
    )


def atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent)
    )
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_path, path)
    except Exception:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise


def parse_file_id(filename: str) -> str | None:
    m = FILENAME_RE.match(Path(filename).name)
    return m.group(1) if m else None


def is_safe_zip_member(member_name: str) -> tuple[bool, str | None]:
    name = member_name.replace("\\", "/")
    if not name or name.endswith("/"):
        return False, "directory_entry"
    if name.startswith("/") or name.startswith("\\"):
        return False, "absolute_path"
    if re.match(r"^[A-Za-z]:", name):
        return False, "drive_letter_path"
    parts = Path(name).parts
    if ".." in parts:
        return False, "path_traversal"
    if any(p.startswith("~") for p in parts):
        return False, "home_relative_path"
    ext = Path(name).suffix.lower()
    if ext in EXECUTABLE_EXTENSIONS:
        return False, "executable_extension"
    if ext and ext not in ALLOWED_ZIP_EXTENSIONS:
        # Allow only .txt in this package (manifests are .txt too)
        return False, "unsupported_extension"
    return True, None


def iter_lines_streaming(path: Path) -> Iterator[tuple[int, str]]:
    with path.open("r", encoding="utf-8", errors="strict", newline="") as fh:
        for i, line in enumerate(fh, start=1):
            yield i, line.rstrip("\n").rstrip("\r")


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalize_for_hash(text: str) -> str:
    t = text.casefold()
    t = re.sub(r"\s+", " ", t).strip()
    return t


def load_phase_status(path: Path | None = None) -> dict[str, Any]:
    p = path or PHASE_STATUS_PATH
    if not p.exists():
        return {"schema_version": "1.0.0", "updated_at": None, "phases": {}}
    with p.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_phase_status(status: dict[str, Any], path: Path | None = None) -> None:
    p = path or PHASE_STATUS_PATH
    status["updated_at"] = utc_now_iso()
    atomic_write_json(p, status)


def update_phase(
    phase_id: str,
    *,
    name: str,
    status: str,
    commands: list[str] | None = None,
    tests: list[str] | None = None,
    outputs: list[str] | None = None,
    findings: list[str] | None = None,
    blockers: list[str] | None = None,
    warnings: list[str] | None = None,
    next_phase: str | None = None,
    start: bool = False,
    finish: bool = False,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data = load_phase_status()
    phases = data.setdefault("phases", {})
    entry = phases.get(phase_id, {})
    entry["phase_id"] = phase_id
    entry["phase_name"] = name
    entry["status"] = status
    if start or "start_time" not in entry:
        entry["start_time"] = utc_now_iso()
    if finish:
        entry["completion_time"] = utc_now_iso()
    if commands is not None:
        entry["commands_executed"] = commands
    if tests is not None:
        entry["tests_executed"] = tests
    if outputs is not None:
        entry["outputs"] = outputs
    if findings is not None:
        entry["findings"] = findings
    if blockers is not None:
        entry["blockers"] = blockers
    if warnings is not None:
        entry["warnings"] = warnings
    if next_phase is not None:
        entry["next_phase"] = next_phase
    if extra:
        entry.update(extra)
    phases[phase_id] = entry
    save_phase_status(data)
    return entry


def language_signals(text: str) -> dict[str, Any]:
    dev_chars = DEVANAGARI_RE.findall(text)
    latin_words = LATIN_WORD_RE.findall(text)
    mixed = 0
    for line in text.splitlines():
        if DEVANAGARI_RE.search(line) and LATIN_WORD_RE.search(line):
            mixed += 1
    # Heuristic romanized nepali tokens frequently seen in package
    roman_hints = (
        "cha",
        "chha",
        "gareko",
        "kina",
        "becha",
        "udhar",
        "kharcha",
        "talab",
        "bikri",
        "kharid",
        "paisa",
        "rupees",
        "rs",
        "npr",
        "vat",
        "tds",
    )
    lower = text.casefold()
    roman_hits = sum(1 for h in roman_hints if re.search(rf"\b{re.escape(h)}\b", lower))
    return {
        "devanagari_detected": bool(dev_chars),
        "devanagari_char_count": len(dev_chars),
        "latin_word_count": len(latin_words),
        "mixed_script_line_count": mixed,
        "likely_romanized_nepali_detected": roman_hits >= 3,
        "romanized_hint_hits": roman_hits,
        "replacement_character_count": text.count("\ufffd"),
        "null_byte_count": text.count("\x00"),
    }


def chunked(iterable: Iterable[Any], size: int) -> Iterator[list[Any]]:
    batch: list[Any] = []
    for item in iterable:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch
