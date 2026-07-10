"""NIOS Event Bus — in-process pub/sub (Phase 0)."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable
from uuid import uuid4

logger = logging.getLogger(__name__)

EventHandler = Callable[["NiosEvent"], None]


@dataclass
class NiosEvent:
    id: str
    type: str
    timestamp: str
    payload: dict[str, Any]
    tenant_id: str | None = None
    company_id: str | None = None
    session_id: str | None = None


class EventBus:
  def __init__(self) -> None:
      self._handlers: dict[str, list[EventHandler]] = {}

  def subscribe(self, event_type: str, handler: EventHandler) -> Callable[[], None]:
      self._handlers.setdefault(event_type, []).append(handler)

      def unsubscribe() -> None:
          if event_type in self._handlers:
              try:
                  self._handlers[event_type].remove(handler)
              except ValueError:
                  pass

      return unsubscribe

  def emit(
      self,
      event_type: str,
      payload: dict[str, Any],
      *,
      tenant_id: str | None = None,
      company_id: str | None = None,
      session_id: str | None = None,
  ) -> NiosEvent:
      event = NiosEvent(
          id=str(uuid4()),
          type=event_type,
          timestamp=datetime.now(timezone.utc).isoformat(),
          payload=payload,
          tenant_id=tenant_id,
          company_id=company_id,
          session_id=session_id,
      )
      for handler in self._handlers.get(event_type, []):
          try:
              handler(event)
          except Exception as exc:
              logger.warning("EventBus handler error for %s: %s", event_type, exc)
      for handler in self._handlers.get("*", []):
          try:
              handler(event)
          except Exception as exc:
              logger.warning("EventBus wildcard handler error: %s", exc)
      return event


event_bus = EventBus()
