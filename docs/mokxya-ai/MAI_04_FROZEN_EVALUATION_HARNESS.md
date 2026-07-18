# MAI-04 — Frozen Evaluation Harness and Baseline

## 1. Objective

Create a reproducible, leakage-resistant, mutation-safe evaluation system that honestly measures current MokXya AI behavior before language/context/routing/RAG/model improvements. Poor quality scores are expected and must be reported, not hidden.

## 2. Pre-edit evaluation inventory

| Asset | Role | MAI-04 authority? |
|-------|------|-------------------|
| `erp_bot/scripts/eval_khata_benchmark.py` | Legacy khata golden | No |
| `erp_bot/src/eval/` | Sector NLU holdout | No |
| `knowledgebase/scripts/run_kb_evaluation.py` | Retrieval/KB | No |
| `data/ekhata/**/eval`, `data/nepal-ai/eval` | Phrase/golden corpora | Reference only |
| `oip.modules.quality_gate` | Runtime action quality | No — not frozen AI suite |
| LLM judge | Not used as authority | N/A |

**Stop conditions:** none. No two systems claimed canonical frozen AI eval authority. Synthetic cases only.

## 3. Selected evaluation authority

`erp_bot/src/oip/evaluation/` + `evals/mai04/`  
Versions: runner/scorer `mai-04.1.0`, contracts schema `1.0.0`.

## 4. Contracts

`EvalCaseV1`, `EvalInputV1`, `ExpectedBehaviorV1`, `ProhibitedBehaviorV1`, `EvalManifestV1`, `EvalRunV1`, `EvalResultV1` (Pydantic v2). Schemas under `evals/schemas/`.

## 5. Dataset structure

See `evals/README.md` and `evals/mai04/`.

## 6. Frozen V1 coverage

Manifest: `evals/mai04/manifests/MAI_04_FROZEN_V1.manifest.json`  
**245** cases across critical, multilingual, number roles, accounting events, context/turn, safety, knowledge/no-answer, response-contract suites. All `prohibited_for_training=true`.

## 7. Case review / governance

See `EVALUATION_GOVERNANCE.md`. Engineering freeze labels; linguist/accounting/professional review marked where required. No false “professionally approved” without evidence.

## 8. Leakage prevention

Scenario-group/split validator; expected answers not in model_input; frozen hashes; run output cannot write `evals/mai04/frozen/`.

## 9. Runner modes

- `component` — deterministic heuristics + constitution policy
- `pipeline_in_process` — preprocess + constitution; default baseline; no network
- `live_shadow` — blocked unless provider available (CI default blocked)

## 10. Mutation safety

`EvaluationSafetyGuard` blocks post/confirm/OEC/Dexie/production URLs/tenants. Successful mutations in baseline: **0**.

## 11. Scorers

schema, classification (macro-F1/per-class/confusion), spans, number-roles, response-type, safety (zero-tolerance visibility), language (deterministic only), knowledge/evidence, latency (observational).

## 12. Aggregation

Status counts, suite prefixes, classification report, latency sample. Informational overall score is **non-authoritative**.

## 13. Human review

Rubric in `EVALUATION_GOVERNANCE.md`. LLM judge is not human/professional authority.

## 14. Reproducibility

Manifest/dataset hash, commit, dirty tree, seed, versions, semantic_hash (excludes run_id/timestamps). Component same-seed rerun matched.

## 15. CLI

```text
python -m src.oip.evaluation.cli validate --manifest evals/mai04/manifests/MAI_04_FROZEN_V1.manifest.json
python -m src.oip.evaluation.cli run --manifest … --mode component|pipeline_in_process --output …
python -m src.oip.evaluation.cli report --run … --format json,markdown
python -m src.oip.evaluation.cli compare --baseline … --candidate …
```

## 16. CI integration

Fast: validate + harness unit tests (no network). Full: pipeline_in_process baseline (manual/nightly). No Groq/Ollama required. Quality failures do not fail CI by default (`--fail-on-quality` opt-in).

## 17–18. Baseline execution / results

See `docs/mokxya-ai/baselines/MAI_04_BASELINE_SUMMARY.md` and `evals/mai04/baselines/current/`.

## 19. Critical failures

Recorded in results; `successful_mutations=0`. Product/quality criticals (number roles, policy expectation mismatches, weak intents) keep `production_approved=false`.

## 20. Gap mapping

Baseline-derived gaps added to `MAI_00_GAP_REGISTER.md` (GAP-P1-EVAL-* / related). GAP-P0-001 remains open.

## 21. Security / privacy

Synthetic eval scopes only; redaction-friendly outputs; no production credentials in reports.

## 22. Accounting impact

**None** — harness-only; no posting/sync/OEC changes.

## 23. Known limitations

Heuristic observers are weak by design; MAI-14+ context behavior fails honestly; naturalness requires human review; live_shadow blocked without provider.

## 24. Rollback

Remove `erp_bot/src/oip/evaluation/`, `evals/mai04/`, MAI-04 tests/docs/ledger entries. Do not `git reset --hard`.

## 25. Gate verdict

**PASSED** for harness + baseline recording. `QUALITY_GATE_PASSED=false`. `production_approved=false`.
