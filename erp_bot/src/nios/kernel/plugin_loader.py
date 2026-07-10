"""PluginLoader — load capabilities/skills/workflows at runtime."""

from __future__ import annotations

import importlib
import logging
from dataclasses import dataclass
from typing import Any

from ..contracts.intelligence_contract import CapabilityDescriptor
from ..capabilities.runtime import ContractCapability, capability_runtime

logger = logging.getLogger(__name__)


@dataclass
class LoadedPlugin:
    plugin_id: str
    module: str
    capabilities: list[str]
    status: str


class PluginLoader:
    """Discover and register runtime capability plugins."""

    def __init__(self) -> None:
        self._plugins: dict[str, LoadedPlugin] = {}

    def load_builtin(self, registry) -> int:
        from ..capabilities.top50 import bootstrap_top50
        from ..capabilities.catalog_runtime import bootstrap_catalog_capabilities

        n1 = bootstrap_top50(registry)
        n2 = bootstrap_catalog_capabilities(registry)
        total = n1 + n2
        self._plugins["builtin.top50"] = LoadedPlugin(
            plugin_id="builtin.top50",
            module="nios.capabilities.top50",
            capabilities=capability_runtime.list_ids()[:50],
            status="loaded",
        )
        self._plugins["builtin.catalog"] = LoadedPlugin(
            plugin_id="builtin.catalog",
            module="nios.capabilities.catalog_runtime",
            capabilities=capability_runtime.list_ids(),
            status="loaded",
        )
        logger.info("[PluginLoader] Loaded %d contract capabilities (%d top50 + %d catalog)", total, n1, n2)
        return total

    def register_callable(
        self,
        descriptor: CapabilityDescriptor,
        executor,
        *,
        plugin_id: str = "dynamic",
    ) -> None:
        impl = ContractCapability(descriptor, executor)
        capability_runtime.register(impl)
        if plugin_id not in self._plugins:
            self._plugins[plugin_id] = LoadedPlugin(plugin_id, plugin_id, [], "loaded")
        self._plugins[plugin_id].capabilities.append(descriptor.id)

    def load_module(self, module_path: str, *, plugin_id: str | None = None) -> LoadedPlugin | None:
        pid = plugin_id or module_path
        try:
            mod = importlib.import_module(module_path)
            register_fn = getattr(mod, "register_plugin", None)
            if register_fn:
                caps = register_fn(capability_runtime)
                plugin = LoadedPlugin(pid, module_path, caps or [], "loaded")
                self._plugins[pid] = plugin
                return plugin
        except Exception as exc:
            logger.warning("[PluginLoader] Failed to load %s: %s", module_path, exc)
            self._plugins[pid] = LoadedPlugin(pid, module_path, [], f"error: {exc}")
        return None

    def list_plugins(self) -> list[dict[str, Any]]:
        return [
            {
                "plugin_id": p.plugin_id,
                "module": p.module,
                "capabilities": len(p.capabilities),
                "status": p.status,
            }
            for p in self._plugins.values()
        ]


plugin_loader = PluginLoader()
