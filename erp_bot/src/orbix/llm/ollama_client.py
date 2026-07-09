"""Thin async Ollama wrapper with JSON mode, tool-calling, and streaming.

Ollama tool-calling reliability varies by model, so this client supports two
paths and lets the caller decide:

1. Native tools: pass ``tools=[...]``; if the model returns ``tool_calls`` we
   surface them directly.
2. JSON ReAct fallback: ask the model for a strict JSON action object and parse
   it defensively (models often wrap JSON in prose or ```json fences).
"""

from __future__ import annotations

import json
import re
from typing import Any, AsyncIterator

import httpx

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", re.DOTALL)


def extract_json_object(text: str) -> dict[str, Any] | list[Any] | None:
    """Best-effort extraction of a JSON object/array from possibly noisy text."""
    if not text:
        return None

    # 1. Direct parse.
    stripped = text.strip()
    try:
        return json.loads(stripped)
    except Exception:
        pass

    # 2. Fenced ```json block.
    fence = _JSON_FENCE_RE.search(text)
    if fence:
        try:
            return json.loads(fence.group(1))
        except Exception:
            pass

    # 3. First balanced {...} span.
    start = stripped.find("{")
    if start != -1:
        depth = 0
        in_str = False
        esc = False
        for i in range(start, len(stripped)):
            ch = stripped[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = stripped[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except Exception:
                        break
    return None


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout: float = 120.0):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict] | None = None,
        temperature: float = 0.1,
        num_ctx: int = 8192,
        json_mode: bool = False,
        model: str | None = None,
    ) -> dict[str, Any]:
        """Return the raw Ollama message dict (may contain ``tool_calls``)."""
        payload: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature, "num_ctx": num_ctx},
        }
        if tools:
            payload["tools"] = tools
        if json_mode:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
        return data.get("message", {"role": "assistant", "content": ""})

    async def chat_json(
        self,
        messages: list[dict[str, Any]],
        temperature: float = 0.1,
        num_ctx: int = 8192,
        model: str | None = None,
    ) -> dict[str, Any] | list[Any] | None:
        """Chat in JSON mode and parse the result defensively."""
        msg = await self.chat(
            messages,
            temperature=temperature,
            num_ctx=num_ctx,
            json_mode=True,
            model=model,
        )
        return extract_json_object(msg.get("content", ""))

    async def stream_chat(
        self,
        messages: list[dict[str, Any]],
        temperature: float = 0.1,
        num_ctx: int = 8192,
        model: str | None = None,
    ) -> AsyncIterator[str]:
        """Yield incremental content tokens from a streaming chat."""
        payload = {
            "model": model or self.model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature, "num_ctx": num_ctx},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST", f"{self.base_url}/api/chat", json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                    except Exception:
                        continue
                    piece = chunk.get("message", {}).get("content", "")
                    if piece:
                        yield piece
                    if chunk.get("done"):
                        break

    async def embed(self, text: str, model: str | None = None) -> list[float]:
        payload = {"model": model or self.model, "prompt": text}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}/api/embeddings", json=payload)
            resp.raise_for_status()
            return resp.json().get("embedding", [])

    async def reachable(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    async def available_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                return [m.get("name", "") for m in resp.json().get("models", [])]
        except Exception:
            return []
