"""MAI-31 slice 2 — consume EventFrame→port mapping into draft payload candidates.

Default: PAYLOAD_ONLY (build field_overrides candidate; never call start_or_merge_*).
Optional allow_port_invoke is for isolated unit tests only — not wired on live ingress.
Never journal math, Dexie, or mode_aware.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.domain_port_mapping import (
    DomainPortMappingBundleV1,
    DomainPortMappingStatus,
    DomainPortSupportStatus,
)
from ....contracts.event_frame import EventFrameV1
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-31.0.2-slice2"
AUTHORITY = "ADR_0048"


def _as_mapping_meta(
    mapping: Mapping[str, Any] | DomainPortMappingBundleV1 | None,
) -> dict[str, Any] | None:
    if mapping is None:
        return None
    if isinstance(mapping, DomainPortMappingBundleV1):
        from .domain_port_mapping_service import domain_port_mapping_to_metadata

        return domain_port_mapping_to_metadata(mapping)
    if isinstance(mapping, Mapping):
        return dict(mapping)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("port_executed") is True
        or data.get("dexie_invoked") is True
        or data.get("journal_calculated") is True
        or data.get("mode_aware_invoked") is True
        or int(data.get("draft_mutations") or 0) != 0
        or str(data.get("master_lookup_mode") or "ANNOTATION_ONLY")
        not in {"", "ANNOTATION_ONLY"}
    )


def resolve_port_consume_mode(
    mapping: Mapping[str, Any] | DomainPortMappingBundleV1 | None,
    *,
    allow_port_invoke: bool = False,
) -> str:
    """Return consume mode (never implies drafts written on default path)."""
    data = _as_mapping_meta(mapping)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != DomainPortMappingStatus.COMPLETE.value:
        return "SKIP"
    support = str(data.get("support_status") or "")
    if support == DomainPortSupportStatus.UNSUPPORTED.value:
        return "BLOCKED"
    if support == DomainPortSupportStatus.INCOMPLETE.value:
        return "BLOCKED"
    if support != DomainPortSupportStatus.SUPPORTED.value:
        return "SKIP"
    if allow_port_invoke:
        return "INVOKE_START_OR_MERGE"
    return "PAYLOAD_ONLY"


def _field_value_as_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    # MoneyV1 / DateValueV1 / IdentifierV1 / QuantityV1 style objects
    amount = getattr(value, "amount", None)
    if amount is not None:
        return str(amount)
    iso = getattr(value, "iso_date", None) or getattr(value, "value", None)
    if iso is not None:
        return str(iso)
    text = getattr(value, "text", None) or getattr(value, "id", None)
    if text is not None:
        return str(text)
    if isinstance(value, Mapping):
        for key in ("amount", "iso_date", "value", "text", "id"):
            if value.get(key) is not None:
                return str(value[key])
    return str(value)


def _extract_event_fields(frame: EventFrameV1 | None) -> dict[str, str]:
    if frame is None:
        return {}
    out: dict[str, str] = {}
    for fv in frame.values or ():
        name = getattr(fv, "field_name", None) or ""
        if not name:
            continue
        raw = getattr(fv, "normalized_value", None)
        parsed = _field_value_as_str(raw)
        if parsed is not None:
            out[str(name)] = parsed
    # Parties may carry a display name when values lack party.
    if "party" not in out and frame.parties:
        first = frame.parties[0]
        if isinstance(first, Mapping):
            for key in ("name", "party", "display_name", "label"):
                if first.get(key):
                    out["party"] = str(first[key])
                    break
    return out


def build_draft_payload_candidate(
    mapping: Mapping[str, Any] | DomainPortMappingBundleV1 | None,
    frame: EventFrameV1 | None,
    *,
    allow_port_invoke: bool = False,
) -> dict[str, Any]:
    """Map EventFrame values through bindings → draft field_overrides candidate."""
    data = _as_mapping_meta(mapping)
    mode = resolve_port_consume_mode(data, allow_port_invoke=allow_port_invoke)
    base: dict[str, Any] = {
        "port_consume_mode": mode,
        "port_consume_ready": False,
        "entrypoint": None,
        "port_id": None,
        "event_type": (data or {}).get("event_type") if data else None,
        "field_overrides": {},
        "missing_required": [],
        "support_status": (data or {}).get("support_status") if data else None,
        "ready": False,
        "port_executed": False,
        "draft_mutations": 0,
        "dexie_invoked": False,
        "journal_calculated": False,
        "mode_aware_invoked": False,
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
    }
    if data is None or mode in {"UNCHANGED", "SKIP", "BLOCKED"}:
        if mode == "BLOCKED" and data is not None:
            base["entrypoint"] = data.get("selected_draft_entrypoint")
            base["port_id"] = data.get("selected_port_id")
            base["missing_required"] = list(
                getattr(frame, "missing_required_fields", None) or []
            ) if frame is not None else []
        return base

    entrypoint = data.get("selected_draft_entrypoint")
    port_id = data.get("selected_port_id")
    event_fields = _extract_event_fields(frame)
    overrides: dict[str, str] = {}
    missing_required: list[str] = []

    bindings: list[Any] = []
    if isinstance(mapping, DomainPortMappingBundleV1):
        bindings = list(mapping.field_bindings or ())
    # Fallback: use known binding names from metadata only when bundle not typed.
    if not bindings and isinstance(mapping, Mapping):
        # Cannot rebuild full bindings from flat meta; leave overrides empty.
        bindings = []

    for binding in bindings:
        event_field = getattr(binding, "event_field", None) or (
            binding.get("event_field") if isinstance(binding, Mapping) else None
        )
        draft_field = getattr(binding, "draft_field", None) or (
            binding.get("draft_field") if isinstance(binding, Mapping) else None
        )
        required = bool(
            getattr(binding, "required", False)
            if not isinstance(binding, Mapping)
            else binding.get("required")
        )
        if not event_field or not draft_field:
            continue
        val = event_fields.get(str(event_field))
        if val is not None:
            overrides[str(draft_field)] = val
        elif required:
            missing_required.append(str(event_field))

    # Also surface frame.missing_required_fields.
    if frame is not None:
        for m in frame.missing_required_fields or ():
            if m not in missing_required:
                missing_required.append(str(m))

    ready = (
        mode == "PAYLOAD_ONLY"
        and bool(entrypoint)
        and not missing_required
        and bool(overrides)
    )
    # SUPPORTED with empty overrides still candidate-ready if no required missing
    # (message-driven entrypoints may fill later).
    if (
        mode == "PAYLOAD_ONLY"
        and bool(entrypoint)
        and not missing_required
        and str(data.get("support_status")) == DomainPortSupportStatus.SUPPORTED.value
    ):
        ready = True

    base.update(
        {
            "entrypoint": entrypoint,
            "port_id": port_id,
            "field_overrides": overrides,
            "missing_required": missing_required,
            "port_consume_ready": ready,
            "ready": ready,
        }
    )
    return base


def domain_port_consume_observability(
    mapping: Mapping[str, Any] | DomainPortMappingBundleV1 | None,
    frame: EventFrameV1 | None,
    *,
    allow_port_invoke: bool = False,
) -> dict[str, Any]:
    candidate = build_draft_payload_candidate(
        mapping, frame, allow_port_invoke=allow_port_invoke
    )
    return {
        "port_consume_mode": candidate["port_consume_mode"],
        "port_consume_ready": bool(candidate["port_consume_ready"]),
        "draft_payload_candidate": {
            "entrypoint": candidate.get("entrypoint"),
            "port_id": candidate.get("port_id"),
            "event_type": candidate.get("event_type"),
            "field_overrides": dict(candidate.get("field_overrides") or {}),
            "missing_required": list(candidate.get("missing_required") or []),
            "ready": bool(candidate.get("ready")),
        },
        "port_executed": False,
        "draft_mutations": 0,
        "dexie_invoked": False,
        "journal_calculated": False,
        "mode_aware_invoked": False,
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_port_invoke": False,  # live path always false
    }


def assert_domain_port_consume_authority(obs: Mapping[str, Any] | None) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("port_executed") is True
        or obs.get("dexie_invoked") is True
        or obs.get("journal_calculated") is True
        or obs.get("mode_aware_invoked") is True
        or int(obs.get("draft_mutations") or 0) != 0
        or obs.get("allow_port_invoke") is True
    ):
        raise RuntimeError("DOMAIN_PORT_CONSUME_AUTHORITY")


def enrich_mapping_metadata_with_consume(
    mapping_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
    *,
    allow_port_invoke: bool = False,
) -> dict[str, Any]:
    """Merge consume observability into domain_port_mapping metadata dict."""
    out = dict(mapping_meta)
    obs = domain_port_consume_observability(
        request.domain_port_mapping_bundle,
        request.event_frame,
        allow_port_invoke=allow_port_invoke,
    )
    # Force live authority flags.
    obs["allow_port_invoke"] = False
    obs["port_executed"] = False
    obs["draft_mutations"] = 0
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
