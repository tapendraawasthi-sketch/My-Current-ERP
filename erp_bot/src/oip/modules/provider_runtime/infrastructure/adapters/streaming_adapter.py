"""Streaming adapter — consumes real provider stream tokens when present."""

from __future__ import annotations

from typing import Any, AsyncIterator

from ...application.ports.execution_ports import StreamingPort
from ...domain.value_objects import StreamingMode


class DefaultStreamingAdapter(StreamingPort):
    async def stream_chunks(
        self,
        *,
        execution_id: str,
        provider_response: dict[str, Any],
        mode: StreamingMode,
    ) -> AsyncIterator[str]:
        stream_tokens = provider_response.get("stream_tokens") or []
        if stream_tokens:
            for token in stream_tokens:
                if token:
                    yield token
            return

        text = provider_response.get("text", "")
        if not text:
            return
        words = text.split()
        chunk_size = max(1, len(words) // 3)
        for i in range(0, len(words), chunk_size):
            yield " ".join(words[i : i + chunk_size])
