"""Memory Runtime domain value objects."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MemoryType(str, Enum):
    CONVERSATION = "ConversationMemory"
    EXECUTION = "ExecutionMemory"
    KNOWLEDGE = "KnowledgeMemory"
    ERP_CONTEXT = "ERPContextMemory"
    PREFERENCE = "PreferenceMemory"
    PATTERN = "PatternMemory"
    FAILURE = "FailureMemory"
    BUSINESS = "BusinessMemory"
    SEMANTIC = "SemanticMemory"


class Importance(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Freshness(str, Enum):
    HOT = "Hot"
    WARM = "Warm"
    COLD = "Cold"
    ARCHIVED = "Archived"


class RetentionPolicy(str, Enum):
    FOREVER = "Forever"
    TEN_YEARS = "10 Years"
    SEVEN_YEARS = "7 Years"
    FISCAL_YEAR = "Fiscal Year"
    CONVERSATION = "Conversation"
    SESSION = "Session"
    TEMPORARY = "Temporary"


class MemoryCategory(str, Enum):
    CONVERSATION = "Conversation"
    KNOWLEDGE = "Knowledge"
    ERP = "ERP"
    PREFERENCE = "Preference"
    WORKFLOW = "Workflow"
    EXECUTION = "Execution"
    PATTERN = "Pattern"
    FAILURE = "Failure"
    BUSINESS = "Business"
    SEMANTIC = "Semantic"


class RecallMode(str, Enum):
    EXACT = "Exact"
    SEMANTIC = "Semantic"
    HYBRID = "Hybrid"
    TIMELINE = "Timeline"
    PATTERN = "Pattern"
    CONTEXT = "Context"


class CollectionScope(str, Enum):
    CURRENT_CONVERSATION = "Current Conversation"
    ACCOUNTING_SESSION = "Accounting Session"
    CUSTOMER = "Customer"
    COMPANY = "Company"
    PROJECT = "Project"
    WORKFLOW = "Workflow"
    FISCAL_YEAR = "Fiscal Year"
    BRANCH = "Branch"
    GLOBAL = "Global"


class MemoryHash(BaseModel):
    model_config = ConfigDict(frozen=True)

    hash_value: str
    content_version: str = "1.0"


class PayloadHash(BaseModel):
    model_config = ConfigDict(frozen=True)

    hash_value: str
    algorithm: str = "sha256"


class EntityRef(BaseModel):
    model_config = ConfigDict(frozen=True)

    entity_type: str
    entity_id: str
    label: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryLineage(BaseModel):
    model_config = ConfigDict(frozen=True)

    nodes: tuple[str, ...] = Field(default_factory=tuple)
    source_module: str = ""
    parent_memory_id: str | None = None


class RecallScore(BaseModel):
    model_config = ConfigDict(frozen=True)

    combined: float
    lexical: float = 0.0
    semantic: float = 0.0
    importance: float = 0.0
    freshness: float = 0.0
    authority: float = 0.0


class MemoryStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    EXPIRED = "expired"
    MERGED = "merged"
    DELETED = "deleted"
