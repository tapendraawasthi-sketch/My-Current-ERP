"""Usage collector adapter."""

from __future__ import annotations

import uuid
from typing import Any

from ...application.ports.execution_ports import UsageCollectorPort
from ...domain.value_objects import ProviderUsage


class DefaultUsageCollectorAdapter(UsageCollectorPort):
    async def collect(
        self,
        *,
        execution_id: str,
        tenant_id: str,
        provider_id: str,
        provider_response: dict[str, Any],
        latency_ms: int,
        retries: int,
        tool_count: int,
        streaming_duration_ms: int,
    ) -> ProviderUsage:
        usage_data = provider_response.get("usage", {})
        model = provider_response.get("model", "")
        region = provider_response.get("region", "global")
        input_tokens = int(usage_data.get("input_tokens", 0))
        output_tokens = int(usage_data.get("output_tokens", 0))
        reasoning_tokens = int(usage_data.get("reasoning_tokens", 0))
        cache_hits = int(usage_data.get("cache_hits", 0))
        cost_micros = int(usage_data.get("cost_micros", 0))
        if not cost_micros:
            cost_micros = (input_tokens + output_tokens) * 10 + reasoning_tokens * 20
        return ProviderUsage(
            usage_id=str(uuid.uuid4()),
            execution_id=execution_id,
            tenant_id=tenant_id,
            provider_id=provider_id,
            model=model,
            region=region,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            reasoning_tokens=reasoning_tokens,
            cache_hits=cache_hits,
            latency_ms=latency_ms,
            cost_micros=cost_micros,
            retries=retries,
            streaming_duration_ms=streaming_duration_ms,
            tool_count=tool_count,
        )
