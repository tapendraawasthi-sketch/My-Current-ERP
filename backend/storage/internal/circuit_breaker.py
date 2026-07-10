"""Production-grade circuit breaker for R2 operations."""

from __future__ import annotations

import enum
import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import wraps
from typing import ParamSpec, TypeVar

from backend.storage.internal.errors import StorageCircuitOpenError

P = ParamSpec("P")
T = TypeVar("T")

logger = logging.getLogger(__name__)


class CircuitState(enum.Enum):
    """Circuit breaker states."""

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreakerConfig:
    """Threshold configuration for the circuit breaker.

    Attributes:
        failure_threshold: Consecutive failures before opening the circuit.
        recovery_timeout_sec: Seconds before attempting half-open probe.
        half_open_max_calls: Successful probes required to close circuit.
        half_open_max_failures: Failures in half-open before re-opening.
    """

    failure_threshold: int = 5
    recovery_timeout_sec: float = 30.0
    half_open_max_calls: int = 3
    half_open_max_failures: int = 1


@dataclass
class CircuitBreaker:
    """Thread-safe circuit breaker preventing retry storms during outages.

    States:
        CLOSED: Normal operation; failures are counted.
        OPEN: Calls rejected immediately until recovery timeout elapses.
        HALF_OPEN: Limited probe calls allowed to test recovery.
    """

    config: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    _state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    _failure_count: int = field(default=0, init=False)
    _success_count: int = field(default=0, init=False)
    _opened_at: float | None = field(default=None, init=False)

    @property
    def state(self) -> CircuitState:
        with self._lock:
            self._maybe_transition_to_half_open()
            return self._state

    def before_call(self) -> None:
        """Raise if the circuit is open and recovery period has not elapsed."""
        with self._lock:
            self._maybe_transition_to_half_open()
            if self._state == CircuitState.OPEN:
                raise StorageCircuitOpenError(
                    "R2 circuit breaker is OPEN — requests blocked to prevent "
                    "retry storms. Retry after recovery timeout."
                )

    def record_success(self) -> None:
        """Record a successful R2 call."""
        with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.config.half_open_max_calls:
                    self._transition_to(CircuitState.CLOSED)
            elif self._state == CircuitState.CLOSED:
                self._failure_count = 0

    def record_failure(self) -> None:
        """Record a failed R2 call and open circuit when threshold exceeded."""
        with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._half_open_failures = getattr(self, "_half_open_failures", 0) + 1
                if self._half_open_failures >= self.config.half_open_max_failures:
                    self._transition_to(CircuitState.OPEN)
                return

            self._failure_count += 1
            if self._failure_count >= self.config.failure_threshold:
                self._transition_to(CircuitState.OPEN)

    def reset(self) -> None:
        """Reset breaker to closed state (for tests)."""
        with self._lock:
            self._transition_to(CircuitState.CLOSED)

    def snapshot(self) -> dict:
        """Return current breaker state for health diagnostics."""
        with self._lock:
            self._maybe_transition_to_half_open()
            return {
                "state": self._state.value,
                "failure_count": self._failure_count,
                "success_count": self._success_count,
                "failure_threshold": self.config.failure_threshold,
                "recovery_timeout_sec": self.config.recovery_timeout_sec,
            }

    def _maybe_transition_to_half_open(self) -> None:
        if self._state != CircuitState.OPEN or self._opened_at is None:
            return
        elapsed = time.monotonic() - self._opened_at
        if elapsed >= self.config.recovery_timeout_sec:
            self._transition_to(CircuitState.HALF_OPEN)

    def _transition_to(self, new_state: CircuitState) -> None:
        old = self._state
        self._state = new_state
        if new_state == CircuitState.OPEN:
            self._opened_at = time.monotonic()
            self._success_count = 0
            logger.warning("R2 circuit breaker OPENED after %d failures", self._failure_count)
        elif new_state == CircuitState.HALF_OPEN:
            self._opened_at = None
            self._success_count = 0
            self._half_open_failures = 0
            logger.info("R2 circuit breaker HALF_OPEN — probing recovery")
        elif new_state == CircuitState.CLOSED:
            self._opened_at = None
            self._failure_count = 0
            self._success_count = 0
            self._half_open_failures = 0
            if old != CircuitState.CLOSED:
                logger.info("R2 circuit breaker CLOSED — service recovered")


def with_circuit_breaker(
    func: Callable[P, T],
) -> Callable[P, T]:
    """Decorator that guards R2 service methods with the container circuit breaker."""

    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
        service = args[0]
        breaker = service._c.circuit_breaker
        if breaker is None:
            return func(*args, **kwargs)
        breaker.before_call()
        try:
            result = func(*args, **kwargs)
            breaker.record_success()
            return result
        except StorageCircuitOpenError:
            raise
        except Exception:
            breaker.record_failure()
            raise

    return wrapper
