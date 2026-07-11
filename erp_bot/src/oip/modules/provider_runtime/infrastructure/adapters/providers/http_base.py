"""Shared HTTP provider infrastructure."""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass, field
from typing import Any

import httpx

from ....application.ports.execution_ports import ProviderAdapterPort
from ....domain.value_objects import ExecutionContext, ExecutionPolicyName
from .errors import (
    ProviderAuthError,
    ProviderError,
    ProviderModelError,
    ProviderNetworkError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from .model_catalog import ModelCatalog, create_default_model_catalog


@dataclass(frozen=True)
class ProviderRuntimeConfig:
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    anthropic_api_key: str = ""
    anthropic_base_url: str = "https://api.anthropic.com/v1"
    google_api_key: str = ""
    google_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    ollama_base_url: str = "http://127.0.0.1:11434"
    provider_timeout_seconds: float = 60.0
    max_retries: int = 3
    retry_backoff_seconds: float = 1.0
    default_temperature: float = 0.2
    default_top_p: float = 0.95
    offline_mode: bool = False
    force_stub_providers: bool = False
    default_provider: str = ""
    default_model: str = ""

    @classmethod
    def from_env(cls) -> ProviderRuntimeConfig:
        return cls(
            openai_api_key=os.getenv("OIP_OPENAI_API_KEY", ""),
            openai_base_url=os.getenv("OIP_OPENAI_BASE_URL", "https://api.openai.com/v1"),
            anthropic_api_key=os.getenv("OIP_ANTHROPIC_API_KEY", ""),
            anthropic_base_url=os.getenv("OIP_ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1"),
            google_api_key=os.getenv("OIP_GOOGLE_API_KEY", ""),
            google_base_url=os.getenv("OIP_GOOGLE_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"),
            groq_api_key=os.getenv("OIP_GROQ_API_KEY", ""),
            groq_base_url=os.getenv("OIP_GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
            ollama_base_url=os.getenv("OIP_OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
            provider_timeout_seconds=float(os.getenv("OIP_PROVIDER_TIMEOUT_SECONDS", "60")),
            max_retries=int(os.getenv("OIP_MAX_RETRIES", "3")),
            retry_backoff_seconds=float(os.getenv("OIP_RETRY_BACKOFF", "1.0")),
            default_temperature=float(os.getenv("OIP_PROVIDER_TEMPERATURE", "0.2")),
            default_top_p=float(os.getenv("OIP_PROVIDER_TOP_P", "0.95")),
            offline_mode=os.getenv("OIP_PROVIDER_OFFLINE_MODE", "false").lower() == "true",
            force_stub_providers=os.getenv("OIP_FORCE_STUB_PROVIDERS", "true").lower() == "true",
            default_provider=os.getenv("OIP_PROVIDER", ""),
            default_model=os.getenv("OIP_DEFAULT_MODEL", ""),
        )


@dataclass
class GenerationParams:
    model: str
    system_prompt: str
    user_prompt: str
    temperature: float
    top_p: float
    max_tokens: int
    json_mode: bool = False


class HttpProviderAdapter(ProviderAdapterPort):
    provider_kind: str = "http"

    def __init__(
        self,
        *,
        provider_id: str,
        default_model: str,
        region: str,
        config: ProviderRuntimeConfig,
        model_catalog: ModelCatalog | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._provider_id = provider_id
        self._default_model = default_model
        self._region = region
        self._config = config
        self._catalog = model_catalog or create_default_model_catalog()
        self._http = http_client

    @property
    def provider_id(self) -> str:
        return self._provider_id

    def has_credentials(self) -> bool:
        return True

    async def invoke(
        self,
        *,
        provider_id: str,
        context: ExecutionContext,
        prompt: str,
        tools: tuple[str, ...],
        streaming: bool,
    ) -> dict[str, Any]:
        if self._config.offline_mode or self._config.force_stub_providers or not self.has_credentials():
            return self._stub_response(context=context, prompt=prompt, tools=tools, streaming=streaming)

        params = self._build_params(context=context, prompt=prompt, tools=tools)
        last_error: Exception | None = None
        attempts = max(1, min(self._config.max_retries, 3))
        for attempt in range(attempts):
            try:
                if streaming:
                    return await self._invoke_streaming(params=params, tools=tools, context=context)
                return await self._invoke_complete(params=params, tools=tools, context=context)
            except ProviderRateLimitError as exc:
                last_error = exc
                if attempt + 1 >= attempts:
                    raise
                await asyncio.sleep(self._config.retry_backoff_seconds * (attempt + 1))
            except ProviderTimeoutError as exc:
                last_error = exc
                if attempt + 1 >= attempts:
                    raise
                await asyncio.sleep(self._config.retry_backoff_seconds * (attempt + 1))
            except ProviderNetworkError as exc:
                last_error = exc
                if attempt + 1 >= attempts:
                    raise
                await asyncio.sleep(self._config.retry_backoff_seconds * (attempt + 1))
        raise last_error or ProviderError("provider invocation failed")

    def _build_params(self, *, context: ExecutionContext, prompt: str, tools: tuple[str, ...]) -> GenerationParams:
        model = context.model_hint or self._default_model
        meta = context.metadata or {}
        policy = context.policy_name
        max_tokens = int(meta.get("max_tokens") or self._policy_max_tokens(policy))
        return GenerationParams(
            model=model,
            system_prompt=self._system_prompt(context=context, tools=tools),
            user_prompt=prompt,
            temperature=float(meta.get("temperature", self._config.default_temperature)),
            top_p=float(meta.get("top_p", self._config.default_top_p)),
            max_tokens=max_tokens,
            json_mode=bool(meta.get("json_mode")),
        )

    @staticmethod
    def _policy_max_tokens(policy: ExecutionPolicyName) -> int:
        mapping = {
            ExecutionPolicyName.FAST: 4096,
            ExecutionPolicyName.BALANCED: 8192,
            ExecutionPolicyName.QUALITY: 16384,
            ExecutionPolicyName.LOW_COST: 4096,
            ExecutionPolicyName.ACCOUNTING: 8192,
            ExecutionPolicyName.GOVERNMENT: 8192,
            ExecutionPolicyName.OFFLINE: 4096,
            ExecutionPolicyName.HYBRID: 8192,
        }
        return mapping.get(policy, 8192)

    @staticmethod
    def _system_prompt(*, context: ExecutionContext, tools: tuple[str, ...]) -> str:
        tool_hint = f" Available tools: {', '.join(tools)}." if tools else ""
        return (
            "You are Orbix — the Sutra ERP intelligence layer. "
            "You MUST answer using ERP execution results only. "
            "NEVER tell the user to navigate modules, open screens, create orders manually, "
            "or follow step-by-step UI procedures. "
            "NEVER invent accounting entries — if structured ERP data is missing, ask a short clarifying question. "
            "Respond in natural language based on facts from tools and context."
            f"{tool_hint}"
        )

    async def _client(self) -> httpx.AsyncClient:
        if self._http is not None:
            return self._http
        return httpx.AsyncClient(timeout=self._config.provider_timeout_seconds)

    async def _invoke_complete(
        self,
        *,
        params: GenerationParams,
        tools: tuple[str, ...],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        raise NotImplementedError

    async def _invoke_streaming(
        self,
        *,
        params: GenerationParams,
        tools: tuple[str, ...],
        context: ExecutionContext,
    ) -> dict[str, Any]:
        complete = await self._invoke_complete(params=params, tools=tools, context=context)
        text = complete.get("text", "")
        if text and "stream_tokens" not in complete:
            words = text.split()
            chunk_size = max(1, len(words) // 4)
            complete["stream_tokens"] = [" ".join(words[i : i + chunk_size]) for i in range(0, len(words), chunk_size)]
        complete["streamable"] = True
        return complete

    def _normalize_response(
        self,
        *,
        params: GenerationParams,
        text: str,
        usage: dict[str, Any],
        tools: tuple[str, ...],
        context: ExecutionContext,
        stream_tokens: list[str] | None = None,
        tool_calls: list[dict[str, Any]] | None = None,
        raw: Any = None,
        streaming: bool = False,
    ) -> dict[str, Any]:
        input_tokens = int(usage.get("input_tokens", 0))
        output_tokens = int(usage.get("output_tokens", 0))
        meta = self._catalog.resolve(params.model)
        cost_micros = self._catalog.estimate_cost_micros(
            model_id=params.model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
        return {
            "provider_id": self._provider_id,
            "model": params.model,
            "region": self._region,
            "text": text,
            "raw_content": text if isinstance(raw, str) else json.dumps(raw or {}),
            "json": {
                "tools": list(tools),
                "execution_id": context.execution_id,
                "tool_calls": tool_calls or [],
                "context_window": meta.context_window,
            },
            "streamable": streaming or bool(stream_tokens),
            "stream_tokens": stream_tokens or [],
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "reasoning_tokens": int(usage.get("reasoning_tokens", 0)),
                "cache_hits": int(usage.get("cache_hits", 0)),
                "cost_micros": cost_micros,
            },
            "health": {"provider_id": self._provider_id, "model": params.model, "available": True},
        }

    def _stub_response(
        self,
        *,
        context: ExecutionContext,
        prompt: str,
        tools: tuple[str, ...],
        streaming: bool,
    ) -> dict[str, Any]:
        tool_suffix = f" [tools: {', '.join(tools)}]" if tools else ""
        text = f"[{self._provider_id}] Response for: {prompt[:120]}{tool_suffix}"
        stream_tokens = []
        if streaming:
            words = text.split()
            chunk_size = max(1, len(words) // 3)
            stream_tokens = [" ".join(words[i : i + chunk_size]) for i in range(0, len(words), chunk_size)]
        return self._normalize_response(
            params=GenerationParams(
                model=context.model_hint or self._default_model,
                system_prompt="",
                user_prompt=prompt,
                temperature=self._config.default_temperature,
                top_p=self._config.default_top_p,
                max_tokens=1024,
            ),
            text=text,
            usage={"input_tokens": max(len(prompt.split()), 1), "output_tokens": max(len(text.split()), 1)},
            tools=tools,
            context=context,
            stream_tokens=stream_tokens,
            streaming=streaming,
        )

    async def _handle_http_error(self, response: httpx.Response) -> None:
        if response.status_code in (401, 403):
            raise ProviderAuthError(f"{self._provider_id} authentication failed")
        if response.status_code == 429:
            raise ProviderRateLimitError(f"{self._provider_id} rate limited")
        if response.status_code == 404:
            raise ProviderModelError(f"{self._provider_id} model unavailable")
        if response.status_code >= 500:
            raise ProviderNetworkError(f"{self._provider_id} server error {response.status_code}")
        if response.status_code >= 400:
            raise ProviderError(f"{self._provider_id} request failed: {response.status_code}")

    @staticmethod
    def _extract_openai_usage(payload: dict[str, Any]) -> dict[str, int]:
        usage = payload.get("usage") or {}
        return {
            "input_tokens": int(usage.get("prompt_tokens", 0)),
            "output_tokens": int(usage.get("completion_tokens", 0)),
        }

    @staticmethod
    def _tool_definitions(tools: tuple[str, ...]) -> list[dict[str, Any]]:
        if not tools:
            return []
        return [
            {
                "type": "function",
                "function": {
                    "name": tool_id.replace(".", "_"),
                    "description": f"Invoke ERP tool {tool_id}",
                    "parameters": {"type": "object", "properties": {}, "additionalProperties": True},
                },
            }
            for tool_id in tools
        ]
