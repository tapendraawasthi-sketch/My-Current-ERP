"""Deterministic JSON Schema export for MAI-02 contracts.

Usage:
  python -m src.oip.contracts.export_schemas
  # or from erp_bot/: python -m src.oip.contracts.export_schemas --check
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Type

from pydantic import BaseModel

from .draft_preview import DraftReferenceV1, PreviewV1, ReceiptV1
from .dialogue import IntentCandidateV1, TurnRelationV1
from .event_frame import EventFrameV1
from .evidence import ClaimV1, EvidenceItemV1
from .language import LanguageFrameV1
from .normalization import NormalizationBundleV1
from .plan_tools import PlanV1, ToolCallV1, ToolObservationV1
from .request import CanonicalAIRequestV1, ClientTurnPayloadV1
from .response import AIResponseEnvelopeV1
from .sse import SSEEventEnvelopeV1
from .transliteration import TransliterationBundleV1
from .typo_code_mix import TypoCodeMixBundleV1
from .number_roles import NumberRoleBundleV1
from .domain_lexicon import DomainLexiconBundleV1
from .response_register import ResponseRegisterBundleV1
from .language_data_governance import LanguageDataCatalogV1

SCHEMAS_DIR = Path(__file__).resolve().parent / "schemas" / "v1"

MODELS: list[tuple[str, Type[BaseModel]]] = [
    ("ClientTurnPayloadV1", ClientTurnPayloadV1),
    ("CanonicalAIRequestV1", CanonicalAIRequestV1),
    ("LanguageFrameV1", LanguageFrameV1),
    ("NormalizationBundleV1", NormalizationBundleV1),
    ("TransliterationBundleV1", TransliterationBundleV1),
    ("TypoCodeMixBundleV1", TypoCodeMixBundleV1),
    ("NumberRoleBundleV1", NumberRoleBundleV1),
    ("DomainLexiconBundleV1", DomainLexiconBundleV1),
    ("ResponseRegisterBundleV1", ResponseRegisterBundleV1),
    ("LanguageDataCatalogV1", LanguageDataCatalogV1),
    ("TurnRelationV1", TurnRelationV1),
    ("IntentCandidateV1", IntentCandidateV1),
    ("EventFrameV1", EventFrameV1),
    ("PlanV1", PlanV1),
    ("ToolCallV1", ToolCallV1),
    ("ToolObservationV1", ToolObservationV1),
    ("EvidenceItemV1", EvidenceItemV1),
    ("ClaimV1", ClaimV1),
    ("DraftReferenceV1", DraftReferenceV1),
    ("PreviewV1", PreviewV1),
    ("ReceiptV1", ReceiptV1),
    ("AIResponseEnvelopeV1", AIResponseEnvelopeV1),
    ("SSEEventEnvelopeV1", SSEEventEnvelopeV1),
]


def _stable_json(data: Any) -> str:
    return json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def model_to_schema(name: str, model: Type[BaseModel]) -> dict[str, Any]:
    schema = model.model_json_schema(mode="serialization")
    schema["$id"] = f"https://mokxya.local/contracts/v1/{name}.json"
    schema["title"] = name
    schema["x-mai-schema-version"] = "1.0.0"
    # Strip non-deterministic noise if any
    schema.pop("description", None)  # keep descriptions from fields; model-level ok
    return schema


def export_all(*, check: bool = False) -> int:
    SCHEMAS_DIR.mkdir(parents=True, exist_ok=True)
    changed = False
    for name, model in MODELS:
        path = SCHEMAS_DIR / f"{name}.json"
        payload = _stable_json(model_to_schema(name, model))
        if check:
            if not path.exists() or path.read_text(encoding="utf-8") != payload:
                print(f"DRIFT: {path}", file=sys.stderr)
                changed = True
        else:
            existing = path.read_text(encoding="utf-8") if path.exists() else None
            if existing != payload:
                path.write_text(payload, encoding="utf-8", newline="\n")
                changed = True
                print(f"wrote {path.name}")
            else:
                print(f"unchanged {path.name}")
    index = {
        "schema_version": "1.0.0",
        "contracts": [name for name, _ in MODELS],
        "regenerate": "python -m src.oip.contracts.export_schemas",
    }
    index_path = SCHEMAS_DIR / "index.json"
    index_text = _stable_json(index)
    if check:
        if not index_path.exists() or index_path.read_text(encoding="utf-8") != index_text:
            print(f"DRIFT: {index_path}", file=sys.stderr)
            changed = True
    else:
        if not index_path.exists() or index_path.read_text(encoding="utf-8") != index_text:
            index_path.write_text(index_text, encoding="utf-8", newline="\n")
            changed = True
    if check and changed:
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Export MAI-02 JSON Schemas")
    parser.add_argument("--check", action="store_true", help="Fail if schemas drift")
    args = parser.parse_args(argv)
    return export_all(check=args.check)


if __name__ == "__main__":
    raise SystemExit(main())
