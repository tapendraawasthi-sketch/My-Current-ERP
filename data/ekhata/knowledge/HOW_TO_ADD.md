# e-Khata Tiered Knowledge — How to Add Information

When you give the AI new knowledge, it is stored in **segmented files** under `data/ekhata/knowledge/`.  
Each segment has an **authority level**. On conflict, the system picks the **more authoritative** source for the **task type**.

## Two top levels

| Level | Purpose | Authority |
|-------|---------|-----------|
| **general/** | Language, romanization, plain accounting concepts | Lower (10–25) |
| **professional/** | NFRS, NAS, Conceptual Framework, VAT/TDS/SSF law, NRB | Higher (65–82) |

## General segments (`general/`)

```
general/language/nepali/       — देवनागरी, grammar, Nepali accounting words
general/language/english/      — English business/accounting phrasing
general/language/romanized/    — Roman Nepali (tapai, udhaar, becheko…)
general/accounting-concepts/   — Plain-language double entry, Dr/Cr basics
```

## Professional segments (`professional/`)

```
professional/accounting-standards/conceptual-framework/
professional/accounting-standards/nfrs/
professional/accounting-standards/nfrs-sme/
professional/accounting-standards/nas-micro/
professional/legal-compliance/vat/
professional/legal-compliance/income-tax/
professional/legal-compliance/ssf/
professional/legal-compliance/nrb/
professional/sector/coa/
```

## Conflict priority (who wins)

1. **Compliance** (VAT rate, TDS, filing date, SSF %) → `professional/legal-compliance/*`
2. **Recognition / NFRS / framework** (sampatti, manyata, para 4.3) → `professional/accounting-standards/*`
3. **How to say it in Nepali/Roman** → `general/language/*`
4. **Simple concept explanation** → `general/accounting-concepts/*` (only if no professional source matches)

**Professional always beats general** for the same topic unless the task is purely language.

## File format — add one `.jsonl` file per topic

Each line = one knowledge chunk:

```json
{
  "id": "vat-standard-rate-2024",
  "title": "Nepal VAT standard rate",
  "content": "Standard VAT rate is 13%. Monthly return by 25th...",
  "segment": "professional.legal-compliance.vat",
  "language": ["nepali", "english", "romanized"],
  "tags": ["vat", "13%", "ird"],
  "source": "VAT Act 2052 / IRD practice",
  "effective_from": "2024-01-01",
  "supersedes": []
}
```

Required fields: `id`, `content`, `segment`  
Optional: `title`, `language`, `tags`, `source`, `effective_from`, `supersedes`

### Superseding old info

If new law replaces old text, set `"supersedes": ["old-chunk-id"]`.  
The loader drops superseded chunks automatically.

## Where to put your next upload

| You are teaching… | Put file in… |
|-------------------|--------------|
| Nepali grammar / Roman rules | `general/language/nepali/` or `romanized/` |
| English accounting terms | `general/language/english/` |
| Basic “what is debit” | `general/accounting-concepts/` |
| IFRS Conceptual Framework | `professional/accounting-standards/conceptual-framework/` |
| NFRS / NAS | `professional/accounting-standards/nfrs/` etc. |
| VAT, TDS, Income Tax, SSF | `professional/legal-compliance/<act>/` |
| Bank/NRB rules | `professional/legal-compliance/nrb/` |
| COA / sector accounts | `professional/sector/coa/` |

After adding files, restart `erp_bot` (or wait for watcher) — chunks index into RAG automatically.

## Registry

Segment list and authority scores: `data/ekhata/knowledge/_registry.json`  
Do not edit unless adding a **new segment type**.
