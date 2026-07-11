"""Content compression adapter."""

from __future__ import annotations

from ...application.ports.memory_ports import CompressionPort


class WhitespaceCompressionAdapter(CompressionPort):
    def compress(self, content: str) -> tuple[str, float]:
        if not content:
            return "", 1.0
        compressed = " ".join(content.split())
        ratio = len(compressed) / len(content) if content else 1.0
        return compressed, ratio
