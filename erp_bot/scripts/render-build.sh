#!/usr/bin/env bash
# Render production build for erp_bot (OIP Provider Runtime — no Ollama/GPU).
set -euo pipefail

echo "[erp_bot render-build] installing Python dependencies..."
pip install -r requirements.txt

echo "[erp_bot render-build] preparing data directories..."
mkdir -p data/oip data/chroma_db data/orbix

echo "[erp_bot render-build] done"
