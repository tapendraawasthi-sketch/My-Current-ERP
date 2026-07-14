#!/usr/bin/env bash
# Render production build for erp_bot (OIP Provider Runtime — no Ollama/GPU).
set -euo pipefail

echo "[erp_bot render-build] installing Python dependencies..."
pip install -r requirements.txt

echo "[erp_bot render-build] preparing data directories..."
mkdir -p data/oip data/chroma_db data/orbix

# Bundle ONLI Nepali Language KB indexes for Ask Orbix prompt grounding.
# Prefer compact kb_grounding.sqlite (git-tracked); fall back to full lexical if present.
if [ -d "../knowledgebase/indexes/lexical" ]; then
  echo "[erp_bot render-build] bundling NP Language KB indexes..."
  mkdir -p knowledgebase/indexes/lexical
  if [ -f "../knowledgebase/indexes/lexical/kb_grounding.sqlite" ]; then
    cp -f ../knowledgebase/indexes/lexical/kb_grounding.sqlite knowledgebase/indexes/lexical/
    echo "[erp_bot render-build] NP KB grounding index ready"
  elif [ -f "../knowledgebase/indexes/lexical/kb_lexical.sqlite" ]; then
    cp -f ../knowledgebase/indexes/lexical/kb_lexical.sqlite knowledgebase/indexes/lexical/
    echo "[erp_bot render-build] WARNING: using full lexical index (large)"
  else
    echo "[erp_bot render-build] WARNING: no lexical/grounding sqlite found"
  fi
  if [ -d "../knowledgebase/indexes/metadata" ]; then
    mkdir -p knowledgebase/indexes/metadata
    cp -a ../knowledgebase/indexes/metadata/. knowledgebase/indexes/metadata/ 2>/dev/null || true
  fi
else
  echo "[erp_bot render-build] WARNING: ../knowledgebase/indexes/lexical missing — NP KB grounding will be empty"
fi

echo "[erp_bot render-build] done"
