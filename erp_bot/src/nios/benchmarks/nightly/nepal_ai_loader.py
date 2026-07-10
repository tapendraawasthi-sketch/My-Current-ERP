"""Load 500+ benchmark cases from nepal-ai corpus."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Iterator

from .suites import BenchmarkCase, BenchmarkSuite


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _nepal_ai_dir() -> Path:
    return _repo_root() / "data" / "nepal-ai"


def _iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            continue


def _extract_text(record: dict[str, Any]) -> str | None:
    for key in (
        "text",
        "utterance",
        "phrase",
        "query",
        "user_text",
        "input",
        "example",
        "canonical",
        "nepali",
        "english",
    ):
        val = record.get(key)
        if isinstance(val, str) and len(val.strip()) >= 3:
            return val.strip()
    for key in ("examples", "phrases", "utterances"):
        arr = record.get(key)
        if isinstance(arr, list) and arr:
            first = arr[0]
            if isinstance(first, str):
                return first.strip()
            if isinstance(first, dict):
                return _extract_text(first)
    return None


def _collect_utterances(limit: int = 600) -> list[tuple[str, str]]:
    """Return (source_file, text) pairs."""
    base = _nepal_ai_dir()
    if not base.exists():
        return []

    collected: list[tuple[str, str]] = []
    seen: set[str] = set()

    for path in sorted(base.rglob("*.jsonl")):
        for record in _iter_jsonl(path):
            text = _extract_text(record)
            if not text or len(text) < 4:
                continue
            norm = text.lower()[:80]
            if norm in seen:
                continue
            seen.add(norm)
            collected.append((path.name, text))
            if len(collected) >= limit:
                return collected
    return collected


def _run_uil_parse(case: BenchmarkCase) -> bool:
    from ...representations.uil_parser import parse_to_uil

    try:
        uil = parse_to_uil(case.input)
        return bool(uil.action) and uil.confidence >= float(case.expected)
    except Exception:
        return False


def _run_domain_guard(case: BenchmarkCase) -> bool:
    from ...intelligence.domain_guard import domain_guard

    result = domain_guard(case.input)
    expected = case.expected
    if isinstance(expected, dict):
        return result.get(expected["key"]) == expected["value"]
    return bool(result.get("allow_web_search")) == bool(expected)


def _run_tax_golden(case: BenchmarkCase) -> bool:
    from ...execution.engines.tax_engine import compute_vat, compute_tds

    inp = case.input
    if inp.get("type") == "vat":
        result = compute_vat(inp["amount"], rate=inp.get("rate", 13))
        return abs(result["vat_amount"] - float(case.expected)) <= case.tolerance
    result = compute_tds(inp["amount"], rate=inp.get("rate", 1.5))
    return abs(result["tds_amount"] - float(case.expected)) <= case.tolerance


def build_nepal_ai_suites() -> list[BenchmarkSuite]:
    utterances = _collect_utterances(550)
    uil_cases = [
        BenchmarkCase(f"uil-na-{i}", text, 0.5)
        for i, (_, text) in enumerate(utterances[:400])
    ]

    guard_cases: list[BenchmarkCase] = []
    for i, (_, text) in enumerate(utterances[400:500]):
        is_sampati = bool(re.search(r"\bsampati\b", text, re.I))
        guard_cases.append(
            BenchmarkCase(
                f"guard-na-{i}",
                text,
                {"key": "allow_web_search", "value": not is_sampati},
            )
        )

    tax_cases: list[BenchmarkCase] = []
    for i, amount in enumerate(range(1000, 1000 + 50 * 50, 50)):
        tax_cases.append(BenchmarkCase(f"vat-na-{i}", {"type": "vat", "amount": amount, "rate": 13}, amount * 0.13))
        if len(tax_cases) >= 100:
            break
    for i, amount in enumerate(range(10000, 10000 + 50 * 50, 50)):
        tax_cases.append(BenchmarkCase(f"tds-na-{i}", {"type": "tds", "amount": amount, "rate": 1.5}, amount * 0.015))
        if len(tax_cases) >= 200:
            break

    suites = [
        BenchmarkSuite("nepal_ai_uil", "Nepal-AI UIL Parse (400)", uil_cases, _run_uil_parse),
        BenchmarkSuite("nepal_ai_guard", "Nepal-AI Domain Guard (100)", guard_cases, _run_domain_guard),
        BenchmarkSuite("nepal_ai_tax", "Nepal-AI Tax Golden (100)", tax_cases[:100], _run_tax_golden),
    ]
    return suites


NEPAL_AI_SUITES = build_nepal_ai_suites()
