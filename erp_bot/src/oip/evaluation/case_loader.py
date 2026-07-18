"""Load and validate frozen evaluation JSONL + manifests."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from .contracts import EvalCaseV1, EvalManifestV1, Split, content_hash_case, sha256_bytes

_WS = re.compile(r"\s+")


def normalize_text_for_dup(text: str) -> str:
    return _WS.sub(" ", (text or "").strip().lower())


def resolve_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for parent in [cur, *cur.parents]:
        if (parent / "evals").is_dir() and (parent / "erp_bot").is_dir():
            return parent
        if parent.name == "evals":
            return parent.parent
    return start.resolve().parents[3]


def load_jsonl_cases(path: Path) -> list[EvalCaseV1]:
    if not path.exists():
        raise FileNotFoundError(f"MISSING_EVAL_FILE:{path}")
    cases: list[EvalCaseV1] = []
    with path.open("r", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, start=1):
            text = line.strip()
            if not text:
                continue
            try:
                raw = json.loads(text)
            except json.JSONDecodeError as exc:
                raise ValueError(f"INVALID_JSONL:{path}:{line_no}:{exc}") from exc
            cases.append(EvalCaseV1.model_validate(raw))
    return cases


def file_sha256(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def load_manifest(path: Path) -> EvalManifestV1:
    return EvalManifestV1.model_validate(json.loads(path.read_text(encoding="utf-8")))


def load_cases_from_manifest(manifest_path: Path, *, repo_root: Path | None = None) -> list[EvalCaseV1]:
    root = repo_root or resolve_repo_root(manifest_path)
    manifest = load_manifest(manifest_path)
    if not manifest.dataset_hash:
        raise ValueError("MANIFEST_MISSING_DATASET_HASH")
    all_cases: list[EvalCaseV1] = []
    for entry in manifest.files:
        path = root / entry.path
        digest = file_sha256(path)
        if digest != entry.sha256:
            raise ValueError(f"HASH_MISMATCH:{entry.path}:expected={entry.sha256}:actual={digest}")
        cases = load_jsonl_cases(path)
        if len(cases) != entry.case_count:
            raise ValueError(f"CASE_COUNT_MISMATCH:{entry.path}")
        all_cases.extend(cases)
    all_cases.sort(key=lambda c: c.case_id)
    if len(all_cases) != manifest.total_cases:
        raise ValueError(
            f"MANIFEST_TOTAL_MISMATCH:expected={manifest.total_cases}:actual={len(all_cases)}"
        )
    return all_cases


@dataclass
class ValidationReport:
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    case_count: int = 0
    duplicate_ids: list[str] = field(default_factory=list)
    near_duplicates: list[str] = field(default_factory=list)
    split_leaks: list[str] = field(default_factory=list)


def validate_cases(cases: list[EvalCaseV1]) -> ValidationReport:
    report = ValidationReport(ok=True, case_count=len(cases))
    seen_ids: dict[str, int] = {}
    group_splits: dict[str, set[Split]] = defaultdict(set)
    norm_texts: dict[str, list[str]] = defaultdict(list)

    for case in cases:
        if case.case_id in seen_ids:
            report.duplicate_ids.append(case.case_id)
            report.errors.append(f"DUPLICATE_CASE_ID:{case.case_id}")
        seen_ids[case.case_id] = seen_ids.get(case.case_id, 0) + 1

        if case.split == Split.FROZEN and not case.prohibited_for_training:
            report.errors.append(f"TRAINING_ALLOWED_ON_FROZEN:{case.case_id}")

        expected_hash = content_hash_case(case)
        if case.content_hash and case.content_hash != expected_hash:
            report.errors.append(f"CONTENT_HASH_MISMATCH:{case.case_id}")

        group_splits[case.scenario_group_id].add(case.split)

        text = normalize_text_for_dup(case.input.primary_user_text())
        if text:
            norm_texts[text].append(case.case_id)

        # Sensitive markers
        blob = (case.input.primary_user_text() + " " + case.description).lower()
        if any(x in blob for x in ("bearer ", "sk-", "password=", "eyj")):
            report.errors.append(f"SENSITIVE_MARKER:{case.case_id}")

    for gid, splits in group_splits.items():
        if len(splits) > 1:
            report.split_leaks.append(gid)
            report.errors.append(f"SCENARIO_SPLIT_LEAK:{gid}:{sorted(s.value for s in splits)}")

    for text, ids in norm_texts.items():
        if len(ids) > 1:
            # Same normalized text across different case IDs — near/exact dup
            report.near_duplicates.append(f"{ids[0]}~{ids[1]}")
            report.warnings.append(f"NEAR_OR_EXACT_DUP_TEXT:{','.join(ids)}")

    if report.errors:
        report.ok = False
    return report


def validate_manifest_and_cases(manifest_path: Path, *, repo_root: Path | None = None) -> ValidationReport:
    cases = load_cases_from_manifest(manifest_path, repo_root=repo_root)
    return validate_cases(cases)
