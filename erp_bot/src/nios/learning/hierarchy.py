"""Learning Hierarchy — Observation → Pattern → Knowledge → Skill → Capability."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from ..knowledge.graph.store import KnowledgeGraphStore


class LearningLevel(str, Enum):
    OBSERVATION = "observation"
    PATTERN = "pattern"
    KNOWLEDGE = "knowledge"
    SKILL = "skill"
    CAPABILITY = "capability"


@dataclass
class LearningRecord:
    id: str
    level: LearningLevel
    payload: dict[str, Any]
    cluster_key: str | None = None
    promoted_to: LearningLevel | None = None


class LearningHierarchy:
    def __init__(self, store: KnowledgeGraphStore | None = None) -> None:
        self.store = store or KnowledgeGraphStore()
        self._patterns: dict[str, list[dict]] = {}

    def observe(
        self,
        observation_type: str,
        payload: dict,
        *,
        tenant_id: str | None = None,
        company_id: str | None = None,
        session_id: str | None = None,
    ) -> LearningRecord:
        obs_id = self.store.record_observation(
            observation_type,
            payload,
            tenant_id=tenant_id,
            company_id=company_id,
            session_id=session_id,
        )
        record = LearningRecord(
            id=obs_id,
            level=LearningLevel.OBSERVATION,
            payload={"type": observation_type, **payload},
        )
        self._maybe_promote_pattern(record)
        return record

    def _maybe_promote_pattern(self, record: LearningRecord) -> None:
        key = f"{record.payload.get('type')}:{record.payload.get('intent', 'general')}"
        self._patterns.setdefault(key, []).append(record.payload)
        if len(self._patterns[key]) >= 3:
            record.promoted_to = LearningLevel.PATTERN
            record.cluster_key = key

    def promote_to_knowledge(
        self,
        cluster_key: str,
        fact: dict,
        *,
        tenant_id: str | None = None,
    ) -> str:
        node_id = self.store.add_node(
            cluster_key,
            "LearnedFact",
            properties=fact,
            tenant_id=tenant_id,
        )
        return node_id

    def suggest_capability_upgrade(self, cluster_key: str) -> dict | None:
        cluster = self._patterns.get(cluster_key, [])
        if len(cluster) < 5:
            return None
        return {
            "suggestion": "capability_threshold_adjustment",
            "cluster_key": cluster_key,
            "observation_count": len(cluster),
            "recommended_action": "Lower retrieval confidence threshold for repeated intent",
        }


learning_hierarchy = LearningHierarchy()
