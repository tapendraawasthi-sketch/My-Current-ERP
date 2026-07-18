# ADR_0005 — Frozen Evaluation Authority

## Status

Accepted (MAI-04)

## Context

MokXya had multiple non-aligned eval scripts (khata golden, sector holdout, KB retrieval, runtime quality_gate) but no canonical frozen multi-language accounting AI harness with leakage controls and mutation isolation.

## Decision

1. Canonical authority: `erp_bot/src/oip/evaluation/` + `evals/mai04/`.
2. Frozen V1 immutable after closure; corrections via V2/errata.
3. Deterministic scorers primary; informational aggregate never hides critical failures.
4. EvaluationSafetyGuard makes real posting/network/production scope impossible.
5. Human review rubric exists; LLM judge is not safety/professional authority (none enabled in CI).
6. Baseline vs gate: HARNESS_VALID + QUALITY_BASELINE_RECORDED required; QUALITY_GATE_PASSED deferred.
7. Contract schema version `1.0.0`; runner/scorer `mai-04.1.0`.

## Alternatives rejected

| Alternative | Why |
|-------------|-----|
| Extend khata benchmark script only | Missing multilingual/constitution/SSE contract scope |
| quality_gate as frozen suite | Runtime action module, not dataset harness |
| LLM-as-judge sole scorer | Non-deterministic; unsafe for safety/legal |
| Tuning product to pass frozen cases in MAI-04 | Contaminates baseline |

## Consequences

Honest low scores expected. Future MAI phases map to suite failures. `production_approved` remains false.

## Rollback

Remove evaluation package, evals/mai04 artifacts, MAI-04 docs/tests/ledger pointers. No DB migration.
