#!/usr/bin/env bash
# Export fine-tuned e-Khata model to Ollama as ekhata-ca:7b
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MERGED="$SCRIPT_DIR/outputs/ekhata-ca-merged"
MODEL_TAG="${EKHATA_OLLAMA_TAG:-ekhata-ca:7b}"
BASE_MODEL="${EKHATA_BASE_MODEL:-qwen2.5:7b-instruct}"

echo "==> e-Khata Ollama export"
echo "    Tag: $MODEL_TAG"

cd "$SCRIPT_DIR"

# Step 1: Merge LoRA if adapter exists
if [[ -d "./outputs/ekhata-ca-lora" ]]; then
  echo "==> Merging LoRA adapter..."
  if command -v llamafactory-cli &>/dev/null; then
    llamafactory-cli export merge_config.yaml
  else
    echo "WARN: llamafactory-cli not found — using base model only"
  fi
else
  echo "==> No LoRA adapter found at outputs/ekhata-ca-lora"
  echo "    Creating base e-Khata model from $BASE_MODEL"
fi

# Step 2: Ensure base model in Ollama
echo "==> Pulling base Ollama model: $BASE_MODEL"
ollama pull "$BASE_MODEL" || true

# Step 3: Generate Modelfile with CA system prompt
echo "==> Generating Modelfile..."
python3 "$SCRIPT_DIR/generate_modelfile.py" \
  --base "$BASE_MODEL" \
  --output "$SCRIPT_DIR/Modelfile.generated" \
  --merged-path "$MERGED"

# Step 4: Create Ollama model
echo "==> Creating Ollama model: $MODEL_TAG"
ollama create "$MODEL_TAG" -f "$SCRIPT_DIR/Modelfile.generated"

echo ""
echo "Done! Set in erp_bot/.env:"
echo "  MODEL_NAME=$MODEL_TAG"
echo ""
echo "Test:"
echo "  curl http://localhost:8765/khata/chat -X POST -H 'Content-Type: application/json' \\"
echo "    -d '{\"message\":\"what is sampati\",\"session_id\":\"test-1\"}'"
