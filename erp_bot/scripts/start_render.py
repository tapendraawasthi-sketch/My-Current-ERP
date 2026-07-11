#!/usr/bin/env python3
"""Render production entry — OIP chat via Provider Runtime (no Ollama ingest/warmup)."""

from __future__ import annotations

import sys
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

for subdir in ("data/oip", "data/chroma_db", "data/orbix"):
    (BOT_ROOT / subdir).mkdir(parents=True, exist_ok=True)

import src.config  # noqa: F401 — load env + print ERP_PATH
from src.api.oip_chat_ingress import provider_runtime_active
from src.config import API_PORT

if provider_runtime_active():
    print("[START] Render: Provider Runtime active — OIP chat ingress (Groq, no Ollama)")
else:
    print("[START] Render: WARNING — OIP Provider Runtime not active; check OIP_* env vars")

print(f"[START] Listening on 0.0.0.0:{API_PORT}")

import uvicorn
from src.api.server import app

uvicorn.run(app, host="0.0.0.0", port=API_PORT)
