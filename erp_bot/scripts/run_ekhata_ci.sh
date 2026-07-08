#!/usr/bin/env bash
# e-Khata CI test bundle — offline, no Ollama required.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "== Health check =="
python3 erp_bot/scripts/health_check.py --full

TESTS=(
  test_erp_action_policy
  test_clarification_planner
  test_sector_retrieval_boost
  test_sector_nlu_holdout
  test_hybrid_nlu_search
  test_nearest_neighbor_intent
  test_vocabulary_loader
  test_sector_journal_templates
  test_journal_verifier_chain
  test_compound_splitter
  test_wsd_expansion
  test_feedback_promoter
  test_ts_python_parity
  test_production_smoke
)

for t in "${TESTS[@]}"; do
  echo ""
  echo "== ${t} =="
  python3 "erp_bot/scripts/${t}.py"
done

echo ""
echo "== Sector holdout enrich eval =="
python3 erp_bot/scripts/eval_sector_nlu_holdout.py --tier enrich --compare-baseline

echo ""
echo "e-Khata Python CI: all passed"
