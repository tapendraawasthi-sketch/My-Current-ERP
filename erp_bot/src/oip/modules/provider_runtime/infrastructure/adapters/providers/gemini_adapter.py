"""Google Gemini provider adapter."""

from __future__ import annotations

import json
from typing import Any

import httpx

from ....domain.value_objects import ExecutionContext
from .errors import ProviderNetworkError, ProviderTimeoutError
from .http_base import GenerationParams, HttpProviderAdapter


class GeminiProviderAdapter(HttpProviderAdapter):
    provider_kind = "google"

    def has_credentials(self) -> bool:
        return bool(self._config.google_api_key)

    def _endpoint(self, model: str, *, stream: bool = False) -> str:
        action = "streamGenerateContent" if stream else "generateContent"
        base = self._config.google_base_url.rstrip("/")
        return f"{base}/models/{model}:{action}?key={self._config.google_api_key}"

    def _request_body(self, params: GenerationParams, context: ExecutionContext, tools: tuple[str, ...]) -> dict[str, Any]:
        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": params.system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": params.user_prompt}]}],
            "generationConfig": {
                "temperature": params.temperature,
                "topP": params.top_p,
                "maxOutputTokens": params.max_tokens,
            },
        }
        if params.json_mode:
            body["generationConfig"]["responseMimeType"] = "application/json"
        if tools:
            body["tools"] = [
                {
                    "functionDeclarations": [
                        {
                            "name": tool_id.replace(".", "_"),
                            "description": f"Invoke ERP tool {tool_id}",
                            "parameters": {"type": "object", "properties": {}},
                        }
                        for tool_id in tools
                    ]
                }
            ]
        return body

    async def _invoke_complete(
        self,
        *,
        params: GenerationParams,
        tools: tuple[str, ...],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        client = await self._client()
        try:
            response = await client.post(
                self._endpoint(params.model),
                json=self._request_body(params, context, tools),
            )
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("gemini request timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderNetworkError(f"gemini network failure: {exc}") from exc

        if response.status_code >= 400:
            await self._handle_http_error(response)

        payload = response.json()
        candidate = ((payload.get("candidates") or [{}])[0].get("content") or {})
        text_parts = [part.get("text", "") for part in candidate.get("parts") or [] if part.get("text")]
        text = "".join(text_parts)
        usage_meta = payload.get("usageMetadata") or {}
        usage = {
            "input_tokens": int(usage_meta.get("promptTokenCount", 0)),
            "output_tokens": int(usage_meta.get("candidatesTokenCount", 0)),
        }
        return self._normalize_response(
            params=params,
            text=text,
            usage=usage,
            tools=tools,
            context=context,
            raw=payload,
        )

    async def _invoke_streaming(
        self,
        *,
        params: GenerationParams,
        tools: tuple[str, ...],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        client = await self._client()
        tokens: list[str] = []
        text_parts: list[str] = []
        try:
            async with client.stream(
                "POST",
                self._endpoint(params.model, stream=True),
                json=self._request_body(params, context, tools),
            ) as response:
                if response.status_code >= 400:
                    await self._handle_http_error(response)
                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line or line.startswith("["):
                            continue
                        if line.endswith(","):
                            line = line[:-1]
                        try:
                            event = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        parts = (((event.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
                        for part in parts:
                            delta = part.get("text") or ""
                            if delta:
                                tokens.append(delta)
                                text_parts.append(delta)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError("gemini stream timed out") from exc
        except httpx.HTTPError as exc:
            raise ProviderNetworkError(f"gemini stream failure: {exc}") from exc

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
