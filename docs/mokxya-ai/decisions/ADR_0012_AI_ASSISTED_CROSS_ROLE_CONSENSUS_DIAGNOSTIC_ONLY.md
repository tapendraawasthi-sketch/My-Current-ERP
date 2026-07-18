# ADR_0012 — Cross-role AI consensus is diagnostic only (never gold)

- **Status:** Accepted (2026-07-17)
- **Phase:** MAI-07R3K-AI-ASSISTED-CROSS-ROLE-CONSENSUS-DIAGNOSTIC
- **Extends:** ADR_0011

## Context

Four AI-assisted role streams (including ACCOUNTING_DOMAIN and an AI simulation of PROFESSIONAL_LINGUIST_B) now exist as engineering evidence. Cross-role agreement is attractive as a “consensus” signal, but the remaining-role drafts reused accounting labels and a shared heuristic, so agreement is not independent.

## Decision

1. Cross-role consolidation may run as **`PASSED_ENGINEERING_DIAGNOSTIC`** only.
2. Majority / unanimous AI dispositions are **never gold** (`majority_as_gold=false`).
3. Agreement metrics must be labeled as **non-independent AI-output similarity**, not human IRR.
4. Targeted follow-up packets derived from the risk queue are **not** official Round A and must not enter `round_a_inbox`.
5. Private AI/role mappings stay adjudication-import-only and must not appear in reviewer-facing workbooks.
6. No change to `QUALITY_GATES_PASSED`, linguist/production approval, Round A/B locks, frozen V3 authorization, runtime packs, or MAI-08.

## Consequences

- Diagnostics and risk queues may guide optional human sampling.
- Independent V3 freeze still requires genuine independent human review (GAP-P1-016) and professional linguist evidence (GAP-P1-012).

## Closure note (MAI-07R3K-CLOSURE, 2026-07-17)

A conversational abbreviation mixed accounting **semantic** prefix `b96bec29` with accounting **ZIP raw** suffix `1cdb68`. Classification: **REPORT_ONLY**. Canonical R3K machine artifacts and semantic hash `42d1a5ff…0ddafc` were already correct and are preserved. Authority: `R3K_INPUT_AUTHORITY_MANIFEST.json`. Recurrence prevented via typed hash-contract helpers. Verdict: `PASSED_CLOSURE`. Does not upgrade R3K to quality evidence.

## Related

- ADR_0011
- `docs/mokxya-ai/MAI_07_R3K_AI_ASSISTED_CROSS_ROLE_CONSENSUS_DIAGNOSTIC_REPORT.md`
- `docs/mokxya-ai/MAI_07_R3K_HASH_CONTRACT_CLOSURE_REPORT.md`
