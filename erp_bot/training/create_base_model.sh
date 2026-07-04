#!/usr/bin/env bash
# Create ekhata-ca:7b from base instruct + CA system prompt (no GPU fine-tune required)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAG="${1:-ekhata-ca:7b}"
BASE="${2:-qwen2.5:7b-instruct}"

echo "==> Pulling $BASE ..."
ollama pull "$BASE"

echo "==> Generating Modelfile..."
python3 "$SCRIPT_DIR/generate_modelfile.py" --base "$BASE" --output "$SCRIPT_DIR/Modelfile.generated"

echo "==> Creating $TAG ..."
ollama create "$TAG" -f "$SCRIPT_DIR/Modelfile.generated"

echo "Done. Update erp_bot/.env: MODEL_NAME=$TAG"
