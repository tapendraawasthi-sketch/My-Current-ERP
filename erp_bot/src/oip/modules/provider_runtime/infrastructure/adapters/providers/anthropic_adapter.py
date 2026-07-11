"""Anthropic Claude provider adapter."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ....domain.value_objects import ExecutionContext
from .errors import ProviderNetworkError, ProviderTimeoutError
from .http_base import GenerationParams, HttpProviderAdapter


class AnthropicProviderAdapter(HttpProviderAdapter):
    provider_kind = "anthropic"

    def has_credentials(self) -> bool:
        return bool(self._config.anthropic_api_key)

    async def _invoke_complete(
        self,
        *,
        params: GenerationParams,
        tools: tuple[str, ...],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": params.model,
            "max_tokens": params.max_tokens,
            "temperature": params.temperature,
            "top_p": params.top_p,
            "system": params.system_prompt,
            "messages": [
                {"role": "user", "content": params.user_prompt},
            ],
        }
        if tools:
            body["tools"] = [
                {
                    "name": tool_id.replace(".", "_"),
                    "description": f"Invoke ERP tool {tool_id}",
                    "input_schema": {"type": "object", "properties": {}},
                }
                for tool_id in tools
            ]

        client = await self._client()
        try:
            response = await client.post(
                f"{self._config.anthropic_base_url.rstrip('/')}/messages",
                headers={
                    "x-api-key": self._config.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                },
                json=body,
            )
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("anthropic request timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderNetworkError(f"anthropic network failure: {exc}") from exc

        if response.status_code >= 400:
            await self._handle_http_error(response)

        payload = response.json()
        text_parts = []
        tool_calls: list[dict[str, Any]] = []
        for block in payload.get("content") or []:
            if block.get("type") == "text":
                text_parts.append(block.get("text", ""))
            elif block.get("type") == "tool_use":
                tool_calls.append(block)
        text = "".join(text_parts)
        usage_data = payload.get("usage") or {}
        usage = {
            "input_tokens": int(usage_data.get("input_tokens", 0)),
            "output_tokens": int(usage_data.get("output_tokens", 0)),
        }
        return self._normalize_response(
            params=params,
            text=text,
            usage=usage,
            tools=tools,
            context=context,
            tool_calls=tool_calls,
            raw=payload,
        )

    async def _invoke_streaming(
        self,
        *,
        params: GenerationParams,
        tools: tuple[str, ...],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        body = {
            "model": params.model,
            "max_tokens": params.max_tokens,
            "stream": True,
            "system": params.system_prompt,
            "messages": [{"role": "user", "content": params.user_prompt}],
        }
        client = await self._client()
        tokens: list[str] = []
        text_parts: list[str] = []
        try:
            async with client.stream(
                "POST",
                f"{self._config.anthropic_base_url.rstrip('/')}/messages",
                headers={
                    "x-api-key": self._config.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                },
                json=body,
            ) as response:
                if response.status_code >= 400:
                    await self._handle_http_error(response)
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    event = json.loads(line[5:].strip())
                    if event.get("type") == "content_block_delta":
                        delta = (event.get("delta") or {}).get("text") or ""
                        if delta:
                            tokens.append(delta)
                            text_parts.append(delta)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("anthropic stream timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderNetworkError(f"anthropic stream failure: {exc}") from exc

        text = "".join(text_parts)
        usage = {"input_tokens": max(len(text.split()), 1), "output_tokens": max(len(text.split()), 1)}
        return self._normalize_response(
            params=params,
            text=text,
            usage=usage,
            tools=tools,
            context=context,
            stream_tokens=tokens,
            streaming=True,
        )
