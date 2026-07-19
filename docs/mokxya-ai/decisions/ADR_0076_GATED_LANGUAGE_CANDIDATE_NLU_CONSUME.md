# ADR_0076 — Gated Language Candidate Consume into Primary NLU (NEXT-07)

- **Status:** Accepted (2026-07-19)
- **Step:** NEXT-07 (`MOKXYA_AI_WHAT_MUST_BE_DONE_NEXT_V1.txt`)
- **Extends:** MAI-09 / MAI-10 candidates; MAI-14/17 metadata consume pattern
- **Gap:** GAP-P1-009 remains **OPEN** (product multilingual quality / linguist path)

## Context

OIP ingress already produces LanguageFrame bundles (MAI-05…11) as annotation.
Planner/router soft-consume concepts, but `preprocess_erp_message` /
`handle_mode_aware_erp` still classify raw text only. NEXT-07 requires safe
candidates to affect primary intent/event extraction without silent master-data
bind or silent draft write.

## Decision

1. **Enable gated consume** of:
   - MAI-10 **concept → intent** (via existing `map_concepts_to_intent`) into
     `classify_operation` refinement on the mode-aware path
   - MAI-09 **number-role** preference when selecting money amounts
     (duration/ID/unknown must not win as first money)
2. **Forward** a slim `language_nlu_candidates` metadata object from
   `canonical_oip` → `module_stages` → `preprocess_erp_message` →
   `handle_mode_aware_erp`.
3. **Keep forbidden:**
   - transliteration top-1 applied as intent text
   - typo/code-mix rewrite of `raw_text`
   - silent party/item bind (MAI-08 floors unchanged)
   - silent draft write from lexicon/number roles alone
4. **Protected spans** remain skipped by candidate builders; consume must not
   set `applied=true` or `silent_applications!=0`.
5. **Ambiguous sales+purchase concepts** still abstain (no override).

## Rejected

| Alternative | Why |
|-------------|-----|
| Auto-apply transliteration/typo to raw_text | Violates MAI-07/08 / ADR_0007 |
| Claim GAP-P1-009 CLOSED | Needs NEXT-09 linguist/product-policy samples |
| Lower MAI-08 fuzzy floors | Increases silent master bind risk |

## Related

- `docs/mokxya-ai/MAI_NLU_LANGUAGE_CONSUME_REGISTRY.json`
- `erp_bot/.../nlu_language_consume_policy.py`
- `erp_bot/.../language_nlu_consume.py`
