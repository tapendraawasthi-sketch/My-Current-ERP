# ADR_0018 — R3N4 Identity Anchor and Path Finalization

## Status

Accepted for engineering lineage. Release candidate **failed** fresh holdout (`FAILED_HOLDOUT_QUALITY`). Candidate **not promoted**.

## Context

R3N3 reserved-identity finalization still failed holdout identity/idempotence gates (aggregate deficit ≈12). Source analysis showed identity could be inferred from candidates and some output routes bypassed the finalizer. R3N4 introduces immutable raw-slice anchors and path-complete finalization on a new candidate version with a fresh holdout.

## Decision

1. New candidate `mai-07.1.9-r3n4-identityanchor` / policy `mai-07-r3n4.1.0.0` (parent = failed R3N3).
2. `IdentityAnchorV1` created from raw code-point offsets before transforms.
3. `finalize_candidates_r3n4` builds identity only from the anchor.
4. `apply_r3n4_finalize_bundle` is the single authoritative finalization boundary for all R3N4 span outputs.
5. Active R3F sealnew construction unchanged; overlay disabled; `default_active=false`.
6. One sealed lock, one holdout attempt; no RC_002 after failure.

## Consequences

- Holdout Attempt 001 consumed with `FAILED_HOLDOUT_QUALITY` (identity/path deficits = 23 cases aggregate).
- IDENTITY_ANCHOR_CHALLENGE and most supporting splits passed; DEVELOPMENT passed before lock.
- Next phase: separately versioned **MAI-07R3N5** with another fresh holdout.
- MAI-07 remains `NEEDS_CORRECTIVE_WORK`; MAI-08 remains `NOT_STARTED`.

## References

- `docs/mokxya-ai/MAI_07_R3N4_IDENTITY_ANCHOR_CORRECTIVE_REPORT.md`
- `docs/mokxya-ai/R3N4_IDENTITY_ANCHOR_POLICY.md`
- `docs/mokxya-ai/R3N4_FINALIZATION_PATH_AUTHORITY.md`
- `evals/mai07_r3n4_fresh_holdout/`
