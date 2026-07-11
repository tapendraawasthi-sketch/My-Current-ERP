"""Base provider adapter — no SDK imports."""

from __future__ import annotations

from typing import Any

from ...application.ports.execution_ports import ProviderAdapterPort
from ...domain.value_objects import ExecutionContext


class BaseProviderAdapter(ProviderAdapterPort):
    def __init__(self, *, provider_id: str, default_model: str, region: str = "global") -> None:
        self._provider_id = provider_id
        self._default_model = default_model
        self._region = region

    async def invoke(
        self,
        *,
        provider_id: str,
        context: ExecutionContext,
        prompt: str,
        tools: tuple[str, ...],
        streaming: bool,
    ) -> dict[str, Any]:
        text = self._generate_text(prompt, tools)
        return {
            "provider_id": self._provider_id,
            "model": self._default_model,
            "region": self._region,
            "text": text,
            "raw_content": text,
            "json": {"tools": list(tools), "execution_id": context.execution_id},
            "streamable": streaming,
            "usage": {
                "input_tokens": max(len(prompt.split()), 1),
                "output_tokens": max(len(text.split()), 1),
                "reasoning_tokens": 0,
                "cache_hits": 0,
            },
        }

    def _generate_text(self, prompt: str, tools: tuple[str, ...]) -> str:
        tool_suffix = f" [tools: {', '.join(tools)}]" if tools else ""
        return f"[{self._provider_id}] Response for: {prompt[:120]}{tool_suffix}"
