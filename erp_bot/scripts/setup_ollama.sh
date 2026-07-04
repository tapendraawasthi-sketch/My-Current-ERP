#!/usr/bin/env bash
# Install Ollama 0.5.7 — stable on CPU-only VMs where newer builds segfault.
set -euo pipefail

OLLAMA_VERSION="0.5.7"
INSTALL_DIR="/usr/local"
TMP="/tmp/ollama-${OLLAMA_VERSION}"

echo "[setup_ollama] Installing Ollama ${OLLAMA_VERSION}..."

mkdir -p "$TMP"
curl -fsSL "https://github.com/ollama/ollama/releases/download/v${OLLAMA_VERSION}/ollama-linux-amd64.tgz" \
  -o "$TMP/ollama.tgz"
tar -xzf "$TMP/ollama.tgz" -C "$TMP"

sudo cp "$TMP/bin/ollama" "${INSTALL_DIR}/bin/ollama"
sudo chmod +x "${INSTALL_DIR}/bin/ollama"
sudo rm -rf "${INSTALL_DIR}/lib/ollama"
sudo cp -r "$TMP/lib/ollama" "${INSTALL_DIR}/lib/ollama"

echo "[setup_ollama] Installed: $(ollama --version 2>&1 | tail -1)"
echo "[setup_ollama] Start with: ollama serve"
echo "[setup_ollama] Then pull models:"
echo "  ollama pull nomic-embed-text"
echo "  ollama pull qwen2.5-coder:7b"
