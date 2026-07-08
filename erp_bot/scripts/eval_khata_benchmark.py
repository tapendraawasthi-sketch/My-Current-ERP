#!/usr/bin/env python3
"""Golden evaluation suite for e-Khata intelligence (Peak Plan — Phase 1).

Buckets: concept (50), journal_parse (80), reasoning (30), language (20), adversarial (20).

Usage:
    python erp_bot/scripts/eval_khata_benchmark.py --build
    python erp_bot/scripts/eval_khata_benchmark.py --tier offline
    python erp_bot/scripts/eval_khata_benchmark.py --tier llm
    python erp_bot/scripts/eval_khata_benchmark.py --tier llm --bucket concept --limit 10
    python erp_bot/scripts/eval_khata_benchmark.py --tier offline --report erp_bot/data/benchmark_report.json

Sector NLU hold-out (Phase A v2 pipeline — retrieval + policy + enrich):

    python erp_bot/scripts/eval_sector_nlu_holdout.py --build
    python erp_bot/scripts/eval_sector_nlu_holdout.py --tier enrich --save-baseline
    python erp_bot/scripts/eval_sector_nlu_holdout.py --compare-baseline

Phase B hybrid NLU embeddings (lexical + Chroma RRF — requires Ollama for ingest):

    python erp_bot/scripts/ingest_nlu_knowledge_embeddings.py
    python erp_bot/scripts/test_hybrid_nlu_search.py
    python erp_bot/scripts/test_nearest_neighbor_intent.py
    python erp_bot/scripts/test_vocabulary_loader.py
    python erp_bot/scripts/build_sector_journal_templates.py
    python erp_bot/scripts/test_sector_journal_templates.py
    python erp_bot/scripts/test_journal_verifier_chain.py
    python erp_bot/scripts/test_compound_splitter.py
    python erp_bot/scripts/test_wsd_expansion.py
    python erp_bot/scripts/test_feedback_promoter.py
    python erp_bot/scripts/test_ts_python_parity.py
    python erp_bot/scripts/test_production_smoke.py
    python erp_bot/scripts/health_check.py
    python erp_bot/scripts/health_check.py --full
    bash erp_bot/scripts/run_ekhata_ci.sh
    npm run test:ekhata-panel-smoke
    npm run test:e2e:ekhata:install && npm run test:e2e:ekhata
    python erp_bot/scripts/promote_user_feedback.py --dry-run

Tiers:
    offline — routing, RAG retrieval, regex parse (no Ollama)
    llm     — full khata_chat replies (requires Ollama + model)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BOT_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BOT_ROOT.parent
BENCHMARK_PATH = REPO_ROOT / "data" / "ekhata" / "khata-benchmark.json"
KNOWLEDGE_JSON = REPO_ROOT / "data" / "ekhata" / "conceptual-framework-knowledge.json"
LORA_JSONL = REPO_ROOT / "data" / "ekhata" / "lora-instruction-dataset.jsonl"

sys.path.insert(0, str(BOT_ROOT))


def _khata_imports() -> tuple[Any, ...]:
    """Lazy import — avoids Chroma/Ollama during --build."""
    from src.falcon_trader import parse_khata_message
    from src.khata.context_intelligence import (
        build_intelligent_context,
        classify_message_kind,
        clear_session_context,
        match_accounting_concepts,
    )
    from src.khata.khata_chat import clear_session, khata_chat

    return (
        parse_khata_message,
        build_intelligent_context,
        classify_message_kind,
        clear_session_context,
        match_accounting_concepts,
        clear_session,
        khata_chat,
    )

BUCKET_TARGETS = {
    "concept": 50,
    "journal_parse": 80,
    "reasoning": 30,
    "language": 20,
    "adversarial": 20,
}

_REASONING_CASES: list[tuple[str, dict[str, Any]]] = [
    ("udhaar deko vs tiryo farak k ho", {"kind": "general", "reply_keywords": ["udhaar", "tiryo", "debtor", "payment", "receivable", "cash"]}),
    ("provision vs write-off farak k ho", {"kind": "general", "reply_keywords": ["provision", "write", "bad debt", "receivable"]}),
    ("credit sale ko entry kasari hunchha", {"kind": "general", "reply_keywords": ["debtor", "sales", "dr", "cr", "udhaar"]}),
    ("payment received entry explain", {"kind": "general", "reply_keywords": ["cash", "debtor", "dr", "cr", "payment"]}),
    ("Ram lai udhaar becheko entry k ho", {"kind": "general", "reply_keywords": ["debtor", "sales", "ram", "dr", "cr"]}),
    ("SSF employer vs employee contribution farak", {"kind": "general", "reply_keywords": ["ssf", "employer", "employee", "10", "11"]}),
    ("VAT inclusive sale ma net ra VAT kasari nikalne", {"kind": "transaction", "reply_keywords": ["13", "vat", "net", "gross", "1.13"]}),
    ("prepaid expense vs outstanding expense", {"kind": "general", "reply_keywords": ["prepaid", "outstanding", "accrued", "asset", "liability"]}),
    ("depreciation cash flow ma kina add back", {"kind": "general", "reply_keywords": ["depreciation", "non-cash", "cash"]}),
    ("drawings capital ma kasari affect hunchha", {"kind": "general", "reply_keywords": ["drawings", "capital", "equity", "owner"]}),
    ("loan received entry logic", {"kind": "general", "reply_keywords": ["loan", "bank", "liability", "dr", "cr"]}),
    ("bad debt recovery pachhi entry", {"kind": "general", "reply_keywords": ["recovery", "bad debt", "income", "cash"]}),
    ("gratuity provision kina chaincha", {"kind": "general", "reply_keywords": ["gratuity", "provision", "expense", "liability"]}),
    ("TDS deduct garda entry kasari", {"kind": "general", "reply_keywords": ["tds", "payable", "expense", "bank"]}),
    ("capital introduced vs loan received", {"kind": "general", "reply_keywords": ["capital", "loan", "equity", "liability"]}),
    ("udhaar bikri ma VAT inclusive 113000 split", {"kind": "transaction", "reply_keywords": ["113", "100", "13", "vat", "sales"]}),
    ("accrual vs cash basis farak", {"kind": "general", "reply_keywords": ["accrual", "cash", "recognition", "timing"]}),
    ("substance over form example Nepal", {"kind": "general", "reply_keywords": ["substance", "form", "economic"]}),
    ("going concern assumption k ho", {"kind": "accounting_concept", "reply_para_ids": ["3.8", "3.9"], "reply_keywords": ["going concern"]}),
    ("materiality le ke affect garcha", {"kind": "accounting_concept", "reply_keywords": ["material", "materiality", "omit"]}),
    ("recognition criteria kasari apply huncha", {"kind": "accounting_concept", "reply_keywords": ["recognition", "relevance", "faithful"]}),
    ("derecognition asset ko case", {"kind": "accounting_concept", "reply_keywords": ["derecognition", "control", "transfer"]}),
    ("fair value vs historical cost kun bela", {"kind": "accounting_concept", "reply_keywords": ["fair value", "historical cost", "measurement"]}),
    ("equity vs liability farak short", {"kind": "accounting_concept", "reply_keywords": ["equity", "liability", "obligation"]}),
    ("income vs expense recognition timing", {"kind": "accounting_concept", "reply_keywords": ["income", "expense", "increase", "decrease"]}),
    ("SSF payable asset ho ki liability", {"kind": "general", "reply_keywords": ["liability", "ssf", "payable"]}),
    ("input VAT vs output VAT entry", {"kind": "general", "reply_keywords": ["input", "output", "vat", "credit"]}),
    ("salary accrual vs salary payment entry farak", {"kind": "general", "reply_keywords": ["accrual", "payable", "payment", "salary"]}),
    ("stock purchase cash vs credit", {"kind": "general", "reply_keywords": ["stock", "cash", "creditor", "purchase"]}),
    ("commission income entry kasari", {"kind": "general", "reply_keywords": ["commission", "income", "cash", "dr", "cr"]}),
]

_LANGUAGE_CASES: list[tuple[str, dict[str, Any]]] = [
    ("what is an asset", {"reply_language": "english", "kind": "accounting_concept", "context_para_ids": ["4.3"], "reply_keywords": ["asset", "economic resource"]}),
    ("sampatti k ho", {"reply_language": "nepali", "kind": "accounting_concept", "context_para_ids": ["4.3"], "reply_keywords": ["sampatti", "asset", "economic"]}),
    ("define liability in accounting", {"reply_language": "english", "kind": "accounting_concept", "context_para_ids": ["4.26"], "reply_keywords": ["liability", "obligation"]}),
    ("dayitwo k ho", {"reply_language": "nepali", "kind": "accounting_concept", "context_para_ids": ["4.26"], "reply_keywords": ["dayitwo", "liability", "dait"]}),
    ("what is faithful representation", {"reply_language": "english", "kind": "accounting_concept", "context_para_ids": ["2.12"], "reply_keywords": ["faithful", "representation"]}),
    ("faithful representation k ho", {"reply_language": "nepali", "kind": "accounting_concept", "context_para_ids": ["2.12"], "reply_keywords": ["faithful", "representation", "imfaithful"]}),
    ("explain recognition criteria", {"reply_language": "english", "kind": "accounting_concept", "context_para_ids": ["5.6"], "reply_keywords": ["recognition", "relevance"]}),
    ("recognition criteria kasari ho", {"reply_language": "nepali", "kind": "accounting_concept", "context_para_ids": ["5.6"], "reply_keywords": ["recognition", "criteria", "manyata"]}),
    ("what is equity", {"reply_language": "english", "kind": "accounting_concept", "context_para_ids": ["4.63"], "reply_keywords": ["equity", "residual"]}),
    ("punji k ho accounting ma", {"reply_language": "nepali", "kind": "accounting_concept", "context_para_ids": ["4.63"], "reply_keywords": ["punji", "equity", "capital"]}),
    ("what is materiality", {"reply_language": "english", "kind": "accounting_concept", "context_para_ids": ["2.29"], "reply_keywords": ["material", "materiality"]}),
    ("materiality ko meaning", {"reply_language": "nepali", "kind": "accounting_concept", "context_para_ids": ["2.29"], "reply_keywords": ["material", "mahatwo", "omit"]}),
    ("what is going concern", {"reply_language": "english", "kind": "accounting_concept", "context_para_ids": ["3.8"], "reply_keywords": ["going concern", "continue"]}),
    ("going concern assumption k ho", {"reply_language": "nepali", "kind": "accounting_concept", "context_para_ids": ["3.8"], "reply_keywords": ["going concern", "business", "continue"]}),
    ("what is fair value", {"reply_language": "english", "kind": "accounting_concept", "context_para_ids": ["6.2"], "reply_keywords": ["fair value", "measurement"]}),
    ("fair value k ho", {"reply_language": "nepali", "kind": "accounting_concept", "context_para_ids": ["6.2"], "reply_keywords": ["fair value", "mulya", "measurement"]}),
    ("asset vs liability difference", {"reply_language": "english", "kind": "accounting_concept", "reply_keywords": ["asset", "liability"]}),
    ("sampatti ra dayitwo farak", {"reply_language": "nepali", "kind": "accounting_concept", "reply_keywords": ["sampatti", "dayitwo", "farak"]}),
    ("what is income in IFRS", {"reply_language": "english", "kind": "accounting_concept", "context_para_ids": ["4.68"], "reply_keywords": ["income", "increase", "equity"]}),
    ("aamdani k ho IFRS ma", {"reply_language": "nepali", "kind": "accounting_concept", "context_para_ids": ["4.68"], "reply_keywords": ["aamdani", "income", "equity"]}),
]

_ADVERSARIAL_CASES: list[tuple[str, dict[str, Any]]] = [
    ("sampati k ho xa chaina grammar", {"kind": "accounting_concept", "context_para_ids": ["4.3"], "forbid_keywords": ["halkhabar", "spelling mistake", "grammar rule"]}),
    ("faithful representation k ho chha ki chaina", {"kind": "accounting_concept", "context_para_ids": ["2.12"], "forbid_keywords": ["verb conjugation", "halkhabar"]}),
    ("dayitwo k ho vaneko k ho", {"kind": "accounting_concept", "context_para_ids": ["4.26"], "forbid_keywords": ["spelling", "romanization"]}),
    ("punji k ho halkhabar ma", {"kind": "accounting_concept", "context_para_ids": ["4.63"], "forbid_keywords": ["halkhabar guide", "conjugation table"]}),
    ("recognition criteria kasari ho explain pls", {"kind": "accounting_concept", "context_para_ids": ["5.6"], "forbid_keywords": ["your spelling", "typo"]}),
    ("asset ko paribhasha k ho IFRS", {"kind": "accounting_concept", "context_para_ids": ["4.3"], "forbid_keywords": ["nepali grammar reference", "decode spelling"]}),
    ("what is sampatti xa", {"kind": "accounting_concept", "context_para_ids": ["4.3"], "forbid_keywords": ["particle xa", "grammar lesson"]}),
    ("liability k ho vanne", {"kind": "accounting_concept", "context_para_ids": ["4.26"], "forbid_keywords": ["vanne vs vaneko", "grammar"]}),
    ("materiality ko matlab chaina bhane", {"kind": "accounting_concept", "context_para_ids": ["2.29"], "forbid_keywords": ["chaina particle", "verb form"]}),
    ("going concern k ho ki hudaina", {"kind": "accounting_concept", "context_para_ids": ["3.8"], "forbid_keywords": ["ki hudaina grammar", "conjugation"]}),
    ("fair value kasari measure garne ho", {"kind": "accounting_concept", "context_para_ids": ["6.2"], "forbid_keywords": ["garne ho grammar", "halkhabar"]}),
    ("income expense farak k ho explain", {"kind": "accounting_concept", "context_para_ids": ["4.68"], "forbid_keywords": ["spelling variant", "roman nepali lesson"]}),
    ("derecognition k ho short ma", {"kind": "accounting_concept", "context_para_ids": ["5.25"], "forbid_keywords": ["short ma grammar", "abbreviation lesson"]}),
    ("accrual accounting k ho simple", {"kind": "accounting_concept", "context_para_ids": ["1.17"], "forbid_keywords": ["simple nepali lesson", "halkhabar"]}),
    ("substance over form k ho example", {"kind": "accounting_concept", "context_para_ids": ["4.59"], "forbid_keywords": ["form vs form grammar", "spelling"]}),
    ("what is an asset pls halkhabar", {"kind": "accounting_concept", "context_para_ids": ["4.3"], "forbid_keywords": ["halkhabar romanization", "decode the word asset"]}),
    ("equity k ho accounting sikha", {"kind": "accounting_concept", "context_para_ids": ["4.63"], "forbid_keywords": ["sikha grammar", "verb teaching"]}),
    ("expense k ho kharcha jasto ho ki", {"kind": "accounting_concept", "context_para_ids": ["4.72"], "forbid_keywords": ["jasto ho ki particle", "grammar comparison"]}),
    ("comparability k ho IFRS ma", {"kind": "accounting_concept", "context_para_ids": ["2.20"], "forbid_keywords": ["comparable spelling", "nepali grammar"]}),
    ("cost constraint k ho brief", {"kind": "accounting_concept", "context_para_ids": ["2.39"], "forbid_keywords": ["brief grammar", "halkhabar tutorial"]}),
]


@dataclass
class CaseResult:
    id: str
    bucket: str
    input: str
    passed: bool
    scores: dict[str, bool] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    elapsed_ms: int = 0
    reply_preview: str = ""


def _detect_language(text: str) -> str:
    en = len(re.findall(
        r"\b(the|is|are|what|how|entry|debit|credit|account|journal|asset|liability|define|explain)\b",
        text,
        re.I,
    ))
    ne = len(re.findall(
        r"\b(k\s*ho|kasari|udhaar|kharcha|bikri|tiryo|hisab|lekha|chha|hunchha|farak|bhaneko)\b|[\u0900-\u097F]",
        text,
        re.I,
    ))
    if en > ne * 1.5:
        return "english"
    if ne > en * 1.5:
        return "nepali"
    return "mixed"


def _para_ids_in_text(text: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r"\bPara\s+([\d.]+)", text, re.I)))


def _keywords_hit(text: str, keywords: list[str]) -> bool:
    low = text.lower()
    hits = sum(1 for kw in keywords if kw.lower() in low)
    return hits >= max(1, len(keywords) // 3)


def _journal_balanced(lines: list[dict]) -> bool:
    if not lines:
        return True
    dr = sum(float(l.get("debit", 0) or 0) for l in lines)
    cr = sum(float(l.get("credit", 0) or 0) for l in lines)
    return abs(dr - cr) <= 0.02


def _load_knowledge_concepts() -> list[dict]:
    if not KNOWLEDGE_JSON.exists():
        return []
    with open(KNOWLEDGE_JSON, encoding="utf-8") as f:
        data = json.load(f)
    return [c for c in data.get("concepts", []) if c.get("paragraphs")]


def _concept_prompts(concept: dict) -> list[str]:
    ne_terms = [t for t in concept.get("ne", []) if len(t) > 2][:2]
    en_terms = [t for t in concept.get("en", []) if len(t) > 2][:2]
    prompts: list[str] = []
    for term in ne_terms:
        prompts.append(f"{term} k ho")
    for term in en_terms:
        prompts.append(f"what is {term}")
    if ne_terms:
        prompts.append(f"IFRS ma {ne_terms[0]} ko paribhasha")
    return prompts


def _build_concept_cases() -> list[dict]:
    cases: list[dict] = []
    for concept in _load_knowledge_concepts():
        if len(cases) >= BUCKET_TARGETS["concept"]:
            break
        para_ids = [str(p) for p in concept.get("paragraphs", [])[:3]]
        primary_para = para_ids[0] if para_ids else ""
        for prompt in _concept_prompts(concept):
            if len(cases) >= BUCKET_TARGETS["concept"]:
                break
            lang = _detect_language(prompt)
            cases.append({
                "id": f"concept_{len(cases) + 1:03d}",
                "bucket": "concept",
                "input": prompt,
                "expect": {
                    "kind": "accounting_concept",
                    "context_para_ids": para_ids,
                    "reply_para_ids": [primary_para] if primary_para else [],
                    "reply_language": lang if lang != "mixed" else None,
                    "concept_id": concept.get("id"),
                },
            })
    return cases


def _build_journal_cases() -> list[dict]:
    cases: list[dict] = []
    if not LORA_JSONL.exists():
        return cases
    seen_inputs: set[str] = set()
    with open(LORA_JSONL, encoding="utf-8") as f:
        for line in f:
            if len(cases) >= BUCKET_TARGETS["journal_parse"]:
                break
            row = json.loads(line)
            inp = (row.get("input") or "").strip()
            if not inp or inp in seen_inputs:
                continue
            try:
                out = json.loads(row.get("output") or "{}")
            except json.JSONDecodeError:
                continue
            intent = out.get("intent")
            amount = out.get("amount")
            if not intent or amount is None:
                continue
            seen_inputs.add(inp)
            party = out.get("party")
            lines = out.get("journalLines") or []
            expect: dict[str, Any] = {
                "kind": "transaction",
                "parse": {
                    "intent": intent,
                    "amount": int(amount),
                },
            }
            if party:
                expect["parse"]["party"] = party
            if lines:
                expect["llm_card"] = {
                    "intent": intent,
                    "amount": int(amount),
                    "party": party,
                    "balanced": _journal_balanced(lines),
                }
            cases.append({
                "id": f"journal_{len(cases) + 1:03d}",
                "bucket": "journal_parse",
                "input": inp,
                "expect": expect,
            })
    return cases


def _build_static_bucket(
    bucket: str,
    rows: list[tuple[str, dict[str, Any]]],
) -> list[dict]:
    cases: list[dict] = []
    for i, (inp, extra) in enumerate(rows[: BUCKET_TARGETS[bucket]]):
        expect = dict(extra)
        if "kind" not in expect and bucket == "reasoning":
            expect["kind"] = "general"
        cases.append({
            "id": f"{bucket}_{i + 1:03d}",
            "bucket": bucket,
            "input": inp,
            "expect": expect,
        })
    return cases


def build_benchmark() -> dict[str, Any]:
    """Generate golden benchmark JSON from IFRS corpus + LoRA dataset."""
    cases: list[dict] = []
    cases.extend(_build_concept_cases())
    cases.extend(_build_journal_cases())
    cases.extend(_build_static_bucket("reasoning", _REASONING_CASES))
    cases.extend(_build_static_bucket("language", _LANGUAGE_CASES))
    cases.extend(_build_static_bucket("adversarial", _ADVERSARIAL_CASES))

    counts: dict[str, int] = {}
    for c in cases:
        counts[c["bucket"]] = counts.get(c["bucket"], 0) + 1

    return {
        "version": "1.0.0",
        "description": "e-Khata golden evaluation suite (Peak Intelligence Plan Phase 1)",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "bucket_counts": counts,
        "total": len(cases),
        "cases": cases,
    }


def save_benchmark(path: Path | None = None) -> Path:
    path = path or BENCHMARK_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    data = build_benchmark()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path


def load_benchmark(path: Path | None = None) -> dict[str, Any]:
    path = path or BENCHMARK_PATH
    if not path.exists():
        save_benchmark(path)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _score_offline(case: dict) -> CaseResult:
    (
        parse_khata_message,
        build_intelligent_context,
        classify_message_kind,
        _clear_session_context,
        match_accounting_concepts,
        _clear_session,
        _khata_chat,
    ) = _khata_imports()

    inp = case["input"]
    expect = case.get("expect", {})
    scores: dict[str, bool] = {}
    notes: list[str] = []
    t0 = time.time()

    if expect.get("kind"):
        got = classify_message_kind(inp).value
        scores["kind"] = got == expect["kind"]
        if not scores["kind"]:
            notes.append(f"kind: expected {expect['kind']}, got {got}")

    ctx = build_intelligent_context(inp, session_id=f"bench-{case['id']}")
    if expect.get("context_para_ids"):
        found = []
        for pid in expect["context_para_ids"]:
            if pid in ctx or f"Para {pid}" in ctx or f"▸ Para {pid}" in ctx:
                found.append(pid)
        scores["context_para"] = len(found) >= 1
        if not scores["context_para"]:
            notes.append(f"context missing para: {expect['context_para_ids']}")

    if case["bucket"] == "journal_parse" and expect.get("parse"):
        parsed = parse_khata_message(inp)
        pexp = expect["parse"]
        if "intent" in pexp:
            scores["parse_intent"] = parsed.get("intent") == pexp["intent"]
            if not scores["parse_intent"]:
                notes.append(f"intent: expected {pexp['intent']}, got {parsed.get('intent')}")
        if "amount" in pexp:
            scores["parse_amount"] = parsed.get("AMOUNT") == pexp["amount"]
            if not scores["parse_amount"]:
                notes.append(f"amount: expected {pexp['amount']}, got {parsed.get('AMOUNT')}")
        if "party" in pexp:
            scores["parse_party"] = parsed.get("PARTY") == pexp["party"]
            if not scores["parse_party"]:
                notes.append(f"party: expected {pexp['party']}, got {parsed.get('PARTY')}")

    if case["bucket"] == "adversarial":
        if expect.get("context_para_ids"):
            scores.setdefault("context_para", False)
        if expect.get("forbid_keywords"):
            low = ctx.lower()
            bad = [kw for kw in expect["forbid_keywords"] if kw.lower() in low and "NEPALI GRAMMAR" in ctx]
            scores["grammar_not_primary"] = len(bad) == 0 or "IFRS" in ctx
        if expect.get("kind"):
            scores.setdefault("kind", False)

    if case["bucket"] == "concept":
        concepts = match_accounting_concepts(inp)
        if expect.get("concept_id"):
            ids = {c.get("id") for c in concepts}
            scores["concept_match"] = expect["concept_id"] in ids
            if not scores["concept_match"]:
                notes.append(f"concept: expected {expect['concept_id']}, got {list(ids)[:3]}")

    if case["bucket"] == "language" and expect.get("reply_language"):
        got_in = _detect_language(inp)
        scores["input_language"] = got_in == expect["reply_language"]
        if not scores["input_language"]:
            notes.append(f"input language: expected {expect['reply_language']}, got {got_in}")

    passed = bool(scores) and all(scores.values())
    return CaseResult(
        id=case["id"],
        bucket=case["bucket"],
        input=inp,
        passed=passed,
        scores=scores,
        notes=notes,
        elapsed_ms=int((time.time() - t0) * 1000),
    )


def _score_llm(case: dict) -> CaseResult:
    (
        parse_khata_message,
        build_intelligent_context,
        classify_message_kind,
        clear_session_context,
        _match_accounting_concepts,
        clear_session,
        khata_chat,
    ) = _khata_imports()

    inp = case["input"]
    expect = case.get("expect", {})
    scores: dict[str, bool] = {}
    notes: list[str] = []
    sid = f"bench-{case['id']}-{uuid.uuid4().hex[:6]}"
    t0 = time.time()

    try:
        result = khata_chat(inp, session_id=sid)
    except Exception as exc:
        return CaseResult(
            id=case["id"],
            bucket=case["bucket"],
            input=inp,
            passed=False,
            scores={"llm_ok": False},
            notes=[f"khata_chat error: {exc}"],
            elapsed_ms=int((time.time() - t0) * 1000),
        )
    finally:
        clear_session(sid)
        clear_session_context(sid)

    reply = (result.get("reply") or "").strip()
    kind = result.get("kind")
    card = result.get("card")

    scores["llm_ok"] = bool(reply) and "Ollama" not in reply[:80]
    if not scores["llm_ok"]:
        notes.append("empty or Ollama connection error")

    if expect.get("kind") and case["bucket"] != "journal_parse":
        routed = classify_message_kind(inp).value
        scores["kind"] = routed == expect["kind"]
        if not scores["kind"]:
            notes.append(f"kind: expected {expect['kind']}, got {routed}")

    if expect.get("reply_para_ids"):
        cited = _para_ids_in_text(reply)
        scores["para_cite"] = any(p in cited or p.replace(".", "") in cited for p in expect["reply_para_ids"])
        if not scores["para_cite"]:
            scores["para_cite"] = _keywords_hit(reply, ["para", "ifrs"])
            if not scores["para_cite"]:
                notes.append(f"reply missing para refs: {expect['reply_para_ids']}, cited={cited}")

    if expect.get("reply_keywords"):
        scores["reply_keywords"] = _keywords_hit(reply, expect["reply_keywords"])
        if not scores["reply_keywords"]:
            notes.append(f"reply missing keywords (sample): {expect['reply_keywords'][:4]}")

    if expect.get("reply_language"):
        got_lang = _detect_language(reply)
        scores["reply_language"] = got_lang == expect["reply_language"]
        if not scores["reply_language"]:
            notes.append(f"language: expected {expect['reply_language']}, got {got_lang}")

    if expect.get("forbid_keywords"):
        low = reply.lower()
        bad = [kw for kw in expect["forbid_keywords"] if kw.lower() in low]
        scores["no_forbidden"] = len(bad) == 0
        if bad:
            notes.append(f"forbidden in reply: {bad}")

    if case["bucket"] == "journal_parse":
        pexp = expect.get("parse") or {}
        if card:
            if "intent" in pexp:
                scores["card_intent"] = card.get("intent") == pexp["intent"]
            if "amount" in pexp:
                scores["card_amount"] = card.get("amount") == pexp["amount"]
            if "party" in pexp:
                scores["card_party"] = card.get("party") == pexp["party"]
            lines = card.get("journalLines") or []
            scores["card_balanced"] = _journal_balanced(lines)
            if not scores.get("card_balanced", True):
                notes.append("journal lines unbalanced")
        else:
            parsed = parse_khata_message(inp)
            if "intent" in pexp:
                scores["parse_intent"] = parsed.get("intent") == pexp["intent"]
            if "amount" in pexp:
                scores["parse_amount"] = parsed.get("AMOUNT") == pexp["amount"]

    # Hallucination heuristic for concept/adversarial: cite Para without IFRS context
    if case["bucket"] in ("concept", "adversarial"):
        ctx = build_intelligent_context(inp, session_id="hall-check")
        if "IFRS" not in ctx and _para_ids_in_text(reply):
            scores["no_hallucinated_para"] = False
            notes.append("cited Para but no IFRS context retrieved")
        else:
            scores["no_hallucinated_para"] = True

    core_scores = {k: v for k, v in scores.items() if k not in ("llm_ok",)}
    passed = scores.get("llm_ok", False) and (not core_scores or all(core_scores.values()))

    return CaseResult(
        id=case["id"],
        bucket=case["bucket"],
        input=inp,
        passed=passed,
        scores=scores,
        notes=notes,
        elapsed_ms=int((time.time() - t0) * 1000),
        reply_preview=reply[:200],
    )


def run_benchmark(
    *,
    tier: str = "offline",
    buckets: set[str] | None = None,
    limit: int | None = None,
    verbose: bool = False,
    report_path: Path | None = None,
) -> dict[str, Any]:
    data = load_benchmark()
    cases = data["cases"]
    if buckets:
        cases = [c for c in cases if c["bucket"] in buckets]
    if limit:
        cases = cases[:limit]

    scorer = _score_offline if tier == "offline" else _score_llm
    results: list[CaseResult] = []
    total_cases = len(cases)
    for i, case in enumerate(cases, 1):
        r = scorer(case)
        results.append(r)
        if verbose:
            mark = "PASS" if r.passed else "FAIL"
            print(
                f"[{i}/{total_cases}] {mark} {r.id} ({r.bucket}) {r.elapsed_ms}ms",
                flush=True,
            )
        if report_path and tier == "llm" and i % 10 == 0:
            _write_checkpoint(report_path, tier, results)

    bucket_stats: dict[str, dict[str, Any]] = {}
    for r in results:
        st = bucket_stats.setdefault(r.bucket, {"total": 0, "passed": 0, "score_sums": {}})
        st["total"] += 1
        if r.passed:
            st["passed"] += 1
        for k, v in r.scores.items():
            st["score_sums"][k] = st["score_sums"].get(k, 0) + (1 if v else 0)

    for st in bucket_stats.values():
        n = st["total"]
        st["pass_rate"] = round(st["passed"] / n, 3) if n else 0.0
        st["metric_rates"] = {
            k: round(v / n, 3) for k, v in st["score_sums"].items()
        }

    total = len(results)
    passed = sum(1 for r in results if r.passed)

    report: dict[str, Any] = {
        "tier": tier,
        "model_note": "offline=no LLM" if tier == "offline" else "khata_chat via Ollama",
        "total": total,
        "passed": passed,
        "pass_rate": round(passed / total, 3) if total else 0.0,
        "bucket_stats": bucket_stats,
        "failures": [
            asdict(r) for r in results if not r.passed
        ][:50],
        "results": [asdict(r) for r in results],
    }
    if tier == "llm":
        try:
            from src.config import MODEL_NAME

            report["model"] = MODEL_NAME
        except Exception:
            report["model"] = "unknown"
    return report


def _bucket_stats_from_results(results: list[CaseResult]) -> dict[str, dict[str, Any]]:
    bucket_stats: dict[str, dict[str, Any]] = {}
    for r in results:
        st = bucket_stats.setdefault(r.bucket, {"total": 0, "passed": 0, "score_sums": {}})
        st["total"] += 1
        if r.passed:
            st["passed"] += 1
        for k, v in r.scores.items():
            st["score_sums"][k] = st["score_sums"].get(k, 0) + (1 if v else 0)
    for st in bucket_stats.values():
        n = st["total"]
        st["pass_rate"] = round(st["passed"] / n, 3) if n else 0.0
        st["metric_rates"] = {k: round(v / n, 3) for k, v in st["score_sums"].items()}
    return bucket_stats


def _write_checkpoint(path: Path, tier: str, results: list[CaseResult]) -> None:
    bucket_stats = _bucket_stats_from_results(results)
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    payload: dict[str, Any] = {
        "tier": tier,
        "checkpoint": True,
        "total": total,
        "passed": passed,
        "pass_rate": round(passed / total, 3) if total else 0.0,
        "bucket_stats": bucket_stats,
        "results": [asdict(r) for r in results],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def write_scorecard(
    offline_path: Path,
    llm_path: Path,
    out_path: Path,
) -> dict[str, Any]:
    """Merge offline + LLM baseline into a single before/after scorecard."""
    offline = json.loads(offline_path.read_text(encoding="utf-8")) if offline_path.exists() else {}
    llm = json.loads(llm_path.read_text(encoding="utf-8")) if llm_path.exists() else {}
    scorecard = {
        "phase": "1.2_baseline",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": llm.get("model", "qwen2.5:7b-instruct"),
        "offline": {
            "run_at": offline.get("run_at"),
            "total": offline.get("total"),
            "passed": offline.get("passed"),
            "pass_rate": offline.get("pass_rate"),
            "bucket_stats": offline.get("bucket_stats", {}),
        },
        "llm": {
            "run_at": llm.get("run_at"),
            "total": llm.get("total"),
            "passed": llm.get("passed"),
            "pass_rate": llm.get("pass_rate"),
            "bucket_stats": llm.get("bucket_stats", {}),
        },
        "gaps_vs_peak": [
            "journal_parse regex + LLM card accuracy",
            "Para citation in concept replies",
            "reply language match (EN/NE)",
            "adversarial: grammar noise must not override CA terms",
            "reasoning: Dr/Cr logic without hallucination",
        ],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(scorecard, f, ensure_ascii=False, indent=2)
    return scorecard


def _print_summary(report: dict[str, Any]) -> None:
    print("=" * 72)
    print(f"e-Khata benchmark — tier={report['tier']} | {report['passed']}/{report['total']} passed "
          f"({report['pass_rate']:.1%})")
    print("=" * 72)
    for bucket, st in sorted(report["bucket_stats"].items()):
        print(f"  {bucket:16s} {st['passed']:3d}/{st['total']:3d}  ({st['pass_rate']:.1%})")
        for metric, rate in sorted(st.get("metric_rates", {}).items()):
            print(f"    {metric:20s} {rate:.1%}")
    print("=" * 72)
    fails = report.get("failures") or []
    if fails:
        print(f"First {min(5, len(fails))} failures:")
        for f in fails[:5]:
            print(f"  [{f['id']}] {f['input'][:60]}")
            if f.get("notes"):
                print(f"    → {f['notes'][0]}")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description="e-Khata golden benchmark (Phase 1)")
    parser.add_argument("--build", action="store_true", help="Regenerate khata-benchmark.json")
    parser.add_argument("--tier", choices=["offline", "llm"], default="offline")
    parser.add_argument("--bucket", type=str, default="", help="Comma-separated bucket filter")
    parser.add_argument("--limit", type=int, default=0, help="Max cases to run (0=all)")
    parser.add_argument("--report", type=str, default="", help="Write JSON report to path")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print per-case progress")
    parser.add_argument(
        "--scorecard",
        action="store_true",
        help="Write combined scorecard from offline + LLM report paths",
    )
    args = parser.parse_args()

    data_dir = BOT_ROOT / "data"
    offline_report = data_dir / "benchmark_offline_baseline.json"
    llm_report = data_dir / "benchmark_llm_baseline.json"
    scorecard_path = data_dir / "benchmark_scorecard.json"

    if args.scorecard:
        sc = write_scorecard(offline_report, llm_report, scorecard_path)
        print(f"Scorecard → {scorecard_path}")
        print(f"  offline: {sc['offline'].get('pass_rate', 0):.1%} | llm: {sc['llm'].get('pass_rate', 0):.1%}")
        return 0

    if args.build:
        path = save_benchmark()
        data = load_benchmark(path)
        print(f"Built {data['total']} cases → {path}")
        for b, n in sorted(data.get("bucket_counts", {}).items()):
            target = BUCKET_TARGETS.get(b, "?")
            print(f"  {b}: {n} (target {target})")
        return 0

    buckets = {b.strip() for b in args.bucket.split(",") if b.strip()} or None
    limit = args.limit or None
    report_path = Path(args.report) if args.report else None

    report = run_benchmark(
        tier=args.tier,
        buckets=buckets,
        limit=limit,
        verbose=args.verbose or args.tier == "llm",
        report_path=report_path,
    )
    report["run_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"Report saved → {report_path}", flush=True)
        if args.tier == "llm" and offline_report.exists():
            write_scorecard(offline_report, report_path, scorecard_path)
            print(f"Scorecard updated → {scorecard_path}", flush=True)

    _print_summary(report)
    return 0 if report["passed"] == report["total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
