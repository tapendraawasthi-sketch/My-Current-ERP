#!/usr/bin/env bash
# Promote user feedback into LoRA dataset, then optionally train (requires GPU + llama-factory).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "== Promote user feedback =="
python3 erp_bot/scripts/promote_user_feedback.py "$@"

echo ""
echo "== LoRA dataset line count =="
wc -l data/ekhata/lora-instruction-dataset.jsonl 2>/dev/null || echo "(no dataset yet)"

if [[ "${RUN_LORA_TRAIN:-0}" == "1" ]]; then
  echo "== Training (RUN_LORA_TRAIN=1) =="
  bash erp_bot/training/train_ekhata_lora.sh
else
  echo ""
  echo "Feedback merged. To train: RUN_LORA_TRAIN=1 bash erp_bot/training/prepare_feedback_lora.sh"
  echo "Or: bash erp_bot/training/train_ekhata_lora.sh"
fi
