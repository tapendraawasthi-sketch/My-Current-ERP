# ADR_0013 — Policy conformance is not language quality

- **Status:** Accepted (2026-07-17)
- **Phase:** MAI-07R3L-AI-ASSISTED-RUNTIME-CONFORMANCE-DIAGNOSTIC
- **Extends:** ADR_0011, ADR_0012

## Context

AI-assisted user-accepted dispositions provide behavioral policy references, but they are not independent human IRR and do not include exact Devanagari target spellings. Running the active runtime against these cases can measure **policy/behavior conformance**, which is easily mistaken for transliteration quality.

## Decision

1. R3L may run as `PASSED_ENGINEERING_DIAGNOSTIC` only.
2. `runtime_conformance_is_language_quality=false` is mandatory.
3. Devanagari metrics measure script/disposition presence only — never spelling accuracy.
4. OPTIONAL and CONTEXT_DEPENDENT have no unique top-1 gold.
5. Unknown dispositions fail closed as UNSUPPORTED.
6. Residual queues and targeted packets are engineering triage aids — not official Round A.
7. No change to quality gates, linguist/production approval, Round A/B locks, frozen V3, runtime packs, or MAI-08.

## Consequences

- Diagnostics may guide optional human triage of policy mismatches.
- Independent V3 freeze still requires GAP-P1-016 / GAP-P1-012 evidence.
- R3L pass rates must not be cited as quality-gate readiness.

## Related

- `docs/mokxya-ai/R3L_BEHAVIOR_EXPECTATION_POLICY.md`
- `docs/mokxya-ai/MAI_07_R3L_AI_ASSISTED_RUNTIME_CONFORMANCE_DIAGNOSTIC_REPORT.md`
