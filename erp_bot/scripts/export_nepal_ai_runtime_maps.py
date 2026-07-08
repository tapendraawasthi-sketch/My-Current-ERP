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
        lines.append(f"  {ts_string(alias)}: {{{', '.join(parts)}}},")
    lines.append("};")
    return "\n".join(lines)


def export_string_map(name: str, raw: dict[str, str]) -> str:
    lines = [f"export const {name}: Record<string, string> = {{"]
    for k, v in sorted(raw.items(), key=lambda x: (-len(x[0]), x[0])):
        lines.append(f"  {ts_string(k)}: {ts_string(v)},")
    lines.append("};")
    return "\n".join(lines)


def export_question_patterns(rows_path: Path) -> str:
    patterns: list[str] = []
    if rows_path.exists():
        for line in rows_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            pat = str(row.get("pattern") or "")
            if pat and pat not in ("?",):
                safe = re.escape(pat).replace(r"\ ", r"\s+").replace("X", r"[\w\u0900-\u097F]+")
                patterns.append(safe)
    # Critical hardcoded patterns
    extras = [
        r"\bk\s*ho\b",
        r"\bke\s*ho\b",
        r"\bk\s*huncha\b",
        r"\bke\s*huncha\b",
        r"\bk\s*bhanne\b",
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
    return f"export const QUESTION_REGEX_SOURCES: string[] = [\n  {body},\n];"


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


def export_discourse(raw: dict) -> str:
    lines = ["export interface DiscourseEntry {", "  type: string;", "  multi_turn_action: string;", "  strength?: string;", "}", "", "export const DISCOURSE_MAP: Record<string, DiscourseEntry> = {"]
    for pat, meta in raw.items():
        lines.append(
            f"  {ts_string(pat)}: {{type: {ts_string(meta.get('type') or '')}, "
            f"multi_turn_action: {ts_string(meta.get('multi_turn_action') or '')}, "
            f"strength: {ts_string(meta.get('strength') or '')}}},"
        )
    lines.append("};")
    return "\n".join(lines)


def export_pl_map(raw: dict) -> str:
    """Profit/loss terms that signal expense vs question."""
    expense_terms = [k for k, v in raw.items() if v.get("journal_intent_if_entry") == "khata_expense"]
    body = ",\n  ".join(ts_string(t) for t in sorted(set(expense_terms)))
    return f"export const EXPENSE_TERM_HINTS: string[] = [\n  {body},\n];"


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
        kw_list = sorted(k for k in kws if k and len(k) > 2)[:45]
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
        export_string_map("TYPO_ALIASES", {k: str(v) for k, v in typo_raw.items()}),
        "",
        export_question_patterns(q_rows),
        "",
        export_safety_patterns(safety_raw),
        "",
        export_clarify_templates(clarify_raw),
        "",
        export_discourse(discourse_raw),
        "",
        export_pl_map(pl_raw),
        "",
        export_particle_map(particle_raw),
        "",
        export_sector_keywords(),
    ]

    out_path = OUT / "runtimeMaps.ts"
    out_path.write_text("\n".join(parts) + "\n", encoding="utf-8")
    print(f"Exported {out_path} ({len(verb_raw)} verbs, {len(typo_raw)} typos)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
