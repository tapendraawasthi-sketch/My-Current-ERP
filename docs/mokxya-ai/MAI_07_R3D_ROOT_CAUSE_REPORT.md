# MAI-07R3D — Sanitized Root-Cause Classification

**Authority:** Aggregate R3C failure classes + code inspection + non-frozen probes.  
**Firewall:** No frozen V2 case IDs, sentences, candidate surfaces, or review IDs.

## R3C aggregate failure classes (inputs only)

| Class | Aggregate signal |
| --- | --- |
| CORE_RECALL@5 | 263/272 (need ≥267) |
| English identity top-1 | 98/102 (need ≥100) |
| False Devanagari on English | 4/102 (need ≤2) |
| Protected-span mutations | 6 (need 0) |

## Classification (sanitized)

1. **Protected-span boundary / eligibility error**  
   Overlapping or partially covered MAI-05 protected ranges could still enter GENERATE, and GENERATE-path results were serialized with `is_protected=False`. Hypothesis previews could rewrite protected surfaces.  
   **Lane:** Hard gate pre-generation + pre-serialize (reuse MAI-05 ranges only).

2. **English-form false positive / ranking disposition error**  
   ENGLISH language-form alone boosted identity broadly *and* allowed GENERATE when lexicon hit, including confirmed `english_identity` members → false Devanagari-first.  
   **Lane:** Multi-signal English identity (`english_identity` resource / acronym); IDENTITY_ONLY for confirmed English; do not treat MAI-05 ENGLISH as absolute.

3. **Romanized-form false negative (under ENGLISH form)**  
   MAI-05 classifies many Romanized/morphology tokens as ENGLISH. Identity boost from form alone suppressed valid Devanagari despite lexicon/morph evidence.  
   **Lane:** Strong Romanized evidence disables prefer_identity; morph-stem eligibility; lexical/morph boost.

4. **Name-like handling**  
   Proper-name identity demotion risk when Devanagari optional candidates outrank.  
   **Lane:** Stronger name identity boost + Dev review penalty.

5. **Candidate-generation miss / spelling variants**  
   Aspiration/spelling probes may lack lexicon entries; not treated as gold targets in R3D corrective sets.

6. **Candidate-cap displacement**  
   Ranker already dedupes by surface before cap; identity retention enforced. No cap increase.

7. **Scorer/evaluation error**  
   Not indicated for R3C aggregates; R3D uses dual scorers on non-frozen holdout only.

## Not assumed

- Broad ranker rewrite  
- R1/R2 overlay re-enable  
- Frozen V2 case mining  
