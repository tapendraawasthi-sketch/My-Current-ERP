"""Ollama local provider adapter."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ....domain.value_objects import ExecutionContext
from .errors import ProviderNetworkError, ProviderTimeoutError
from .http_base import GenerationParams, HttpProviderAdapter


class OllamaProviderAdapter(HttpProviderAdapter):
    provider_kind = "ollama"

    def has_credentials(self) -> bool:
        return True

    async def _invoke_complete(
        self,
        *,
        params: GenerationParams,
        tools: tuple[str, ...],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": params.model,
            "stream": False,
            "messages": [
                {"role": "system", "content": params.system_prompt},
                {"role": "user", "content": params.user_prompt},
            ],
            "options": {"temperature": params.temperature, "top_p": params.top_p, "num_predict": params.max_tokens},
        }
        if tools:
            body["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": tool_id.replace(".", "_"),
                        "description": f"Invoke ERP tool {tool_id}",
                        "parameters": {"type": "object", "properties": {}},
                    },
                }
                for tool_id in tools
            ]

        client = await self._client()
        try:
            response = await client.post(f"{self._config.ollama_base_url.rstrip('/')}/api/chat", json=body)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("ollama request timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderNetworkError(f"ollama network failure: {exc}") from exc

        if response.status_code >= 400:
            await self._handle_http_error(response)

        payload = response.json()
        message = payload.get("message") or {}
        text = message.get("content") or ""
        eval_count = int(payload.get("eval_count") or 0)
        prompt_eval_count = int(payload.get("prompt_eval_count") or 0)
        usage = {"input_tokens": prompt_eval_count, "output_tokens": eval_count}
        return self._normalize_response(
            params=params,
            text=text,
            usage=usage,
            tools=tools,
            context=context,
            tool_calls=message.get("tool_calls") or [],
            raw=payload,
        )

    async def _invoke_streaming(
        self,
        *,
        params: GenerationParams,
        tools: tuple[str, ...],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": params.model,
            "stream": True,
            "messages": [
                {"role": "system", "content": params.system_prompt},
                {"role": "user", "content": params.user_prompt},
            ],
            "options": {"temperature": params.temperature, "top_p": params.top_p, "num_predict": params.max_tokens},
        }
        client = await self._client()
        tokens: list[str] = []
        text_parts: list[str] = []
        prompt_eval_count = 0
        eval_count = 0
        try:
            async with client.stream(
                "POST",
                f"{self._config.ollama_base_url.rstrip('/')}/api/chat",
                json=body,
            ) as response:
                if response.status_code >= 400:
                    await self._handle_http_error(response)
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    event = json.loads(line)
                    delta = (event.get("message") or {}).get("content") or ""
                    if delta:
                        tokens.append(delta)
                        text_parts.append(delta)
                    prompt_eval_count = int(event.get("prompt_eval_count") or prompt_eval_count)
                    eval_count = int(event.get("eval_count") or eval_count)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("ollama stream timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderNetworkError(f"ollama stream failure: {exc}") from exc

        text = "".join(text_parts)
        usage = {
            "input_tokens": prompt_eval_count or max(len(text.split()), 1),
            "output_tokens": eval_count or max(len(text.split()), 1),
        }
        return self._normalize_response(
            params=params,
            text=text,
            usage=usage,
            tools=tools,
            context=context,
            stream_tokens=tokens,
            streaming=True,
        )

    async def health_check(self) -> dict[str, Any]:
        client = await self._client()
        try:
            response = await client.get(f"{self._config.ollama_base_url.rstrip('/')}/api/tags")
            return {"available": response.status_code < 400, "status_code": response.status_code}
        except httpx.HTTPError:
            return {"available": False, "status_code": 0}
