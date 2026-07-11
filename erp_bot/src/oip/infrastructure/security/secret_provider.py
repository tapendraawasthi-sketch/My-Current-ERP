"""Environment-backed secret provider — no secrets in code."""

from __future__ import annotations

import json
import os
from typing import Any


class SecretProvider:
    def get(self, key: str, default: str = "") -> str:
        return os.getenv(key, default)

    def get_json(self, key: str) -> dict[str, Any]:
        raw = self.get(key, "{}")
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}

    def redact(self, value: str, visible: int = 4) -> str:
        if not value:
            return ""
        if len(value) <= visible:
            return "*" * len(value)
        return f"{value[:visible]}{'*' * (len(value) - visible)}"


def get_secret_provider() -> SecretProvider:
    return SecretProvider()
