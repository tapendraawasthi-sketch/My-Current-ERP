#!/usr/bin/env python3
"""KB Phase 2 — Streaming parse of raw ONLI files to canonical JSONL collections."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterator

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import (  # noqa: E402
    END_OF_FILE_RE,
    FILENAME_RE,
    RECORD_HEADER_RE,
    REPO_ROOT,
    atomic_write_json,
    atomic_write_text,
    content_hash,
    load_config,
    normalize_for_hash,
    parse_file_id,
    rel_to_repo,
    setup_logging,
    update_phase,
    utc_now_iso,
)

logger = setup_logging("parse_kb_to_jsonl")

SECTION_RE = re.compile(r"^={10,}\s*$")
KV_RE = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_.-]*)\s*:\s*(.*)$")
LIST_ITEM_RE = re.compile(r"^\s*-\s+(.*)$")
RULE_LINE_RE = re.compile(r"^RULE\s+\S+", re.IGNORECASE)

COLLECTIONS = [
    "language_rules",
    "lexicon",
    "normalization_examples",
    "intent_examples",
    "entity_examples",
    "slot_examples",
    "dialogue_examples",
    "domain_records",
    "safety_rules",
    "authorization_rules",
    "runtime_contracts",
    "gold_tests",
    "adversarial_tests",
    "e2e_tests",
    "unclassified_records",
]

EVAL_COLLECTIONS = {"gold_tests", "adversarial_tests", "e2e_tests"}

SCHEMA_VERSION = "1.0.0"
SCHEMA_ID = "SCHEMA.ONLI.CANONICAL_RECORD"


class IssueWriter:
    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []

    def add(
        self,
        severity: str,
        check_code: str,
        message: str,
        *,
        file_id: str = "",
        filename: str = "",
        record_id: str = "",
        line_number: int | str = "",
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
            }
        )


class JsonlWriterPool:
    """Stream JSONL lines to temp files; finalize with atomic replace."""

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._handles: dict[str, tuple[Path, Any]] = {}
        self.counts: Counter[str] = Counter()

    def write(self, collection: str, record: dict[str, Any]) -> None:
        if collection not in self._handles:
            final = self.output_dir / f"{collection}.jsonl"
            fd, tmp_name = tempfile.mkstemp(
                prefix=f".{collection}.",
                suffix=".jsonl.tmp",
                dir=str(self.output_dir),
            )
            tmp = Path(tmp_name)
            fh = os.fdopen(fd, "w", encoding="utf-8", newline="\n")
            self._handles[collection] = (final, fh, tmp)
        _, fh, _ = self._handles[collection]
        fh.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
        self.counts[collection] += 1

    def close_all(self) -> None:
        for _collection, (final, fh, tmp) in list(self._handles.items()):
            fh.flush()
            fh.close()
            os.replace(tmp, final)
        self._handles.clear()


def load_sha256_manifest(manifests_dir: Path) -> dict[str, str]:
    path = manifests_dir / "orbix_np_lang_kb_manifest.json"
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    out: dict[str, str] = {}
    for entry in data.get("files", []):
        fn = entry.get("filename")
        sha = entry.get("sha256")
        if fn and sha:
            out[fn] = sha
    return out


def infer_language_form(text: str, fields: dict[str, Any]) -> str | None:
    if fields.get("language_form"):
        return str(fields["language_form"])
    if fields.get("script"):
        return str(fields["script"])
    dev = bool(re.search(r"[\u0900-\u097F]", text))
    lat = bool(re.search(r"[A-Za-z]{2,}", text))
    if dev and lat:
        return "mixed"
    if dev:
        return "devanagari_nepali"
    if lat:
        return "romanized_nepali"
    return None


def infer_record_type(record_id: str, fields: dict[str, Any], is_normative: bool) -> str:
    if is_normative:
        return "normative_section"
    test_type = str(fields.get("test_type", "")).upper()
    if test_type.startswith("GOLD"):
        return "gold_test"
    if test_type.startswith("ADVERSARIAL") or "ADVERSARIAL" in test_type:
        return "adversarial_test"
    if "E2E" in test_type:
        return "e2e_test"
    rid = record_id.upper()
    if rid.startswith("GOLD."):
        return "gold_test"
    if rid.startswith("ADV.") or "ADVERSARIAL" in rid:
        return "adversarial_test"
    if rid.startswith("E2E."):
        return "e2e_test"
    if fields.get("operation_name") or rid.startswith("OV-"):
        return "normalization_rule"
    if fields.get("intent") or "INTENT" in rid:
        return "intent_example"
    if fields.get("entity") or rid.startswith("ENT."):
        return "entity_example"
    if "SLOT" in rid:
        return "slot_example"
    if "DIAL" in rid or fields.get("dialogue_state"):
        return "dialogue_example"
    if fields.get("abbreviation") or fields.get("term") or "LEX" in rid:
        return "lexicon_entry"
    if fields.get("action_code") or fields.get("negative_class"):
        return "safety_rule"
    if fields.get("authorization") or fields.get("authorization_check"):
        return "authorization_rule"
    if fields.get("runtime_contract") or fields.get("contract_json"):
        return "runtime_contract"
    if RULE_LINE_RE.match(record_id) or fields.get("definition"):
        return "language_rule"
    return "structured_record"


def classify_collection(
    record_id: str,
    record_type: str,
    fields: dict[str, Any],
    *,
    section_title: str,
    source_filename: str,
) -> str:
    rid = record_id.upper()
    fn = source_filename.upper()
    st = section_title.upper()
    test_type = str(fields.get("test_type", "")).upper()

    if record_type == "normative_section":
        if any(k in st for k in ("SAFETY", "ABSTENTION", "AUTHORIZATION", "NEGATION")):
            return "safety_rules"
        return "language_rules"

    if record_type in {"gold_test"} or rid.startswith("GOLD.") or "GOLD" in test_type:
        return "gold_tests"
    if record_type == "adversarial_test" or rid.startswith("ADV.") or "ADVERSARIAL" in test_type:
        return "adversarial_tests"
    if record_type == "e2e_test" or rid.startswith("E2E.") or "E2E" in test_type:
        return "e2e_tests"

    if record_type == "runtime_contract" or fields.get("contract_json"):
        return "runtime_contracts"
    if record_type == "authorization_rule" or fields.get("authorization_check") == "mandatory":
        return "authorization_rules"
    if record_type == "safety_rule" or rid.startswith("NEG-") or fields.get("negative_class"):
        return "safety_rules"
    if record_type == "lexicon_entry" or "LEXICON" in fn or "ABBREVIATION" in fn:
        return "lexicon"
    if record_type == "intent_example" or "INTENT" in fn or rid.startswith("INT."):
        return "intent_examples"
    if record_type == "entity_example" or "ENTITY" in fn:
        return "entity_examples"
    if record_type == "slot_example" or "SLOT" in fn:
        return "slot_examples"
    if record_type == "dialogue_example" or "DIALOGUE" in fn or "CONVERSATION" in fn:
        return "dialogue_examples"
    if record_type in {"normalization_rule"} or rid.startswith("OV-") or "NORMALIZATION" in fn:
        return "normalization_examples"
    if "ACCOUNTING_ERP" in fn or fields.get("domain"):
        return "domain_records"
    if record_type == "language_rule" or any(
        k in fn for k in ("MORPHOLOGY", "GRAMMAR", "ORTHOGRAPHIC", "UNICODE", "TAXONOMY")
    ):
        return "language_rules"
    if "SAFETY" in fn or "ABSTENTION" in fn:
        return "safety_rules"
    return "unclassified_records"


def parse_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    s = str(value).strip().lower()
    if s in {"true", "yes", "1", "allowed"}:
        return True
    if s in {"false", "no", "0", "forbidden", "none", ""}:
        return False
    return default


def parse_fields_from_body(lines: list[str]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Parse key:value and list fields; detect embedded JSON blocks."""
    fields: dict[str, Any] = {}
    lists: dict[str, list[str]] = defaultdict(list)
    current_list: str | None = None
    json_blocks: list[Any] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped or stripped.startswith("---"):
            i += 1
            continue
        if stripped.startswith("{"):
            block_lines = [stripped]
            depth = stripped.count("{") - stripped.count("}")
            i += 1
            while i < len(lines) and depth > 0:
                block_lines.append(lines[i].strip())
                depth += lines[i].count("{") - lines[i].count("}")
                i += 1
            blob = "\n".join(block_lines)
            try:
                json_blocks.append(json.loads(blob))
            except json.JSONDecodeError:
                fields.setdefault("_invalid_json_blocks", []).append(blob[:500])
            continue
        lm = LIST_ITEM_RE.match(line)
        if lm and current_list:
            lists[current_list].append(lm.group(1).strip())
            i += 1
            continue
        km = KV_RE.match(line)
        if km:
            key, val = km.group(1), km.group(2).strip()
            if val == "":
                current_list = key
                fields[key] = lists[key]
            else:
                current_list = None
                if key in fields and isinstance(fields[key], list):
                    fields[key].append(val)
                elif key in fields:
                    prev = fields[key]
                    fields[key] = [prev, val] if not isinstance(prev, list) else prev + [val]
                else:
                    fields[key] = val
            i += 1
            continue
        current_list = None
        if stripped.upper().startswith("RULE "):
            fields.setdefault("rule_lines", []).append(stripped)
        else:
            fields.setdefault("_prose_lines", []).append(stripped)
        i += 1
    for k, v in lists.items():
        if k not in fields or fields[k] == v:
            fields[k] = v
    metadata: dict[str, Any] = {}
    if json_blocks:
        metadata["json_blocks"] = json_blocks
        if len(json_blocks) == 1:
            metadata["contract_json"] = json_blocks[0]
    return fields, metadata


def build_content_text(record_id: str, fields: dict[str, Any], body_lines: list[str]) -> str:
    parts = [record_id]
    for key in (
        "raw_input",
        "normalized_input",
        "surface",
        "surface_candidate",
        "definition",
        "operation_name",
        "intent",
        "domain",
        "test_type",
        "notes",
    ):
        val = fields.get(key)
        if val:
            parts.append(f"{key}: {val}")
    prose = fields.get("_prose_lines") or []
    if prose:
        parts.extend(prose[:20])
    elif body_lines:
        parts.extend(l.strip() for l in body_lines[:30] if l.strip() and not l.strip().startswith("---"))
    return "\n".join(parts)


def validate_record_schema(record: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for req in (
        "record_id",
        "record_type",
        "schema_version",
        "source_file_id",
        "source_filename",
        "source_sha256",
        "source_line_start",
        "source_line_end",
        "execution_allowed",
        "parse_status",
        "content_text",
        "content_hash",
        "normalized_content_hash",
    ):
        if req not in record:
            errors.append(f"missing_required:{req}")
    if record.get("schema_version") != SCHEMA_VERSION:
        errors.append("invalid_schema_version")
    if record.get("execution_allowed") is not False and record.get("execution_allowed") is not True:
        errors.append("invalid_execution_allowed_type")
    if not re.fullmatch(r"^[a-f0-9]{64}$", str(record.get("content_hash", ""))):
        errors.append("invalid_content_hash")
    return errors


def make_record(
    *,
    record_id: str,
    body_lines: list[str],
    line_start: int,
    line_end: int,
    source_file_id: str,
    source_filename: str,
    source_sha256: str,
    section_title: str,
    is_normative: bool,
    parse_status: str = "ok",
    issues: list[str] | None = None,
) -> dict[str, Any]:
    fields, meta = parse_fields_from_body(body_lines)
    content = build_content_text(record_id, fields, body_lines)
    record_type = infer_record_type(record_id, fields, is_normative)
    collection = classify_collection(
        record_id,
        record_type,
        fields,
        section_title=section_title,
        source_filename=source_filename,
    )
    exec_allowed = parse_bool(fields.get("execution_allowed"), default=False)
    safety_labels: list[str] = []
    for key in ("negative_class", "action_risk", "severity", "polarity", "safety_label"):
        if fields.get(key):
            safety_labels.append(str(fields[key]))

    # Compact export: cap prose/content to keep JSONL tractable at multi-million scale.
    content_capped = content if len(content) <= 2000 else content[:2000] + "\n…[truncated]"
    slim_meta: dict[str, Any] = {}
    if meta.get("contract_json") is not None:
        slim_meta["contract_json"] = meta["contract_json"]
    if meta.get("_invalid_json_blocks"):
        slim_meta["invalid_json_blocks_count"] = len(meta["_invalid_json_blocks"])
    if issues:
        slim_meta["parse_issues"] = issues

    # Keep only compact scalar/list fields useful for retrieval (drop full fields dump).
    compact_fields: dict[str, Any] = {}
    for key in (
        "raw_input",
        "normalized_input",
        "surface",
        "intent",
        "domain",
        "operation_name",
        "test_type",
        "negative_class",
        "severity",
        "execution_allowed",
        "authorization_check",
    ):
        if key in fields and fields[key] is not None:
            val = fields[key]
            if isinstance(val, str) and len(val) > 500:
                val = val[:500] + "…"
            compact_fields[key] = val

    record: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "record_id": record_id,
        "record_type": record_type,
        "source_file_id": source_file_id,
        "source_filename": source_filename,
        "source_sha256": source_sha256,
        "source_section_title": section_title or None,
        "source_line_start": line_start,
        "source_line_end": line_end,
        "collection": collection,
        "domain": fields.get("domain") or fields.get("category"),
        "language_form": infer_language_form(content, fields),
        "raw_input": fields.get("raw_input") or fields.get("surface") or fields.get("surface_candidate"),
        "normalized_input": fields.get("normalized_input"),
        "intent": fields.get("intent") or fields.get("expected_intent_candidates"),
        "operation_class": fields.get("operation_name") or fields.get("operation_class"),
        "read_only": parse_bool(fields.get("read_only"), default=True) if fields.get("read_only") is not None else None,
        "preview": parse_bool(fields.get("preview"), default=False) if fields.get("preview") is not None else None,
        "mutation": parse_bool(fields.get("mutation"), default=False) if fields.get("mutation") is not None else None,
        "destructive": parse_bool(fields.get("destructive"), default=False) if fields.get("destructive") is not None else None,
        "entities": fields.get("entities") if isinstance(fields.get("entities"), (dict, list)) else None,
        "slots": fields.get("slots") if isinstance(fields.get("slots"), (dict, list)) else None,
        "rules": (fields.get("rule_lines") or fields.get("required_invariants") or [])[:20] or None,
        "expected_behavior": fields.get("expected_response") or fields.get("expected_candidates"),
        "execution_allowed": exec_allowed,
        "safety_labels": safety_labels[:10],
        "content_text": content_capped,
        "content_hash": content_hash(content_capped),
        "normalized_content_hash": content_hash(normalize_for_hash(content_capped)),
        "parse_status": parse_status,
        "quality_score": None,
        "review_status": fields.get("review_status") or "unreviewed",
        "eligibility": "evaluation_only" if collection in EVAL_COLLECTIONS else None,
        "metadata": slim_meta,
        "fields": compact_fields,
    }
    return record


def iter_file_events(path: Path) -> Iterator[dict[str, Any]]:
    """Stream parse events: section, record_start, record_line, record_end, normative."""
    section_title = ""
    pending_title_line: str | None = None
    in_record = False
    record_id = ""
    record_start = 0
    body: list[str] = []
    section_prose: list[str] = []
    section_has_record = False
    section_start_line = 1
    line_no = 0

    def flush_normative() -> dict[str, Any] | None:
        nonlocal section_prose, section_has_record
        text_lines = [l for l in section_prose if l.strip()]
        section_prose = []
        if section_has_record or len(text_lines) < 2:
            return None
        joined = "\n".join(text_lines)
        if len(joined) < 40:
            return None
        return {
            "kind": "normative",
            "line_start": section_start_line,
            "line_end": line_no,
            "section_title": section_title,
            "body": text_lines,
        }

    with path.open("r", encoding="utf-8", errors="strict", newline="") as fh:
        for raw in fh:
            line_no += 1
            line = raw.rstrip("\r\n")
            if END_OF_FILE_RE.match(line):
                break
            if SECTION_RE.match(line):
                if in_record:
                    yield {
                        "kind": "record_end",
                        "record_id": record_id,
                        "line_start": record_start,
                        "line_end": line_no - 1,
                        "body": body,
                        "section_title": section_title,
                    }
                    in_record = False
                    body = []
                evt = flush_normative()
                if evt:
                    yield evt
                section_has_record = False
                section_start_line = line_no + 1
                section_title = ""
                pending_title_line = None
                continue
            if pending_title_line is None and SECTION_RE.match("") is False:
                # After first === in pair, next non-empty may be title before second ===
                pass
            if not in_record and not SECTION_RE.match(line) and section_start_line == line_no:
                # first line after section boundary marker handled below
                pass

            # Detect title line pattern: number. TITLE between separators
            if (
                not in_record
                and not section_title
                and re.match(r"^\d+\.\s+\S", line.strip())
                and line_no <= section_start_line + 2
            ):
                section_title = line.strip()
                continue

            if line.startswith("RECORD"):
                if in_record:
                    yield {
                        "kind": "record_end",
                        "record_id": record_id,
                        "line_start": record_start,
                        "line_end": line_no - 1,
                        "body": body,
                        "section_title": section_title,
                    }
                    body = []
                m = RECORD_HEADER_RE.match(line)
                if m:
                    in_record = True
                    record_id = m.group(1)
                    record_start = line_no
                    section_has_record = True
                    yield {
                        "kind": "record_start",
                        "record_id": record_id,
                        "line_start": line_no,
                        "section_title": section_title,
                        "valid_header": True,
                    }
                else:
                    in_record = False
                    yield {
                        "kind": "malformed_header",
                        "line": line_no,
                        "text": line[:200],
                        "section_title": section_title,
                    }
                continue

            if in_record:
                body.append(line)
            else:
                if line.strip() and not line.strip().startswith("---"):
                    section_prose.append(line)

        if in_record:
            yield {
                "kind": "record_end",
                "record_id": record_id,
                "line_start": record_start,
                "line_end": line_no,
                "body": body,
                "section_title": section_title,
            }
        evt = flush_normative()
        if evt:
            yield evt


def parse_file_streaming(
    path: Path,
    source_sha256: str,
    seen_ids: dict[str, str],
    pool: JsonlWriterPool,
    quarantine_fh: Any,
    issue_writer: IssueWriter,
) -> dict[str, Any]:
    file_id = parse_file_id(path.name) or "0000"
    stats: dict[str, Any] = {
        "file_id": file_id,
        "filename": path.name,
        "records_ok": 0,
        "records_quarantined": 0,
        "normative_sections": 0,
        "collections": Counter(),
    }

    normative_counter = 0
    for event in iter_file_events(path):
        kind = event["kind"]
        if kind == "malformed_header":
            rec = make_record(
                record_id=f"QUARANTINE.MALFORMED.{file_id}.{event['line']}",
                body_lines=[event.get("text", "")],
                line_start=event["line"],
                line_end=event["line"],
                source_file_id=file_id,
                source_filename=path.name,
                source_sha256=source_sha256,
                section_title=event.get("section_title", ""),
                is_normative=False,
                parse_status="quarantined",
                issues=["malformed_record_header"],
            )
            quarantine_fh.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")
            stats["records_quarantined"] += 1
            issue_writer.add(
                "ERROR",
                "MALFORMED_RECORD_HEADER",
                event.get("text", "")[:120],
                file_id=file_id,
                filename=path.name,
                line_number=event["line"],
            )
            continue

        if kind == "normative":
            normative_counter += 1
            nid = f"NORM.{file_id}.{normative_counter:04d}"
            rec = make_record(
                record_id=nid,
                body_lines=event["body"],
                line_start=event["line_start"],
                line_end=event["line_end"],
                source_file_id=file_id,
                source_filename=path.name,
                source_sha256=source_sha256,
                section_title=event.get("section_title", ""),
                is_normative=True,
                parse_status="ok",
            )
            pool.write(rec["collection"], rec)
            stats["records_ok"] += 1
            stats["normative_sections"] += 1
            stats["collections"][rec["collection"]] += 1
            continue

        if kind == "record_end":
            rid = event["record_id"]
            if rid in seen_ids:
                rec = make_record(
                    record_id=rid,
                    body_lines=event["body"],
                    line_start=event["line_start"],
                    line_end=event["line_end"],
                    source_file_id=file_id,
                    source_filename=path.name,
                    source_sha256=source_sha256,
                    section_title=event.get("section_title", ""),
                    is_normative=False,
                    parse_status="quarantined",
                    issues=[f"duplicate_record_id:first_seen_in={seen_ids[rid]}"],
                )
                quarantine_fh.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")
                stats["records_quarantined"] += 1
                issue_writer.add(
                    "ERROR",
                    "DUPLICATE_RECORD_ID",
                    f"Duplicate record ID {rid}",
                    file_id=file_id,
                    filename=path.name,
                    record_id=rid,
                    line_number=event["line_start"],
                )
                continue
            seen_ids[rid] = path.name
            rec = make_record(
                record_id=rid,
                body_lines=event["body"],
                line_start=event["line_start"],
                line_end=event["line_end"],
                source_file_id=file_id,
                source_filename=path.name,
                source_sha256=source_sha256,
                section_title=event.get("section_title", ""),
                is_normative=False,
                parse_status="ok",
            )
            schema_errors = validate_record_schema(rec)
            if schema_errors:
                rec["parse_status"] = "warning"
                rec["metadata"]["schema_errors"] = schema_errors
                issue_writer.add(
                    "WARNING",
                    "SCHEMA_VALIDATION",
                    ";".join(schema_errors),
                    file_id=file_id,
                    filename=path.name,
                    record_id=rid,
                )
            pool.write(rec["collection"], rec)
            stats["records_ok"] += 1
            stats["collections"][rec["collection"]] += 1

    return stats


def run(
    *,
    repo_root: Path,
    raw_dir: Path,
    output_dir: Path,
    quarantine_dir: Path,
    review_dir: Path,
    manifests_dir: Path,
) -> int:
    cfg = load_config(repo_root)
    update_phase(
        "2",
        name="Streaming Parser and Canonical JSONL Conversion",
        status="in_progress",
        start=True,
        next_phase="3",
    )
    issue_writer = IssueWriter()
    sha_map = load_sha256_manifest(manifests_dir)

    raw_files = sorted(
        [p for p in raw_dir.glob("ORBIX_NP_LANG_KB_*.txt") if FILENAME_RE.match(p.name)],
        key=lambda p: parse_file_id(p.name) or "",
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    quarantine_dir.mkdir(parents=True, exist_ok=True)
    review_dir.mkdir(parents=True, exist_ok=True)

    quarantine_path = quarantine_dir / "quarantine.jsonl"
    q_fd, q_tmp_name = tempfile.mkstemp(
        prefix=".quarantine.", suffix=".jsonl.tmp", dir=str(quarantine_dir)
    )
    q_tmp = Path(q_tmp_name)

    pool = JsonlWriterPool(output_dir)
    # Within-file duplicates are enforced per file; cross-file reuse reported in Phase 1.
    # Avoid retaining 5.7M+ IDs in RAM for the whole package run.
    file_stats: list[dict[str, Any]] = []
    schema_failures: list[dict[str, Any]] = []
    total_by_collection: Counter[str] = Counter()
    unique_id_estimate = 0

    with os.fdopen(q_fd, "w", encoding="utf-8", newline="\n") as qfh:
        for path in raw_files:
            seen_ids: dict[str, str] = {}
            sha = sha_map.get(path.name)
            if not sha:
                h = hashlib.sha256()
                with path.open("rb") as fh:
                    while chunk := fh.read(1024 * 1024):
                        h.update(chunk)
                sha = h.hexdigest()
            try:
                stats = parse_file_streaming(path, sha, seen_ids, pool, qfh, issue_writer)
            except UnicodeDecodeError as exc:
                issue_writer.add(
                    "CRITICAL",
                    "INVALID_UTF8",
                    str(exc),
                    file_id=parse_file_id(path.name) or "",
                    filename=path.name,
                )
                stats = {
                    "file_id": parse_file_id(path.name),
                    "filename": path.name,
                    "records_ok": 0,
                    "records_quarantined": 0,
                    "error": "invalid_utf8",
                }
            unique_id_estimate += int(stats.get("records_ok", 0))
            file_stats.append(stats)
            total_by_collection.update(stats.get("collections", {}))
            logger.info(
                "Parsed %s ok=%s quarantined=%s",
                path.name,
                stats.get("records_ok", 0),
                stats.get("records_quarantined", 0),
            )

    pool.close_all()
    os.replace(q_tmp, quarantine_path)

    total_ok = sum(s.get("records_ok", 0) for s in file_stats)
    total_q = sum(s.get("records_quarantined", 0) for s in file_stats)
    total_records = total_ok + total_q

    parser_summary = {
        "generated_at": utc_now_iso(),
        "files_processed": len(raw_files),
        "records_total": total_records,
        "records_ok": total_ok,
        "records_quarantined": total_q,
        "unique_record_ids_estimate": unique_id_estimate,
        "collections": dict(total_by_collection),
        "eval_collections_separated": True,
        "eval_collection_counts": {
            c: total_by_collection.get(c, 0) for c in sorted(EVAL_COLLECTIONS)
        },
        "notes": [
            "Record payloads are compact-capped for multi-million scale.",
            "Duplicate IDs checked within each source file; cross-file reuse was reported in Phase 1.",
        ],
    }

    parser_coverage = {
        "generated_at": utc_now_iso(),
        "files": file_stats,
        "collection_totals": dict(total_by_collection),
    }

    reconciliation = {
        "generated_at": utc_now_iso(),
        "manifest_record_estimate": None,
        "parsed_records_total": total_records,
        "parsed_ok": total_ok,
        "quarantined": total_q,
        "by_file": [
            {
                "filename": s["filename"],
                "records_ok": s.get("records_ok", 0),
                "records_quarantined": s.get("records_quarantined", 0),
            }
            for s in file_stats
        ],
    }

    schema_report = {
        "generated_at": utc_now_iso(),
        "schema_version": SCHEMA_VERSION,
        "records_validated": total_ok,
        "failure_count": len(schema_failures),
        "failures_sample": schema_failures[:100],
        "issue_count": len([r for r in issue_writer.rows if r["check_code"] == "SCHEMA_VALIDATION"]),
    }

    atomic_write_json(review_dir / "parser_summary.json", parser_summary)
    atomic_write_json(review_dir / "parser_coverage.json", parser_coverage)
    atomic_write_json(review_dir / "record_count_reconciliation.json", reconciliation)
    atomic_write_json(review_dir / "schema_validation_report.json", schema_report)

    buf = io.StringIO()
    w = csv.DictWriter(
        buf,
        fieldnames=["severity", "file_id", "filename", "check_code", "message", "record_id", "line_number"],
    )
    w.writeheader()
    for row in issue_writer.rows:
        w.writerow(row)
    atomic_write_text(review_dir / "parser_issues.csv", buf.getvalue())

    status = "passed_with_warnings" if issue_writer.rows else "passed"
    if any(r["severity"] == "CRITICAL" for r in issue_writer.rows):
        status = "failed"

    update_phase(
        "2",
        name="Streaming Parser and Canonical JSONL Conversion",
        status=status,
        finish=True,
        commands=["python knowledgebase/scripts/parse_kb_to_jsonl.py"],
        tests=["knowledgebase/tests/parser"],
        outputs=[
            rel_to_repo(repo_root, output_dir),
            rel_to_repo(repo_root, quarantine_path),
            rel_to_repo(repo_root, review_dir / "parser_summary.json"),
        ],
        findings=[
            f"Records parsed: {total_ok}",
            f"Quarantined: {total_q}",
            f"Collections: {len(total_by_collection)}",
        ],
        warnings=[r["message"] for r in issue_writer.rows if r["severity"] == "WARNING"][:20],
        next_phase="3" if status != "failed" else "blocked",
    )
    logger.info("Phase 2 complete records=%d quarantined=%d", total_ok, total_q)
    return 0 if status != "failed" else 1


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    parser = argparse.ArgumentParser(description="Parse ONLI raw KB files to JSONL")
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--raw-dir", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument("--quarantine-dir", type=Path, default=None)
    parser.add_argument("--review-dir", type=Path, default=None)
    parser.add_argument("--manifests-dir", type=Path, default=None)
    args = parser.parse_args(argv)
    repo_root = args.repo_root.resolve()
    raw_dir = (args.raw_dir or repo_root / cfg["paths"]["raw_dir"]).resolve()
    output_dir = (args.output_dir or repo_root / cfg["paths"]["processed_jsonl_dir"]).resolve()
    quarantine_dir = (args.quarantine_dir or repo_root / cfg["paths"]["quarantine_dir"]).resolve()
    review_dir = (args.review_dir or repo_root / cfg["paths"]["review_dir"]).resolve()
    manifests_dir = (args.manifests_dir or repo_root / cfg["paths"]["manifests_dir"]).resolve()
    try:
        return run(
            repo_root=repo_root,
            raw_dir=raw_dir,
            output_dir=output_dir,
            quarantine_dir=quarantine_dir,
            review_dir=review_dir,
            manifests_dir=manifests_dir,
        )
    except Exception as exc:
        logger.exception("Phase 2 failed: %s", exc)
        update_phase(
            "2",
            name="Streaming Parser and Canonical JSONL Conversion",
            status="failed",
            finish=True,
            blockers=[str(exc)],
            next_phase="blocked",
        )
        return 2


if __name__ == "__main__":
    sys.exit(main())
