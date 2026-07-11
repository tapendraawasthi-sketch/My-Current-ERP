"""Session domain value objects."""

from __future__ import annotations

from enum import Enum


class SessionStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
