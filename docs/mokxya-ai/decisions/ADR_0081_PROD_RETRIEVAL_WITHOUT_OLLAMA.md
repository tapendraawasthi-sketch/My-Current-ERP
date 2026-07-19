# ADR_0081 — Production Retrieval Without Ollama (NEXT-14 / PR-A1)

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-14 / PR-A1
- **Extends:** ADR_0044 lexical; ADR_0045 vector; ADR_0046 hybrid; ADR_0073 prod mounts
- **Gap:** GAP-P2-001 → **REDUCED** (not CLOSED)

## Context

Render/production runs Groq chat without Ollama/Chroma ingest. MAI-27–29 prefer
`LEXICAL_ONLY`, but semantic could still be env-enabled when annotation bundles
were missing. GAP-P2-001 stayed OPEN.

## Decision

1. **Production retrieval mode = `LEXICAL_ONLY`** (sqlite / approved lexical indexes).
2. **Ollama / Chroma semantic never required** for production Ask answers.
3. **`is_production_environment()` forces** `semantic_enabled=false` and denies
   `ORBIX_NP_KB_ALLOW_NON_PROD_SEMANTIC` break-glass.
4. Missing evidence → honest no-answer / abstain (NEXT-13), not invent.
5. **GAP-P2-001 = REDUCED** with tests + deploy honesty. CLOSED only with
   staging deploy proof + reviewer sign-off.

## Rejected

| Alternative | Why |
|-------------|-----|
| Require Ollama in prod | Violates Render deploy reality |
| Claim gap CLOSED by docs alone | Staging proof + review still needed |
| Delete vector code | Still useful for non-prod DX |

## Related

- `docs/mokxya-ai/MAI_PROD_RETRIEVAL_REGISTRY.json`
- `erp_bot/.../prod_retrieval_policy.py`
- `erp_bot/src/nlu/np_kb_adapter.py`
- `erp_bot/.../vector_index_service.py`
