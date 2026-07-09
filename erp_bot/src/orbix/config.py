"""Central configuration for Orbix v2.

Defaults reuse the models the repo already runs (qwen3 family, nomic-embed-text)
so nothing new must be pulled to get a working agent. Every value is overridable
via environment variables, so you can point Orbix at qwen2.5-coder / bge-m3 once
those are pulled, exactly as the architecture doc recommends.
"""

from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel

# Reuse the existing single source of truth where possible.
from ..config import (
    BOT_ROOT,
    ERP_PATH as _ERP_PATH,
    OLLAMA_BASE_URL as _OLLAMA_BASE_URL,
    DEEP_MODEL as _DEEP_MODEL,
    FAST_MODEL as _FAST_MODEL,
    EMBED_MODEL as _EMBED_MODEL,
)


class OrbixConfig(BaseModel):
    erp_path: Path
    ollama_base_url: str = "http://localhost:11434"

    # Role-specialised models. Defaults are the repo's installed models; override
    # via env to use stronger models (qwen2.5-coder:14b/32b, deepseek-r1, bge-m3).
    agent_model: str = "qwen3:14b"
    verifier_model: str = "qwen3:14b"
    router_model: str = "qwen3:4b"
    embed_model: str = "nomic-embed-text"

    max_tool_steps: int = 8
    agent_temperature: float = 0.1
    agent_num_ctx: int = 8192

    memory_db_path: Path = Path("data/orbix_memory.sqlite3")

    # Directories/files the agent must never read as evidence.
    denied_path_parts: tuple[str, ...] = (
        ".env",
        ".git",
        "node_modules",
        "dist",
        "build",
        ".workspace",
        ".tanstack",
        ".venv",
        "venv",
        "__pycache__",
    )

    class Config:
        arbitrary_types_allowed = True


def _bool_env(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def load_config() -> OrbixConfig:
    memory_path = os.environ.get("ORBIX_MEMORY_DB")
    memory_db = (
        Path(memory_path)
        if memory_path
        else (BOT_ROOT / "data" / "orbix_memory.sqlite3")
    )

    return OrbixConfig(
        erp_path=Path(os.environ.get("ERP_PATH", str(_ERP_PATH))).resolve(),
        ollama_base_url=os.environ.get("OLLAMA_BASE_URL", _OLLAMA_BASE_URL),
        agent_model=os.environ.get("ORBIX_AGENT_MODEL", _DEEP_MODEL or "qwen3:14b"),
        verifier_model=os.environ.get(
            "ORBIX_VERIFIER_MODEL", _DEEP_MODEL or "qwen3:14b"
        ),
        router_model=os.environ.get("ORBIX_ROUTER_MODEL", _FAST_MODEL or "qwen3:4b"),
        embed_model=os.environ.get("ORBIX_EMBED_MODEL", _EMBED_MODEL),
        max_tool_steps=int(os.environ.get("ORBIX_MAX_TOOL_STEPS", "8")),
        agent_temperature=float(os.environ.get("ORBIX_TEMPERATURE", "0.1")),
        agent_num_ctx=int(os.environ.get("ORBIX_NUM_CTX", "8192")),
        memory_db_path=memory_db,
    )


_CONFIG: OrbixConfig | None = None


def get_config() -> OrbixConfig:
    global _CONFIG
    if _CONFIG is None:
        _CONFIG = load_config()
    return _CONFIG
