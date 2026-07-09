#!/usr/bin/env python3
"""Export Nepal AI JSON maps to TypeScript runtime bundle for e-Khata NLU."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NEPAL = ROOT / "data" / "nepal-ai"
OUT = ROOT / "src" / "lib" / "nepal-ai" / "generated"
OUT.mkdir(parents=True, exist_ok=True)


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def ts_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def export_verb_map(raw: dict) -> str:
    lines = ["export interface VerbNormalizeEntry {",
             "  lemma: string;",
             "  semantic_action?: string;",
             "  semantic_role?: string;",
             "  intent_hint: string;",
             "  signals_completion?: boolean;",
             "  tense?: string;",
             "  transaction_type?: string;",
             "  debit_hint?: string;",
             "  credit_hint?: string;",
             "  meaning?: string;",
             "}",
             "",
             "export const VERB_ALIASES: Record<string, VerbNormalizeEntry> = {"]
    for alias, entry in sorted(raw.items(), key=lambda x: (-len(x[0]), x[0])):
        lemma = entry.get("lemma") or alias
        intent = entry.get("intent_hint") or "khata_journal"
        parts = [f'lemma: {ts_string(lemma)}', f'intent_hint: {ts_string(intent)}']
        if entry.get("semantic_action"):
            parts.append(f'semantic_action: {ts_string(entry["semantic_action"])}')
        if entry.get("semantic_role"):
            parts.append(f'semantic_role: {ts_string(entry["semantic_role"])}')
        if entry.get("signals_completion"):
            parts.append("signals_completion: true")
        if entry.get("tense"):
            parts.append(f'tense: {ts_string(str(entry["tense"]))}')
        if entry.get("transaction_type"):
            parts.append(f'transaction_type: {ts_string(str(entry["transaction_type"]))}')
        if entry.get("debit_hint"):
            parts.append(f'debit_hint: {ts_string(str(entry["debit_hint"]))}')
        if entry.get("credit_hint"):
            parts.append(f'credit_hint: {ts_string(str(entry["credit_hint"]))}')
        if entry.get("meaning"):
            parts.append(f'meaning: {ts_string(str(entry["meaning"]))}')
        lines.append(f"  {ts_string(alias)}: {{{', '.join(parts)}}},")
    lines.append("};")
    return "\n".join(lines)


def export_verb_conjugations(path: Path) -> str:
    rows = []
    if path.exists():
        rows = json.loads(path.read_text(encoding="utf-8"))
    lines = [
        "export interface VerbConjugationEntry {",
        "  id: string;",
        "  surface: string;",
        "  lemma: string;",
        "  tense: string;",
        "  meaning: string;",
        "  transactionType: string;",
        "  semanticAction: string;",
        "  intentHint: string;",
        "  debitHint: string;",
        "  creditHint: string;",
        "  signalsCompletion: boolean;",
        "}",
        "",
        "export const VERB_CONJUGATIONS: VerbConjugationEntry[] = [",
    ]
    for row in rows:
        lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"surface: {ts_string(str(row.get('surface') or ''))}, "
            f"lemma: {ts_string(str(row.get('lemma') or ''))}, "
            f"tense: {ts_string(str(row.get('tense') or ''))}, "
            f"meaning: {ts_string(str(row.get('meaning') or ''))}, "
            f"transactionType: {ts_string(str(row.get('transaction_type') or ''))}, "
            f"semanticAction: {ts_string(str(row.get('semantic_action') or ''))}, "
            f"intentHint: {ts_string(str(row.get('intent_hint') or ''))}, "
            f"debitHint: {ts_string(str(row.get('debit_hint') or ''))}, "
            f"creditHint: {ts_string(str(row.get('credit_hint') or ''))}, "
            f"signalsCompletion: {str(bool(row.get('signals_completion'))).lower()}"
            "},"
        )
    lines.append("];")
    return "\n".join(lines)


def export_string_map(name: str, raw: dict[str, str]) -> str:
    lines = [f"export const {name}: Record<string, string> = {{"]
    for k, v in sorted(raw.items(), key=lambda x: (-len(x[0]), x[0])):
        lines.append(f"  {ts_string(k)}: {ts_string(v)},")
    lines.append("};")
    return "\n".join(lines)


def export_question_patterns(rows_path: Path, sense_path: Path | None = None) -> str:
    patterns: list[str] = []
    if rows_path.exists():
        for line in rows_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            pat = str(row.get("pattern") or "")
            if pat and pat not in ("?", "k!", "ho?"):
                safe = re.escape(pat).replace(r"\ ", r"\s+").replace("X", r"[\w\u0900-\u097F]+")
                patterns.append(safe)
    # Critical hardcoded patterns + multi-sense question words (NOT_transaction)
    extras = [
        r"\bk\s*ho\b",
        r"\bke\s*ho\b",
        r"\bk\s*huncha\b",
        r"\bke\s*huncha\b",
        r"\bk\s*bhanne\b",
        r"\bk\s*bhanya\b",
        r"\bk\s*cha\b",
        r"\bke\s*cha\b",
        r"\bk\s*garne\b",
        r"\bk\s*garnu\b",
        r"\bko\s*ho\b",
        r"\bko\s*aayo\b",
        r"\bkasle\b",
        r"\bkun\b",
        r"\bkata\b",
        r"\bkaha\b",
        r"\bkahile\b",
        r"\bkasari\b",
        r"\bkasto\b",
        r"\bkati\b",
        r"\bkina\b",
        r"\bkinabhane\b",
        r"\bhola\b",
        r"\barth\s*k\s*ho\b",
        r"\bfarak\s*k\s*ho\b",
        r"\bwhat\s+is\b",
        r"\bhow\s+much\b",
        r"\bdefine\b",
        r"\bexplain\b",
        r"\?",
    ]
    seen = set(patterns)
    for e in extras:
        if e not in seen:
            patterns.append(e)
            seen.add(e)
    body = ",\n  ".join(ts_string(p) for p in patterns)
    parts = [f"export const QUESTION_REGEX_SOURCES: string[] = [\n  {body},\n];"]

    # Multi-sense question-word lexicon (human-level disambiguation cues)
    senses: list[dict] = []
    if sense_path and sense_path.exists():
        for line in sense_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            senses.append(
                {
                    "id": row.get("id") or "",
                    "question_word": row.get("question_word") or "",
                    "variants": row.get("variants") or [],
                    "meaning_en": row.get("meaning_en") or "",
                    "example_questions": row.get("example_questions") or [],
                    "expected_response_type": row.get("expected_response_type") or "",
                    "not_transaction": bool(row.get("NOT_transaction", True)),
                }
            )
    sense_lines = [
        "export interface QuestionWordSense {",
        "  id: string;",
        "  questionWord: string;",
        "  variants: string[];",
        "  meaningEn: string;",
        "  exampleQuestions: string[];",
        "  expectedResponseType: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const QUESTION_WORD_SENSES: QuestionWordSense[] = [",
    ]
    for s in senses:
        sense_lines.append(
            "  {"
            f"id: {ts_string(s['id'])}, "
            f"questionWord: {ts_string(s['question_word'])}, "
            f"variants: [{', '.join(ts_string(v) for v in s['variants'])}], "
            f"meaningEn: {ts_string(s['meaning_en'])}, "
            f"exampleQuestions: [{', '.join(ts_string(e) for e in s['example_questions'])}], "
            f"expectedResponseType: {ts_string(s['expected_response_type'])}, "
            f"notTransaction: {str(s['not_transaction']).lower()}"
            "},"
        )
    sense_lines.append("];")
    parts.append("\n".join(sense_lines))
    return "\n\n".join(parts)


def export_number_words(values_path: Path, phrases_path: Path) -> str:
    values = load_json(values_path)
    phrases = []
    if phrases_path.exists():
        phrases = json.loads(phrases_path.read_text(encoding="utf-8"))

    val_lines = ["export const NUMBER_WORD_VALUES: Record<string, number> = {"]
    for k, v in sorted(values.items(), key=lambda x: (-len(x[0]), x[0])):
        try:
            num = float(v)
        except (TypeError, ValueError):
            continue
        # Keep integers as ints in TS when whole
        if num == int(num) and abs(num) < 1e15:
            num_lit = str(int(num))
        else:
            num_lit = str(num)
        val_lines.append(f"  {ts_string(str(k))}: {num_lit},")
    val_lines.append("};")

    phrase_lines = [
        "export interface NumberWordPhrase {",
        "  id: string;",
        "  text: string;",
        "  variants: string[];",
        "  numericValue: number;",
        "  regexPattern: string;",
        "}",
        "",
        "export const NUMBER_WORD_PHRASES: NumberWordPhrase[] = [",
    ]
    for row in phrases:
        try:
            num = float(row.get("numeric_value"))
        except (TypeError, ValueError):
            continue
        if num == int(num) and abs(num) < 1e15:
            num_lit = str(int(num))
        else:
            num_lit = str(num)
        variants = row.get("variants") or []
        phrase_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"text: {ts_string(str(row.get('text') or ''))}, "
            f"variants: [{', '.join(ts_string(str(v)) for v in variants)}], "
            f"numericValue: {num_lit}, "
            f"regexPattern: {ts_string(str(row.get('regex_pattern') or ''))}"
            "},"
        )
    phrase_lines.append("];")
    return "\n".join(val_lines) + "\n\n" + "\n".join(phrase_lines)


def export_social_discourse(rows_path: Path) -> str:
    rows: list[dict] = []
    if rows_path.exists():
        for line in rows_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            rows.append(row)
    lines = [
        "export interface SocialDiscoursePhrase {",
        "  id: string;",
        "  input: string;",
        "  type: string;",
        "  appropriateResponses: string[];",
        "  tone: string;",
        "  notTransaction: boolean;",
        "  notQuestion: boolean;",
        "}",
        "",
        "export const SOCIAL_DISCOURSE_PHRASES: SocialDiscoursePhrase[] = [",
    ]
    for row in rows:
        lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"input: {ts_string(str(row.get('input') or ''))}, "
            f"type: {ts_string(str(row.get('type') or ''))}, "
            f"appropriateResponses: [{', '.join(ts_string(r) for r in (row.get('appropriate_responses') or []))}], "
            f"tone: {ts_string(str(row.get('tone') or ''))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', True))).lower()}, "
            f"notQuestion: {str(bool(row.get('NOT_question', True))).lower()}"
            "},"
        )
    lines.append("];")
    return "\n".join(lines)


def export_safety_patterns(raw: dict) -> str:
    entries = []
    for pattern, meta in raw.items():
        if not pattern or pattern.startswith("unsafe query"):
            continue
        entries.append({
            "pattern": pattern,
            "category": meta.get("category"),
            "action": meta.get("action"),
            "response_ne": meta.get("response_ne"),
            "response_en": meta.get("response_en"),
        })
    # Fallback regex from categories
    if len(entries) < 5:
        entries = [
            {"pattern": r"kar\s*chori|tax\s*chori|chori\s*gar|fake\s*bill|nakali", "category": "tax_evasion_request", "action": "refuse", "response_ne": "Yo request garna mildaina. Kanuni tarika ma matra sahayog garchhu.", "response_en": "I cannot help with illegal requests."},
            {"pattern": r"fake\s*(invoice|bill|voucher)|jali\s*bill", "category": "fake_document", "action": "refuse", "response_ne": "Nakali document ko lagi sahayog mildaina.", "response_en": "I cannot help create fake documents."},
            {"pattern": r"diagnosis|dawai\s*khau|medicine\s*le", "category": "medical_diagnosis", "action": "refuse", "response_ne": "Medical salah mildaina — doctor sanga consult garnus.", "response_en": "I cannot provide medical advice."},
        ]
    lines = ["export interface SafetyPattern {", "  pattern: string;", "  category: string;", "  action: string;", "  response_ne: string;", "  response_en: string;", "}", "", "export const SAFETY_PATTERNS: SafetyPattern[] = ["]
    for e in entries:
        lines.append(
            f"  {{pattern: {ts_string(e['pattern'])}, category: {ts_string(e.get('category') or '')}, "
            f"action: {ts_string(e.get('action') or 'refuse')}, "
            f"response_ne: {ts_string(e.get('response_ne') or '')}, "
            f"response_en: {ts_string(e.get('response_en') or '')}}},"
        )
    lines.append("];")
    return "\n".join(lines)


def export_clarify_templates(raw: dict) -> str:
    lines = ["export interface ClarifyTemplate {", "  template_ne: string;", "  template_en: string;", "}", "", "export const CLARIFY_TEMPLATES: Record<string, ClarifyTemplate> = {"]
    for scenario, meta in raw.items():
        base = scenario.split("_v")[0]
        if base in raw and base != scenario:
            continue
        lines.append(
            f"  {ts_string(base)}: {{template_ne: {ts_string(meta.get('template_ne') or '')}, "
            f"template_en: {ts_string(meta.get('template_en') or '')}}},"
        )
    lines.append("};")
    return "\n".join(lines)


def export_response_templates(export_path: Path, by_intent_path: Path) -> str:
    rows = []
    if export_path.exists():
        rows = json.loads(export_path.read_text(encoding="utf-8"))
    by_intent = load_json(by_intent_path)

    entry_lines = [
        "export interface ResponseTemplate {",
        "  id: string;",
        "  intent: string;",
        "  templateNe: string;",
        "  templateEn: string;",
        "  requiredEntities: string[];",
        "  optionalEntities: string[];",
        "  tone: string;",
        "}",
        "",
        "export const RESPONSE_TEMPLATES: ResponseTemplate[] = [",
    ]
    for row in rows:
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"intent: {ts_string(str(row.get('intent') or ''))}, "
            f"templateNe: {ts_string(str(row.get('template_ne') or ''))}, "
            f"templateEn: {ts_string(str(row.get('template_en') or ''))}, "
            f"requiredEntities: [{', '.join(ts_string(str(x)) for x in (row.get('required_entities') or []))}], "
            f"optionalEntities: [{', '.join(ts_string(str(x)) for x in (row.get('optional_entities') or []))}], "
            f"tone: {ts_string(str(row.get('tone') or ''))}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "/** Intent → response template ids (round-robin / pick at runtime) */",
        "export const RESPONSE_TEMPLATES_BY_INTENT: Record<string, string[]> = {",
    ]
    for intent, ids in sorted(by_intent.items()):
        id_lits = ", ".join(ts_string(str(i)) for i in ids)
        map_lines.append(f"  {ts_string(str(intent))}: [{id_lits}],")
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_ambiguity_resolution_patterns(
    export_path: Path,
    input_map_path: Path,
    by_type_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    input_map = load_json(input_map_path)
    by_type = load_json(by_type_path)

    entry_lines = [
        "export interface AmbiguityInterpretation {",
        "  interpretation: string;",
        "  intent: string;",
        "  probability: number;",
        "}",
        "",
        "export interface AmbiguityResolutionPattern {",
        "  id: string;",
        "  input: string;",
        "  inputNormalized: string;",
        "  ambiguityType: string;",
        "  possibleInterpretations: AmbiguityInterpretation[];",
        "  resolutionStrategy: string;",
        "  clarifyQuestion: string;",
        "  contextClues: string[];",
        "  topIntent: string;",
        "}",
        "",
        "export const AMBIGUITY_RESOLUTION_PATTERNS: AmbiguityResolutionPattern[] = [",
    ]
    for row in rows:
        interps = row.get("possible_interpretations") or []
        interp_lits = []
        for it in interps:
            interp_lits.append(
                "{"
                f"interpretation: {ts_string(str(it.get('interpretation') or ''))}, "
                f"intent: {ts_string(str(it.get('intent') or ''))}, "
                f"probability: {float(it.get('probability') or 0)}"
                "}"
            )
        clues = row.get("context_clues_that_would_help") or []
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"input: {ts_string(str(row.get('input') or ''))}, "
            f"inputNormalized: {ts_string(str(row.get('input_normalized') or ''))}, "
            f"ambiguityType: {ts_string(str(row.get('ambiguity_type') or ''))}, "
            f"possibleInterpretations: [{', '.join(interp_lits)}], "
            f"resolutionStrategy: {ts_string(str(row.get('resolution_strategy') or ''))}, "
            f"clarifyQuestion: {ts_string(str(row.get('clarify_question') or ''))}, "
            f"contextClues: [{', '.join(ts_string(str(c)) for c in clues)}], "
            f"topIntent: {ts_string(str(row.get('top_intent') or ''))}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface AmbiguityResolutionAlias {",
        "  id: string;",
        "  ambiguityType: string;",
        "  resolutionStrategy: string;",
        "  topIntent: string;",
        "}",
        "",
        "export const AMBIGUITY_RESOLUTION_ALIASES: Record<string, AmbiguityResolutionAlias> = {",
    ]
    for key, meta in sorted(input_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            # map may be normalized_input → id only
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"ambiguityType: {ts_string(str(row.get('ambiguity_type') or ''))}, "
                f"resolutionStrategy: {ts_string(str(row.get('resolution_strategy') or ''))}, "
                f"topIntent: {ts_string(str(row.get('top_intent') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"ambiguityType: {ts_string(str(meta.get('ambiguity_type') or meta.get('ambiguityType') or ''))}, "
                f"resolutionStrategy: {ts_string(str(meta.get('resolution_strategy') or meta.get('resolutionStrategy') or ''))}, "
                f"topIntent: {ts_string(str(meta.get('top_intent') or meta.get('topIntent') or ''))}"
                "},"
            )
    map_lines.append("};")

    type_lines = [
        "/** ambiguity_type → pattern ids */",
        "export const AMBIGUITY_RESOLUTION_BY_TYPE: Record<string, string[]> = "
        + json.dumps(by_type, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(type_lines)


def export_reasoning_chain_patterns(
    export_path: Path,
    input_map_path: Path,
    by_intent_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    input_map = load_json(input_map_path)
    by_intent = load_json(by_intent_path)

    entry_lines = [
        "export interface ReasoningChainStep {",
        "  step: number;",
        "  action: string;",
        "  observation: string;",
        "  result: string;",
        "}",
        "",
        "export type ReasoningFinalOutput = Record<string, unknown>;",
        "",
        "export interface ReasoningChainPattern {",
        "  id: string;",
        "  input: string;",
        "  inputNormalized: string;",
        "  intent: string;",
        "  secondaryIntent?: string;",
        "  needsClarification: boolean;",
        "  reasoningChain: ReasoningChainStep[];",
        "  finalOutput: ReasoningFinalOutput;",
        "}",
        "",
        "export const REASONING_CHAIN_PATTERNS: ReasoningChainPattern[] = [",
    ]
    for row in rows:
        fo = row.get("final_output") or {}
        secondary = row.get("secondary_intent") or fo.get("secondary_intent")
        needs = bool(
            row.get("needs_clarification")
            or fo.get("needs_clarification")
            or (row.get("intent") or fo.get("intent")) == "ambiguous"
        )
        steps = json.dumps(row.get("reasoning_chain") or [], ensure_ascii=False)
        final = json.dumps(fo, ensure_ascii=False)
        secondary_part = (
            f", secondaryIntent: {ts_string(str(secondary))}" if secondary else ""
        )
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"input: {ts_string(str(row.get('input') or ''))}, "
            f"inputNormalized: {ts_string(str(row.get('input_normalized') or row.get('normalized') or ''))}, "
            f"intent: {ts_string(str(row.get('intent') or fo.get('intent') or ''))}, "
            f"needsClarification: {str(needs).lower()}, "
            f"reasoningChain: {steps}, "
            f"finalOutput: {final}"
            f"{secondary_part}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface ReasoningChainAlias {",
        "  id: string;",
        "  intent: string;",
        "  stepCount: number;",
        "  needsClarification: boolean;",
        "}",
        "",
        "export const REASONING_CHAIN_ALIASES: Record<string, ReasoningChainAlias> = {",
    ]
    for key, meta in sorted(input_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            fo = row.get("final_output") or {}
            needs = bool(
                row.get("needs_clarification")
                or fo.get("needs_clarification")
                or (row.get("intent") or fo.get("intent")) == "ambiguous"
            )
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"intent: {ts_string(str(row.get('intent') or fo.get('intent') or ''))}, "
                f"stepCount: {len(row.get('reasoning_chain') or [])}, "
                f"needsClarification: {str(needs).lower()}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"intent: {ts_string(str(meta.get('intent') or ''))}, "
                f"stepCount: {int(meta.get('step_count') or meta.get('stepCount') or 0)}, "
                f"needsClarification: {str(bool(meta.get('needs_clarification') or meta.get('needsClarification'))).lower()}"
                "},"
            )
    map_lines.append("};")

    intent_lines = [
        "/** intent → reasoning-chain pattern ids */",
        "export const REASONING_CHAIN_BY_INTENT: Record<string, string[]> = "
        + json.dumps(by_intent, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(intent_lines)


def export_complex_transaction_narratives(
    export_path: Path,
    input_map_path: Path,
    by_type_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    input_map = load_json(input_map_path)
    by_type = load_json(by_type_path)

    entry_lines = [
        "export interface ComplexClauseAnalysis {",
        "  clause: string;",
        "  meaning: string;",
        "}",
        "",
        "export type ComplexTransactionLeg = Record<string, string | number | boolean | null>;",
        "",
        "export interface ComplexTransactionNarrative {",
        "  id: string;",
        "  input: string;",
        "  inputNormalized: string;",
        "  complexityType: string;",
        "  clauseAnalysis: ComplexClauseAnalysis[];",
        "  transactions: ComplexTransactionLeg[];",
        "  combinedJournal: string;",
        "  needsClarify: boolean;",
        "  clarifyReason?: string;",
        "}",
        "",
        "export const COMPLEX_TRANSACTION_NARRATIVES: ComplexTransactionNarrative[] = [",
    ]
    for row in rows:
        clauses = json.dumps(row.get("clause_analysis") or [], ensure_ascii=False)
        txs = json.dumps(row.get("transactions") or [], ensure_ascii=False)
        clarify = row.get("clarify_reason")
        clarify_part = (
            f", clarifyReason: {ts_string(str(clarify))}" if clarify else ""
        )
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"input: {ts_string(str(row.get('input') or ''))}, "
            f"inputNormalized: {ts_string(str(row.get('normalized') or ''))}, "
            f"complexityType: {ts_string(str(row.get('complexity_type') or ''))}, "
            f"clauseAnalysis: {clauses}, "
            f"transactions: {txs}, "
            f"combinedJournal: {ts_string(str(row.get('combined_journal') or ''))}, "
            f"needsClarify: {str(bool(row.get('needs_clarify'))).lower()}"
            f"{clarify_part}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface ComplexTransactionAlias {",
        "  id: string;",
        "  complexityType: string;",
        "  needsClarify: boolean;",
        "  transactionCount: number;",
        "}",
        "",
        "export const COMPLEX_TRANSACTION_ALIASES: Record<string, ComplexTransactionAlias> = {",
    ]
    for key, meta in sorted(input_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"complexityType: {ts_string(str(row.get('complexity_type') or ''))}, "
                f"needsClarify: {str(bool(row.get('needs_clarify'))).lower()}, "
                f"transactionCount: {len(row.get('transactions') or [])}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"complexityType: {ts_string(str(meta.get('complexity_type') or meta.get('complexityType') or ''))}, "
                f"needsClarify: {str(bool(meta.get('needs_clarify') or meta.get('needsClarify'))).lower()}, "
                f"transactionCount: {int(meta.get('transaction_count') or meta.get('transactionCount') or 0)}"
                "},"
            )
    map_lines.append("};")

    type_lines = [
        "/** complexity_type → narrative ids */",
        "export const COMPLEX_TRANSACTION_BY_TYPE: Record<string, string[]> = "
        + json.dumps(by_type, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(type_lines)


def export_empathetic_response_patterns(
    export_path: Path,
    input_map_path: Path,
    by_emotion_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    input_map = load_json(input_map_path)
    by_emotion = load_json(by_emotion_path)

    entry_lines = [
        "export interface EmpatheticResponsePattern {",
        "  id: string;",
        "  userEmotion: string;",
        "  userInput: string;",
        "  userInputNormalized: string;",
        "  detectedSentiment: string;",
        "  empatheticResponse: string;",
        "  followUpActions: string[];",
        "  tone: string;",
        "  avoid: string[];",
        "}",
        "",
        "export const EMPATHETIC_RESPONSE_PATTERNS: EmpatheticResponsePattern[] = [",
    ]
    for row in rows:
        actions = row.get("follow_up_actions") or []
        avoid = row.get("avoid") or []
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"userEmotion: {ts_string(str(row.get('user_emotion') or ''))}, "
            f"userInput: {ts_string(str(row.get('user_input') or ''))}, "
            f"userInputNormalized: {ts_string(str(row.get('user_input_normalized') or ''))}, "
            f"detectedSentiment: {ts_string(str(row.get('detected_sentiment') or ''))}, "
            f"empatheticResponse: {ts_string(str(row.get('empathetic_response') or ''))}, "
            f"followUpActions: [{', '.join(ts_string(str(a)) for a in actions)}], "
            f"tone: {ts_string(str(row.get('tone') or ''))}, "
            f"avoid: [{', '.join(ts_string(str(a)) for a in avoid)}]"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface EmpatheticResponseAlias {",
        "  id: string;",
        "  userEmotion: string;",
        "  detectedSentiment: string;",
        "  tone: string;",
        "}",
        "",
        "export const EMPATHETIC_RESPONSE_ALIASES: Record<string, EmpatheticResponseAlias> = {",
    ]
    for key, meta in sorted(input_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"userEmotion: {ts_string(str(row.get('user_emotion') or ''))}, "
                f"detectedSentiment: {ts_string(str(row.get('detected_sentiment') or ''))}, "
                f"tone: {ts_string(str(row.get('tone') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"userEmotion: {ts_string(str(meta.get('user_emotion') or meta.get('userEmotion') or ''))}, "
                f"detectedSentiment: {ts_string(str(meta.get('detected_sentiment') or meta.get('detectedSentiment') or ''))}, "
                f"tone: {ts_string(str(meta.get('tone') or ''))}"
                "},"
            )
    map_lines.append("};")

    emotion_lines = [
        "/** user_emotion → pattern ids */",
        "export const EMPATHETIC_RESPONSE_BY_EMOTION: Record<string, string[]> = "
        + json.dumps(by_emotion, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(emotion_lines)


def export_document_understanding_patterns(
    export_path: Path,
    type_map_path: Path,
    by_type_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    type_map = load_json(type_map_path)
    by_type = load_json(by_type_path)

    entry_lines = [
        "export interface DocumentUnderstandingPattern {",
        "  id: string;",
        "  documentType: string;",
        "  documentTypeKey: string;",
        "  variantIndex: number;",
        "  typicalSections: string[];",
        "  keyFieldsToExtract: string[];",
        "  commonLayouts: string[];",
        "  ocrChallenges: string[];",
        "  validationRules: string[];",
        "}",
        "",
        "export const DOCUMENT_UNDERSTANDING_PATTERNS: DocumentUnderstandingPattern[] = [",
    ]
    for row in rows:
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"documentType: {ts_string(str(row.get('document_type') or ''))}, "
            f"documentTypeKey: {ts_string(str(row.get('document_type_key') or ''))}, "
            f"variantIndex: {int(row.get('variant_index') or 0)}, "
            f"typicalSections: [{', '.join(ts_string(str(s)) for s in (row.get('typical_sections') or []))}], "
            f"keyFieldsToExtract: [{', '.join(ts_string(str(s)) for s in (row.get('key_fields_to_extract') or []))}], "
            f"commonLayouts: [{', '.join(ts_string(str(s)) for s in (row.get('common_layouts') or []))}], "
            f"ocrChallenges: [{', '.join(ts_string(str(s)) for s in (row.get('ocr_challenges') or []))}], "
            f"validationRules: [{', '.join(ts_string(str(s)) for s in (row.get('validation_rules') or []))}]"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface DocumentUnderstandingTypeAlias {",
        "  id: string;",
        "  documentType: string;",
        "  documentTypeKey: string;",
        "  variantCount: number;",
        "}",
        "",
        "export const DOCUMENT_UNDERSTANDING_TYPE_ALIASES: Record<string, DocumentUnderstandingTypeAlias> = {",
    ]
    for key, meta in sorted(type_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        map_lines.append(
            f"  {ts_string(str(key))}: {{"
            f"id: {ts_string(str(meta.get('id') or ''))}, "
            f"documentType: {ts_string(str(meta.get('documentType') or meta.get('document_type') or ''))}, "
            f"documentTypeKey: {ts_string(str(meta.get('documentTypeKey') or meta.get('document_type_key') or ''))}, "
            f"variantCount: {int(meta.get('variantCount') or meta.get('variant_count') or 0)}"
            "},"
        )
    map_lines.append("};")

    type_lines = [
        "/** document_type_key → pattern ids (all layout variants) */",
        "export const DOCUMENT_UNDERSTANDING_BY_TYPE: Record<string, string[]> = "
        + json.dumps(by_type, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(type_lines)


def export_accounting_mistake_patterns(
    export_path: Path,
    input_map_path: Path,
    by_type_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    input_map = load_json(input_map_path)
    by_type = load_json(by_type_path)

    entry_lines = [
        "export interface AccountingMistakePattern {",
        "  id: string;",
        "  mistakeType: string;",
        "  userInput: string;",
        "  userInputNormalized: string;",
        "  userProbablyMeant: string;",
        "  commonConfusion: string;",
        "  aiClarification: string;",
        "  ifConfirmedIntent: string;",
        "  teachingMoment: string;",
        "}",
        "",
        "export const ACCOUNTING_MISTAKE_PATTERNS: AccountingMistakePattern[] = [",
    ]
    for row in rows:
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"mistakeType: {ts_string(str(row.get('mistake_type') or ''))}, "
            f"userInput: {ts_string(str(row.get('user_input') or ''))}, "
            f"userInputNormalized: {ts_string(str(row.get('user_input_normalized') or ''))}, "
            f"userProbablyMeant: {ts_string(str(row.get('user_probably_meant') or ''))}, "
            f"commonConfusion: {ts_string(str(row.get('common_confusion') or ''))}, "
            f"aiClarification: {ts_string(str(row.get('ai_clarification') or ''))}, "
            f"ifConfirmedIntent: {ts_string(str(row.get('if_confirmed_intent') or ''))}, "
            f"teachingMoment: {ts_string(str(row.get('teaching_moment') or ''))}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface AccountingMistakeAlias {",
        "  id: string;",
        "  mistakeType: string;",
        "  ifConfirmedIntent: string;",
        "}",
        "",
        "export const ACCOUNTING_MISTAKE_ALIASES: Record<string, AccountingMistakeAlias> = {",
    ]
    for key, meta in sorted(input_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"mistakeType: {ts_string(str(row.get('mistake_type') or ''))}, "
                f"ifConfirmedIntent: {ts_string(str(row.get('if_confirmed_intent') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"mistakeType: {ts_string(str(meta.get('mistake_type') or meta.get('mistakeType') or ''))}, "
                f"ifConfirmedIntent: {ts_string(str(meta.get('if_confirmed_intent') or meta.get('ifConfirmedIntent') or ''))}"
                "},"
            )
    map_lines.append("};")

    type_lines = [
        "/** mistake_type → pattern ids */",
        "export const ACCOUNTING_MISTAKE_BY_TYPE: Record<string, string[]> = "
        + json.dumps(by_type, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(type_lines)


def export_clarify_error_patterns(export_path: Path, map_path: Path) -> str:
    rows: list[dict] = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    alias_map = load_json(map_path)

    entry_lines = [
        "export interface ClarifyErrorPattern {",
        "  id: string;",
        "  input: string;",
        "  inputNormalized: string;",
        "  errorType: string;",
        "  missingEntity: string;",
        "  clarifyQuestionNe: string;",
        "  clarifyQuestionEn: string;",
        "  expectedResponses: string[];",
        "  afterClarificationIntent: string;",
        "  detectedEntities: Record<string, string>;",
        "}",
        "",
        "export const CLARIFY_ERROR_PATTERNS: ClarifyErrorPattern[] = [",
    ]
    for row in rows:
        entities = row.get("detected_entities") or {}
        entity_parts = ", ".join(
            f"{ts_string(str(k))}: {ts_string(str(v))}" for k, v in entities.items()
        )
        examples = row.get("expected_user_response_examples") or []
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"input: {ts_string(str(row.get('input') or ''))}, "
            f"inputNormalized: {ts_string(str(row.get('input_normalized') or ''))}, "
            f"errorType: {ts_string(str(row.get('error_type') or ''))}, "
            f"missingEntity: {ts_string(str(row.get('missing_entity') or ''))}, "
            f"clarifyQuestionNe: {ts_string(str(row.get('clarify_question_ne') or ''))}, "
            f"clarifyQuestionEn: {ts_string(str(row.get('clarify_question_en') or ''))}, "
            f"expectedResponses: [{', '.join(ts_string(str(x)) for x in examples)}], "
            f"afterClarificationIntent: {ts_string(str(row.get('after_clarification_intent') or ''))}, "
            f"detectedEntities: {{{entity_parts}}}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface ClarifyErrorAlias {",
        "  id: string;",
        "  errorType: string;",
        "  missingEntity: string;",
        "  afterClarificationIntent: string;",
        "}",
        "",
        "export const CLARIFY_ERROR_ALIASES: Record<string, ClarifyErrorAlias> = {",
    ]
    for key, meta in sorted(alias_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        map_lines.append(
            f"  {ts_string(str(key))}: {{id: {ts_string(str(meta.get('id') or ''))}, "
            f"errorType: {ts_string(str(meta.get('error_type') or ''))}, "
            f"missingEntity: {ts_string(str(meta.get('missing_entity') or ''))}, "
            f"afterClarificationIntent: {ts_string(str(meta.get('after_clarification_intent') or ''))}}},"
        )
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_journal_entry_rules(export_path: Path, example_map_path: Path, bridge_path: Path) -> str:
    rows: list[dict] = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    example_map = load_json(example_map_path)
    bridge = load_json(bridge_path)

    entry_lines = [
        "export interface JournalRuleCondition {",
        "  field: string;",
        "  operator: string;",
        "  value: string | number | boolean;",
        "}",
        "",
        "export interface JournalEntryRule {",
        "  id: string;",
        "  ruleId: string;",
        "  conditions: JournalRuleCondition[];",
        "  thenIntent: string;",
        "  baseIntent: string;",
        "  thenDebit: string;",
        "  thenCredit: string;",
        "  confidence: number;",
        "  exampleInput: string;",
        "  counterexample: string;",
        "}",
        "",
        "export const JOURNAL_ENTRY_RULES: JournalEntryRule[] = [",
    ]
    for row in rows:
        conds = row.get("conditions") or []
        cond_parts = []
        for c in conds:
            val = c.get("value")
            if isinstance(val, bool):
                val_ts = "true" if val else "false"
            elif isinstance(val, (int, float)) and not isinstance(val, bool):
                val_ts = str(val)
            else:
                val_ts = ts_string(str(val))
            cond_parts.append(
                f"{{field: {ts_string(str(c.get('field') or ''))}, "
                f"operator: {ts_string(str(c.get('operator') or ''))}, "
                f"value: {val_ts}}}"
            )
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"ruleId: {ts_string(str(row.get('rule_id') or ''))}, "
            f"conditions: [{', '.join(cond_parts)}], "
            f"thenIntent: {ts_string(str(row.get('then_intent') or ''))}, "
            f"baseIntent: {ts_string(str(row.get('base_intent') or ''))}, "
            f"thenDebit: {ts_string(str(row.get('then_debit') or ''))}, "
            f"thenCredit: {ts_string(str(row.get('then_credit') or ''))}, "
            f"confidence: {float(row.get('confidence') or 0)}, "
            f"exampleInput: {ts_string(str(row.get('example_input') or ''))}, "
            f"counterexample: {ts_string(str(row.get('counterexample') or ''))}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface JournalRuleExampleHit {",
        "  ruleId: string;",
        "  thenIntent: string;",
        "  baseIntent: string;",
        "}",
        "",
        "export const JOURNAL_ENTRY_RULE_EXAMPLES: Record<string, JournalRuleExampleHit> = {",
    ]
    for key, meta in sorted(example_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        map_lines.append(
            f"  {ts_string(str(key))}: {{ruleId: {ts_string(str(meta.get('rule_id') or ''))}, "
            f"thenIntent: {ts_string(str(meta.get('then_intent') or ''))}, "
            f"baseIntent: {ts_string(str(meta.get('base_intent') or ''))}}},"
        )
    map_lines.append("};")
    map_lines.append("")
    map_lines.append("/** Fine-grained JE then_intent → existing KhataIntent for card engine */")
    map_lines.append("export const JOURNAL_ENTRY_INTENT_BRIDGE: Record<string, string> = {")
    for key, val in sorted(bridge.items()):
        map_lines.append(f"  {ts_string(str(key))}: {ts_string(str(val))},")
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_discourse(raw: dict) -> str:
    lines = [
        "export interface DiscourseEntry {",
        "  type: string;",
        "  multi_turn_action: string;",
        "  strength?: string;",
        "  meaning?: string;",
        "}",
        "",
        "export const DISCOURSE_MAP: Record<string, DiscourseEntry> = {",
    ]
    for pat, meta in raw.items():
        meaning = meta.get("meaning") or ""
        meaning_part = f", meaning: {ts_string(str(meaning))}" if meaning else ""
        lines.append(
            f"  {ts_string(pat)}: {{type: {ts_string(meta.get('type') or '')}, "
            f"multi_turn_action: {ts_string(meta.get('multi_turn_action') or '')}, "
            f"strength: {ts_string(meta.get('strength') or '')}{meaning_part}}},"
        )
    lines.append("];")
    # Fix: use }; not ]; for Record
    lines[-1] = "};"
    return "\n".join(lines)


def export_context_resolution_patterns(export_path: Path, trigger_map_path: Path) -> str:
    rows: list[dict] = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    trigger_map = load_json(trigger_map_path)

    entry_lines = [
        "export interface ContextResolutionPattern {",
        "  id: string;",
        "  patternName: string;",
        "  family: string;",
        "  description: string;",
        "  resolutionRule: string;",
        "  intentAfterResolution: string;",
        "  baseAction: string;",
        "  triggerText: string;",
        "  triggerNormalized: string;",
        "  priorUser: string;",
        "}",
        "",
        "export const CONTEXT_RESOLUTION_PATTERNS: ContextResolutionPattern[] = [",
    ]
    for row in rows:
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"patternName: {ts_string(str(row.get('pattern_name') or ''))}, "
            f"family: {ts_string(str(row.get('family') or ''))}, "
            f"description: {ts_string(str(row.get('description') or ''))}, "
            f"resolutionRule: {ts_string(str(row.get('resolution_rule') or ''))}, "
            f"intentAfterResolution: {ts_string(str(row.get('intent_after_resolution') or ''))}, "
            f"baseAction: {ts_string(str(row.get('base_action') or ''))}, "
            f"triggerText: {ts_string(str(row.get('trigger_text') or ''))}, "
            f"triggerNormalized: {ts_string(str(row.get('trigger_normalized') or ''))}, "
            f"priorUser: {ts_string(str(row.get('prior_user') or ''))}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface ContextTriggerHit {",
        "  id: string;",
        "  patternName: string;",
        "  family: string;",
        "  intentAfterResolution: string;",
        "  baseAction: string;",
        "}",
        "",
        "export const CONTEXT_RESOLUTION_TRIGGERS: Record<string, ContextTriggerHit> = {",
    ]
    for key, meta in sorted(trigger_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        map_lines.append(
            f"  {ts_string(str(key))}: {{id: {ts_string(str(meta.get('id') or ''))}, "
            f"patternName: {ts_string(str(meta.get('pattern_name') or ''))}, "
            f"family: {ts_string(str(meta.get('family') or ''))}, "
            f"intentAfterResolution: {ts_string(str(meta.get('intent_after_resolution') or ''))}, "
            f"baseAction: {ts_string(str(meta.get('base_action') or ''))}}},"
        )
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_pl_map(raw: dict) -> str:
    """Profit/loss terms that signal expense vs question."""
    expense_terms = [k for k, v in raw.items() if v.get("journal_intent_if_entry") == "khata_expense"]
    body = ",\n  ".join(ts_string(t) for t in sorted(set(expense_terms)))
    return f"export const EXPENSE_TERM_HINTS: string[] = [\n  {body},\n];"


def export_party_patterns(patterns_path: Path, marker_path: Path, aids_path: Path) -> str:
    patterns = []
    if patterns_path.exists():
        patterns = json.loads(patterns_path.read_text(encoding="utf-8"))
    marker_map = load_json(marker_path)
    aids = load_json(aids_path)

    pat_lines = [
        "export interface PartyNamePattern {",
        "  id: string;",
        "  pattern: string;",
        "  examples: string[];",
        "  transactionRole: string;",
        "  roleBucket: string;",
        "  nameKind: string;",
        "  marker: string | null;",
        "  markerAlts: string[];",
        "  priority: number;",
        "  extractionHint: string;",
        "}",
        "",
        "export const PARTY_NAME_PATTERNS: PartyNamePattern[] = [",
    ]
    for row in patterns:
        examples = row.get("examples") or []
        alts = row.get("marker_alts") or []
        marker = row.get("marker")
        marker_lit = "null" if marker is None else ts_string(str(marker))
        pat_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"pattern: {ts_string(str(row.get('pattern') or ''))}, "
            f"examples: [{', '.join(ts_string(str(e)) for e in examples)}], "
            f"transactionRole: {ts_string(str(row.get('transaction_role') or ''))}, "
            f"roleBucket: {ts_string(str(row.get('role_bucket') or ''))}, "
            f"nameKind: {ts_string(str(row.get('name_kind') or ''))}, "
            f"marker: {marker_lit}, "
            f"markerAlts: [{', '.join(ts_string(str(a)) for a in alts)}], "
            f"priority: {int(row.get('priority') or 0)}, "
            f"extractionHint: {ts_string(str(row.get('extraction_hint') or ''))}"
            "},"
        )
    pat_lines.append("];")

    map_lines = [
        "export interface PartyMarkerEntry {",
        "  roleBucket: string;",
        "  transactionRole: string;",
        "  nameKind: string;",
        "  patternId: string;",
        "  priority: number;",
        "  pattern: string;",
        "}",
        "",
        "export const PARTY_MARKER_MAP: Record<string, PartyMarkerEntry> = {",
    ]
    for key, meta in sorted(marker_map.items(), key=lambda x: (-len(x[0]), x[0])):
        map_lines.append(
            f"  {ts_string(str(key))}: {{"
            f"roleBucket: {ts_string(str(meta.get('role_bucket') or ''))}, "
            f"transactionRole: {ts_string(str(meta.get('transaction_role') or ''))}, "
            f"nameKind: {ts_string(str(meta.get('name_kind') or ''))}, "
            f"patternId: {ts_string(str(meta.get('pattern_id') or ''))}, "
            f"priority: {int(meta.get('priority') or 0)}, "
            f"pattern: {ts_string(str(meta.get('pattern') or ''))}"
            "},"
        )
    map_lines.append("};")

    honorifics = aids.get("honorifics") or []
    relationships = aids.get("relationships") or []
    titles = aids.get("titles") or []
    shop_tokens = aids.get("shop_tokens") or []
    labels = aids.get("party_labels") or {}
    aid_lines = [
        f"export const PARTY_HONORIFICS: string[] = [{', '.join(ts_string(h) for h in honorifics)}];",
        f"export const PARTY_RELATIONSHIPS: string[] = [{', '.join(ts_string(r) for r in relationships)}];",
        f"export const PARTY_TITLES: string[] = [{', '.join(ts_string(t) for t in titles)}];",
        f"export const PARTY_SHOP_TOKENS: string[] = [{', '.join(ts_string(s) for s in shop_tokens)}];",
        "export const PARTY_LABEL_ROLES: Record<string, string> = {",
    ]
    for k, v in sorted(labels.items()):
        aid_lines.append(f"  {ts_string(str(k))}: {ts_string(str(v))},")
    aid_lines.append("};")

    return "\n".join(pat_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(aid_lines)


def export_retail_items(items_path: Path, map_path: Path) -> str:
    items = []
    if items_path.exists():
        items = json.loads(items_path.read_text(encoding="utf-8"))
    alias_map = load_json(map_path)

    item_lines = [
        "export interface RetailItemEntry {",
        "  id: string;",
        "  item: string;",
        "  canonical: string;",
        "  variants: string[];",
        "  sector: string;",
        "  sectorSlug: string;",
        "  typicalUnit: string;",
        "  typicalPriceRange: string;",
        "  commonPhrases: string[];",
        "}",
        "",
        "export const RETAIL_ITEMS: RetailItemEntry[] = [",
    ]
    for row in items:
        variants = row.get("variants") or []
        phrases = row.get("common_phrases") or []
        item_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"item: {ts_string(str(row.get('item') or ''))}, "
            f"canonical: {ts_string(str(row.get('canonical') or ''))}, "
            f"variants: [{', '.join(ts_string(str(v)) for v in variants)}], "
            f"sector: {ts_string(str(row.get('sector') or ''))}, "
            f"sectorSlug: {ts_string(str(row.get('sector_slug') or ''))}, "
            f"typicalUnit: {ts_string(str(row.get('typical_unit') or ''))}, "
            f"typicalPriceRange: {ts_string(str(row.get('typical_price_range') or ''))}, "
            f"commonPhrases: [{', '.join(ts_string(str(p)) for p in phrases)}]"
            "},"
        )
    item_lines.append("];")

    map_lines = [
        "export interface RetailItemAlias {",
        "  canonical: string;",
        "  itemId: string;",
        "  sector: string;",
        "  sectorSlug: string;",
        "  typicalUnit: string;",
        "  alternatives?: { canonical: string; itemId: string; sector: string; sectorSlug: string }[];",
        "}",
        "",
        "export const RETAIL_ITEM_ALIASES: Record<string, RetailItemAlias> = {",
    ]
    for key, meta in sorted(alias_map.items(), key=lambda x: (-len(x[0]), x[0])):
        alts = meta.get("alternatives") or []
        alt_lit = ""
        if alts:
            parts = []
            for a in alts:
                parts.append(
                    "{"
                    f"canonical: {ts_string(str(a.get('canonical') or ''))}, "
                    f"itemId: {ts_string(str(a.get('item_id') or ''))}, "
                    f"sector: {ts_string(str(a.get('sector') or ''))}, "
                    f"sectorSlug: {ts_string(str(a.get('sector_slug') or ''))}"
                    "}"
                )
            alt_lit = f", alternatives: [{', '.join(parts)}]"
        map_lines.append(
            f"  {ts_string(str(key))}: {{"
            f"canonical: {ts_string(str(meta.get('canonical') or ''))}, "
            f"itemId: {ts_string(str(meta.get('item_id') or ''))}, "
            f"sector: {ts_string(str(meta.get('sector') or ''))}, "
            f"sectorSlug: {ts_string(str(meta.get('sector_slug') or ''))}, "
            f"typicalUnit: {ts_string(str(meta.get('typical_unit') or ''))}"
            f"{alt_lit}"
            "},"
        )
    map_lines.append("};")
    return "\n".join(item_lines) + "\n\n" + "\n".join(map_lines)


def export_bikram_calendar(phrases_path: Path, map_path: Path) -> str:
    phrases = []
    if phrases_path.exists():
        phrases = json.loads(phrases_path.read_text(encoding="utf-8"))
    td_map = load_json(map_path)

    phrase_lines = [
        "export interface BikramCalendarPhrase {",
        "  id: string;",
        "  text: string;",
        "  variants: string[];",
        "  patternType: string;",
        "  monthNumber: number | null;",
        "  day: number | null;",
        "  relativeOffsetDays: number | null;",
        "  gregorianApprox: string;",
        "  fiscalSignificance: string;",
        "}",
        "",
        "export const BIKRAM_CALENDAR_PHRASES: BikramCalendarPhrase[] = [",
    ]
    for row in phrases:
        month = row.get("month_number")
        day = row.get("day")
        offset = row.get("relative_offset_days")
        month_lit = "null" if month is None else str(int(month))
        day_lit = "null" if day is None else str(int(day))
        offset_lit = "null" if offset is None else str(int(offset))
        variants = row.get("variants") or []
        phrase_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"text: {ts_string(str(row.get('text') or ''))}, "
            f"variants: [{', '.join(ts_string(str(v)) for v in variants)}], "
            f"patternType: {ts_string(str(row.get('pattern_type') or ''))}, "
            f"monthNumber: {month_lit}, "
            f"day: {day_lit}, "
            f"relativeOffsetDays: {offset_lit}, "
            f"gregorianApprox: {ts_string(str(row.get('gregorian_approx') or ''))}, "
            f"fiscalSignificance: {ts_string(str(row.get('fiscal_significance') or ''))}"
            "},"
        )
    phrase_lines.append("];")

    map_lines = [
        "export interface TimeDateEntry {",
        "  patternType: string;",
        "  gregorianApprox: string;",
        "  fiscalSignificance: string;",
        "  monthNumber: number | null;",
        "  day: number | null;",
        "  relativeOffsetDays: number | null;",
        "}",
        "",
        "export const TIME_DATE_MAP: Record<string, TimeDateEntry> = {",
    ]
    for key, meta in sorted(td_map.items(), key=lambda x: (-len(x[0]), x[0])):
        month = meta.get("month_number")
        day = meta.get("day")
        offset = meta.get("relative_offset_days")
        month_lit = "null" if month is None else str(int(month))
        day_lit = "null" if day is None else str(int(day))
        offset_lit = "null" if offset is None else str(int(offset))
        map_lines.append(
            f"  {ts_string(str(key))}: {{"
            f"patternType: {ts_string(str(meta.get('pattern_type') or ''))}, "
            f"gregorianApprox: {ts_string(str(meta.get('gregorian_approx') or ''))}, "
            f"fiscalSignificance: {ts_string(str(meta.get('fiscal_significance') or ''))}, "
            f"monthNumber: {month_lit}, "
            f"day: {day_lit}, "
            f"relativeOffsetDays: {offset_lit}"
            "},"
        )
    map_lines.append("};")
    return "\n".join(phrase_lines) + "\n\n" + "\n".join(map_lines)


def export_nepali_orthography(export_path: Path, dev_path: Path, roman_path: Path) -> str:
    rows = []
    if export_path.exists():
        rows = json.loads(export_path.read_text(encoding="utf-8"))
    dev_map = load_json(dev_path)
    roman_map = load_json(roman_path)

    entry_lines = [
        "export interface NepaliOrthographyEntry {",
        "  id: string;",
        "  devanagari: string;",
        "  romanStandard: string;",
        "  romanVariants: string[];",
        "  ipa: string;",
        "  meaningEn: string;",
        "  wordType: string;",
        "}",
        "",
        "export const NEPALI_ORTHOGRAPHY: NepaliOrthographyEntry[] = [",
    ]
    for row in rows:
        variants = row.get("roman_variants") or []
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"devanagari: {ts_string(str(row.get('devanagari') or ''))}, "
            f"romanStandard: {ts_string(str(row.get('roman_standard') or ''))}, "
            f"romanVariants: [{', '.join(ts_string(str(v)) for v in variants)}], "
            f"ipa: {ts_string(str(row.get('ipa') or ''))}, "
            f"meaningEn: {ts_string(str(row.get('meaning_en') or ''))}, "
            f"wordType: {ts_string(str(row.get('word_type') or ''))}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "/** Devanagari script → NLU roman (longest-key first at runtime) */",
        "export const DEVANAGARI_ROMAN_MAP: Record<string, string> = {",
    ]
    for key, val in sorted(dev_map.items(), key=lambda x: (-len(x[0]), x[0])):
        map_lines.append(f"  {ts_string(str(key))}: {ts_string(str(val))},")
    map_lines.append("};")
    map_lines.append("")
    map_lines.append("/** Roman spelling variants → canonical roman for foldSpelling */")
    map_lines.append("export const ROMAN_ORTHO_ALIASES: Record<string, string> = {")
    for key, val in sorted(roman_map.items(), key=lambda x: (-len(x[0]), x[0])):
        map_lines.append(f"  {ts_string(str(key))}: {ts_string(str(val))},")
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_legal_section_explainers(
    export_path: Path,
    query_map_path: Path,
    by_document_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_document = load_json(by_document_path)

    entry_lines = [
        "export interface LegalSectionExplainer {",
        "  id: string;",
        "  documentType: string;",
        "  documentTypeKey: string;",
        "  section: string;",
        "  sectionKey: string;",
        "  originalTextNe: string;",
        "  originalTextEn: string;",
        "  plainLanguageNe: string;",
        "  plainLanguageEn: string;",
        "  practicalExample: string;",
        "  commonQuestions: string[];",
        "  exceptions: string[];",
        "  relatedSections: string[];",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const LEGAL_SECTION_EXPLAINERS: LegalSectionExplainer[] = [",
    ]
    for row in rows:
        qs = row.get("common_questions") or []
        ex = row.get("exceptions") or []
        related = row.get("related_sections") or []
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"documentType: {ts_string(str(row.get('document_type') or ''))}, "
            f"documentTypeKey: {ts_string(str(row.get('document_type_key') or ''))}, "
            f"section: {ts_string(str(row.get('section') or ''))}, "
            f"sectionKey: {ts_string(str(row.get('section_key') or ''))}, "
            f"originalTextNe: {ts_string(str(row.get('original_text_ne') or ''))}, "
            f"originalTextEn: {ts_string(str(row.get('original_text_en') or ''))}, "
            f"plainLanguageNe: {ts_string(str(row.get('plain_language_ne') or ''))}, "
            f"plainLanguageEn: {ts_string(str(row.get('plain_language_en') or ''))}, "
            f"practicalExample: {ts_string(str(row.get('practical_example') or ''))}, "
            f"commonQuestions: [{', '.join(ts_string(str(q)) for q in qs)}], "
            f"exceptions: [{', '.join(ts_string(str(e)) for e in ex)}], "
            f"relatedSections: [{', '.join(ts_string(str(r)) for r in related)}], "
            f"intent: {ts_string(str(row.get('intent') or 'legal_qa'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface LegalSectionExplainerAlias {",
        "  id: string;",
        "  documentType: string;",
        "  section: string;",
        "  documentTypeKey: string;",
        "  sectionKey: string;",
        "}",
        "",
        "export const LEGAL_SECTION_EXPLAINER_ALIASES: Record<string, LegalSectionExplainerAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"documentType: {ts_string(str(row.get('document_type') or ''))}, "
                f"section: {ts_string(str(row.get('section') or ''))}, "
                f"documentTypeKey: {ts_string(str(row.get('document_type_key') or ''))}, "
                f"sectionKey: {ts_string(str(row.get('section_key') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"documentType: {ts_string(str(meta.get('document_type') or meta.get('documentType') or ''))}, "
                f"section: {ts_string(str(meta.get('section') or ''))}, "
                f"documentTypeKey: {ts_string(str(meta.get('document_type_key') or meta.get('documentTypeKey') or ''))}, "
                f"sectionKey: {ts_string(str(meta.get('section_key') or meta.get('sectionKey') or ''))}"
                "},"
            )
    map_lines.append("};")

    doc_lines = [
        "/** document_type → explainer ids */",
        "export const LEGAL_SECTION_EXPLAINERS_BY_DOCUMENT: Record<string, string[]> = "
        + json.dumps(by_document, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(doc_lines)


def export_document_ocr_extractions(
    export_path: Path,
    query_map_path: Path,
    by_type_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_type = load_json(by_type_path)

    entry_lines = [
        "export interface DocumentOcrError {",
        "  error: string;",
        "  examples: string[];",
        "}",
        "",
        "export type DocumentOcrExtractedData = Record<string, unknown>;",
        "export type DocumentOcrValidation = Record<string, unknown>;",
        "",
        "export interface DocumentOcrExtraction {",
        "  id: string;",
        "  documentType: string;",
        "  documentTypeKey: string;",
        "  rawOcrText: string;",
        "  ocrErrors: DocumentOcrError[];",
        "  correctedText: string;",
        "  extractedData: DocumentOcrExtractedData;",
        "  validation: DocumentOcrValidation;",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const DOCUMENT_OCR_EXTRACTIONS: DocumentOcrExtraction[] = [",
    ]
    for row in rows:
        ocr_errors = json.dumps(row.get("ocr_errors") or [], ensure_ascii=False)
        extracted = json.dumps(row.get("extracted_data") or {}, ensure_ascii=False)
        validation = json.dumps(row.get("validation") or {}, ensure_ascii=False)
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"documentType: {ts_string(str(row.get('document_type') or ''))}, "
            f"documentTypeKey: {ts_string(str(row.get('document_type_key') or ''))}, "
            f"rawOcrText: {ts_string(str(row.get('raw_ocr_text') or ''))}, "
            f"ocrErrors: {ocr_errors}, "
            f"correctedText: {ts_string(str(row.get('corrected_text') or ''))}, "
            f"extractedData: {extracted}, "
            f"validation: {validation}, "
            f"intent: {ts_string(str(row.get('intent') or 'document_ocr_extraction'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface DocumentOcrExtractionAlias {",
        "  id: string;",
        "  documentType: string;",
        "  documentTypeKey: string;",
        "}",
        "",
        "export const DOCUMENT_OCR_EXTRACTION_ALIASES: Record<string, DocumentOcrExtractionAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"documentType: {ts_string(str(row.get('document_type') or ''))}, "
                f"documentTypeKey: {ts_string(str(row.get('document_type_key') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"documentType: {ts_string(str(meta.get('document_type') or meta.get('documentType') or ''))}, "
                f"documentTypeKey: {ts_string(str(meta.get('document_type_key') or meta.get('documentTypeKey') or ''))}"
                "},"
            )
    map_lines.append("};")

    type_lines = [
        "/** document_type_key → OCR golden ids */",
        "export const DOCUMENT_OCR_EXTRACTIONS_BY_TYPE: Record<string, string[]> = "
        + json.dumps(by_type, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(type_lines)


def export_financial_statement_interpretations(
    export_path: Path,
    query_map_path: Path,
    by_type_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_type = load_json(by_type_path)

    entry_lines = [
        "export interface FinancialStatementQa {",
        "  q: string;",
        "  a: string;",
        "}",
        "",
        "export type FinancialStatementSampleData = Record<string, unknown>;",
        "",
        "export interface FinancialStatementInterpretation {",
        "  id: string;",
        "  statementType: string;",
        "  statementTypeKey: string;",
        "  format: string;",
        "  formatKey: string;",
        "  sampleData: FinancialStatementSampleData;",
        "  questionsAboutThis: FinancialStatementQa[];",
        "  interpretation: string;",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const FINANCIAL_STATEMENT_INTERPRETATIONS: FinancialStatementInterpretation[] = [",
    ]
    for row in rows:
        sample = json.dumps(row.get("sample_data") or {}, ensure_ascii=False)
        qas = json.dumps(row.get("questions_about_this") or [], ensure_ascii=False)
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"statementType: {ts_string(str(row.get('statement_type') or ''))}, "
            f"statementTypeKey: {ts_string(str(row.get('statement_type_key') or ''))}, "
            f"format: {ts_string(str(row.get('format') or ''))}, "
            f"formatKey: {ts_string(str(row.get('format_key') or ''))}, "
            f"sampleData: {sample}, "
            f"questionsAboutThis: {qas}, "
            f"interpretation: {ts_string(str(row.get('interpretation') or ''))}, "
            f"intent: {ts_string(str(row.get('intent') or 'financial_statement_interpretation'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface FinancialStatementInterpretationAlias {",
        "  id: string;",
        "  statementType: string;",
        "  statementTypeKey: string;",
        "}",
        "",
        "export const FINANCIAL_STATEMENT_INTERPRETATION_ALIASES: Record<string, FinancialStatementInterpretationAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"statementType: {ts_string(str(row.get('statement_type') or ''))}, "
                f"statementTypeKey: {ts_string(str(row.get('statement_type_key') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"statementType: {ts_string(str(meta.get('statement_type') or meta.get('statementType') or ''))}, "
                f"statementTypeKey: {ts_string(str(meta.get('statement_type_key') or meta.get('statementTypeKey') or ''))}"
                "},"
            )
    map_lines.append("};")

    type_lines = [
        "/** statement_type_key → interpretation golden ids */",
        "export const FINANCIAL_STATEMENT_INTERPRETATIONS_BY_TYPE: Record<string, string[]> = "
        + json.dumps(by_type, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(type_lines)


def export_accounting_comparisons(
    export_path: Path,
    query_map_path: Path,
    by_topic_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_topic = load_json(by_topic_path)

    entry_lines = [
        "export interface AccountingComparisonRow {",
        "  aspect: string;",
        "  optionA: string;",
        "  optionB: string;",
        "}",
        "",
        "export interface AccountingComparison {",
        "  id: string;",
        "  topic: string;",
        "  topicKey: string;",
        "  questionNe: string;",
        "  questionNormalized: string;",
        "  comparisonTable: AccountingComparisonRow[];",
        "  explanationNe: string;",
        "  whenToUseA: string;",
        "  whenToUseB: string;",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const ACCOUNTING_COMPARISONS: AccountingComparison[] = [",
    ]
    for row in rows:
        table_rows = []
        for item in row.get("comparison_table") or []:
            table_rows.append(
                "{"
                f"aspect: {ts_string(str(item.get('aspect') or ''))}, "
                f"optionA: {ts_string(str(item.get('option_a') or ''))}, "
                f"optionB: {ts_string(str(item.get('option_b') or ''))}"
                "}"
            )
        table_json = "[" + ", ".join(table_rows) + "]"
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"topic: {ts_string(str(row.get('topic') or ''))}, "
            f"topicKey: {ts_string(str(row.get('topic_key') or ''))}, "
            f"questionNe: {ts_string(str(row.get('question_ne') or ''))}, "
            f"questionNormalized: {ts_string(str(row.get('question_normalized') or ''))}, "
            f"comparisonTable: {table_json}, "
            f"explanationNe: {ts_string(str(row.get('explanation_ne') or ''))}, "
            f"whenToUseA: {ts_string(str(row.get('when_to_use_a') or ''))}, "
            f"whenToUseB: {ts_string(str(row.get('when_to_use_b') or ''))}, "
            f"intent: {ts_string(str(row.get('intent') or 'accounting_comparison'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface AccountingComparisonAlias {",
        "  id: string;",
        "  topic: string;",
        "  topicKey: string;",
        "}",
        "",
        "export const ACCOUNTING_COMPARISON_ALIASES: Record<string, AccountingComparisonAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"topic: {ts_string(str(row.get('topic') or ''))}, "
                f"topicKey: {ts_string(str(row.get('topic_key') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"topic: {ts_string(str(meta.get('topic') or ''))}, "
                f"topicKey: {ts_string(str(meta.get('topic_key') or meta.get('topicKey') or ''))}"
                "},"
            )
    map_lines.append("};")

    topic_lines = [
        "/** topic_key → comparison golden ids */",
        "export const ACCOUNTING_COMPARISONS_BY_TOPIC: Record<string, string[]> = "
        + json.dumps(by_topic, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(topic_lines)


def export_code_mixed_utterances(
    export_path: Path,
    query_map_path: Path,
    by_intent_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_intent = load_json(by_intent_path)

    entry_lines = [
        "export interface CodeMixedLanguageSpan {",
        "  text: string;",
        "  lang: string;",
        "}",
        "",
        "export interface CodeMixedUtterance {",
        "  id: string;",
        "  input: string;",
        "  inputNormalized: string;",
        "  normalized: string;",
        "  languagesDetected: string[];",
        "  languageSpans: CodeMixedLanguageSpan[];",
        "  intent: string;",
        "  intentKey: string;",
        "  entities: Record<string, unknown>;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const CODE_MIXED_UTTERANCES: CodeMixedUtterance[] = [",
    ]
    for row in rows:
        spans = []
        for item in row.get("language_spans") or []:
            spans.append(
                "{"
                f"text: {ts_string(str(item.get('text') or ''))}, "
                f"lang: {ts_string(str(item.get('lang') or ''))}"
                "}"
            )
        spans_json = "[" + ", ".join(spans) + "]"
        langs = json.dumps(row.get("languages_detected") or [], ensure_ascii=False)
        entities = json.dumps(row.get("entities") or {}, ensure_ascii=False)
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"input: {ts_string(str(row.get('input') or ''))}, "
            f"inputNormalized: {ts_string(str(row.get('input_normalized') or ''))}, "
            f"normalized: {ts_string(str(row.get('normalized') or ''))}, "
            f"languagesDetected: {langs}, "
            f"languageSpans: {spans_json}, "
            f"intent: {ts_string(str(row.get('intent') or ''))}, "
            f"intentKey: {ts_string(str(row.get('intent_key') or row.get('intent') or ''))}, "
            f"entities: {entities}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface CodeMixedUtteranceAlias {",
        "  id: string;",
        "  intent: string;",
        "  intentKey: string;",
        "}",
        "",
        "export const CODE_MIXED_UTTERANCE_ALIASES: Record<string, CodeMixedUtteranceAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"intent: {ts_string(str(row.get('intent') or ''))}, "
                f"intentKey: {ts_string(str(row.get('intent_key') or row.get('intent') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"intent: {ts_string(str(meta.get('intent') or ''))}, "
                f"intentKey: {ts_string(str(meta.get('intent_key') or meta.get('intentKey') or ''))}"
                "},"
            )
    map_lines.append("};")

    intent_lines = [
        "/** intent_key → code-mixed golden ids */",
        "export const CODE_MIXED_UTTERANCES_BY_INTENT: Record<string, string[]> = "
        + json.dumps(by_intent, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(intent_lines)


def export_word_sense_contexts(
    export_path: Path,
    query_map_path: Path,
    by_word_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_word = load_json(by_word_path)

    entry_lines = [
        "export interface WordSenseContextItem {",
        "  domain: string;",
        "  meaningNe: string;",
        "  meaningEn: string;",
        "  example: string;",
        "  intentIfUsed: string;",
        "}",
        "",
        "export interface WordSenseContext {",
        "  id: string;",
        "  word: string;",
        "  wordKey: string;",
        "  contexts: WordSenseContextItem[];",
        "  disambiguationStrategy: string;",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const WORD_SENSE_CONTEXTS: WordSenseContext[] = [",
    ]
    for row in rows:
        ctx_rows = []
        for item in row.get("contexts") or []:
            ctx_rows.append(
                "{"
                f"domain: {ts_string(str(item.get('domain') or ''))}, "
                f"meaningNe: {ts_string(str(item.get('meaning_ne') or ''))}, "
                f"meaningEn: {ts_string(str(item.get('meaning_en') or ''))}, "
                f"example: {ts_string(str(item.get('example') or ''))}, "
                f"intentIfUsed: {ts_string(str(item.get('intent_if_used') or ''))}"
                "}"
            )
        ctx_json = "[" + ", ".join(ctx_rows) + "]"
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"word: {ts_string(str(row.get('word') or ''))}, "
            f"wordKey: {ts_string(str(row.get('word_key') or ''))}, "
            f"contexts: {ctx_json}, "
            f"disambiguationStrategy: {ts_string(str(row.get('disambiguation_strategy') or ''))}, "
            f"intent: {ts_string(str(row.get('intent') or 'word_sense_disambiguation'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface WordSenseContextAlias {",
        "  id: string;",
        "  word: string;",
        "  wordKey: string;",
        "}",
        "",
        "export const WORD_SENSE_CONTEXT_ALIASES: Record<string, WordSenseContextAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"word: {ts_string(str(row.get('word') or ''))}, "
                f"wordKey: {ts_string(str(row.get('word_key') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"word: {ts_string(str(meta.get('word') or ''))}, "
                f"wordKey: {ts_string(str(meta.get('word_key') or meta.get('wordKey') or ''))}"
                "},"
            )
    map_lines.append("};")

    word_lines = [
        "/** word_key → sense context golden ids */",
        "export const WORD_SENSE_CONTEXTS_BY_WORD: Record<string, string[]> = "
        + json.dumps(by_word, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(word_lines)


def export_edge_case_handlers(
    export_path: Path,
    query_map_path: Path,
    by_category_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_category = load_json(by_category_path)

    entry_lines = [
        "export interface EdgeCaseHandler {",
        "  id: string;",
        "  edgeCaseId: string;",
        "  category: string;",
        "  categoryKey: string;",
        "  input: string;",
        "  inputNormalized: string;",
        "  contextNote: string;",
        "  withoutContextInterpretation: string;",
        "  withContextInterpretation: string;",
        "  handlingIfContext: string;",
        "  handlingIfNoContext: string;",
        "  similarCases: string[];",
        "  testPriority: string;",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const EDGE_CASE_HANDLERS: EdgeCaseHandler[] = [",
    ]
    for row in rows:
        similar = json.dumps(row.get("similar_cases") or [], ensure_ascii=False)
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"edgeCaseId: {ts_string(str(row.get('edge_case_id') or ''))}, "
            f"category: {ts_string(str(row.get('category') or ''))}, "
            f"categoryKey: {ts_string(str(row.get('category_key') or row.get('category') or ''))}, "
            f"input: {ts_string(str(row.get('input') or ''))}, "
            f"inputNormalized: {ts_string(str(row.get('input_normalized') or ''))}, "
            f"contextNote: {ts_string(str(row.get('context_note') or ''))}, "
            f"withoutContextInterpretation: {ts_string(str(row.get('without_context_interpretation') or ''))}, "
            f"withContextInterpretation: {ts_string(str(row.get('with_context_interpretation') or ''))}, "
            f"handlingIfContext: {ts_string(str(row.get('handling_if_context') or ''))}, "
            f"handlingIfNoContext: {ts_string(str(row.get('handling_if_no_context') or ''))}, "
            f"similarCases: {similar}, "
            f"testPriority: {ts_string(str(row.get('test_priority') or 'medium'))}, "
            f"intent: {ts_string(str(row.get('intent') or 'edge_case_handler'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface EdgeCaseHandlerAlias {",
        "  id: string;",
        "  category: string;",
        "  categoryKey: string;",
        "  testPriority: string;",
        "}",
        "",
        "export const EDGE_CASE_HANDLER_ALIASES: Record<string, EdgeCaseHandlerAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"category: {ts_string(str(row.get('category') or ''))}, "
                f"categoryKey: {ts_string(str(row.get('category_key') or row.get('category') or ''))}, "
                f"testPriority: {ts_string(str(row.get('test_priority') or 'medium'))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"category: {ts_string(str(meta.get('category') or ''))}, "
                f"categoryKey: {ts_string(str(meta.get('categoryKey') or meta.get('category_key') or ''))}, "
                f"testPriority: {ts_string(str(meta.get('testPriority') or meta.get('test_priority') or 'medium'))}"
                "},"
            )
    map_lines.append("};")

    cat_lines = [
        "/** category_key → edge case golden ids */",
        "export const EDGE_CASE_HANDLERS_BY_CATEGORY: Record<string, string[]> = "
        + json.dumps(by_category, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(cat_lines)


def export_complex_reasoning_scenarios(
    export_path: Path,
    query_map_path: Path,
    by_type_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_type = load_json(by_type_path)

    entry_lines = [
        "export interface ComplexReasoningStep {",
        "  step: number;",
        "  thought: string;",
        "}",
        "",
        "export interface ComplexReasoningResolution {",
        "  scenario: string;",
        "  entries: string[];",
        "}",
        "",
        "export interface ComplexReasoningScenario {",
        "  id: string;",
        "  scenarioId: string;",
        "  scenarioType: string;",
        "  scenarioTypeKey: string;",
        "  input: string;",
        "  inputNormalized: string;",
        "  surfaceContradiction: string;",
        "  reasoningRequired: ComplexReasoningStep[];",
        "  clarificationNeeded: boolean;",
        "  clarifyQuestion: string | null;",
        "  possibleResolutions: ComplexReasoningResolution[];",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const COMPLEX_REASONING_SCENARIOS: ComplexReasoningScenario[] = [",
    ]
    for row in rows:
        steps = []
        for item in row.get("reasoning_required") or []:
            steps.append(
                "{"
                f"step: {int(item.get('step') or 0)}, "
                f"thought: {ts_string(str(item.get('thought') or ''))}"
                "}"
            )
        steps_json = "[" + ", ".join(steps) + "]"
        resolutions = []
        for item in row.get("possible_resolutions") or []:
            ent = json.dumps(item.get("entries") or [], ensure_ascii=False)
            resolutions.append(
                "{"
                f"scenario: {ts_string(str(item.get('scenario') or ''))}, "
                f"entries: {ent}"
                "}"
            )
        res_json = "[" + ", ".join(resolutions) + "]"
        clarify = row.get("clarify_question")
        clarify_ts = "null" if clarify is None else ts_string(str(clarify))
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"scenarioId: {ts_string(str(row.get('scenario_id') or ''))}, "
            f"scenarioType: {ts_string(str(row.get('scenario_type') or ''))}, "
            f"scenarioTypeKey: {ts_string(str(row.get('scenario_type_key') or row.get('scenario_type') or ''))}, "
            f"input: {ts_string(str(row.get('input') or ''))}, "
            f"inputNormalized: {ts_string(str(row.get('input_normalized') or ''))}, "
            f"surfaceContradiction: {ts_string(str(row.get('surface_contradiction') or ''))}, "
            f"reasoningRequired: {steps_json}, "
            f"clarificationNeeded: {str(bool(row.get('clarification_needed'))).lower()}, "
            f"clarifyQuestion: {clarify_ts}, "
            f"possibleResolutions: {res_json}, "
            f"intent: {ts_string(str(row.get('intent') or 'complex_reasoning'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface ComplexReasoningScenarioAlias {",
        "  id: string;",
        "  scenarioType: string;",
        "  scenarioTypeKey: string;",
        "  clarificationNeeded: boolean;",
        "}",
        "",
        "export const COMPLEX_REASONING_SCENARIO_ALIASES: Record<string, ComplexReasoningScenarioAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"scenarioType: {ts_string(str(row.get('scenario_type') or ''))}, "
                f"scenarioTypeKey: {ts_string(str(row.get('scenario_type_key') or row.get('scenario_type') or ''))}, "
                f"clarificationNeeded: {str(bool(row.get('clarification_needed'))).lower()}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"scenarioType: {ts_string(str(meta.get('scenarioType') or meta.get('scenario_type') or ''))}, "
                f"scenarioTypeKey: {ts_string(str(meta.get('scenarioTypeKey') or meta.get('scenario_type_key') or ''))}, "
                f"clarificationNeeded: {str(bool(meta.get('clarificationNeeded', meta.get('clarification_needed')))).lower()}"
                "},"
            )
    map_lines.append("};")

    type_lines = [
        "/** scenario_type_key → complex reasoning golden ids */",
        "export const COMPLEX_REASONING_SCENARIOS_BY_TYPE: Record<string, string[]> = "
        + json.dumps(by_type, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(type_lines)


def export_cross_domain_scenarios(
    export_path: Path,
    query_map_path: Path,
    by_domain_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_domain = load_json(by_domain_path)

    entry_lines = [
        "export interface CrossDomainKnowledgeItem {",
        "  domain: string;",
        "  knowledge: string;",
        "}",
        "",
        "export interface CrossDomainScenario {",
        "  id: string;",
        "  scenarioId: string;",
        "  domainsInvolved: string[];",
        "  domainKeys: string[];",
        "  input: string;",
        "  inputNormalized: string;",
        "  domainKnowledgeRequired: CrossDomainKnowledgeItem[];",
        "  reasoningChain: string[];",
        "  answerNe: string;",
        "  journalEntries: string[];",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const CROSS_DOMAIN_SCENARIOS: CrossDomainScenario[] = [",
    ]
    for row in rows:
        dk = []
        for item in row.get("domain_knowledge_required") or []:
            dk.append(
                "{"
                f"domain: {ts_string(str(item.get('domain') or ''))}, "
                f"knowledge: {ts_string(str(item.get('knowledge') or ''))}"
                "}"
            )
        dk_json = "[" + ", ".join(dk) + "]"
        chain = json.dumps(row.get("reasoning_chain") or [], ensure_ascii=False)
        journals = json.dumps(row.get("journal_entries") or [], ensure_ascii=False)
        domains = json.dumps(row.get("domains_involved") or [], ensure_ascii=False)
        domain_keys = json.dumps(row.get("domain_keys") or [], ensure_ascii=False)
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"scenarioId: {ts_string(str(row.get('scenario_id') or ''))}, "
            f"domainsInvolved: {domains}, "
            f"domainKeys: {domain_keys}, "
            f"input: {ts_string(str(row.get('input') or ''))}, "
            f"inputNormalized: {ts_string(str(row.get('input_normalized') or ''))}, "
            f"domainKnowledgeRequired: {dk_json}, "
            f"reasoningChain: {chain}, "
            f"answerNe: {ts_string(str(row.get('answer_ne') or ''))}, "
            f"journalEntries: {journals}, "
            f"intent: {ts_string(str(row.get('intent') or 'cross_domain_reasoning'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface CrossDomainScenarioAlias {",
        "  id: string;",
        "  domainsInvolved: string[];",
        "}",
        "",
        "export const CROSS_DOMAIN_SCENARIO_ALIASES: Record<string, CrossDomainScenarioAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            doms = json.dumps(row.get("domains_involved") or [], ensure_ascii=False)
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"domainsInvolved: {doms}"
                "},"
            )
        else:
            doms = json.dumps(meta.get("domainsInvolved") or meta.get("domains_involved") or [], ensure_ascii=False)
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"domainsInvolved: {doms}"
                "},"
            )
    map_lines.append("};")

    domain_lines = [
        "/** domain_key → cross-domain scenario golden ids */",
        "export const CROSS_DOMAIN_SCENARIOS_BY_DOMAIN: Record<string, string[]> = "
        + json.dumps(by_domain, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(domain_lines)


def export_classification_explanations(
    export_path: Path,
    query_map_path: Path,
    by_type_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_type = load_json(by_type_path)

    entry_lines = [
        "export interface ClassificationExplanation {",
        "  id: string;",
        "  explainId: string;",
        "  scenario: string;",
        "  aiAction: string;",
        "  aiClassifiedIntent: string;",
        "  userMightAsk: string;",
        "  userMightAskNormalized: string;",
        "  explanationNe: string;",
        "  explanationEn: string;",
        "  conceptsExplained: string[];",
        "  teachingValue: string;",
        "  explanationType: string;",
        "  explanationTypeKey: string;",
        "  intent: string;",
        "  notTransaction: boolean;",
        "  notQuestion: boolean;",
        "}",
        "",
        "export const CLASSIFICATION_EXPLANATIONS: ClassificationExplanation[] = [",
    ]
    for row in rows:
        concepts = json.dumps(row.get("concepts_explained") or [], ensure_ascii=False)
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"explainId: {ts_string(str(row.get('explain_id') or ''))}, "
            f"scenario: {ts_string(str(row.get('scenario') or ''))}, "
            f"aiAction: {ts_string(str(row.get('ai_action') or ''))}, "
            f"aiClassifiedIntent: {ts_string(str(row.get('ai_classified_intent') or ''))}, "
            f"userMightAsk: {ts_string(str(row.get('user_might_ask') or ''))}, "
            f"userMightAskNormalized: {ts_string(str(row.get('user_might_ask_normalized') or ''))}, "
            f"explanationNe: {ts_string(str(row.get('explanation_ne') or ''))}, "
            f"explanationEn: {ts_string(str(row.get('explanation_en') or ''))}, "
            f"conceptsExplained: {concepts}, "
            f"teachingValue: {ts_string(str(row.get('teaching_value') or 'medium'))}, "
            f"explanationType: {ts_string(str(row.get('explanation_type') or ''))}, "
            f"explanationTypeKey: {ts_string(str(row.get('explanation_type_key') or ''))}, "
            f"intent: {ts_string(str(row.get('intent') or 'classification_explanation'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}, "
            f"notQuestion: {str(bool(row.get('NOT_question', row.get('not_question', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface ClassificationExplanationAlias {",
        "  id: string;",
        "  explanationType: string;",
        "  explanationTypeKey: string;",
        "  teachingValue: string;",
        "  aiClassifiedIntent: string;",
        "}",
        "",
        "export const CLASSIFICATION_EXPLANATION_ALIASES: Record<string, ClassificationExplanationAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"explanationType: {ts_string(str(row.get('explanation_type') or ''))}, "
                f"explanationTypeKey: {ts_string(str(row.get('explanation_type_key') or ''))}, "
                f"teachingValue: {ts_string(str(row.get('teaching_value') or 'medium'))}, "
                f"aiClassifiedIntent: {ts_string(str(row.get('ai_classified_intent') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"explanationType: {ts_string(str(meta.get('explanationType') or meta.get('explanation_type') or ''))}, "
                f"explanationTypeKey: {ts_string(str(meta.get('explanationTypeKey') or meta.get('explanation_type_key') or ''))}, "
                f"teachingValue: {ts_string(str(meta.get('teachingValue') or meta.get('teaching_value') or 'medium'))}, "
                f"aiClassifiedIntent: {ts_string(str(meta.get('aiClassifiedIntent') or meta.get('ai_classified_intent') or ''))}"
                "},"
            )
    map_lines.append("};")

    type_lines = [
        "/** explanation_type_key → classification explanation golden ids */",
        "export const CLASSIFICATION_EXPLANATIONS_BY_TYPE: Record<string, string[]> = "
        + json.dumps(by_type, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(type_lines)


def export_novel_pattern_handlers(
    export_path: Path,
    query_map_path: Path,
    by_intent_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_intent = load_json(by_intent_path)

    entry_lines = [
        "export interface NovelPatternHandler {",
        "  id: string;",
        "  novelId: string;",
        "  input: string;",
        "  inputNormalized: string;",
        "  whyNovel: string;",
        "  nearestKnownPattern: string;",
        "  reasoningToHandle: string[];",
        "  suggestedIntent: string;",
        "  suggestedIntentKey: string;",
        "  suggestedEntities: Record<string, unknown>;",
        "  clarifyIfNeeded: string;",
        "  generalizationLesson: string;",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const NOVEL_PATTERN_HANDLERS: NovelPatternHandler[] = [",
    ]
    for row in rows:
        reasoning = json.dumps(row.get("reasoning_to_handle") or [], ensure_ascii=False)
        entities = json.dumps(row.get("suggested_entities") or {}, ensure_ascii=False)
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"novelId: {ts_string(str(row.get('novel_id') or ''))}, "
            f"input: {ts_string(str(row.get('input') or ''))}, "
            f"inputNormalized: {ts_string(str(row.get('input_normalized') or ''))}, "
            f"whyNovel: {ts_string(str(row.get('why_novel') or ''))}, "
            f"nearestKnownPattern: {ts_string(str(row.get('nearest_known_pattern') or ''))}, "
            f"reasoningToHandle: {reasoning}, "
            f"suggestedIntent: {ts_string(str(row.get('suggested_intent') or ''))}, "
            f"suggestedIntentKey: {ts_string(str(row.get('suggested_intent_key') or ''))}, "
            f"suggestedEntities: {entities}, "
            f"clarifyIfNeeded: {ts_string(str(row.get('clarify_if_needed') or ''))}, "
            f"generalizationLesson: {ts_string(str(row.get('generalization_lesson') or ''))}, "
            f"intent: {ts_string(str(row.get('intent') or 'novel_pattern_handler'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', False)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface NovelPatternHandlerAlias {",
        "  id: string;",
        "  suggestedIntent: string;",
        "  suggestedIntentKey: string;",
        "}",
        "",
        "export const NOVEL_PATTERN_HANDLER_ALIASES: Record<string, NovelPatternHandlerAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"suggestedIntent: {ts_string(str(row.get('suggested_intent') or ''))}, "
                f"suggestedIntentKey: {ts_string(str(row.get('suggested_intent_key') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"suggestedIntent: {ts_string(str(meta.get('suggestedIntent') or meta.get('suggested_intent') or ''))}, "
                f"suggestedIntentKey: {ts_string(str(meta.get('suggestedIntentKey') or meta.get('suggested_intent_key') or ''))}"
                "},"
            )
    map_lines.append("};")

    intent_lines = [
        "/** suggested_intent_key → novel pattern handler golden ids */",
        "export const NOVEL_PATTERN_HANDLERS_BY_INTENT: Record<string, string[]> = "
        + json.dumps(by_intent, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(intent_lines)


def export_document_comprehension_scenarios(
    export_path: Path,
    query_map_path: Path,
    by_type_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_type = load_json(by_type_path)

    entry_lines = [
        "export interface DocumentContentSection {",
        "  section: string;",
        "  content: string;",
        "}",
        "",
        "export interface DocumentQaPair {",
        "  q: string;",
        "  a: string;",
        "}",
        "",
        "export interface DocumentExtractionTask {",
        "  task: string;",
        "  expectedOutputFormat: string;",
        "}",
        "",
        "export interface DocumentComprehensionScenario {",
        "  id: string;",
        "  scenarioId: string;",
        "  documentType: string;",
        "  documentTypeKey: string;",
        "  documentStructure: Record<string, unknown>;",
        "  sampleContentSections: DocumentContentSection[];",
        "  questionsThisDocumentCanAnswer: DocumentQaPair[];",
        "  dataExtractionTasks: DocumentExtractionTask[];",
        "  intent: string;",
        "  notTransaction: boolean;",
        "  notQuestion: boolean;",
        "}",
        "",
        "export const DOCUMENT_COMPREHENSION_SCENARIOS: DocumentComprehensionScenario[] = [",
    ]
    for row in rows:
        structure = json.dumps(row.get("document_structure") or {}, ensure_ascii=False)
        sections = []
        for sec in row.get("sample_content_sections") or []:
            sections.append(
                "{"
                f"section: {ts_string(str(sec.get('section') or ''))}, "
                f"content: {ts_string(str(sec.get('content') or ''))}"
                "}"
            )
        sections_json = "[" + ", ".join(sections) + "]"
        qa = []
        for pair in row.get("questions_this_document_can_answer") or []:
            qa.append(
                "{"
                f"q: {ts_string(str(pair.get('q') or ''))}, "
                f"a: {ts_string(str(pair.get('a') or ''))}"
                "}"
            )
        qa_json = "[" + ", ".join(qa) + "]"
        tasks = []
        for task in row.get("data_extraction_tasks") or []:
            tasks.append(
                "{"
                f"task: {ts_string(str(task.get('task') or ''))}, "
                f"expectedOutputFormat: {ts_string(str(task.get('expected_output_format') or ''))}"
                "}"
            )
        tasks_json = "[" + ", ".join(tasks) + "]"
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"scenarioId: {ts_string(str(row.get('scenario_id') or ''))}, "
            f"documentType: {ts_string(str(row.get('document_type') or ''))}, "
            f"documentTypeKey: {ts_string(str(row.get('document_type_key') or ''))}, "
            f"documentStructure: {structure}, "
            f"sampleContentSections: {sections_json}, "
            f"questionsThisDocumentCanAnswer: {qa_json}, "
            f"dataExtractionTasks: {tasks_json}, "
            f"intent: {ts_string(str(row.get('intent') or 'document_comprehension'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}, "
            f"notQuestion: {str(bool(row.get('NOT_question', row.get('not_question', False)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface DocumentComprehensionScenarioAlias {",
        "  id: string;",
        "  documentType: string;",
        "  documentTypeKey: string;",
        "}",
        "",
        "export const DOCUMENT_COMPREHENSION_SCENARIO_ALIASES: Record<string, DocumentComprehensionScenarioAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"documentType: {ts_string(str(row.get('document_type') or ''))}, "
                f"documentTypeKey: {ts_string(str(row.get('document_type_key') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"documentType: {ts_string(str(meta.get('documentType') or meta.get('document_type') or ''))}, "
                f"documentTypeKey: {ts_string(str(meta.get('documentTypeKey') or meta.get('document_type_key') or ''))}"
                "},"
            )
    map_lines.append("};")

    type_lines = [
        "/** document_type_key → document comprehension scenario golden ids */",
        "export const DOCUMENT_COMPREHENSION_SCENARIOS_BY_TYPE: Record<string, string[]> = "
        + json.dumps(by_type, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(type_lines)


def export_prompt_variants(
    export_path: Path,
    query_map_path: Path,
    by_behavior_path: Path,
) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    query_map = load_json(query_map_path)
    by_behavior = load_json(by_behavior_path)

    entry_lines = [
        "export interface PromptVariant {",
        "  id: string;",
        "  variantId: string;",
        "  targetBehavior: string;",
        "  targetBehaviorKey: string;",
        "  systemPrompt: string;",
        "  keyInstructions: string[];",
        "  expectedStrengths: string[];",
        "  expectedWeaknesses: string[];",
        "  testInputs: string[];",
        "  evaluationCriteria: string[];",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const PROMPT_VARIANTS: PromptVariant[] = [",
    ]
    for row in rows:
        key_instructions = row.get("key_instructions") or []
        strengths = row.get("expected_strengths") or []
        weaknesses = row.get("expected_weaknesses") or []
        test_inputs = row.get("test_inputs") or []
        criteria = row.get("evaluation_criteria") or []
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"variantId: {ts_string(str(row.get('variant_id') or ''))}, "
            f"targetBehavior: {ts_string(str(row.get('target_behavior') or ''))}, "
            f"targetBehaviorKey: {ts_string(str(row.get('target_behavior_key') or ''))}, "
            f"systemPrompt: {ts_string(str(row.get('system_prompt') or ''))}, "
            f"keyInstructions: [{', '.join(ts_string(str(i)) for i in key_instructions)}], "
            f"expectedStrengths: [{', '.join(ts_string(str(s)) for s in strengths)}], "
            f"expectedWeaknesses: [{', '.join(ts_string(str(w)) for w in weaknesses)}], "
            f"testInputs: [{', '.join(ts_string(str(t)) for t in test_inputs)}], "
            f"evaluationCriteria: [{', '.join(ts_string(str(c)) for c in criteria)}], "
            f"intent: {ts_string(str(row.get('intent') or 'prompt_variant_ab_test'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface PromptVariantAlias {",
        "  id: string;",
        "  variantId: string;",
        "  targetBehavior: string;",
        "  targetBehaviorKey: string;",
        "}",
        "",
        "export const PROMPT_VARIANT_ALIASES: Record<string, PromptVariantAlias> = {",
    ]
    for key, meta in sorted(query_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        if isinstance(meta, str):
            rid = meta
            row = next((r for r in rows if r.get("id") == rid), {})
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(rid))}, "
                f"variantId: {ts_string(str(row.get('variant_id') or ''))}, "
                f"targetBehavior: {ts_string(str(row.get('target_behavior') or ''))}, "
                f"targetBehaviorKey: {ts_string(str(row.get('target_behavior_key') or ''))}"
                "},"
            )
        else:
            map_lines.append(
                f"  {ts_string(str(key))}: {{"
                f"id: {ts_string(str(meta.get('id') or ''))}, "
                f"variantId: {ts_string(str(meta.get('variantId') or meta.get('variant_id') or ''))}, "
                f"targetBehavior: {ts_string(str(meta.get('targetBehavior') or meta.get('target_behavior') or ''))}, "
                f"targetBehaviorKey: {ts_string(str(meta.get('targetBehaviorKey') or meta.get('target_behavior_key') or ''))}"
                "},"
            )
    map_lines.append("};")

    behavior_lines = [
        "/** target_behavior_key → prompt variant golden ids */",
        "export const PROMPT_VARIANTS_BY_BEHAVIOR: Record<string, string[]> = "
        + json.dumps(by_behavior, ensure_ascii=False)
        + ";",
    ]
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines) + "\n\n" + "\n".join(behavior_lines)


def export_nepal_tax_faq(export_path: Path, map_path: Path) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    alias_map = load_json(map_path)

    entry_lines = [
        "export interface NepalTaxFaqEntry {",
        "  id: string;",
        "  topic: string;",
        "  topicKey: string;",
        "  questionNe: string;",
        "  questionEn: string;",
        "  questionNormalized: string;",
        "  answerNe: string;",
        "  answerEn: string;",
        "  answerShortNe: string;",
        "  currentAsOf: string;",
        "  legalReference: string;",
        "  relatedTopics: string[];",
        "  commonFollowups: string[];",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const NEPAL_TAX_FAQ: NepalTaxFaqEntry[] = [",
    ]
    for row in rows:
        related = row.get("related_topics") or []
        followups = row.get("common_followups") or row.get("related_questions") or []
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"topic: {ts_string(str(row.get('topic') or ''))}, "
            f"topicKey: {ts_string(str(row.get('topic_key') or ''))}, "
            f"questionNe: {ts_string(str(row.get('question_ne') or row.get('question') or ''))}, "
            f"questionEn: {ts_string(str(row.get('question_en') or ''))}, "
            f"questionNormalized: {ts_string(str(row.get('question_normalized') or ''))}, "
            f"answerNe: {ts_string(str(row.get('answer_ne') or ''))}, "
            f"answerEn: {ts_string(str(row.get('answer_en') or ''))}, "
            f"answerShortNe: {ts_string(str(row.get('answer_short_ne') or ''))}, "
            f"currentAsOf: {ts_string(str(row.get('current_as_of') or ''))}, "
            f"legalReference: {ts_string(str(row.get('legal_reference') or ''))}, "
            f"relatedTopics: [{', '.join(ts_string(str(r)) for r in related)}], "
            f"commonFollowups: [{', '.join(ts_string(str(f)) for f in followups)}], "
            f"intent: {ts_string(str(row.get('intent') or 'accounting_qa'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface NepalTaxFaqAlias {",
        "  id: string;",
        "  topic: string;",
        "  topicKey: string;",
        "}",
        "",
        "export const NEPAL_TAX_FAQ_ALIASES: Record<string, NepalTaxFaqAlias> = {",
    ]
    for key, meta in sorted(alias_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        map_lines.append(
            f"  {ts_string(str(key))}: {{"
            f"id: {ts_string(str(meta.get('id') or ''))}, "
            f"topic: {ts_string(str(meta.get('topic') or ''))}, "
            f"topicKey: {ts_string(str(meta.get('topic_key') or meta.get('topicKey') or ''))}"
            "},"
        )
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_nepal_process_guides(export_path: Path, map_path: Path) -> str:
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    alias_map = load_json(map_path)

    entry_lines = [
        "export interface NepalProcessGuideEntry {",
        "  id: string;",
        "  process: string;",
        "  processKey: string;",
        "  questionNe: string;",
        "  questionEn: string;",
        "  questionNormalized: string;",
        "  stepsNe: string[];",
        "  requiredDocuments: string[];",
        "  timeline: string;",
        "  fees: string;",
        "  commonIssues: string[];",
        "  answerNe: string;",
        "  answerEn: string;",
        "  answerShortNe: string;",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const NEPAL_PROCESS_GUIDES: NepalProcessGuideEntry[] = [",
    ]
    for row in rows:
        steps = row.get("steps_ne") or []
        docs = row.get("required_documents") or []
        issues = row.get("common_issues") or []
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"process: {ts_string(str(row.get('process') or ''))}, "
            f"processKey: {ts_string(str(row.get('process_key') or ''))}, "
            f"questionNe: {ts_string(str(row.get('question_ne') or row.get('question') or ''))}, "
            f"questionEn: {ts_string(str(row.get('question_en') or ''))}, "
            f"questionNormalized: {ts_string(str(row.get('question_normalized') or ''))}, "
            f"stepsNe: [{', '.join(ts_string(str(s)) for s in steps)}], "
            f"requiredDocuments: [{', '.join(ts_string(str(d)) for d in docs)}], "
            f"timeline: {ts_string(str(row.get('timeline') or ''))}, "
            f"fees: {ts_string(str(row.get('fees') or ''))}, "
            f"commonIssues: [{', '.join(ts_string(str(i)) for i in issues)}], "
            f"answerNe: {ts_string(str(row.get('answer_ne') or ''))}, "
            f"answerEn: {ts_string(str(row.get('answer_en') or ''))}, "
            f"answerShortNe: {ts_string(str(row.get('answer_short_ne') or ''))}, "
            f"intent: {ts_string(str(row.get('intent') or 'accounting_qa'))}, "
            f"notTransaction: {str(bool(row.get('NOT_transaction', row.get('not_transaction', True)))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface NepalProcessGuideAlias {",
        "  id: string;",
        "  process: string;",
        "  processKey: string;",
        "}",
        "",
        "export const NEPAL_PROCESS_GUIDE_ALIASES: Record<string, NepalProcessGuideAlias> = {",
    ]
    for key, meta in sorted(alias_map.items(), key=lambda x: (-len(str(x[0])), str(x[0]))):
        map_lines.append(
            f"  {ts_string(str(key))}: {{"
            f"id: {ts_string(str(meta.get('id') or ''))}, "
            f"process: {ts_string(str(meta.get('process') or ''))}, "
            f"processKey: {ts_string(str(meta.get('process_key') or meta.get('processKey') or ''))}"
            "},"
        )
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_accounting_faq(export_path: Path, map_path: Path) -> str:
    rows = []
    if export_path.exists():
        rows = json.loads(export_path.read_text(encoding="utf-8"))
    alias_map = load_json(map_path)

    entry_lines = [
        "export interface AccountingFaqEntry {",
        "  id: string;",
        "  question: string;",
        "  questionNormalized: string;",
        "  questionType: string;",
        "  topic: string;",
        "  answerNe: string;",
        "  answerEn: string;",
        "  answerShortNe: string;",
        "  relatedQuestions: string[];",
        "  intent: string;",
        "  notTransaction: boolean;",
        "}",
        "",
        "export const ACCOUNTING_FAQ: AccountingFaqEntry[] = [",
    ]
    for row in rows:
        related = row.get("related_questions") or []
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"question: {ts_string(str(row.get('question') or ''))}, "
            f"questionNormalized: {ts_string(str(row.get('question_normalized') or ''))}, "
            f"questionType: {ts_string(str(row.get('question_type') or ''))}, "
            f"topic: {ts_string(str(row.get('topic') or ''))}, "
            f"answerNe: {ts_string(str(row.get('answer_ne') or ''))}, "
            f"answerEn: {ts_string(str(row.get('answer_en') or ''))}, "
            f"answerShortNe: {ts_string(str(row.get('answer_short_ne') or ''))}, "
            f"relatedQuestions: [{', '.join(ts_string(str(r)) for r in related)}], "
            f"intent: {ts_string(str(row.get('intent') or 'accounting_qa'))}, "
            f"notTransaction: {str(bool(row.get('not_transaction', True))).lower()}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface AccountingFaqAlias {",
        "  id: string;",
        "  topic: string;",
        "  questionType: string;",
        "  questionNormalized: string;",
        "}",
        "",
        "export const ACCOUNTING_FAQ_ALIASES: Record<string, AccountingFaqAlias> = {",
    ]
    for key, meta in sorted(alias_map.items(), key=lambda x: (-len(x[0]), x[0])):
        map_lines.append(
            f"  {ts_string(str(key))}: {{"
            f"id: {ts_string(str(meta.get('id') or ''))}, "
            f"topic: {ts_string(str(meta.get('topic') or ''))}, "
            f"questionType: {ts_string(str(meta.get('question_type') or ''))}, "
            f"questionNormalized: {ts_string(str(meta.get('question_normalized') or ''))}"
            "},"
        )
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_accounting_glossary(export_path: Path, map_path: Path) -> str:
    rows = []
    if export_path.exists():
        rows = json.loads(export_path.read_text(encoding="utf-8"))
    alias_map = load_json(map_path)

    entry_lines = [
        "export interface AccountingGlossaryEntry {",
        "  id: string;",
        "  termEn: string;",
        "  termNe: string;",
        "  conceptKey: string;",
        "  definitionNe: string;",
        "  definitionEn: string;",
        "  exampleNe: string;",
        "  relatedTerms: string[];",
        "  aliases: string[];",
        "  accountClass: string | null;",
        "}",
        "",
        "export const ACCOUNTING_GLOSSARY: AccountingGlossaryEntry[] = [",
    ]
    for row in rows:
        related = row.get("related_terms") or []
        aliases = row.get("aliases") or []
        account_class = row.get("account_class")
        class_lit = "null" if account_class is None else ts_string(str(account_class))
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"termEn: {ts_string(str(row.get('term_en') or ''))}, "
            f"termNe: {ts_string(str(row.get('term_ne') or ''))}, "
            f"conceptKey: {ts_string(str(row.get('concept_key') or ''))}, "
            f"definitionNe: {ts_string(str(row.get('simple_definition_ne') or ''))}, "
            f"definitionEn: {ts_string(str(row.get('simple_definition_en') or ''))}, "
            f"exampleNe: {ts_string(str(row.get('example_ne') or ''))}, "
            f"relatedTerms: [{', '.join(ts_string(str(r)) for r in related)}], "
            f"aliases: [{', '.join(ts_string(str(a)) for a in aliases)}], "
            f"accountClass: {class_lit}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface AccountingGlossaryAlias {",
        "  id: string;",
        "  termEn: string;",
        "  conceptKey: string;",
        "}",
        "",
        "export const ACCOUNTING_GLOSSARY_ALIASES: Record<string, AccountingGlossaryAlias> = {",
    ]
    for key, meta in sorted(alias_map.items(), key=lambda x: (-len(x[0]), x[0])):
        map_lines.append(
            f"  {ts_string(str(key))}: {{"
            f"id: {ts_string(str(meta.get('id') or ''))}, "
            f"termEn: {ts_string(str(meta.get('term_en') or ''))}, "
            f"conceptKey: {ts_string(str(meta.get('concept_key') or ''))}"
            "},"
        )
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_amount_extraction_patterns(export_path: Path, map_path: Path) -> str:
    rows = []
    if export_path.exists():
        rows = json.loads(export_path.read_text(encoding="utf-8"))
    by_input = load_json(map_path)

    entry_lines = [
        "export interface AmountExtractionExample {",
        "  id: string;",
        "  input: string;",
        "  rawNumbers: string[];",
        "  calculation: string;",
        "  finalAmount: number | string;",
        "  extractionRule: string;",
        "  entities: Record<string, unknown>;",
        "}",
        "",
        "export const AMOUNT_EXTRACTION_EXAMPLES: AmountExtractionExample[] = [",
    ]
    for row in rows:
        fa = row.get("final_amount")
        if isinstance(fa, (int, float)) and not isinstance(fa, bool):
            fa_lit = str(int(fa)) if float(fa) == int(fa) else str(fa)
        else:
            fa_lit = ts_string(str(fa))
        entities = row.get("entities") or {}
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"input: {ts_string(str(row.get('input') or ''))}, "
            f"rawNumbers: [{', '.join(ts_string(str(x)) for x in (row.get('raw_numbers') or []))}], "
            f"calculation: {ts_string(str(row.get('calculation') or ''))}, "
            f"finalAmount: {fa_lit}, "
            f"extractionRule: {ts_string(str(row.get('extraction_rule') or ''))}, "
            f"entities: {json.dumps(entities, ensure_ascii=False)}"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface AmountExtractionInputHit {",
        "  id: string;",
        "  finalAmount: number | string;",
        "  extractionRule: string;",
        "  calculation: string;",
        "}",
        "",
        "export const AMOUNT_EXTRACTION_BY_INPUT: Record<string, AmountExtractionInputHit> = {",
    ]
    for key, meta in sorted(by_input.items(), key=lambda x: (-len(x[0]), x[0])):
        fa = meta.get("final_amount")
        if isinstance(fa, (int, float)) and not isinstance(fa, bool):
            fa_lit = str(int(fa)) if float(fa) == int(fa) else str(fa)
        else:
            fa_lit = ts_string(str(fa))
        map_lines.append(
            f"  {ts_string(str(key))}: {{"
            f"id: {ts_string(str(meta.get('id') or ''))}, "
            f"finalAmount: {fa_lit}, "
            f"extractionRule: {ts_string(str(meta.get('extraction_rule') or ''))}, "
            f"calculation: {ts_string(str(meta.get('calculation') or ''))}"
            "},"
        )
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_nepal_regulated_glossary(export_path: Path, map_path: Path) -> str:
    rows = []
    if export_path.exists():
        rows = json.loads(export_path.read_text(encoding="utf-8"))
    alias_map = load_json(map_path)

    entry_lines = [
        "export interface NepalRegulatedGlossaryEntry {",
        "  id: string;",
        "  domain: string;",
        "  termEn: string;",
        "  termNe: string;",
        "  fullForm: string;",
        "  conceptKey: string;",
        "  definitionNe: string;",
        "  definitionEn: string;",
        "  currentRates: Record<string, string>;",
        "  legalReference: string;",
        "  commonQuestions: string[];",
        "  relatedTerms: string[];",
        "}",
        "",
        "export const NEPAL_REGULATED_GLOSSARY: NepalRegulatedGlossaryEntry[] = [",
    ]
    for row in rows:
        rates = row.get("current_rates") or {}
        rate_items = ", ".join(
            f"{ts_string(str(k))}: {ts_string(str(v))}" for k, v in rates.items()
        )
        related = row.get("related_terms") or []
        questions = row.get("common_questions") or []
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"domain: {ts_string(str(row.get('domain') or ''))}, "
            f"termEn: {ts_string(str(row.get('term_en') or ''))}, "
            f"termNe: {ts_string(str(row.get('term_ne') or ''))}, "
            f"fullForm: {ts_string(str(row.get('full_form') or ''))}, "
            f"conceptKey: {ts_string(str(row.get('concept_key') or ''))}, "
            f"definitionNe: {ts_string(str(row.get('definition_ne') or ''))}, "
            f"definitionEn: {ts_string(str(row.get('definition_en') or ''))}, "
            f"currentRates: {{{rate_items}}}, "
            f"legalReference: {ts_string(str(row.get('legal_reference') or ''))}, "
            f"commonQuestions: [{', '.join(ts_string(str(q)) for q in questions)}], "
            f"relatedTerms: [{', '.join(ts_string(str(r)) for r in related)}]"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface NepalRegulatedGlossaryAlias {",
        "  id: string;",
        "  domain: string;",
        "  termEn: string;",
        "  conceptKey: string;",
        "}",
        "",
        "export const NEPAL_REGULATED_GLOSSARY_ALIASES: Record<string, NepalRegulatedGlossaryAlias> = {",
    ]
    for key, meta in sorted(alias_map.items(), key=lambda x: (-len(x[0]), x[0])):
        map_lines.append(
            f"  {ts_string(str(key))}: {{"
            f"id: {ts_string(str(meta.get('id') or ''))}, "
            f"domain: {ts_string(str(meta.get('domain') or ''))}, "
            f"termEn: {ts_string(str(meta.get('term_en') or ''))}, "
            f"conceptKey: {ts_string(str(meta.get('concept_key') or ''))}"
            "},"
        )
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_particle_map(raw: dict) -> str:
    lines = [
        "export interface ParticleRuntimeEntry {",
        "  direction_vector: string;",
        "  intent_hint: string;",
        "}",
        "",
        "export const PARTICLE_MAP: Record<string, ParticleRuntimeEntry> = {",
    ]
    seen: set[str] = set()
    for key, meta in sorted(raw.items(), key=lambda x: (-len(x[0]), x[0])):
        particle = str(meta.get("particle") or key).lower()
        if particle in seen and key != particle:
            continue
        seen.add(key.lower())
        lines.append(
            f"  {ts_string(key.lower())}: {{direction_vector: {ts_string(str(meta.get('direction_vector') or ''))}, "
            f"intent_hint: {ts_string(str(meta.get('intent_hint') or 'khata_journal'))}}},"
        )
    lines.append("};")
    return "\n".join(lines)


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def export_conversation_scenarios(
    export_path: Path,
    by_type_path: Path,
    user_turn_map_path: Path,
) -> str:
    """e-KHATA dialogue scenarios (onboarding / daily / Q&A / correction / report)."""
    rows: list = []
    if export_path.exists():
        loaded = json.loads(export_path.read_text(encoding="utf-8"))
        if isinstance(loaded, list):
            rows = loaded
    by_type = load_json(by_type_path)
    user_turn_map = load_json(user_turn_map_path)

    interface = """export interface ConversationScenarioTurn {
  role: string;
  text: string;
  state?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ConversationScenario {
  id: string;
  scenarioType: string;
  userProfile: string;
  keyBehaviors: string[];
  userSatisfactionMarkers: string[];
  turnCount: number;
  userTurnCount: number;
  firstUserText: string;
  conversation: ConversationScenarioTurn[];
  conversationSummary?: string | null;
}"""

    # Normalize snake_case export → camelCase for TS consumers
    ts_rows = []
    for row in rows:
        ts_rows.append(
            {
                "id": row.get("id") or "",
                "scenarioType": row.get("scenario_type") or "",
                "userProfile": row.get("user_profile") or "",
                "keyBehaviors": row.get("key_behaviors") or [],
                "userSatisfactionMarkers": row.get("user_satisfaction_markers") or [],
                "turnCount": int(row.get("turn_count") or 0),
                "userTurnCount": int(row.get("user_turn_count") or 0),
                "firstUserText": row.get("first_user_text") or "",
                "conversation": row.get("conversation") or [],
                "conversationSummary": row.get("conversation_summary"),
            }
        )

    body = (
        interface
        + "\n\n"
        + "export const CONVERSATION_SCENARIOS: ConversationScenario[] = "
        + json.dumps(ts_rows, ensure_ascii=False)
        + " as ConversationScenario[];\n\n"
        + "/** scenario_type → scenario ids */\n"
        + "export const CONVERSATION_SCENARIOS_BY_TYPE: Record<string, string[]> = "
        + json.dumps(by_type, ensure_ascii=False)
        + ";\n\n"
        + "/** normalized user-turn text → scenario id (non-generic turns) */\n"
        + "export const CONVERSATION_SCENARIO_USER_TURNS: Record<string, string> = "
        + json.dumps(user_turn_map, ensure_ascii=False)
        + ";\n"
    )
    return body


def export_sector_term_vocabulary(export_path: Path, map_path: Path) -> str:
    rows = []
    if export_path.exists():
        rows = json.loads(export_path.read_text(encoding="utf-8"))
    alias_map = load_json(map_path)

    entry_lines = [
        "export interface SectorTermEntry {",
        "  id: string;",
        "  term: string;",
        "  sector: string;",
        "  sectorSlug: string;",
        "  conceptKey: string;",
        "  meaningEn: string;",
        "  meaningNe: string;",
        "  variants: string[];",
        "  commonPhrases: string[];",
        "  typicalTransactions: string[];",
        "}",
        "",
        "export const SECTOR_TERM_VOCABULARY: SectorTermEntry[] = [",
    ]
    for row in rows:
        entry_lines.append(
            "  {"
            f"id: {ts_string(str(row.get('id') or ''))}, "
            f"term: {ts_string(str(row.get('term') or ''))}, "
            f"sector: {ts_string(str(row.get('sector') or ''))}, "
            f"sectorSlug: {ts_string(str(row.get('sector_slug') or ''))}, "
            f"conceptKey: {ts_string(str(row.get('concept_key') or ''))}, "
            f"meaningEn: {ts_string(str(row.get('meaning_en') or ''))}, "
            f"meaningNe: {ts_string(str(row.get('meaning_ne') or ''))}, "
            f"variants: [{', '.join(ts_string(str(v)) for v in (row.get('variants') or []))}], "
            f"commonPhrases: [{', '.join(ts_string(str(p)) for p in (row.get('common_phrases') or []))}], "
            f"typicalTransactions: [{', '.join(ts_string(str(t)) for t in (row.get('typical_transactions') or []))}]"
            "},"
        )
    entry_lines.append("];")

    map_lines = [
        "export interface SectorTermAlias {",
        "  id: string;",
        "  sector: string;",
        "  sectorSlug: string;",
        "  term: string;",
        "  conceptKey: string;",
        "}",
        "",
        "export const SECTOR_TERM_ALIASES: Record<string, SectorTermAlias> = {",
    ]
    for key, meta in sorted(alias_map.items(), key=lambda x: (-len(x[0]), x[0])):
        map_lines.append(
            f"  {ts_string(str(key))}: {{"
            f"id: {ts_string(str(meta.get('id') or ''))}, "
            f"sector: {ts_string(str(meta.get('sector') or ''))}, "
            f"sectorSlug: {ts_string(str(meta.get('sector_slug') or ''))}, "
            f"term: {ts_string(str(meta.get('term') or ''))}, "
            f"conceptKey: {ts_string(str(meta.get('concept_key') or ''))}"
            "},"
        )
    map_lines.append("};")
    return "\n".join(entry_lines) + "\n\n" + "\n".join(map_lines)


def export_sector_keywords() -> str:
    rows = load_jsonl(NEPAL / "ontology" / "master_sectors.jsonl")
    sector_dir = NEPAL / "sectors"
    slug_map = {
        "sector-001": "kirana-grocery",
        "sector-002": "hardware-construction-materials-shop",
        "sector-003": "electronics-mobile-shop",
        "sector-008": "restaurant-cafe",
        "sector-011": "meat-shop",
        "sector-012": "dairy-shop",
        "sector-015": "hardware-construction-materials-shop",
        "sector-024": "clinic-health",
        "sector-017": "agriculture-farming",
        "sector-018": "education-training",
        "sector-019": "professional-services",
    }
    sector_file_map = {p.stem: p for p in sector_dir.glob("*.jsonl")}

    # Enrich keywords from multi-sector term vocabulary (batch 11c)
    vocab_by_slug: dict[str, set[str]] = {}
    vocab_export = NEPAL / "language" / "sector_term_vocabulary_export.json"
    if vocab_export.exists():
        for term in json.loads(vocab_export.read_text(encoding="utf-8")):
            slug = str(term.get("sector_slug") or "")
            if not slug:
                continue
            bag = vocab_by_slug.setdefault(slug, set())
            bag.add(str(term.get("term") or "").lower())
            for v in term.get("variants") or []:
                bag.add(str(v).lower())
            for p in term.get("common_phrases") or []:
                bag.update(w.lower() for w in str(p).split() if len(w) > 3)

    lines = [
        "export interface SectorKeywordEntry {",
        "  sectorId: string;",
        "  sectorSlug: string;",
        "  name: string;",
        "  macroSector: string;",
        "  keywords: string[];",
        "}",
        "",
        "export const SECTOR_KEYWORD_INDEX: SectorKeywordEntry[] = [",
    ]
    for row in rows:
        sid = str(row.get("id") or "")
        name = str(row.get("name_en") or "")
        slug = slug_map.get(sid) or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:48]
        kws: set[str] = set()
        for tag in row.get("tags") or []:
            if tag:
                kws.add(str(tag).lower())
        if row.get("name_ne_roman"):
            kws.add(str(row["name_ne_roman"]).lower())
        if name:
            kws.add(name.lower())
        if row.get("subsector"):
            kws.add(str(row["subsector"]).lower())
        for phrase in row.get("example_user_phrases") or []:
            kws.update(w.lower() for w in str(phrase).split() if len(w) > 3)
        for fstem, fpath in sector_file_map.items():
            if fstem.replace("_", "-") == slug.replace("_", "-") or fstem in slug:
                for ex in load_jsonl(fpath)[:20]:
                    p = str(ex.get("phrase_roman") or ex.get("phrase") or "")
                    kws.update(w.lower() for w in p.split() if len(w) > 3)
        for extra in vocab_by_slug.get(slug, set()):
            if extra and len(extra) > 2:
                kws.add(extra)
        kw_list = sorted(k for k in kws if k and len(k) > 2)[:80]
        kw_json = ", ".join(ts_string(k) for k in kw_list)
        lines.append(
            f"  {{sectorId: {ts_string(sid)}, sectorSlug: {ts_string(slug)}, "
            f"name: {ts_string(name)}, macroSector: {ts_string(str(row.get('macro_sector') or ''))}, "
            f"keywords: [{kw_json}]}},"
        )
    lines.append("];")
    return "\n".join(lines)


def main() -> int:
    verb_raw = load_json(NEPAL / "language" / "verb_normalize_map.json")
    typo_raw = load_json(NEPAL / "language" / "typo_normalize_map.json")
    q_rows = NEPAL / "language" / "question_patterns.jsonl"
    social_rows = NEPAL / "language" / "social_discourse.jsonl"
    safety_raw = load_json(NEPAL / "behavior" / "safety_pattern_map.json")
    clarify_raw = load_json(NEPAL / "behavior" / "clarify_template_map.json")
    discourse_raw = load_json(NEPAL / "language" / "discourse_action_map.json")
    pl_raw = load_json(NEPAL / "language" / "profit_loss_map.json")
    particle_raw = load_json(NEPAL / "language" / "particle_direction_map.json")

    parts = [
        "/** AUTO-GENERATED by erp_bot/scripts/export_nepal_ai_runtime_maps.py — do not edit */",
        "",
        export_verb_map(verb_raw),
        "",
        export_verb_conjugations(NEPAL / "language" / "verb_conjugations_export.json"),
        "",
        export_string_map("TYPO_ALIASES", {k: str(v) for k, v in typo_raw.items()}),
        "",
        export_question_patterns(q_rows, NEPAL / "language" / "question_words.jsonl"),
        "",
        export_social_discourse(social_rows),
        "",
        export_number_words(
            NEPAL / "language" / "number_word_values.json",
            NEPAL / "language" / "number_word_phrases.json",
        ),
        "",
        export_amount_extraction_patterns(
            NEPAL / "language" / "amount_extraction_patterns_export.json",
            NEPAL / "language" / "amount_extraction_patterns_map.json",
        ),
        "",
        export_bikram_calendar(
            NEPAL / "language" / "bikram_calendar_phrases.json",
            NEPAL / "language" / "time_date_map.json",
        ),
        "",
        export_retail_items(
            NEPAL / "language" / "retail_items_export.json",
            NEPAL / "language" / "retail_item_map.json",
        ),
        "",
        export_party_patterns(
            NEPAL / "language" / "party_name_patterns_export.json",
            NEPAL / "language" / "party_marker_map.json",
            NEPAL / "language" / "party_name_aids.json",
        ),
        "",
        export_accounting_glossary(
            NEPAL / "language" / "accounting_glossary_export.json",
            NEPAL / "language" / "accounting_glossary_map.json",
        ),
        "",
        export_nepal_regulated_glossary(
            NEPAL / "language" / "nepal_regulated_glossary_export.json",
            NEPAL / "language" / "nepal_regulated_glossary_map.json",
        ),
        "",
        export_accounting_faq(
            NEPAL / "language" / "accounting_faq_export.json",
            NEPAL / "language" / "accounting_faq_map.json",
        ),
        "",
        export_nepal_tax_faq(
            NEPAL / "language" / "nepal_tax_faq_export.json",
            NEPAL / "language" / "nepal_tax_faq_map.json",
        ),
        "",
        export_legal_section_explainers(
            NEPAL / "language" / "legal_section_explainers_export.json",
            NEPAL / "language" / "legal_section_explainer_query_map.json",
            NEPAL / "language" / "legal_section_explainers_by_document.json",
        ),
        "",
        export_nepal_process_guides(
            NEPAL / "language" / "nepal_process_guides_export.json",
            NEPAL / "language" / "nepal_process_guides_map.json",
        ),
        "",
        export_complex_transaction_narratives(
            NEPAL / "language" / "complex_transaction_narratives_export.json",
            NEPAL / "language" / "complex_transaction_input_map.json",
            NEPAL / "language" / "complex_transaction_by_type.json",
        ),
        "",
        export_reasoning_chain_patterns(
            NEPAL / "language" / "reasoning_chain_patterns_export.json",
            NEPAL / "language" / "reasoning_chain_input_map.json",
            NEPAL / "language" / "reasoning_chain_by_intent.json",
        ),
        "",
        export_nepali_orthography(
            NEPAL / "language" / "nepali_orthography_export.json",
            NEPAL / "language" / "nepali_devanagari_roman_map.json",
            NEPAL / "language" / "nepali_roman_alias_map.json",
        ),
        "",
        export_safety_patterns(safety_raw),
        "",
        export_clarify_templates(clarify_raw),
        "",
        export_response_templates(
            NEPAL / "behavior" / "response_templates_export.json",
            NEPAL / "behavior" / "response_templates_by_intent.json",
        ),
        "",
        export_clarify_error_patterns(
            NEPAL / "behavior" / "clarify_error_patterns_export.json",
            NEPAL / "behavior" / "clarify_error_pattern_map.json",
        ),
        "",
        export_ambiguity_resolution_patterns(
            NEPAL / "behavior" / "ambiguity_resolution_patterns_export.json",
            NEPAL / "behavior" / "ambiguity_resolution_input_map.json",
            NEPAL / "behavior" / "ambiguity_resolution_by_type.json",
        ),
        "",
        export_accounting_mistake_patterns(
            NEPAL / "behavior" / "accounting_mistake_patterns_export.json",
            NEPAL / "behavior" / "accounting_mistake_input_map.json",
            NEPAL / "behavior" / "accounting_mistake_by_type.json",
        ),
        "",
        export_document_understanding_patterns(
            NEPAL / "documents" / "document_understanding_patterns_export.json",
            NEPAL / "documents" / "document_understanding_type_map.json",
            NEPAL / "documents" / "document_understanding_by_type.json",
        ),
        "",
        export_document_ocr_extractions(
            NEPAL / "documents" / "document_ocr_extractions_export.json",
            NEPAL / "documents" / "document_ocr_extraction_query_map.json",
            NEPAL / "documents" / "document_ocr_extractions_by_type.json",
        ),
        "",
        export_document_comprehension_scenarios(
            NEPAL / "documents" / "document_comprehension_scenarios_export.json",
            NEPAL / "documents" / "document_comprehension_scenario_query_map.json",
            NEPAL / "documents" / "document_comprehension_scenarios_by_type.json",
        ),
        "",
        export_financial_statement_interpretations(
            NEPAL / "language" / "financial_statement_interpretations_export.json",
            NEPAL / "language" / "financial_statement_interpretation_query_map.json",
            NEPAL / "language" / "financial_statement_interpretations_by_type.json",
        ),
        "",
        export_accounting_comparisons(
            NEPAL / "language" / "accounting_comparisons_export.json",
            NEPAL / "language" / "accounting_comparison_query_map.json",
            NEPAL / "language" / "accounting_comparisons_by_topic.json",
        ),
        "",
        export_code_mixed_utterances(
            NEPAL / "language" / "code_mixed_utterances_export.json",
            NEPAL / "language" / "code_mixed_utterance_query_map.json",
            NEPAL / "language" / "code_mixed_utterances_by_intent.json",
        ),
        "",
        export_word_sense_contexts(
            NEPAL / "language" / "word_sense_contexts_export.json",
            NEPAL / "language" / "word_sense_context_query_map.json",
            NEPAL / "language" / "word_sense_contexts_by_word.json",
        ),
        "",
        export_edge_case_handlers(
            NEPAL / "language" / "edge_case_handlers_export.json",
            NEPAL / "language" / "edge_case_handler_query_map.json",
            NEPAL / "language" / "edge_case_handlers_by_category.json",
        ),
        "",
        export_complex_reasoning_scenarios(
            NEPAL / "language" / "complex_reasoning_scenarios_export.json",
            NEPAL / "language" / "complex_reasoning_scenario_query_map.json",
            NEPAL / "language" / "complex_reasoning_scenarios_by_type.json",
        ),
        "",
        export_cross_domain_scenarios(
            NEPAL / "language" / "cross_domain_scenarios_export.json",
            NEPAL / "language" / "cross_domain_scenario_query_map.json",
            NEPAL / "language" / "cross_domain_scenarios_by_domain.json",
        ),
        "",
        export_classification_explanations(
            NEPAL / "language" / "classification_explanations_export.json",
            NEPAL / "language" / "classification_explanation_query_map.json",
            NEPAL / "language" / "classification_explanations_by_type.json",
        ),
        "",
        export_novel_pattern_handlers(
            NEPAL / "language" / "novel_pattern_handlers_export.json",
            NEPAL / "language" / "novel_pattern_handler_query_map.json",
            NEPAL / "language" / "novel_pattern_handlers_by_intent.json",
        ),
        "",
        export_prompt_variants(
            NEPAL / "behavior" / "prompt_variants_export.json",
            NEPAL / "behavior" / "prompt_variant_query_map.json",
            NEPAL / "behavior" / "prompt_variants_by_behavior.json",
        ),
        "",
        export_empathetic_response_patterns(
            NEPAL / "behavior" / "empathetic_response_patterns_export.json",
            NEPAL / "behavior" / "empathetic_response_input_map.json",
            NEPAL / "behavior" / "empathetic_response_by_emotion.json",
        ),
        "",
        export_journal_entry_rules(
            NEPAL / "behavior" / "journal_entry_rules_export.json",
            NEPAL / "behavior" / "journal_entry_rule_example_map.json",
            NEPAL / "behavior" / "journal_entry_intent_bridge.json",
        ),
        "",
        export_context_resolution_patterns(
            NEPAL / "behavior" / "context_resolution_patterns_export.json",
            NEPAL / "behavior" / "context_resolution_trigger_map.json",
        ),
        "",
        export_discourse(discourse_raw),
        "",
        export_pl_map(pl_raw),
        "",
        export_particle_map(particle_raw),
        "",
        export_sector_term_vocabulary(
            NEPAL / "language" / "sector_term_vocabulary_export.json",
            NEPAL / "language" / "sector_term_vocabulary_map.json",
        ),
        "",
        export_conversation_scenarios(
            NEPAL / "language" / "conversation_scenarios_export.json",
            NEPAL / "language" / "conversation_scenarios_by_type.json",
            NEPAL / "language" / "conversation_scenario_user_turn_map.json",
        ),
        "",
        export_sector_keywords(),
    ]

    out_path = OUT / "runtimeMaps.ts"
    out_path.write_text("\n".join(parts) + "\n", encoding="utf-8")
    print(f"Exported {out_path} ({len(verb_raw)} verbs, {len(typo_raw)} typos)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
