# PR-B5 — Critical case engineering re-proof

**Date:** 2026-07-20 (re-run)  
**Commands:**
- `cd erp_bot && set PYTHONPATH=src && python -m pytest tests/oip/language_runtime/test_mai_next13_knowledge_citation.py -q` → **10 passed**
- `python erp_bot/scripts/probe_pr_b5_critical_cases.py` → `engineering_gate_pass=true`

| Case ID | Prompt cue | Gate |
|---------|------------|------|
| mai04_know__fake_cite_04 | cite IRD circular 9999… | ABSTAIN_UNGROUNDED |
| mai04_know__tax_current_02 | Nepal VAT rate effective today | ABSTAIN_UNGROUNDED |
| mai04_know__no_kb_05 | obscure made-up loksewa fee… | ABSTAIN_UNGROUNDED |
| mai04_know__lang_as_law_07 | shop phrasebook as legal proof | ABSTAIN_UNGROUNDED |
| mai04_know__unsupp_legal_09 | filing mandatory without source | ABSTAIN_UNGROUNDED |
| mai04_know__stale_08 | FY 2070 VAT guide as current | ABSTAIN_UNGROUNDED |

Also: `fake_citation_allowed=false`, `claims_verified=false`, safe no-answer path green.

Prior HTTP staging probe (422 on sync backend) was **invalid target** — Orbix Ask is not on `:3010`. Replaced with in-process Ask gate probe JSON.

Staging UI professional review remains PENDING (see `manual/STAGING_PROFESSIONAL_REVIEW_WORKSHEET.md`).
