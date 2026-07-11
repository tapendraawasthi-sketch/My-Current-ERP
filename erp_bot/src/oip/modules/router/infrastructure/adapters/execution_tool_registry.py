"""Registry-based execution tool catalog."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ExecutionToolMetadata(BaseModel):
    model_config = ConfigDict(frozen=True)

    tool_id: str
    category: str
    capabilities: tuple[str, ...] = Field(default_factory=tuple)
    offline_capable: bool = False
    requires_provider: bool = False


class ExecutionToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ExecutionToolMetadata] = {}

    def register(self, tool: ExecutionToolMetadata) -> None:
        self._tools[tool.tool_id] = tool

    def get(self, tool_id: str) -> ExecutionToolMetadata | None:
        return self._tools.get(tool_id)

    def list_all(self) -> tuple[ExecutionToolMetadata, ...]:
        return tuple(self._tools.values())

    def by_category(self, category: str) -> tuple[ExecutionToolMetadata, ...]:
        return tuple(t for t in self._tools.values() if t.category == category)


def create_default_execution_tool_registry() -> ExecutionToolRegistry:
    registry = ExecutionToolRegistry()
    tools = [
        ExecutionToolMetadata(tool_id="erp.ledger.balance", category="erp", capabilities=("read",)),
        ExecutionToolMetadata(tool_id="erp.journal.draft", category="erp", capabilities=("write",)),
        ExecutionToolMetadata(tool_id="erp.report.generate", category="erp", capabilities=("read", "report")),
        ExecutionToolMetadata(tool_id="knowledge.retrieve", category="knowledge", capabilities=("retrieve",)),
        ExecutionToolMetadata(tool_id="memory.recall", category="memory", capabilities=("read",)),
        ExecutionToolMetadata(tool_id="calc.arithmetic", category="calculator", capabilities=("compute",), offline_capable=True),
        ExecutionToolMetadata(tool_id="web.search", category="web", capabilities=("search",), requires_provider=True),
        ExecutionToolMetadata(tool_id="ocr.extract", category="ocr", capabilities=("ocr", "vision"), requires_provider=True),
        ExecutionToolMetadata(tool_id="vision.analyze", category="vision", capabilities=("vision",), requires_provider=True),
        ExecutionToolMetadata(tool_id="speech.transcribe", category="speech", capabilities=("speech",), requires_provider=True),
        ExecutionToolMetadata(tool_id="workflow.execute", category="workflow", capabilities=("workflow",)),
    ]
    for tool in tools:
        registry.register(tool)
    return registry
