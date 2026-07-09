"""Orbix v2 — genuine local reasoning agent for Sutra ERP.

Architecture:
    plan -> tool call -> observe -> reflect -> verify -> grounded answer

This package replaces pattern-dispatch "intelligence" with a real agentic
loop backed by Ollama, typed tools, layered memory, deterministic ledger
math, and an evidence-grounding verifier.

The legacy Falcon/agent pipeline remains as a compatibility fallback.
"""

from __future__ import annotations

__all__ = ["__version__"]

__version__ = "2.0.0"
