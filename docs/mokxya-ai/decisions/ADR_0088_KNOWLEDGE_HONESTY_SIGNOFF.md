# ADR_0088 — Knowledge Honesty Sign-Off (PR-B5 / GAP-P2-008)

- **Status:** Accepted (2026-07-19)
- **Step:** PR-B5
- **Extends:** ADR_0080 knowledge citation honesty gate
- **Gap:** GAP-P2-008 remains **REDUCED** (not CLOSED)

## Context

NEXT-13 / ADR_0080 force-abstains fake cite, tax-current without knowledge
release, missing-evidence claim-like Ask, lang-as-law, unsupported legal, and
stale-as-current on the launch Ask gate. PR-B5 files the production-plan
honesty sign-off pack: re-prove critical `knowledge_no_answer_v1` cases,
record an engineering PASS note, and keep professional staging attestation
honest (PENDING ticket) without falsely closing the gap.

## Decision

1. **Critical suite re-proof** (engineering): force-abstain remains green for
   `fake_cite_04`, `tax_current_02`, `no_kb_05`, `lang_as_law_07`,
   `unsupp_legal_09`, `stale_08`.
2. **Sign note** = `ENGINEERING_PASS` for launch Ask gate behaviors;
   `STAGING_PROFESSIONAL_REVIEW` may remain PENDING
   (`TICKET-PR-B5-001`) and blocks PR-C alongside PR-B1 tickets if not cleared.
3. **GAP-P2-008** stays **REDUCED**; CLOSED only when a professional reviewer
   explicitly attests staging Ask naturalness/product wording AND engineering
   gate remains green.
4. **Forbidden:** `production_approved=true`, `claims_verified=true`,
   `legal_effective_dates_proven=true`, `gap_p2_008_closed=true` without
   attestation evidence.

## Rejected

| Alternative | Why |
|-------------|-----|
| Mark GAP-P2-008 CLOSED without human staging review | Violates ADR_0080 CLOSED criteria |
| Invent professional PASS | False hard-proof |
| Skip filing sign note | Plan acceptance requires signed honesty note |

## Related

- `docs/mokxya-ai/MAI_KNOWLEDGE_HONESTY_SIGNOFF_REGISTRY.json`
- `artifacts/prod-ready-pr-b5/`
- `docs/mokxya-ai/MAI_KNOWLEDGE_CITATION_HONESTY_REGISTRY.json`
- `erp_bot/tests/oip/language_runtime/test_mai_next13_knowledge_citation.py`
