# KB Operations Runbook

1. Place/keep ZIPs under `Knowledge source/`
2. `python knowledgebase/scripts/phase0_discover.py`
3. `python knowledgebase/scripts/validate_kb_package.py`
4. `python knowledgebase/scripts/parse_kb_to_jsonl.py`
5. `python knowledgebase/scripts/analyze_kb_quality.py`
6. `python knowledgebase/scripts/build_human_review_sample.py`
7. `python knowledgebase/scripts/build_retrieval_indexes.py`
8. Optional: `python knowledgebase/scripts/build_semantic_index.py`
9. Enable runtime with `ORBIX_NP_KB_ENABLED=true` (dev only until human review)
10. Disable anytime with `ORBIX_NP_KB_ENABLED=false`
