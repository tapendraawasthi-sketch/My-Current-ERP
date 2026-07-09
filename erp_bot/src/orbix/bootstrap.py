"""Lazy singleton wiring for the Orbix engine.

Kept separate from the API so scripts/start.py, tests, and the server can all
obtain the same initialized engine without import cycles.
"""

from __future__ import annotations

import asyncio

from .config import get_config
from .llm.ollama_client import OllamaClient
from .memory.store import MemoryStore
from .reasoning.engine import OrbixAgentEngine
from .tools import memory_tools
from .tools.registry import build_default_registry

_ENGINE: OrbixAgentEngine | None = None
_MEMORY: MemoryStore | None = None
_INIT_LOCK = asyncio.Lock()


async def get_engine() -> OrbixAgentEngine:
    global _ENGINE, _MEMORY
    if _ENGINE is not None:
        return _ENGINE

    async with _INIT_LOCK:
        if _ENGINE is not None:
            return _ENGINE

        config = get_config()

        agent_llm = OllamaClient(config.ollama_base_url, config.agent_model)
        verifier_llm = OllamaClient(config.ollama_base_url, config.verifier_model)
        router_llm = OllamaClient(config.ollama_base_url, config.router_model)

        memory = MemoryStore(config.memory_db_path)
        await memory.init()
        _MEMORY = memory

        registry = build_default_registry()
        memory_tools.register(registry, memory)

        _ENGINE = OrbixAgentEngine(
            config=config,
            agent_llm=agent_llm,
            verifier_llm=verifier_llm,
            router_llm=router_llm,
            tools=registry,
            memory=memory,
        )
        return _ENGINE


async def get_memory() -> MemoryStore:
    if _MEMORY is None:
        await get_engine()
    assert _MEMORY is not None
    return _MEMORY
