"""e-Khata evaluation metrics — Step 9 from overhaul guide."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

DEFAULT_EVAL_PATH = Path(__file__).resolve().parents[3] / "data" / "ekhata" / "eval-test-set.json"


@dataclass
class CaseResult:
    case_id: str
    category: str
    input: str
    expected_type: str
    predicted_type: str
    intent_ok: bool | None = None
    amount_ok: bool | None = None
    party_ok: bool | None = None
    passed: bool = False
    detail: str = ""


@dataclass
class EvalReport:
    engine: str
    total: int = 0
    passed: int = 0
    failed: int = 0
    intent_accuracy: float = 0.0
    amount_accuracy: float = 0.0
    party_accuracy: float = 0.0
    question_gate_accuracy: float = 0.0
    false_positive_rate: float = 0.0
    results: list[CaseResult] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "engine": self.engine,
            "total": self.total,
            "passed": self.passed,
            "failed": self.failed,
            "intent_accuracy": round(self.intent_accuracy, 4),
            "amount_accuracy": round(self.amount_accuracy, 4),
            "party_accuracy": round(self.party_accuracy, 4),
            "question_gate_accuracy": round(self.question_gate_accuracy, 4),
            "false_positive_rate": round(self.false_positive_rate, 4),
            "failures": self.failures[:20],
        }


def load_eval_cases(path: Path | None = None) -> list[dict[str, Any]]:
    eval_path = path or DEFAULT_EVAL_PATH
    data = json.loads(eval_path.read_text(encoding="utf-8"))
    return list(data.get("cases", []))


def _party_match(expected: str | None, predicted: str | None) -> bool:
    if expected is None:
        return True
    if not predicted:
        return False
    exp = expected.lower().strip()
    pred = predicted.lower().strip()
    return exp in pred or pred in exp


def _is_accounting_question(text: str) -> bool:
    if text.strip().endswith("?"):
        return True
    return bool(re.search(
        r"\b(k\s*ho|k\s*hun|ke\s*ho|kina|kasari|kati|kun|explain|define|bataau|bhannus|"
        r"matlab|arth|meaning|what\s+is|how\s+to|which\s+is|record\s+garne|k\s+hunchha)\b",
        text, re.I,
    ))


def _is_transaction_signal(text: str) -> bool:
    if _is_accounting_question(text):
        return False
    return bool(re.search(
        r"\b(\d+|saya|hajar|lakh|karod)\b.*\b(udhaar|salary|ssf|gratuity|vat|tds|"
        r"depreciation|bad\s*debt|loan|capital|drawings|stock|kharcha|bikri|kineko|kinyo|"
        r"tiryo|diyo|becheko|sold|purchase|bought|payment|commission|advance|return|rent|bhaada|bhada)\b",
        text, re.I,
    )) or bool(re.search(r"\b(sold|bought|paid|received|tiryo|kineko)\b.*\d", text, re.I))


ParseFn = Callable[[str], dict[str, Any]]


def _predict_rules(text: str, parse_fn: ParseFn) -> dict[str, Any]:
    """Predict using rules parser. Entry cases parse directly; gates apply for Q&A/chat."""
    parsed = parse_fn(text)
    if parsed.get("clarifying_question"):
        return {"type": "clarify", "clarify": parsed["clarifying_question"]}

    intent = parsed.get("intent")
    amount = parsed.get("AMOUNT")
    if intent and amount:
        return {
            "type": "entry",
            "intent": intent,
            "amount": int(amount),
            "party": parsed.get("PARTY"),
        }

    if _is_accounting_question(text):
        return {"type": "question"}

    return {"type": "chat"}


def _predict_pipeline(text: str, parse_fn: ParseFn) -> dict[str, Any]:
    """Full pipeline: question gate → transaction signal → parser."""
    if _is_accounting_question(text):
        return {"type": "question"}

    if not _is_transaction_signal(text):
        return {"type": "chat"}

    return _predict_rules(text, parse_fn)


def evaluate_parser(
    parse_fn: ParseFn,
    *,
    engine: str = "python-rules",
    cases: list[dict[str, Any]] | None = None,
    eval_path: Path | None = None,
    mode: str = "parser",
) -> EvalReport:
    """Run labeled eval set and compute Step 9 metrics.

    mode=parser  — measures intent/amount/party extraction directly
    mode=pipeline — includes transaction-signal gate (false positive testing)
    """
    cases = cases or load_eval_cases(eval_path)
    predict = _predict_pipeline if mode == "pipeline" else _predict_rules
    report = EvalReport(engine=f"{engine}:{mode}", total=len(cases))

    entry_intent_total = 0
    entry_intent_ok = 0
    amount_total = 0
    amount_ok = 0
    party_total = 0
    party_ok = 0
    question_total = 0
    question_ok = 0
    false_positive_total = 0
    false_positive_hits = 0

    for case in cases:
        text = str(case.get("input", "")).strip()
        expected = case.get("expected") or {}
        expected_type = str(expected.get("type", "chat"))

        predicted = predict(text, parse_fn)
        predicted_type = predicted.get("type", "chat")

        intent_match: bool | None = None
        amount_match: bool | None = None
        party_match: bool | None = None
        passed = False

        if expected_type == "entry":
            entry_intent_total += 1
            if predicted_type == "entry":
                intent_match = predicted.get("intent") == expected.get("intent")
                if intent_match:
                    entry_intent_ok += 1

                if expected.get("amount") is not None:
                    amount_total += 1
                    amount_match = predicted.get("amount") == expected.get("amount")
                    if amount_match:
                        amount_ok += 1

                if "party" in expected:
                    party_total += 1
                    party_match = _party_match(expected.get("party"), predicted.get("party"))
                    if party_match:
                        party_ok += 1

                passed = bool(intent_match and (amount_match is not False) and (party_match is not False))
            else:
                passed = False

        elif expected_type == "question":
            question_total += 1
            passed = _is_accounting_question(text)
            predicted_type = "question" if passed else predict(text, parse_fn).get("type", "chat")
            if passed:
                question_ok += 1

        elif expected_type == "clarify":
            passed = predicted_type in ("clarify", "chat")

        elif expected_type == "chat":
            false_positive_total += 1
            if mode == "pipeline":
                passed = predicted_type != "entry"
            else:
                direct = predict(text, parse_fn)
                passed = direct.get("type") != "entry"
            if not passed:
                false_positive_hits += 1

        else:
            passed = predicted_type == expected_type

        result = CaseResult(
            case_id=str(case.get("id", "")),
            category=str(case.get("category", "")),
            input=text,
            expected_type=expected_type,
            predicted_type=predicted_type,
            intent_ok=intent_match,
            amount_ok=amount_match,
            party_ok=party_match,
            passed=passed,
            detail="" if passed else f"expected={expected_type} got={predicted_type}",
        )
        report.results.append(result)
        if passed:
            report.passed += 1
        else:
            report.failed += 1
            report.failures.append(f"{result.case_id}: {result.detail} | {text[:60]}")

    report.intent_accuracy = entry_intent_ok / entry_intent_total if entry_intent_total else 1.0
    report.amount_accuracy = amount_ok / amount_total if amount_total else 1.0
    report.party_accuracy = party_ok / party_total if party_total else 1.0
    report.question_gate_accuracy = question_ok / question_total if question_total else 1.0
    report.false_positive_rate = false_positive_hits / false_positive_total if false_positive_total else 0.0

    return report
