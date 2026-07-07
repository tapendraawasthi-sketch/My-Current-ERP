#!/usr/bin/env python3
"""Single entry point for the ERP AI chatbot."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

import httpx

import src.config  # noqa: F401 — prints resolved ERP_PATH on import
from src.config import API_PORT, EMBED_MODEL, FAST_MODEL, MODEL_NAME, OLLAMA_BASE_URL

print(f"[START] PRIMARY_MODEL={MODEL_NAME}, FAST_MODEL={FAST_MODEL}, EMBED_MODEL={EMBED_MODEL}")

try:
    resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
    resp.raise_for_status()
    data = resp.json()
    models = [m.get("name", "") for m in data.get("models", [])]
    print(f"[START] Ollama models available: {models}")
    if MODEL_NAME not in models:
        print(f"[WARN] MODEL_NAME '{MODEL_NAME}' not found in Ollama — pull it with: ollama pull {MODEL_NAME}")
    if FAST_MODEL not in models:
        print(f"[WARN] FAST_MODEL '{FAST_MODEL}' not found in Ollama — pull it with: ollama pull {FAST_MODEL}")
    if EMBED_MODEL not in models:
        print(f"[WARN] EMBED_MODEL '{EMBED_MODEL}' not found in Ollama — pull it with: ollama pull {EMBED_MODEL}")
    # Verify chat inference works (newer Ollama builds can segfault on some CPUs)
    try:
        chat_test = httpx.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": MODEL_NAME, "prompt": "ok", "stream": False},
            timeout=60,
        )
        chat_test.raise_for_status()
        print("[START] Ollama chat inference: OK")
    except Exception as e:
        print(f"[FATAL] Ollama chat model '{MODEL_NAME}' cannot generate: {e}")
        print("[HINT] If you see 'segmentation fault', install Ollama 0.5.7:")
        print("  bash erp_bot/scripts/setup_ollama.sh")
        sys.exit(1)
except Exception:
    print(f"[FATAL] Cannot reach Ollama at {OLLAMA_BASE_URL} — is `ollama serve` running?")
    sys.exit(1)

from src.vectorstore import chroma_store

count = chroma_store.get_indexed_file_count()
if count == 0:
    print("[INFO] No index found — running initial full scan (this can take a few minutes)...")
    from src.ingestion import embedder

    result = embedder.ingest_all()
    print(
        f"[INFO] Initial scan complete: {result['indexed']}/{result['total_files']} "
        f"files indexed, {len(result['errors'])} errors"
    )
else:
    print(
        f"[INFO] Existing index found: {count} files already indexed. "
        "Starting without a full rescan — the file watcher will pick up changes "
        "from here, or call POST /reindex to force a full rebuild."
    )

import uvicorn
from src.api.server import app

uvicorn.run(app, host="0.0.0.0", port=API_PORT)
