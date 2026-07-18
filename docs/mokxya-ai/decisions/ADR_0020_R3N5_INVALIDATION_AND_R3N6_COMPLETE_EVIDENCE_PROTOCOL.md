# ADR 0020: R3N5 Invalidation and R3N6 Complete-Evidence Protocol

- **Status:** Accepted before R3N6 lock
- **Date:** 2026-07-18
- **Phase:** MAI-07R3N5-INTEGRITY / MAI-07R3N6

## Context

R3N5 produced numerically consistent results, but its release authority is
invalid. The outcome-affecting `split_expected_pass` metric was emitted only by
the canonical scoring path and explicitly excluded from canonical/audit
comparison, contrary to ADR 0019. In addition, the attempt-time chain bound only
the primary holdout prediction file; qualification, six score reports, and five
support prediction files were not hash-bound.

The append-only R3N5 invalidation preserves every historical byte and records
that the numerical replay is consistent. It cannot retroactively supply the
missing pre-lock independent scoring or attempt-time output commitments.

## Decision

R3N5 verdict authority is withdrawn as
`INVALIDATED_INCOMPLETE_INDEPENDENT_SCORING_AND_OUTPUT_BINDING_NEW_RC_REQUIRED`.
R3N5 must not be repaired or rerun in place.

R3N6 must satisfy all of the following before it can earn a scoped corrective
engineering RC:

1. Use a new runtime, policy, pack, RC, and attempt identity.
2. Use a genuinely fresh corpus with zero R3N5 overlap for case ID, input text,
   target source-text hash, and template family. R3N5 prediction JSONL and score
   reports are prohibited inputs to R3N6 dataset or candidate design. Build the
   development and holdout corpora from separately seeded target pools and
   context templates, with zero development/holdout target-surface,
   target-behavior-pair, input, template-family, or context-template overlap.
   Lock only byte-exact deterministic builder output and its exact manifest.
3. Preserve immutable raw Unicode code-point target-span authority.
4. Compute `split_expected_pass` separately in canonical and audit scorers.
5. Compare every metric and gate with no ignored metric, including key sets,
   population, applicability, numerator, denominator, value, threshold,
   operation, scorer version, formula version, and scoring-contract version.
6. Compare per-case populations and expected behavior as well as observation
   outcomes. Reject unknown expected behaviors and source-lock the complete
   threshold-gate, report-metric, and report-gate key sets. Persist both
   canonical and audit observations with an exact case-ID bijection.
7. Write the immutable attempt-intent record with atomic create-new semantics
   before any holdout scoring begins. The intent is the consumed-attempt claim;
   a partial or crashed attempt cannot be reclaimed or rerun.
8. Bind all 15 verdict-bearing outputs at attempt time: intent, attempt result,
   qualification, six score reports, and six prediction JSONL files.
9. Make the final chain verify raw and semantic output hashes, report/prediction
   projections, qualification metrics, split results, scorer identity, lock
   and lock-record hashes, fixed IDs and paths, exact locked split counts and
   case IDs, unique artifact paths, and duplicate-attempt refusal. Verify the
   sealed candidate pack and every locked input before scoring, after each
   split, and before publication while executing from one verified resource
   snapshot. The one-shot session must parse hash-checked dataset/threshold
   bytes into memory and load resources from a hash-checked temporary copy of
   the sealed pack; no caller-supplied resource object is accepted. Persist the
   complete validated runtime-bundle projection and case input/target hashes
   with every observation. Recompute both observations from that bundle, then
   recompute both scorer reports and both agreement objects from the locked
   cases and thresholds; exact equality is required before the chain may carry
   authority.
10. Preserve a valid chain for either a passing or failed-quality numerical
    verdict; evidence integrity must not depend on passing quality.
11. Treat attempt and qualification records as provisional numerical evidence.
    They must state that engineering authority is pending complete chain
    binding. The final verified chain is the sole engineering-verdict authority.
12. Authenticate the append-only R3N5 invalidation by its fixed raw and semantic
    hashes and exact subject RC, attempt, and lock bindings.

## Consequences

- R3N6 is an evidence-authority correction, not a lexicon or ranking change.
- R3N5 remains historical numerical evidence only and is ineligible for release,
  freeze, promotion, or parent-phase completion.
- A passing R3N6 engineering RC still does not set `QUALITY_GATES_PASSED`,
  `LINGUIST_APPROVED`, or `PRODUCTION_APPROVED`.
- The active runtime remains `mai-07.1.3-r3f-sealnew`, the overlay remains false,
  MAI-07 remains open, and MAI-08 remains `NOT_STARTED`.
