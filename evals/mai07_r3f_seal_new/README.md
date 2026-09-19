# MAI-07R3F-SEAL-NEW fresh datasets (non-frozen)

- DEVELOPMENT: fixtures / equivalence only
- HOLDOUT_VALIDATION: locked before RC; opened **once** after RC lock
- SAFETY_CHALLENGE: protected / English / name probes
- CONTEXT_COUNTERFACTUAL: paired English vs Romanized vs ambiguous

Firewall: no frozen V2 bodies, no reuse of old R3F holdout as release evidence, no R3E predictions.
Gold labels are authored / resource-backed — never from runtime predictions.

Parent R3F RC remains `INVALIDATED_BY_SEAL_DRIFT`.
