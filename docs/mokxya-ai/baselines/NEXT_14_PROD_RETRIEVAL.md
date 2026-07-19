# NEXT-14 — Production Retrieval Without Ollama (GAP-P2-001 REDUCED)

**Date:** 2026-07-19  
**Step:** NEXT-14 / PR-A1  
**ADR:** ADR_0081  

## Decision

| Environment | Retrieval mode | Ollama required |
|-------------|----------------|-----------------|
| Production (`RENDER` / `NODE_ENV=production` / …) | `LEXICAL_ONLY` | **false** |
| Non-prod (explicit allow) | optional lexical + semantic filler | may be true for DX |

## Enforcement

1. `NpKbConfig.from_env` forces `semantic_enabled=false` in production
2. `interpret_user_text` forces lexical-only even without annotation bundles
3. `env_allows_non_prod_semantic` / consume gate return false in production

## Gap status

- **GAP-P2-001 = REDUCED** (not CLOSED)
- Residual: staging deploy proof + reviewer sign-off for CLOSED

## Evidence

- `docs/mokxya-ai/decisions/ADR_0081_PROD_RETRIEVAL_WITHOUT_OLLAMA.md`
- `docs/mokxya-ai/MAI_PROD_RETRIEVAL_REGISTRY.json`
- `erp_bot/.../prod_retrieval_policy.py`
- `erp_bot/tests/oip/language_runtime/test_mai_next14_prod_retrieval.py`
- `src/__tests__/orbix/maiNext14ProdRetrieval.test.ts`

## Explicit non-claims

- Not production_approved (NEXT-20 / PR-C)
- Not GAP-P2-001 CLOSED
- Not sole retrieval / citation verified
