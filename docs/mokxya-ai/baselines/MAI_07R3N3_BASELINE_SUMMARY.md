# MAI-07R3N3 Baseline Summary

- Phase: `MAI-07R3N3-FRESH-HOLDOUT-IDENTITY-INVARIANT-CORRECTIVE`
- Engineering verdict: **`FAILED_HOLDOUT_QUALITY`**
- Pack: `mai-07.1.8-r3n3-identityinv` (**not promoted**; active remains `mai-07.1.3-r3f-sealnew`)
- Policy: `mai-07-r3n3.1.0.0`
- Pack content sha256: `1268527c5c5d99e036628dc104340dafe297afadf9938a310a099a38f825c0e7`
- RC: `MAI_07R3N3_FRESH_HOLDOUT_RELEASE_CANDIDATE_001` (one attempt consumed; no RC_002)
- Lock semantic: `0aaefd824eec3b56a70f6846b29ecc603e9db85b3186e3264eee705f3d16c59b`
- Parent failed R3N2: `mai-07.1.7-r3n2-freshholdout` / `17061028…` (aggregates guided only)
- R3N integrity: `fccbbcfb…`
- Holdout failed: identity_retention 288/300; exact_raw_identity 288/300; exactly_one_identity 288/300; identity_invariant 238/250; cap_pressure 238/250; finalizer_idempotence 1188/1200
- Holdout passed: english 325/325; false-dev 0/325; romanized 200/200; acronym/identifier/protected/caps 100/100 or 250/250
- Monotonic failed only: finalizer_idempotence
- IDENTITY_CAP_PRESSURE_CHALLENGE split: passed
- Supporting splits (safety/cfx/oov): passed
- `PASSED_CORRECTIVE_RC` / `PASSED_FRESH_HOLDOUT_CORRECTIVE_RC`: **not earned**
- Frozen V2/V3 opened: **no**
- MAI-08 touched: **no**
- `MAI-07`: `NEEDS_CORRECTIVE_WORK` | `MAI-08`: `NOT_STARTED` | `candidate_promoted`: false
- Next: `MAI-07R3N4-FRESH-HOLDOUT-IDENTITY-INVARIANT-CORRECTIVE` (do not repair R3N3)

See `MAI_07_R3N3_FRESH_HOLDOUT_IDENTITY_CORRECTIVE_REPORT.md`.
