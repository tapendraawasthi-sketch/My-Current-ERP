"""Learning automation — Observation → Pattern → Knowledge → Skill → Capability."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..contracts.intelligence_contract import CapabilityDescriptor
from ..kernel.capability_registry import registry
from ..marketplace.skills import SkillDescriptor, marketplace
from .hierarchy import LearningHierarchy, LearningLevel, learning_hierarchy


@dataclass
class AutomationResult:
    cluster_key: str
    promoted_levels: list[str] = field(default_factory=list)
    skill_id: str | None = None
    capability_id: str | None = None
    actions: list[str] = field(default_factory=list)


class LearningAutomation:
    """Closes the learning hierarchy loop into marketplace updates."""

    PATTERN_THRESHOLD = 3
    KNOWLEDGE_THRESHOLD = 5
    SKILL_THRESHOLD = 8
    CAPABILITY_THRESHOLD = 12

    def __init__(self, hierarchy: LearningHierarchy | None = None) -> None:
        self.hierarchy = hierarchy or learning_hierarchy
        self._auto_skills: dict[str, SkillDescriptor] = {}

    def process_cluster(self, cluster_key: str) -> AutomationResult:
        cluster = self.hierarchy._patterns.get(cluster_key, [])
        result = AutomationResult(cluster_key=cluster_key)
        n = len(cluster)

        if n >= self.PATTERN_THRESHOLD:
            result.promoted_levels.append(LearningLevel.PATTERN.value)
        if n >= self.KNOWLEDGE_THRESHOLD:
            self.hierarchy.promote_to_knowledge(cluster_key, {"cluster_size": n, "sample": cluster[-1]})
            result.promoted_levels.append(LearningLevel.KNOWLEDGE.value)
            result.actions.append("Promoted to knowledge graph")

        if n >= self.SKILL_THRESHOLD:
            skill_id = f"skill.auto.{cluster_key.replace(':', '_')}"
            intent = cluster_key.split(":")[-1] if ":" in cluster_key else cluster_key
            skill = SkillDescriptor(
                id=skill_id,
                name=f"Auto-learned: {intent}",
                version="1.0",
                tier="skill",
                capabilities=["cap.knowledge.nepal.search", "cap.chat.route"],
                description=f"Auto-composed from {n} observations",
            )
            marketplace.skills[skill_id] = skill
            self._auto_skills[skill_id] = skill
            result.skill_id = skill_id
            result.promoted_levels.append(LearningLevel.SKILL.value)
            result.actions.append(f"Registered skill {skill_id}")

        if n >= self.CAPABILITY_THRESHOLD:
            cap_id = f"cap.auto.{cluster_key.replace(':', '_')}"
            intent = cluster_key.split(":")[-1] if ":" in cluster_key else cluster_key
            if not registry.get(cap_id):
                registry.register(
                    CapabilityDescriptor(
                        id=cap_id,
                        version="1.0.0",
                        contract_version="1.0",
                        tier="capability",
                        inputs=[{"name": "query"}],
                        outputs=[{"name": "result"}],
                        provides=["auto_learned", intent if (intent := cluster_key.split(":")[-1]) else "general"],
                        requires=["cap.knowledge.nepal.search"],
                        latency_p50_ms=50,
                        cost_tier=2,
                        confidence_floor=0.8,
                        description=f"Auto-learned capability from {n} observations",
                    )
                )
            result.capability_id = cap_id
            result.promoted_levels.append(LearningLevel.CAPABILITY.value)
            result.actions.append(f"Registered capability {cap_id}")

        return result

    def run_pending(self) -> list[AutomationResult]:
        results: list[AutomationResult] = []
        for key, cluster in self.hierarchy._patterns.items():
            if len(cluster) >= self.PATTERN_THRESHOLD:
                results.append(self.process_cluster(key))
        return results


learning_automation = LearningAutomation()
