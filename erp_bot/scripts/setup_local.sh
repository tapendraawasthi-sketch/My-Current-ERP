#!/usr/bin/env bash
# One-shot local setup: Ollama + qwen2.5:7b-instruct base + ekhata-ca:7b wrapper
# + Nepali grammar / IFRS ingestion + erp_bot service.
#
# Run this on your own PC/Mac/Linux machine (or later, on a VPS) — NOT on Render.
# Requires: ~8GB free RAM, ~10GB free disk, macOS or Linux (use WSL2 on Windows).
#
# Usage:
#   cd erp_bot
#   bash scripts/setup_local.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ERP_BOT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=================================================="
echo " e-khata local AI brain — one-shot setup"
echo "=================================================="

# --- 1. Install Ollama if missing --------------------------------------
if ! command -v ollama >/dev/null 2>&1; then
  echo "==> Ollama not found."
  if [[ "$(uname)" == "Darwin" ]]; then
    echo "    On macOS, install from https://ollama.com/download then re-run this script."
    exit 1
  else
    echo "    Installing Ollama 0.5.7 (Linux, CPU-stable pin)..."
    bash "$SCRIPT_DIR/setup_ollama.sh"
  fi
else
  echo "==> Ollama already installed: $(ollama --version 2>&1 | tail -1)"
fi

# --- 2. Start Ollama server if not already running ----------------------
if ! curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "==> Starting 'ollama serve' in the background..."
  nohup ollama serve > /tmp/ollama.log 2>&1 &
  sleep 3
else
  echo "==> Ollama server already running."
fi

# --- 3. Pull required models ---------------------------------------------
echo "==> Pulling embedding model (nomic-embed-text)..."
ollama pull nomic-embed-text

echo "==> Pulling base chat model (qwen2.5:7b-instruct) — this is several GB, be patient..."
ollama pull qwen2.5:7b-instruct

echo "==> Creating ekhata-ca:7b (CA/Nepali system-prompt wrapper, no GPU needed)..."
bash "$ERP_BOT_ROOT/training/create_base_model.sh" ekhata-ca:7b qwen2.5:7b-instruct

# --- 4. Python environment -------------------------------------------------
cd "$ERP_BOT_ROOT"
if [[ ! -d .venv ]]; then
  echo "==> Creating Python virtualenv..."
  python3 -m venv .venv
fi
source .venv/bin/activate
echo "==> Installing Python dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "==> Created erp_bot/.env from .env.example"
fi

# --- 5. Ingest the Nepali grammar + IFRS corpora already in the repo ------
echo "==> Ingesting Nepali grammar corpus (BM25 index)..."
python scripts/ingest_nepali_grammar.py

echo "==> Ingesting IFRS conceptual framework into ChromaDB (uses nomic-embed-text)..."
python scripts/ingest_ca_knowledge.py

# --- 6. Start the erp_bot API service --------------------------------------
echo "=================================================="
echo " Setup complete."
echo ""
echo " Next steps:"
echo "  1. In THIS terminal, start the service:"
echo "       cd erp_bot && source .venv/bin/activate && python scripts/start.py"
echo "  2. In your frontend repo root, create/edit .env.local:"
echo "       VITE_ERP_BOT_URL=http://localhost:8765"
echo "  3. Restart the frontend dev server (npm run dev)."
echo "  4. Open e-khata and chat — it should now say the LLM brain is online,"
echo "     not 'Built-in CA Brain'."
echo "=================================================="
