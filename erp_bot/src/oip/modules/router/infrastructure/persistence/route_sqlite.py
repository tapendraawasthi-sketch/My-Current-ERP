"""SQLite route decision repository."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Sequence

import aiosqlite

from ...application.ports.route_repository_port import RouteDecisionRepositoryPort
from ...application.read_models.routing_read_models import ProviderHealthReadModel, RoutingMetricsReadModel
from ...domain.entities import RouteCandidate, RouteDecision
from ...domain.value_objects import (
    CapabilityMatch,
    CostEstimate,
    FallbackChain,
    HealthScore,
    LatencyEstimate,
    ProviderSelection,
    QualityEstimate,
    RouteReason,
    RouteStatus,
    RoutingPolicyName,
    RoutingScore,
    ToolSelection,
)


def _utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


class SqliteRouteDecisionRepositoryAdapter(RouteDecisionRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def save(self, decision: RouteDecision) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_route_decisions (
                route_id, plan_id, request_id, tenant_id, company_id, conversation_id,
                correlation_id, status, routing_policy, edition, deployment_mode,
                primary_provider_id, fallback_providers_json, selected_tools_json,
                estimated_cost_micros, estimated_latency_ms, estimated_tokens,
                expected_quality, policy_decisions_json, reason_codes_json,
                health_snapshot_json, created_at, updated_at,
                approved_at, rejected_at, expired_at, archived_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(route_id) DO UPDATE SET
                status = excluded.status,
                updated_at = excluded.updated_at,
                approved_at = excluded.approved_at,
                rejected_at = excluded.rejected_at,
                expired_at = excluded.expired_at,
                archived_at = excluded.archived_at
            """,
            (
                decision.route_id,
                decision.plan_id,
                decision.request_id,
                decision.tenant_id,
                decision.company_id,
                decision.conversation_id,
                decision.correlation_id,
                decision.status.value,
                decision.routing_policy.value,
                decision.edition,
                decision.deployment_mode,
                decision.primary_provider.provider_id,
                json.dumps(list(decision.fallback_chain.providers)),
                json.dumps([t.model_dump(mode="json") for t in decision.selected_tools]),
                decision.estimated_cost_micros,
                decision.estimated_latency_ms,
                decision.estimated_tokens,
                decision.expected_quality,
                json.dumps(decision.policy_decisions),
                json.dumps([r.value for r in decision.reason_codes]),
                json.dumps({k: v.model_dump(mode="json") if hasattr(v, "model_dump") else v for k, v in decision.health_snapshot.items()}),
                decision.created_at.isoformat(),
                decision.updated_at.isoformat(),
                decision.approved_at.isoformat() if decision.approved_at else None,
                decision.rejected_at.isoformat() if decision.rejected_at else None,
                decision.expired_at.isoformat() if decision.expired_at else None,
                decision.archived_at.isoformat() if decision.archived_at else None,
            ),
        )
        await self._conn.execute("DELETE FROM oip_route_candidates WHERE route_id = ?", (decision.route_id,))
        for candidate in decision.candidates:
            await self._conn.execute(
                """
                INSERT INTO oip_route_candidates (
                    candidate_id, route_id, tenant_id, provider_id, rank_order, score,
                    capability_match_json, latency_estimate_ms, cost_estimate_micros,
                    quality_estimate, health_score, reason_codes_json, selected, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    candidate.candidate_id,
                    candidate.route_id,
                    candidate.tenant_id,
                    candidate.provider_id,
                    candidate.rank_order,
                    candidate.score.total,
                    json.dumps(candidate.capability_match.model_dump(mode="json")),
                    candidate.latency_estimate.estimated_ms,
                    candidate.cost_estimate.estimated_micros,
                    candidate.quality_estimate.score,
                    candidate.health_score.score,
                    json.dumps([r.value for r in candidate.reason_codes]),
                    int(candidate.selected),
                    candidate.created_at.isoformat(),
                ),
            )
        await self._conn.commit()

    async def get_by_id(self, *, tenant_id: str, route_id: str) -> RouteDecision | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_route_decisions WHERE tenant_id = ? AND route_id = ?",
            (tenant_id, route_id),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        candidates = await self._load_candidates(route_id)
        return self._row_to_decision(row, candidates)

    async def search(
        self,
        *,
        tenant_id: str,
        company_id: str | None = None,
        conversation_id: str | None = None,
        request_id: str | None = None,
        plan_id: str | None = None,
        provider_id: str | None = None,
        status: RouteStatus | None = None,
        limit: int = 50,
    ) -> Sequence[RouteDecision]:
        clauses = ["tenant_id = ?"]
        params: list = [tenant_id]
        for field, value in (
            ("company_id", company_id),
            ("conversation_id", conversation_id),
            ("request_id", request_id),
            ("plan_id", plan_id),
            ("primary_provider_id", provider_id),
        ):
            if value:
                clauses.append(f"{field} = ?")
                params.append(value)
        if status:
            clauses.append("status = ?")
            params.append(status.value)
        params.append(limit)
        cursor = await self._conn.execute(
            f"SELECT * FROM oip_route_decisions WHERE {' AND '.join(clauses)} ORDER BY created_at DESC LIMIT ?",
            tuple(params),
        )
        rows = await cursor.fetchall()
        results: list[RouteDecision] = []
        for row in rows:
            candidates = await self._load_candidates(row["route_id"])
            results.append(self._row_to_decision(row, candidates))
        return results

    async def increment_metrics(
        self,
        *,
        tenant_id: str,
        metric: str,
        estimated_latency_ms: int = 0,
        estimated_cost_micros: int = 0,
    ) -> None:
        column_map = {
            "routes_created": "routes_created",
            "routes_approved": "routes_approved",
            "routes_rejected": "routes_rejected",
            "routes_expired": "routes_expired",
            "routes_archived": "routes_archived",
        }
        column = column_map.get(metric)
        if not column:
            return
        metric_date = _utc_today()
        await self._conn.execute(
            f"""
            INSERT INTO oip_routing_metrics (tenant_id, metric_date, {column})
            VALUES (?, ?, 1)
            ON CONFLICT(tenant_id, metric_date) DO UPDATE SET {column} = {column} + 1
            """,
            (tenant_id, metric_date),
        )
        if metric == "routes_created":
            await self._conn.execute(
                """
                UPDATE oip_routing_metrics
                SET avg_estimated_latency_ms = (
                        (avg_estimated_latency_ms * MAX(routes_created - 1, 0) + ?) /
                        MAX(routes_created, 1)
                    ),
                    avg_estimated_cost_micros = (
                        (avg_estimated_cost_micros * MAX(routes_created - 1, 0) + ?) /
                        MAX(routes_created, 1)
                    )
                WHERE tenant_id = ? AND metric_date = ?
                """,
                (float(estimated_latency_ms), float(estimated_cost_micros), tenant_id, metric_date),
            )
        await self._conn.commit()

    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> RoutingMetricsReadModel:
        date = metric_date or _utc_today()
        cursor = await self._conn.execute(
            "SELECT * FROM oip_routing_metrics WHERE tenant_id = ? AND metric_date = ?",
            (tenant_id, date),
        )
        row = await cursor.fetchone()
        if not row:
            return RoutingMetricsReadModel(tenant_id=tenant_id, metric_date=date)
        return RoutingMetricsReadModel(
            tenant_id=row["tenant_id"],
            metric_date=row["metric_date"],
            routes_created=int(row["routes_created"]),
            routes_approved=int(row["routes_approved"]),
            routes_rejected=int(row["routes_rejected"]),
            routes_expired=int(row["routes_expired"]),
            routes_archived=int(row["routes_archived"]),
            avg_estimated_latency_ms=float(row["avg_estimated_latency_ms"]),
            avg_estimated_cost_micros=float(row["avg_estimated_cost_micros"]),
        )

    async def save_provider_health(self, *, record: ProviderHealthReadModel) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_provider_health (
                provider_id, tenant_id, circuit_state, availability,
                rolling_latency_ms, rolling_failure_rate, last_success_at,
                last_failure_at, last_heartbeat_at, metadata_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(provider_id) DO UPDATE SET
                circuit_state = excluded.circuit_state,
                availability = excluded.availability,
                rolling_latency_ms = excluded.rolling_latency_ms,
                rolling_failure_rate = excluded.rolling_failure_rate,
                last_success_at = excluded.last_success_at,
                last_failure_at = excluded.last_failure_at,
                last_heartbeat_at = excluded.last_heartbeat_at,
                updated_at = excluded.updated_at
            """,
            (
                record.provider_id,
                record.tenant_id,
                record.circuit_state,
                record.availability,
                record.rolling_latency_ms,
                record.rolling_failure_rate,
                record.last_success_at.isoformat() if record.last_success_at else None,
                record.last_failure_at.isoformat() if record.last_failure_at else None,
                record.last_heartbeat_at.isoformat(),
                "{}",
                record.updated_at.isoformat(),
            ),
        )
        await self._conn.commit()

    async def list_provider_health(self, *, tenant_id: str = "global") -> list[ProviderHealthReadModel]:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_provider_health WHERE tenant_id = ? OR tenant_id = 'global'",
            (tenant_id,),
        )
        rows = await cursor.fetchall()
        return [
            ProviderHealthReadModel(
                provider_id=row["provider_id"],
                tenant_id=row["tenant_id"],
                circuit_state=row["circuit_state"],
                availability=float(row["availability"]),
                rolling_latency_ms=float(row["rolling_latency_ms"]),
                rolling_failure_rate=float(row["rolling_failure_rate"]),
                last_success_at=datetime.fromisoformat(row["last_success_at"]) if row["last_success_at"] else None,
                last_failure_at=datetime.fromisoformat(row["last_failure_at"]) if row["last_failure_at"] else None,
                last_heartbeat_at=datetime.fromisoformat(row["last_heartbeat_at"]),
                updated_at=datetime.fromisoformat(row["updated_at"]),
            )
            for row in rows
        ]

    async def _load_candidates(self, route_id: str) -> tuple[RouteCandidate, ...]:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_route_candidates WHERE route_id = ? ORDER BY rank_order ASC",
            (route_id,),
        )
        rows = await cursor.fetchall()
        candidates: list[RouteCandidate] = []
        for row in rows:
            cap = json.loads(row["capability_match_json"])
            candidates.append(
                RouteCandidate(
                    candidate_id=row["candidate_id"],
                    route_id=row["route_id"],
                    tenant_id=row["tenant_id"],
                    provider_id=row["provider_id"],
                    rank_order=int(row["rank_order"]),
                    score=RoutingScore(total=float(row["score"])),
                    capability_match=CapabilityMatch(**cap),
                    latency_estimate=LatencyEstimate(estimated_ms=int(row["latency_estimate_ms"])),
                    cost_estimate=CostEstimate(estimated_micros=int(row["cost_estimate_micros"])),
                    quality_estimate=QualityEstimate(score=float(row["quality_estimate"])),
                    health_score=HealthScore(score=float(row["health_score"])),
                    reason_codes=tuple(RouteReason(v) for v in json.loads(row["reason_codes_json"]) if v in RouteReason._value2member_map_),
                    selected=bool(row["selected"]),
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
            )
        return tuple(candidates)

    @staticmethod
    def _row_to_decision(row: aiosqlite.Row, candidates: tuple[RouteCandidate, ...]) -> RouteDecision:
        primary_id = row["primary_provider_id"]
        primary_candidate = next((c for c in candidates if c.provider_id == primary_id), None)
        return RouteDecision(
            route_id=row["route_id"],
            plan_id=row["plan_id"],
            request_id=row["request_id"],
            tenant_id=row["tenant_id"],
            company_id=row["company_id"],
            conversation_id=row["conversation_id"],
            correlation_id=row["correlation_id"],
            status=RouteStatus(row["status"]),
            routing_policy=RoutingPolicyName(row["routing_policy"]),
            edition=row["edition"],
            deployment_mode=row["deployment_mode"],
            primary_provider=ProviderSelection(
                provider_id=primary_id,
                score=primary_candidate.score if primary_candidate else RoutingScore(total=0.5),
            ),
            fallback_chain=FallbackChain(providers=tuple(json.loads(row["fallback_providers_json"]))),
            selected_tools=tuple(ToolSelection(**item) for item in json.loads(row["selected_tools_json"])),
            candidates=candidates,
            estimated_cost_micros=int(row["estimated_cost_micros"]),
            estimated_latency_ms=int(row["estimated_latency_ms"]),
            estimated_tokens=int(row["estimated_tokens"]),
            expected_quality=float(row["expected_quality"]),
            policy_decisions=json.loads(row["policy_decisions_json"]),
            reason_codes=tuple(RouteReason(v) for v in json.loads(row["reason_codes_json"]) if v in RouteReason._value2member_map_),
            health_snapshot={},
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            approved_at=datetime.fromisoformat(row["approved_at"]) if row["approved_at"] else None,
            rejected_at=datetime.fromisoformat(row["rejected_at"]) if row["rejected_at"] else None,
            expired_at=datetime.fromisoformat(row["expired_at"]) if row["expired_at"] else None,
            archived_at=datetime.fromisoformat(row["archived_at"]) if row["archived_at"] else None,
        )
