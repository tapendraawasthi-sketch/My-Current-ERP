"""Promote user feedback (confirmed/corrected) into LoRA training JSONL."""

from __future__ import annotations

import json
import os
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ..config import ERP_PATH
from ..nlu.text_normalize import normalize_for_matching

FEEDBACK_FILE = ERP_PATH / "data" / "ekhata" / "user-feedback.jsonl"
LORA_FILE = ERP_PATH / "data" / "ekhata" / "lora-instruction-dataset.jsonl"
PROMOTED_AUDIT = ERP_PATH / "data" / "ekhata" / "user-feedback-promoted.jsonl"
MANIFEST_FILE = ERP_PATH / "data" / "ekhata" / "feedback-promoted-ids.json"

LORA_INSTRUCTION = (
    "You are e-Khata CA parser. Parse the Nepal accounting transaction to structured JSON "
    "with intent, amount, party, journalLines. Never invent amounts."
)


@dataclass(frozen=True)
class PromoteResult:
    scanned: int
    eligible: int
    promoted: int
    skipped_duplicate: int
    skipped_repeat: int
    skipped_cancelled: int
    output_path: str


def _load_manifest() -> set[str]:
    if not MANIFEST_FILE.exists():
        return set()
    try:
        data = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return set()
    ids = data.get("promoted_ids") or []
    return {str(x) for x in ids}


def _save_manifest(ids: set[str]) -> None:
    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "promoted_ids": sorted(ids),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    MANIFEST_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_feedback(path: Path | None = None) -> list[dict[str, Any]]:
    src = path or FEEDBACK_FILE
    if not src.exists():
        return []
    rows: list[dict[str, Any]] = []
    with src.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def _feedback_key(row: dict[str, Any]) -> str:
    """Stable dedupe key for promotion eligibility."""
    label = str(row.get("label", "")).lower()
    narration = str(row.get("narration") or "")
    corrected = str(row.get("correctedNarration") or "")
    intent = str(row.get("intent") or "")
    amount = str(row.get("amount") or "")
    party = str(row.get("party") or "")
    text = corrected if label == "corrected" and corrected else narration
    norm = normalize_for_matching(text)
    return f"{label}|{norm}|{intent}|{amount}|{party}"


def feedback_to_lora_row(row: dict[str, Any]) -> dict[str, str]:
    label = str(row.get("label", "")).lower()
    narration = str(row.get("narration") or "")
    corrected = str(row.get("correctedNarration") or "")
    user_input = corrected if label == "corrected" and corrected else narration

    output_payload: dict[str, Any] = {
        "intent": row.get("intent"),
        "amount": row.get("amount"),
        "party": row.get("party"),
        "journalLines": row.get("journalLines"),
        "source": f"user_{label}",
    }
    if label == "corrected" and corrected and corrected != narration:
        output_payload["original_narration"] = narration

    return {
        "instruction": LORA_INSTRUCTION,
        "input": user_input,
        "output": json.dumps(output_payload, ensure_ascii=False),
    }


def _existing_lora_inputs(path: Path | None = None) -> set[str]:
    target = path or LORA_FILE
    if not target.exists():
        return set()
    inputs: set[str] = set()
    with target.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            inp = str(row.get("input") or "")
            if inp:
                inputs.add(normalize_for_matching(inp))
    return inputs


def promote_user_feedback(
    *,
    dry_run: bool = False,
    min_corrected_repeats: int = 2,
    feedback_path: Path | None = None,
    lora_path: Path | None = None,
) -> PromoteResult:
    """
    Promote confirmed entries immediately; corrected entries when the same
    correction pattern appears at least ``min_corrected_repeats`` times.
    """
    rows = _load_feedback(feedback_path)
    manifest = _load_manifest()
    existing_inputs = _existing_lora_inputs(lora_path)

    correction_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        label = str(row.get("label", "")).lower()
        if label == "corrected":
            key = _feedback_key(row)
            correction_groups[key].append(row)

    promoted = 0
    skipped_duplicate = 0
    skipped_repeat = 0
    skipped_cancelled = 0
    eligible = 0
    new_rows: list[dict[str, str]] = []
    new_ids: set[str] = set()

    for row in rows:
        label = str(row.get("label", "")).lower()
        row_id = str(row.get("id") or _feedback_key(row))

        if label == "cancelled":
            skipped_cancelled += 1
            continue

        if label not in ("confirmed", "corrected"):
            continue

        if label == "corrected":
            key = _feedback_key(row)
            if len(correction_groups[key]) < min_corrected_repeats:
                skipped_repeat += 1
                continue

        eligible += 1

        if row_id in manifest:
            skipped_duplicate += 1
            continue

        lora_row = feedback_to_lora_row(row)
        norm_input = normalize_for_matching(lora_row["input"])
        if norm_input in existing_inputs:
            skipped_duplicate += 1
            manifest.add(row_id)
            continue

        new_rows.append(lora_row)
        existing_inputs.add(norm_input)
        manifest.add(row_id)
        new_ids.add(row_id)
        promoted += 1

    out_path = lora_path or LORA_FILE
    if new_rows and not dry_run:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("a", encoding="utf-8") as fh:
            for row in new_rows:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")

        PROMOTED_AUDIT.parent.mkdir(parents=True, exist_ok=True)
        with PROMOTED_AUDIT.open("a", encoding="utf-8") as fh:
            for row_id in sorted(new_ids):
                fh.write(
                    json.dumps(
                        {"id": row_id, "promoted_at": datetime.now(timezone.utc).isoformat()},
                        ensure_ascii=False,
                    )
                    + "\n"
                )

        _save_manifest(manifest)

    return PromoteResult(
        scanned=len(rows),
        eligible=eligible,
        promoted=promoted,
        skipped_duplicate=skipped_duplicate,
        skipped_repeat=skipped_repeat,
        skipped_cancelled=skipped_cancelled,
        output_path=str(out_path),
    )


def maybe_auto_promote_on_append(record: dict[str, Any]) -> PromoteResult | None:
    """When FEEDBACK_AUTO_PROMOTE=1, append confirmed rows to LoRA immediately."""
    if os.getenv("FEEDBACK_AUTO_PROMOTE", "").strip() not in ("1", "true", "yes"):
        return None
    label = str(record.get("label", "")).lower()
    if label != "confirmed":
        return None
    return promote_user_feedback(dry_run=False, min_corrected_repeats=999)
