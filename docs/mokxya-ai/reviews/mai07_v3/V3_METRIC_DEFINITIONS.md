# Proposed V3 Metric Definitions (thresholds not locked from candidates)

Metrics (same population for numerator and denominator; no max(1,den)):
- target top-1 / recall@5 / MRR
- target-generation recall
- retention conditional on generation
- identity top-1
- false Devanagari
- complete counterfactual-group accuracy
- unresolved-review accuracy
- protected/raw mutations
- candidate caps
- deterministic output
- naturalness/human preference agreement

Required empty populations → INVALID_REQUIRED_POPULATION.
Optional empty → NOT_APPLICABLE.
Integer gates locked before any model evaluation.
Independent scorer required.
Do not set thresholds from observed candidate results.
