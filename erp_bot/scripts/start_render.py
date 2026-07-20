#!/usr/bin/env python3
"""Render / lean local entry — OIP chat via Provider Runtime (no Ollama ingest/warmup)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Skip file watcher + Chroma knowledge ingest (same as Render deploy)
os.environ.setdefault("RENDER", "true")

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

for subdir in ("data/oip", "data/chroma_db", "data/orbix"):
    (BOT_ROOT / subdir).mkdir(parents=True, exist_ok=True)

# Prefer bundled indexes under erp_bot/knowledgebase (Render rootDir).
_bundled_kb = BOT_ROOT / "knowledgebase"
if _bundled_kb.exists() and not os.environ.get("ORBIX_NP_KB_ROOT"):
    os.environ["ORBIX_NP_KB_ROOT"] = str(_bundled_kb)
os.environ.setdefault("ORBIX_NP_KB_ENABLED", "true")

import src.config  # noqa: F401 — load env + print ERP_PATH
from src.config import API_PORT

# Never crash before bind: missing OIP_AUTH_REQUIRED / JWT secret must not
# prevent /livez healthchecks (Railway/Render). OIP mount is fail-closed inside server.
try:
    from src.oip.config.settings import get_oip_settings
    from src.api.oip_chat_ingress import provider_runtime_active

    get_oip_settings()  # surface auth/secret misconfig clearly in deploy logs
    if provider_runtime_active():
        print("[START] Render: Provider Runtime active — OIP chat ingress (Groq/stub, no Ollama)")
    else:
        print("[START] Render: WARNING — OIP Provider Runtime not active; check OIP_* env vars")
except Exception as exc:
    print(
        f"[START] WARNING — OIP settings unavailable at boot ({exc}). "
        "API will still bind; set OIP_AUTH_REQUIRED=true and a strong "
        "OIP_JWT_SECRET (or API_SECRET_KEY, length>=16) for full OIP chat."
    )

print(f"[START] Listening on 0.0.0.0:{API_PORT}")

import uvicorn
from src.api.server import app

uvicorn.run(app, host="0.0.0.0", port=API_PORT)
