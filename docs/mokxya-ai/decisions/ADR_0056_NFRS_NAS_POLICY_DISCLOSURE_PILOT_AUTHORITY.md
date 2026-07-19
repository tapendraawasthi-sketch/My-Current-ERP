# ADR_0056 — NFRS/NAS Policy, Mapping, and Disclosure Pilot Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-39-NFRS-NAS-POLICY-MAPPING-DISCLOSURE-PILOT (slice 2)
- **Extends:** ADR_0001, ADR_0053, ADR_0047

## Context

MAI-37/38 cover IT/VAT/TDS tax pilot and calculator/rule candidates. NFRS/NAS
policy, mapping, and disclosure need a separate narrow pilot. GAP-P2-008 and
unproven effective dates remain open. MAI-37 treats NFRS as unsupported for
tax pilot — MAI-39 is the correct home.

## Decision

1. MAI-39 owns `NfrsNasPolicyDisclosurePilotBundleV1` on
   `CanonicalAIRequestV1` after TAX_CALCULATOR_RULE_INTEGRATION.
2. Semantic gate: MAI-36 research COMPLETE + active + readiness in
   `{POLICY_DECLARED, CLARIFY_REQUIRED}` — **not** MAI-37 tax-pilot readiness.
3. Slice 1: declare `pilot_scope=NFRS_NAS_DISCLOSURE_ONLY`,
   `mapping_status=CANDIDATE_MAPPINGS_ONLY`,
   `disclosure_status=NOT_FILED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `standards_authority_claimed=false`,
   `mapping_executed=false`,
   `disclosure_filed=false`,
   `filing_ready=false`,
   `legal_effective_dates_proven=false`,
   `gap_p2_008_status=OPEN`.
4. Never invent NFRS/NAS authority or expand to all Nepal law/IFRS.
5. Slice 2: consume builds `nfrs_nas_candidate` / `nfrs_nas_consume_mode`
   (`CANDIDATE_ONLY` default for POLICY_DECLARED / SCOPE_PARTIAL; `BLOCKED`
   for fake authority; `SKIP` for non-pilot). Live path forces
   `allow_mapping_execute=false` and `allow_disclosure_file=false` — does
   **not** execute mapping, file disclosures, or claim standards authority.
   GAP-P2-008 stays OPEN.
6. Engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-37 tax pilot | Tax pilot blocks NFRS as unsupported |
| Authoritative mapping in slice 1–2 | Honesty / specialist review required |
| Live disclosure file in slice 2 | Not an execution authority |
| File disclosures | Not an execution authority |
| Close GAP-P2-008 | Honesty review still required |
| Prove effective dates | Must stay false |

## Related

- `docs/mokxya-ai/MAI_39_NFRS_NAS_POLICY_MAPPING_DISCLOSURE_PILOT.md`
- `docs/mokxya-ai/baselines/MAI_39_SLICE2_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/nfrs_nas_policy_disclosure_pilot_service.py`
- `erp_bot/src/oip/modules/conversation/application/nfrs_nas_policy_disclosure_pilot_consume_service.py`
