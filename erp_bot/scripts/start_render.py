#!/usr/bin/env python3
"""Railway / Render / lean local entry — OIP chat via Provider Runtime (no Ollama ingest/warmup)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Lean start: skip file watcher + Chroma knowledge ingest.
# Do NOT force RENDER=true on localhost — that marks the process as production
# and rejects local OIP_AUTH_REQUIRED=false / OIP_ALLOW_INSECURE_DEV_IDENTITY,
# which 500s /orbix/chat/stream. Real Render already sets RENDER=true.
os.environ.setdefault("ORBIX_LEAN_START", "true")

BOT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_ROOT))

for subdir in ("data/oip", "data/chroma_db", "data/orbix"):
    (BOT_ROOT / subdir).mkdir(parents=True, exist_ok=True)

# Prefer bundled indexes under erp_bot/knowledgebase (Railway/Render rootDir=erp_bot).
_bundled_kb = BOT_ROOT / "knowledgebase"
if _bundled_kb.exists() and not os.environ.get("ORBIX_NP_KB_ROOT"):
    os.environ["ORBIX_NP_KB_ROOT"] = str(_bundled_kb)
os.environ.setdefault("ORBIX_NP_KB_ENABLED", "true")


def _bootstrap_railway_oip_env() -> None:
    """Fill required production OIP vars when Railway dashboard secrets were omitted."""
    on_railway = bool(os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_PROJECT_ID"))
    if not on_railway:
        return

    os.environ.setdefault("OIP_ENABLED", "true")
    os.environ.setdefault("OIP_PROVIDER_RUNTIME_ENABLED", "true")
    os.environ.setdefault("OIP_ORCHESTRATOR_ENABLED", "true")
    os.environ.setdefault("OIP_AUTH_REQUIRED", "true")
    # Pin listen port for private DNS from sutra-erp (http://sutra-erp-bot.railway.internal:8080)
    os.environ.setdefault("PORT", "8080")

    secret = (
        os.environ.get("OIP_JWT_SECRET")
        or os.environ.get("API_SECRET_KEY")
        or os.environ.get("JWT_SECRET")
        or ""
    ).strip()
    if len(secret) < 16:
        import hashlib

        material = "|".join(
            [
                os.environ.get("RAILWAY_PROJECT_ID", ""),
                os.environ.get("RAILWAY_ENVIRONMENT_ID", ""),
                "sutra-orbix-oip",
            ]
        )
        derived = hashlib.sha256(material.encode("utf-8")).hexdigest()
        os.environ["OIP_JWT_SECRET"] = derived
        os.environ.setdefault("API_SECRET_KEY", derived)
        print(
            "[START] WARNING — OIP_JWT_SECRET missing/weak; using project-derived secret "
            "so OIP can mount. Set OIP_JWT_SECRET in Railway Variables for a stable key."
        )


_bootstrap_railway_oip_env()

import src.config  # noqa: F401 — load env + print ERP_PATH
from src.config import API_PORT

_on_railway = bool(os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_PROJECT_ID"))
_platform = "Railway" if _on_railway else "Render/cloud"

# Never crash before bind: missing OIP_AUTH_REQUIRED / JWT secret must not
# prevent /livez healthchecks (Railway/Render). OIP mount is fail-closed inside server.
try:
    from src.oip.config.settings import get_oip_settings
    from src.api.oip_chat_ingress import provider_runtime_active

    get_oip_settings()  # surface auth/secret misconfig clearly in deploy logs
    if provider_runtime_active():
        print(f"[START] {_platform}: Provider Runtime active — OIP chat ingress (Groq/stub, no Ollama)")
    else:
        print(f"[START] {_platform}: WARNING — OIP Provider Runtime not active; check OIP_* env vars")
except Exception as exc:
    print(
        f"[START] WARNING — OIP settings unavailable at boot ({exc}). "
        "API will still bind; set OIP_AUTH_REQUIRED=true and a strong "
        "OIP_JWT_SECRET (or API_SECRET_KEY, length>=16) for full OIP chat."
    )

# Railway private networking (esp. legacy IPv6-only envs) needs bind on :: .
# Public edge still reaches the service; dual-stack :: is the safe cloud default.
_host = os.environ.get("HOST") or ("::" if _on_railway else "0.0.0.0")
print(f"[START] Listening on {_host}:{API_PORT}")

import uvicorn
from src.api.server import app

uvicorn.run(app, host=_host, port=API_PORT)
