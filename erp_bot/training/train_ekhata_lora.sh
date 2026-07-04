#!/usr/bin/env bash
# e-Khata LoRA training launcher
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> Generating training corpus..."
npm run generate:ekhata-corpus

echo "==> Copying dataset_info for LLaMA-Factory..."
cp erp_bot/training/dataset_info.yaml data/ekhata/dataset_info.yaml

echo "==> Starting LoRA training (requires GPU + llamafactory-cli)..."
cd erp_bot/training

if command -v llamafactory-cli &>/dev/null; then
  llamafactory-cli train lora_config.yaml
else
  echo "llamafactory-cli not found. Install: pip install llama-factory"
  echo "Corpus ready at data/ekhata/lora-instruction-dataset.jsonl"
  exit 0
fi

echo "==> Done. Merge adapter: llamafactory-cli export merge_config.yaml"
