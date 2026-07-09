"""Typed tool registration and dispatch for Orbix v2."""

from __future__ import annotations

from typing import Any, Awaitable, Callable

from pydantic import BaseModel

from ..schemas import ToolResult

ToolHandler = Callable[[dict[str, Any]], Awaitable[ToolResult]]


class ToolSpec(BaseModel):
    name: str
    description: str
    input_schema: dict[str, Any]
    read_only: bool = True
    requires_confirmation: bool = False


class RegisteredTool(BaseModel):
    spec: ToolSpec
    handler: ToolHandler

    class Config:
        arbitrary_types_allowed = True


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, RegisteredTool] = {}

    def register(self, spec: ToolSpec, handler: ToolHandler) -> None:
        self._tools[spec.name] = RegisteredTool(spec=spec, handler=handler)

    def get(self, name: str) -> RegisteredTool | None:
        return self._tools.get(name)

    def has(self, name: str) -> bool:
        return name in self._tools

    def list_specs(self) -> list[dict[str, Any]]:
        """OpenAI/Ollama function-tool schema list."""
        out: list[dict[str, Any]] = []
        for tool in self._tools.values():
            out.append(
                {
                    "type": "function",
                    "function": {
                        "name": tool.spec.name,
                        "description": tool.spec.description,
                        "parameters": tool.spec.input_schema,
                    },
                }
            )
        return out

    def describe_for_prompt(self) -> str:
        lines: list[str] = []
        for tool in self._tools.values():
            props = tool.spec.input_schema.get("properties", {})
            arg_names = ", ".join(props.keys()) or "(none)"
            flags = []
            if not tool.spec.read_only:
                flags.append("mutating")
            if tool.spec.requires_confirmation:
                flags.append("needs-confirmation")
            flag_str = f" [{', '.join(flags)}]" if flags else ""
            lines.append(f"- {tool.spec.name}({arg_names}){flag_str}: {tool.spec.description}")
        return "\n".join(lines)

    async def call(self, name: str, args: dict[str, Any]) -> ToolResult:
        tool = self._tools.get(name)
        if not tool:
            return ToolResult(ok=False, error=f"Unknown tool: {name}")
        try:
            return await tool.handler(args or {})
        except Exception as exc:  # defensive: tools must never crash the loop
            return ToolResult(ok=False, error=f"{name} failed: {exc}")


def build_default_registry() -> ToolRegistry:
    """Assemble the standard Orbix toolset."""
    from . import code_tools, ledger_tools, web_tools

    registry = ToolRegistry()
    code_tools.register(registry)
    ledger_tools.register(registry)
    web_tools.register(registry)
    return registry
