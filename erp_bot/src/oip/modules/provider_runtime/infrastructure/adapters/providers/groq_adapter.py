"""Groq OpenAI-compatible provider adapter."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ....domain.value_objects import ExecutionContext
from .errors import ProviderNetworkError, ProviderTimeoutError
from .http_base import GenerationParams, HttpProviderAdapter


class GroqProviderAdapter(HttpProviderAdapter):
    provider_kind = "groq"

    def has_credentials(self) -> bool:
        return bool(self._config.groq_api_key)

    async def _invoke_complete(
        self,
        *,
        params: GenerationParams,
        tools: tuple[str, ...],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": params.model,
            "messages": [
                {"role": "system", "content": params.system_prompt},
                {"role": "user", "content": params.user_prompt},
            ],
            "temperature": params.temperature,
            "top_p": params.top_p,
            "max_tokens": params.max_tokens,
        }
        tool_defs = self._tool_definitions(tools)
        if tool_defs:
            body["tools"] = tool_defs

        client = await self._client()
        try:
            response = await client.post(
                f"{self._config.groq_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {self._config.groq_api_key}"},
                json=body,
            )
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("groq request timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderNetworkError(f"groq network failure: {exc}") from exc

        if response.status_code >= 400:
            await self._handle_http_error(response)

        payload = response.json()
        choice = (payload.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        text = message.get("content") or ""
        return self._normalize_response(
            params=params,
            text=text,
            usage=self._extract_openai_usage(payload),
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
            "temperature": params.temperature,
            "top_p": params.top_p,
            "max_tokens": params.max_tokens,
        }
        client = await self._client()
        tokens: list[str] = []
        text_parts: list[str] = []
        usage = {"input_tokens": 0, "output_tokens": 0}
        try:
            async with client.stream(
                "POST",
                f"{self._config.groq_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {self._config.groq_api_key}"},
                json=body,
            ) as response:
                if response.status_code >= 400:
                    await self._handle_http_error(response)
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)
                    if chunk.get("usage"):
                        usage = self._extract_openai_usage(chunk)
                    delta = ((chunk.get("choices") or [{}])[0].get("delta") or {}).get("content") or ""
                    if delta:
                        tokens.append(delta)
                        text_parts.append(delta)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("groq stream timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderNetworkError(f"groq stream failure: {exc}") from exc

        text = "".join(text_parts)
        if not usage["input_tokens"]:
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
