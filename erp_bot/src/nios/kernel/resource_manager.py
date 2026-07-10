"""Resource Manager — adaptive model tier, token budget, latency SLA."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Literal

ModelTier = Literal["none", "4b", "32b", "planner"]

GPU_BUSY_THRESHOLD = float(os.getenv("NIOS_GPU_BUSY_THRESHOLD", "0.85"))


@dataclass
class ResourceDecision:
    tier: ModelTier
    use_cache: bool
    token_budget: int
    reason: str
    latency_sla_ms: int


class ResourceManager:
    """Decides compute path based on signals — not static if-else."""

    def __init__(self) -> None:
        self._recent_latencies: list[float] = []
        self._tier_counts: dict[str, int] = {"tier_0_2": 0, "tier_3": 0, "tier_4_5": 0}
        self._request_count: int = 0

    def stats(self) -> dict[str, float]:
        total = sum(self._tier_counts.values()) or 1
        sorted_lat = sorted(self._recent_latencies)
        p95 = sorted_lat[int(len(sorted_lat) * 0.95)] if sorted_lat else 0.0
        return {
            "tier_0_2_pct": round(self._tier_counts["tier_0_2"] / total * 100, 1),
            "tier_3_pct": round(self._tier_counts["tier_3"] / total * 100, 1),
            "tier_4_5_pct": round(self._tier_counts["tier_4_5"] / total * 100, 1),
            "avg_latency_ms": round(self.avg_latency_ms, 1),
            "p95_latency_ms": round(p95, 1),
            "request_count": self._request_count,
        }

    def record_tier(self, tier: ModelTier, meta_action: str, *, engine: str = "") -> None:
        """Record tier usage from gateway response path."""
        self._request_count += 1
        if engine.startswith("nios_cache") or engine.startswith("nios_deterministic") or engine.startswith("nios_erp"):
            self._tier_counts["tier_0_2"] += 1
        elif engine.startswith("nios_research") and "32b" not in engine:
            self._tier_counts["tier_3"] += 1
        elif engine.startswith("nios_cascade") or "planner" in engine:
            self._tier_counts["tier_4_5"] += 1
        else:
            self._record_tier(tier, meta_action)

    def _record_tier(self, tier: ModelTier, meta_action: str) -> None:
        if meta_action in ("execute_capability", "calculate", "simulate") or tier == "none":
            self._tier_counts["tier_0_2"] += 1
        elif tier == "4b":
            self._tier_counts["tier_3"] += 1
        else:
            self._tier_counts["tier_4_5"] += 1

    def record_latency(self, ms: float) -> None:
        self._recent_latencies.append(ms)
        if len(self._recent_latencies) > 100:
            self._recent_latencies.pop(0)

    @property
    def avg_latency_ms(self) -> float:
        if not self._recent_latencies:
            return 0.0
        return sum(self._recent_latencies) / len(self._recent_latencies)

    def decide(
        self,
        *,
        meta_action: str,
        uil_confidence: float,
        cascade_model: str,
        cache_available: bool = True,
        is_complex_goal: bool = False,
    ) -> ResourceDecision:
        # Tier 0 — deterministic / tools only
        if meta_action in ("execute_capability", "calculate") and uil_confidence >= 0.85:
            return ResourceDecision(
                tier="none",
                use_cache=False,
                token_budget=512,
                reason="High-confidence deterministic path",
                latency_sla_ms=50,
            )

        # Tier 1 — semantic cache
        if cache_available and uil_confidence >= 0.7 and meta_action not in ("simulate", "debate"):
            return ResourceDecision(
                tier="none",
                use_cache=True,
                token_budget=256,
                reason="Cache-eligible query",
                latency_sla_ms=20,
            )

        # Tier 5 — multi-step planner
        if is_complex_goal or meta_action in ("simulate", "debate", "optimize"):
            return ResourceDecision(
                tier="planner",
                use_cache=False,
                token_budget=8192,
                reason="Complex goal requires planner tier",
                latency_sla_ms=120_000,
            )

        # GPU busy → downgrade 32b to 4b
        gpu_busy = self.avg_latency_ms > 5000
        if cascade_model == "32b" and gpu_busy:
            return ResourceDecision(
                tier="4b",
                use_cache=False,
                token_budget=2048,
                reason="GPU busy — downgraded from 32b",
                latency_sla_ms=800,
            )

        # Low confidence → escalate or spawn reasoner
        if uil_confidence < 0.6:
            return ResourceDecision(
                tier="32b",
                use_cache=False,
                token_budget=4096,
                reason="Low confidence — escalate to 32b",
                latency_sla_ms=15_000,
            )

        tier: ModelTier = cascade_model if cascade_model in ("none", "4b", "32b") else "4b"
        return ResourceDecision(
            tier=tier,
            use_cache=cache_available,
            token_budget=2048 if tier == "4b" else 4096,
            reason=f"Cascade tier {tier}",
            latency_sla_ms=800 if tier == "4b" else 15_000,
        )


resource_manager = ResourceManager()
