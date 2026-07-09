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
        # Warm fast router model so first Orbix message is not cold
        fast_test = httpx.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": FAST_MODEL, "prompt": "ok", "stream": False, "keep_alive": "10m"},
            timeout=60,
        )
        fast_test.raise_for_status()
        print(f"[START] Fast model warmed: {FAST_MODEL}")
        # Warm 32b conversational model (reduces first-token latency on tax queries)
        main_test = httpx.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": MODEL_NAME, "prompt": "ok", "stream": False, "keep_alive": "30m"},
            timeout=120,
        )
        main_test.raise_for_status()
        print(f"[START] Main model warmed: {MODEL_NAME}")
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

from src.vectorstore.nepali_grammar_store import get_nepali_grammar_count, ingest_nepali_grammar
from src.vectorstore.ca_knowledge_store import get_ca_knowledge_count, ingest_ca_knowledge
from src.vectorstore.nav_index_store import get_nav_index_count, ingest_nav_index

ng_count = get_nepali_grammar_count()
if ng_count == 0:
    print("[INFO] Nepali grammar Chroma collection empty — ingesting...")
    result = ingest_nepali_grammar()
    print(f"[INFO] Nepali grammar ingest: {result}")
else:
    print(f"[INFO] Nepali grammar index: {ng_count} chunks")

ca_count = get_ca_knowledge_count()
if ca_count == 0:
    print("[INFO] CA/IFRS knowledge Chroma collection empty — ingesting...")
    result = ingest_ca_knowledge()
    print(f"[INFO] CA knowledge ingest: {result}")
else:
    print(f"[INFO] CA/IFRS knowledge index: {ca_count} chunks")

nav_count = get_nav_index_count()
if nav_count == 0:
    print("[INFO] Nav index collection empty — ingesting UI routes/pages...")
    result = ingest_nav_index()
    print(f"[INFO] Nav index ingest: {result}")
else:
    print(f"[INFO] Nav index: {nav_count} chunks")

# ── Orbix v2 — initialize reasoning agent (memory DB, tools, engine) ─────────
try:
    import asyncio

    from src.orbix.bootstrap import get_engine
    from src.orbix.config import get_config as get_orbix_config

    _oc = get_orbix_config()
    print(
        f"[START] Orbix v2: agent={_oc.agent_model} verifier={_oc.verifier_model} "
        f"router={_oc.router_model} embed={_oc.embed_model}"
    )
    _engine = asyncio.run(get_engine())
    print(
        f"[START] Orbix engine ready — {len(_engine.tools.list_specs())} tools, "
        f"memory at {_oc.memory_db_path}"
    )
except Exception as _orbix_exc:
    print(f"[START] Orbix v2 init skipped: {_orbix_exc}")

import uvicorn
from src.api.server import app

uvicorn.run(app, host="0.0.0.0", port=API_PORT)
