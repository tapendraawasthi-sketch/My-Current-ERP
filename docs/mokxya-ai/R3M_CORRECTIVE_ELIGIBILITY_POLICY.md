# R3M Corrective Eligibility Policy

## CODE_CORRECTIVE_CANDIDATE

Requires all of:

- actual conformance failure (not risk-only PASS);
- valid span resolution;
- expected behavior does not depend on missing exact Devanagari target spelling;
- evidence not merely low-confidence/ambiguous heuristic;
- saved observations identify a plausible runtime stage;
- proposed correction testable without weakening identity/protected/cap invariants.

R3M **does not implement** corrections.

## RESOURCE_CORRECTIVE_CANDIDATE

Only when an independent governed resource fact already exists — never invent targets; never mine frozen datasets. R3M produced **zero** resource candidates.

## NON_FROZEN_TEST_CANDIDATE

Property/regression candidates from heuristic or partial evidence — not production rules.

## Review / blocked

Uncertainty → TARGETED_HUMAN_REVIEW / PROFESSIONAL_LINGUIST / POLICY_CLARIFICATION / BLOCKED_MISSING_EVIDENCE.

## Risk-only

PASS residuals retained only for provenance/confidence/ambiguity → NO_CORRECTIVE_ACTION_RISK_ONLY (do not inflate defect counts).
