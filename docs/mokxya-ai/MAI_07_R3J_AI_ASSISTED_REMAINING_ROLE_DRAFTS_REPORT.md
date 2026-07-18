# MAI-07R3J-AI-ASSISTED-REMAINING-ROLE-DRAFTS

**Verdict:** `PASSED_DRAFT_GENERATION`  
**Date:** 2026-07-17  
**Scope:** PRODUCT_POLICY, NEPALI_FLUENT_A, PROFESSIONAL_LINGUIST_B Round A AI-assisted drafts

## Non-claims

| Claim | Status |
|-------|--------|
| Independent human review | **false** |
| User accepted without changes | **false** (`user_accepted=false`) |
| Official Round A lock eligible | **false** |
| Round B authorized | **false** |
| Frozen V3 gold | **false** |
| Linguist / production approved | **false** |
| Training / runtime promotion | **not performed** |
| Submission-ready under independent protocol | **false** |

Status: `AI_ASSISTED_DRAFT_FOR_HUMAN_REVIEW` · `ai_autofill_used=true` · `prohibited_for_training=true`

## Method

1. Reuse ACCOUNTING_DOMAIN verified AI-assisted labels for identical `(input_text, highlighted_span)` content (**611** rows per role).
2. Apply deterministic `HEURISTIC_V1` for the remaining **500** content pairs per role.
3. Fill only ROUND_A_CONTEXT columns D–I; leave declaration / Round B / checklist untouched.
4. Store under segregated path — **not** `round_a_inbox`.

## Outputs

Root: `docs/mokxya-ai/reviews/mai07_v3_ai_assisted/role_drafts/`

| Role | Rows | Workbooks | ZIP |
|------|------|-----------|-----|
| PRODUCT_POLICY | 1111 | 10 | `MokXya_MAI07_V3_PRODUCT_POLICY_ROUND_A_AI_ASSISTED_DRAFTS.zip` |
| NEPALI_FLUENT_A | 1111 | 10 | `MokXya_MAI07_V3_NEPALI_FLUENT_A_ROUND_A_AI_ASSISTED_DRAFTS.zip` |
| PROFESSIONAL_LINGUIST_B | 1111 | 10 | `MokXya_MAI07_V3_PROFESSIONAL_LINGUIST_B_ROUND_A_AI_ASSISTED_DRAFTS.zip` |

**Total:** 3333 drafted rows · 30 workbooks  

**Semantic hash (decision payload):** `fd10bd0f501d9a25534db18e98254c3e1dec1cbc4acc971f76c42012279a929a`  
**Summary:** `role_drafts/REMAINING_ROLE_DRAFTS_SUMMARY.json`

Per-role disposition (identical across roles; content-aligned):

- ENGLISH_IDENTITY_REQUIRED 244  
- DEVANAGARI_TRANSLITERATION_REQUIRED 324  
- IDENTITY_FIRST_REVIEW_REQUIRED 218  
- PROTECTED 150  
- ACRONYM_OR_IDENTIFIER 72  
- TRANSLITERATION_OPTIONAL 44  
- ABSTAIN_CANNOT_DECIDE 43  
- CONTEXT_DEPENDENT 16  

Sources: ACCOUNTING_VERIFIED_CONTENT_MAP 611 · HEURISTIC_V1 500

## Importer / generator

`erp_bot/src/oip/modules/language_runtime/transliteration/application/draft_mai07_r3j_ai_assisted_remaining_roles.py`

## Governance

- Official inbox empty of drafts; `ROUND_A_LOCKED=false`; `ROUND_B_READY=false`
- Runtime unchanged (`mai-07.1.3-r3f-sealnew`)
- Does **not** close GAP-P1-016 / GAP-P1-012
- Next human step for AI-assisted path: user review/accept drafts (as done for ACCOUNTING_DOMAIN), then a separate verified import phase if authorized
- Independent blinded review path remains the authority for V3 freeze

## ADR

Extends ADR_0011 (AI-assisted vs independent evidence). Drafts are a weaker tier than `AI_ASSISTED_HUMAN_VERIFIED`.
