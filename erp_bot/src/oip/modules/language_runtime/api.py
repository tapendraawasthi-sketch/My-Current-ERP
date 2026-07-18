"""Public facade for MAI-05 language analysis."""

from __future__ import annotations

from .application.language_analyzer import analyze_language
from .infrastructure.compact_resource_repository import last_load_ms, load_resources

__all__ = ["analyze_language", "load_resources", "last_load_ms"]
