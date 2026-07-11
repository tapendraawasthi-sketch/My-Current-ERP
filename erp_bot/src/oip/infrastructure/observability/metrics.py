"""Prometheus-compatible metrics registry."""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field


@dataclass
class _Counter:
    name: str
    help: str
    labels: tuple[str, ...]
    values: dict[tuple[tuple[str, str], ...], float] = field(default_factory=lambda: defaultdict(float))

    def inc(self, amount: float = 1.0, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        self.values[key] += amount


@dataclass
class _Histogram:
    name: str
    help: str
    labels: tuple[str, ...]
    buckets: tuple[float, ...]
    observations: dict[tuple[tuple[str, str], ...], list[float]] = field(
        default_factory=lambda: defaultdict(list)
    )

    def observe(self, value: float, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        self.observations[key].append(value)


@dataclass
class _Gauge:
    name: str
    help: str
    labels: tuple[str, ...]
    values: dict[tuple[tuple[str, str], ...], float] = field(default_factory=dict)

    def set(self, value: float, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        self.values[key] = value


class OipMetricsRegistry:
    """Thread-safe in-memory metrics with Prometheus text exposition."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counters: dict[str, _Counter] = {}
        self._histograms: dict[str, _Histogram] = {}
        self._gauges: dict[str, _Gauge] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        self.counter(
            "oip_requests_total",
            "Total command/query dispatches",
            ("bus", "operation"),
        )
        self.counter(
            "oip_failures_total",
            "Total failures",
            ("component", "reason"),
        )
        self.counter(
            "oip_retries_total",
            "Total retries",
            ("component",),
        )
        self.counter(
            "oip_outbox_published_total",
            "Outbox messages published",
            (),
        )
        self.counter(
            "oip_outbox_failed_total",
            "Outbox publish failures",
            (),
        )
        self.counter(
            "oip_inbox_duplicates_total",
            "Inbox duplicate suppressions",
            ("consumer_group",),
        )
        self.histogram(
            "oip_stage_latency_seconds",
            "Workflow stage latency",
            ("stage",),
            buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0),
        )
        self.histogram(
            "oip_provider_latency_seconds",
            "Provider runtime latency",
            ("provider",),
            buckets=(0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0, 120.0),
        )
        self.histogram(
            "oip_erp_latency_seconds",
            "ERP connector latency",
            ("connector",),
            buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0),
        )
        self.histogram(
            "oip_workflow_latency_seconds",
            "End-to-end workflow latency",
            (),
            buckets=(0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0),
        )
        self.gauge("oip_outbox_queue_depth", "Unpublished outbox messages", ())
        self.gauge("oip_outbox_dlq_depth", "Dead-letter outbox messages", ())
        self.gauge("oip_active_workflows", "Active workflow executions", ("tenant_id",))
        self.gauge("oip_active_streams", "Active streaming sessions", ())
        self.gauge("oip_concurrent_executions", "Concurrent provider executions", ())

    def counter(self, name: str, help_text: str, labels: tuple[str, ...]) -> _Counter:
        with self._lock:
            counter = _Counter(name=name, help=help_text, labels=labels)
            self._counters[name] = counter
            return counter

    def histogram(
        self,
        name: str,
        help_text: str,
        labels: tuple[str, ...],
        *,
        buckets: tuple[float, ...],
    ) -> _Histogram:
        with self._lock:
            hist = _Histogram(name=name, help=help_text, labels=labels, buckets=buckets)
            self._histograms[name] = hist
            return hist

    def gauge(self, name: str, help_text: str, labels: tuple[str, ...]) -> _Gauge:
        with self._lock:
            gauge = _Gauge(name=name, help=help_text, labels=labels)
            self._gauges[name] = gauge
            return gauge

    def inc_counter(self, name: str, amount: float = 1.0, **labels: str) -> None:
        counter = self._counters.get(name)
        if counter:
            counter.inc(amount, **labels)

    def observe_histogram(self, name: str, value: float, **labels: str) -> None:
        hist = self._histograms.get(name)
        if hist:
            hist.observe(value, **labels)

    def set_gauge(self, name: str, value: float, **labels: str) -> None:
        gauge = self._gauges.get(name)
        if gauge:
            gauge.set(value, **labels)

    def render_prometheus(self) -> str:
        lines: list[str] = []
        with self._lock:
            for counter in self._counters.values():
                lines.append(f"# HELP {counter.name} {counter.help}")
                lines.append(f"# TYPE {counter.name} counter")
                for label_key, value in counter.values.items():
                    label_str = self._format_labels(label_key)
                    lines.append(f"{counter.name}{label_str} {value}")
            for gauge in self._gauges.values():
                lines.append(f"# HELP {gauge.name} {gauge.help}")
                lines.append(f"# TYPE {gauge.name} gauge")
                for label_key, value in gauge.values.items():
                    label_str = self._format_labels(label_key)
                    lines.append(f"{gauge.name}{label_str} {value}")
            for hist in self._histograms.values():
                lines.append(f"# HELP {hist.name} {hist.help}")
                lines.append(f"# TYPE {hist.name} histogram")
                for label_key, observations in hist.observations.items():
                    label_str = self._format_labels(label_key)
                    counts = [0] * (len(hist.buckets) + 1)
                    total = 0.0
                    for obs in observations:
                        total += obs
                        placed = False
                        for idx, bound in enumerate(hist.buckets):
                            if obs <= bound:
                                counts[idx] += 1
                                placed = True
                                break
                        if not placed:
                            counts[-1] += 1
                    cumulative = 0
                    for idx, bound in enumerate(hist.buckets):
                        cumulative += counts[idx]
                        bucket_labels = f'{label_str[:-1]},le="{bound}"}}' if label_str else f'{{le="{bound}"}}'
                        lines.append(f"{hist.name}_bucket{bucket_labels} {cumulative}")
                    inf_labels = f'{label_str[:-1]},le="+Inf"}}' if label_str else '{le="+Inf"}'
                    lines.append(f"{hist.name}_bucket{inf_labels} {len(observations)}")
                    lines.append(f"{hist.name}_sum{label_str} {total}")
                    lines.append(f"{hist.name}_count{label_str} {len(observations)}")
        return "\n".join(lines) + "\n"

    @staticmethod
    def _format_labels(label_key: tuple[tuple[str, str], ...]) -> str:
        if not label_key:
            return ""
        inner = ",".join(f'{k}="{v}"' for k, v in label_key)
        return "{" + inner + "}"


_metrics_registry: OipMetricsRegistry | None = None


def get_metrics_registry() -> OipMetricsRegistry:
    global _metrics_registry
    if _metrics_registry is None:
        _metrics_registry = OipMetricsRegistry()
    return _metrics_registry
