# KB Rollback Plan

Set `ORBIX_NP_KB_ENABLED=false` (default).
Do not delete raw files or indexes.
Orbix chat path continues with previous behavior; optional metadata reports disabled.
Test: `python knowledgebase/scripts/run_kb_evaluation.py` checks rollback_via_config.
