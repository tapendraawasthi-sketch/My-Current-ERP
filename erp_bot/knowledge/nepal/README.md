# Nepal Accounting & Tax Knowledge Base

This directory contains the **source of truth** for Nepal-specific accounting, tax, and fiscal knowledge used by Orbix/Falcon AI.

## How It Works

1. **Markdown files** in this directory are chunked and embedded using `nomic-embed-text`
2. **Semantic search** finds relevant chunks when users ask accounting/tax questions
3. **RAG (Retrieval-Augmented Generation)** injects context into LLM prompts
4. **Source citations** are provided with answers

## Files

| File | Content |
|------|---------|
| `vat.md` | Nepal VAT (13%), exempt items, calculations, invoicing rules |
| `tds.md` | TDS rates, thresholds, deduction rules, filing deadlines |
| `ssf.md` | Social Security Fund contributions, benefits, calculations |
| `fiscal-year.md` | BS/AD calendar, fiscal year dates, tax deadlines |
| `double-entry.md` | Standard journal entries, golden rules, accounting equations |
| `gratuity.md` | Gratuity, PF, CIT, leave encashment, employee benefits |

## Adding New Knowledge

### 1. Create a New Markdown File

Create `your-topic.md` with:

```markdown
# Topic Title

> ⚠️ **DISCLAIMER**: [Appropriate disclaimer about verification]

## Section 1

Content here...

### Subsection

More details...

## Section 2

...
```

### 2. Guidelines for Good Content

- **Use clear headers** (##, ###) — the chunker splits by headers
- **Include examples** — especially journal entries with Dr/Cr columns
- **Add tables** — rates, thresholds, deadlines are easier to read
- **Mark uncertainties** — "verify with IRD", "rates may have changed"
- **Cite sources** — mention the Act/Rule number when possible

### 3. Reindex After Changes

After adding or editing files, reindex the knowledge base:

```bash
# Via API
curl -X POST http://localhost:8765/knowledge/nepal/reindex

# Or restart erp_bot (auto-indexes on startup if empty)
```

### 4. Test Your Changes

```bash
# Search the knowledge base
curl -X POST http://localhost:8765/knowledge/nepal/search \
  -H "Content-Type: application/json" \
  -d '{"query": "your question here", "k": 5}'
```

## Chunking Strategy

The ingestion script:
1. Splits markdown by headers (##, ###, etc.)
2. Further splits large sections into ~1200 char chunks
3. Maintains 200 char overlap between chunks
4. Preserves section titles in metadata

## Why Markdown Instead of JSONL?

| Aspect | JSONL Templates | Markdown Knowledge Base |
|--------|-----------------|------------------------|
| **Editability** | Hard to read/edit | Human-friendly |
| **Structure** | Flat Q&A pairs | Hierarchical sections |
| **Updates** | Copy-paste errors | Git-trackable changes |
| **Coverage** | Finite templates | Comprehensive knowledge |
| **Retrieval** | Exact match | Semantic similarity |

The JSONL corpus (`ca-training-corpus-generated.jsonl`) is now **fine-tuning data only** — not used for runtime answers.

## Disclaimers

All files should include:

```markdown
> ⚠️ **DISCLAIMER**: Tax rates and thresholds change. Always verify current rules with IRD (Inland Revenue Department) at https://ird.gov.np before making business decisions.
```

This ensures:
1. Users know to verify critical information
2. AI responses include appropriate caveats
3. Legal liability is managed

## Verification Checklist

Before committing changes, verify:
- [ ] Rates match current IRD publications
- [ ] Thresholds are up to date
- [ ] Fiscal year references are correct
- [ ] Journal entries balance (Dr = Cr)
- [ ] Disclaimer is included

---

*Last updated: FY 2080/81. Review annually at fiscal year start.*
