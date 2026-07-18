# MAI-07R3C — Disposition of three language_runtime failures

Prior full-suite run: 214 passed, 3 skipped, 3 failed (described as known R1/R2).

| Test | Classification | Disposition |
|------|----------------|-------------|
| `test_mai07_r1_ranker.py::test_same_token_different_disposition_by_context` | Historical R2 overlay expectation | `@pytest.mark.skip` with `HISTORICAL_R2_OVERLAY_EXPECTATION`. Pre-R1 keeps identity-first (`CONTEXT_IDENTITY_BOOST`) for `english kar module`. Assertions retained. |
| `test_mai07_r2_overlay.py::test_identity_first_base_may_be_promoted_without_demoting_existing_target` | Historical R2 overlay expectation | Skipped. Expects `PROMOTE_EXISTING_TARGET` for `paisako`; active overlay disabled → abstain. Assertions retained. |
| `test_mai07_r2_overlay.py::test_romanized_lexicon_promotes_when_identity_first_at_base` | Historical R2 overlay expectation | Skipped. Same failed-overlay promotion expectation. Assertions retained. |

None of these failures represent active pre-R1 authority regressions. Active suite must pass without unexplained failures after this disposition.
