"""MAI-07R3B — governed review import, Option A policy lock, V2 eval semantics plan.

Governance/import only. Does not tune rankers, enable overlays, mutate frozen V1,
run frozen quality as a pass attempt, or start MAI-08.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable, Mapping

REPO = Path(__file__).resolve().parents[7]
REVIEW_ROOT = REPO / "docs" / "mokxya-ai" / "reviews" / "mai07r3"
RUNTIME_APP = Path(__file__).resolve().parent
RUNTIME_INFRA = RUNTIME_APP.parent / "infrastructure"

SCHEMA_ID = "mai07r3_review_import_v1"
BULK_PROVENANCE = "EXPLICIT_USER_AUTHORIZED_BULK_SCHEMA_MAPPING"
PRODUCT_POLICY = "OPTION_A_CONSERVATIVE_IDENTITY_POLICY"
ADR_STATUS = "PRODUCT_POLICY_APPROVED_IMPLEMENTATION_PENDING"

EXPECTED_HASHES = {
    "round_a_locked": "f01270e3017162259d2d305e158e86e386eb86841e4928b99546cd613d037f49",
    "round_b_broad_locked": "79e229ebb381f76599e83c68a69fd40324a1efba196202e82afa15bfc44c8a61",
    "round_b_official": "642bc6f39d6eb2797974e704cd32034f520abf0c5df43cb8aa9dcb06a8438021",
    "blind_mapping": "b6888bfd207d0dd225ecf2c9d403dad9a5c761eede1ddcfba4cd97d1701bcfd6",
    "review_schema": "e802be835e61c555ba7699b1bbed65ae597322b1d5c8cb075341e4d23e66e48a",
    "import_completed": "6cfb5a7bdaacfb3a4bbe63a4d35c5e6077dadb0e620c22454413a774ef2ce9e3",
    "frozen_v1_dataset": "5637ccd973173edde3637ce0aeca8e8647431614940fb8a06ceb102e1c736208",
    "active_resource": "18628335c0feb74a4f28f65ca70b2683f8b54a54790fd03e9033d8cd08ed4566",
    "active_semantic": "b28e8240bf0c4faa1253212c40e721f77148516fb3a2a3303582303b8a035849",
    "bulk_decision": "4567504dc10443893f87b69fa46718722c747ee33c0384a2fac007f29362380d",
    "evaluation_semantics_v2": "54e92c5933a55b14043eed1f2c78ec7e3ef615c7896a50092c7cea1d5c05ae24",
    "unblinded_adjudication": "6550d62c73d7deb475c6932df7445f26a355ae02b75f08d3d423b7aebcf32359",
}

BULK_MAPPING = {
    "ACCEPTABLE": "ACCEPTABLE_PREFERRED",
    "UNACCEPTABLE": "UNNATURAL_BUT_POSSIBLE",
    "CANNOT_DECIDE": "CANNOT_DECIDE",
}

OFFICIAL_B_COUNTS = {
    "ACCEPTABLE_PREFERRED": 223,
    "UNNATURAL_BUT_POSSIBLE": 36,
    "CANNOT_DECIDE": 4,
    "ACCEPTABLE_ALTERNATIVE": 0,
    "INCORRECT": 0,
}

EXPECTED_COUNTS = {
    "round_a": 149,
    "round_b": 263,
    "mapping": 149,
    "conflicts": 49,
}

# Mapping file use is adjudication-import only — never runtime/training/reviewer UI.
MAPPING_ALLOWED_USES = frozenset({"adjudication_import_only"})
FORBIDDEN_MAPPING_CONSUMER_TOKENS = (
    "reviews.mai07r3",
    "MAI_07R3_BLIND_MAPPING",
    "blind_mapping",
)


class Mai07R3BImportError(ValueError):
    """Fail-closed review-import / policy validation error."""


@dataclass(frozen=True)
class RoundAEntry:
    review_id: str
    span_class: str
    preferred_rank_policy: str
    devanagari_retention: str
    confidence: str
    reasoning: str


@dataclass(frozen=True)
class RoundBEntry:
    review_id: str
    candidate_index: int
    acceptability: str


@dataclass(frozen=True)
class MappingEntry:
    review_id: str
    case_id: str
    candidate_order_indices: tuple[int, ...]


@dataclass(frozen=True)
class AdjudicatedCandidate:
    presentation_candidate_index: int
    source_candidate_index: int
    acceptability: str
    top1_eligible: bool
    role_hint: str  # IDENTITY | DEVANAGARI | UNKNOWN


@dataclass(frozen=True)
class AdjudicatedCase:
    review_id: str
    case_id: str
    round_a: RoundAEntry
    evaluation_policy_bucket: str
    candidates: tuple[AdjudicatedCandidate, ...]
    unique_top1_gold_eligible: bool
    unique_top1_source_candidate_index: int | None
    ambiguity_reason: str | None
    issues: tuple[str, ...]
    prohibited_for_training: bool = True


@dataclass(frozen=True)
class ReviewImportObject:
    schema: str
    round_a: tuple[RoundAEntry, ...]
    round_b: tuple[RoundBEntry, ...]
    prohibited_for_training: bool = True
    provenance: str = BULK_PROVENANCE
    professional_linguist_adjudication: bool = False
    row_by_row_five_label_review_performed: bool = False
    production_approved: bool = False
    linguist_approved: bool = False


@dataclass
class ImportValidationReport:
    ok: bool
    import_semantic_hash: str
    counts: dict[str, int] = field(default_factory=dict)
    official_b_counts: dict[str, int] = field(default_factory=dict)
    hashes: dict[str, str] = field(default_factory=dict)
    policy: dict[str, Any] = field(default_factory=dict)
    adjudicated_cases: list[AdjudicatedCase] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_review_schema(review_root: Path = REVIEW_ROOT) -> dict[str, Any]:
    path = review_root / "MAI_07R3_REVIEW_SCHEMA.json"
    _require_hash(path, EXPECTED_HASHES["review_schema"], "review_schema")
    return json.loads(path.read_text(encoding="utf-8"))


def load_blind_mapping(review_root: Path = REVIEW_ROOT) -> dict[str, Any]:
    path = review_root / "MAI_07R3_BLIND_MAPPING.json"
    _require_hash(path, EXPECTED_HASHES["blind_mapping"], "blind_mapping")
    data = json.loads(path.read_text(encoding="utf-8"))
    use = data.get("use")
    if use not in MAPPING_ALLOWED_USES:
        raise Mai07R3BImportError(
            f"blind mapping use={use!r} rejected; adjudication_import_only required"
        )
    return data


def _require_hash(path: Path, expected: str, label: str) -> str:
    if not path.exists():
        raise Mai07R3BImportError(f"missing artifact for {label}: {path.name}")
    actual = sha256_file(path)
    if actual != expected:
        raise Mai07R3BImportError(
            f"hash mismatch for {label}: expected={expected} actual={actual}"
        )
    return actual


def _validate_enum(value: str, allowed: Iterable[str], field_name: str) -> None:
    if value not in set(allowed):
        raise Mai07R3BImportError(f"invalid enum for {field_name}: {value!r}")


def parse_round_a_entry(raw: Mapping[str, Any], schema: dict[str, Any]) -> RoundAEntry:
    enums = schema["round_a_enums"]
    review_id = str(raw["review_id"])
    span_class = str(raw["span_class"])
    preferred = str(raw["preferred_rank_policy"])
    retention = str(raw["devanagari_retention"])
    confidence = str(raw["confidence"])
    reasoning = str(raw.get("reasoning") or "")
    _validate_enum(span_class, enums["span_class"], "span_class")
    _validate_enum(preferred, enums["preferred_rank_policy"], "preferred_rank_policy")
    _validate_enum(retention, enums["devanagari_retention"], "devanagari_retention")
    _validate_enum(confidence, enums["confidence"], "confidence")
    return RoundAEntry(
        review_id=review_id,
        span_class=span_class,
        preferred_rank_policy=preferred,
        devanagari_retention=retention,
        confidence=confidence,
        reasoning=reasoning,
    )


def parse_round_b_entry(raw: Mapping[str, Any], schema: dict[str, Any]) -> RoundBEntry:
    enums = schema["round_b_enums"]
    review_id = str(raw["review_id"])
    try:
        idx = int(raw["candidate_index"])
    except (TypeError, ValueError) as exc:
        raise Mai07R3BImportError(
            f"invalid candidate_index for {review_id}: {raw.get('candidate_index')!r}"
        ) from exc
    acceptability = str(raw["acceptability"])
    _validate_enum(acceptability, enums["acceptability"], "acceptability")
    if idx < 0:
        raise Mai07R3BImportError(f"negative candidate_index for {review_id}")
    return RoundBEntry(
        review_id=review_id, candidate_index=idx, acceptability=acceptability
    )


def parse_import_object(
    raw: Mapping[str, Any], schema: dict[str, Any]
) -> ReviewImportObject:
    if raw.get("schema") != SCHEMA_ID:
        raise Mai07R3BImportError(
            f"unsupported import schema: {raw.get('schema')!r}; expected {SCHEMA_ID}"
        )
    # Reject inflated approval claims on the wire object.
    if raw.get("professional_linguist_adjudication") is True:
        raise Mai07R3BImportError(
            "rejected: import must not claim professional_linguist_adjudication"
        )
    if raw.get("linguist_approved") is True or raw.get("production_approved") is True:
        raise Mai07R3BImportError(
            "rejected: import must not claim linguist/production approval"
        )
    if raw.get("row_by_row_five_label_review_performed") is True:
        raise Mai07R3BImportError(
            "rejected: bulk mapping must not claim row-by-row five-label review"
        )
    round_a = tuple(parse_round_a_entry(x, schema) for x in raw.get("round_a") or [])
    round_b = tuple(parse_round_b_entry(x, schema) for x in raw.get("round_b") or [])
    return ReviewImportObject(
        schema=SCHEMA_ID,
        round_a=round_a,
        round_b=round_b,
        prohibited_for_training=True,
        provenance=str(raw.get("provenance") or BULK_PROVENANCE),
        professional_linguist_adjudication=False,
        row_by_row_five_label_review_performed=False,
        production_approved=False,
        linguist_approved=False,
    )


def load_completed_import(path: Path, schema: dict[str, Any]) -> ReviewImportObject:
    _require_hash(path, EXPECTED_HASHES["import_completed"], "import_completed")
    lines = [ln for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    if len(lines) != 1:
        raise Mai07R3BImportError(
            f"completed import must contain exactly one JSON object; found {len(lines)}"
        )
    return parse_import_object(json.loads(lines[0]), schema)


def parse_mapping_entries(mapping: dict[str, Any]) -> tuple[MappingEntry, ...]:
    entries_raw = mapping.get("entries") or []
    out: list[MappingEntry] = []
    seen: set[str] = set()
    for e in entries_raw:
        rid = str(e["review_id"])
        if rid in seen:
            raise Mai07R3BImportError(f"duplicate mapping review_id: {rid}")
        seen.add(rid)
        indices = tuple(int(x) for x in e["candidate_order_indices"])
        out.append(
            MappingEntry(
                review_id=rid,
                case_id=str(e["case_id"]),
                candidate_order_indices=indices,
            )
        )
    if len(out) != EXPECTED_COUNTS["mapping"]:
        raise Mai07R3BImportError(
            f"mapping entries count {len(out)} != {EXPECTED_COUNTS['mapping']}"
        )
    return tuple(out)


def population_bucket_from_round_a(policy: str) -> str:
    """Round A is the sole population authority for V2 evaluation semantics."""
    if policy == "DEVANAGARI_TARGET_REQUIRED":
        return "TRANSLITERATION_REQUIRED"
    if policy in {"LATIN_IDENTITY_REQUIRED", "NO_TRANSLITERATION_ALLOWED"}:
        return "IDENTITY_REQUIRED"
    if policy == "LATIN_IDENTITY_PREFERRED_TARGET_OPTIONAL":
        return "TRANSLITERATION_OPTIONAL"
    if policy in {"BOTH_EQUAL_REVIEW_REQUIRED", "CANNOT_DECIDE"}:
        return "HUMAN_REVIEW_REQUIRED"
    raise Mai07R3BImportError(f"unmapped Round A policy for V2 bucket: {policy!r}")


def candidate_role_hint(surface: str | None, source_index: int) -> str:
    """Lightweight role hint for Option A eligibility (surface-script heuristic)."""
    if not surface:
        return "UNKNOWN"
    # Devanagari block
    if any("\u0900" <= ch <= "\u097F" for ch in surface):
        return "DEVANAGARI"
    # Latin / source identity tendency
    if re.search(r"[A-Za-z]", surface):
        return "IDENTITY"
    return "UNKNOWN"


def is_top1_role_compatible(bucket: str, role: str) -> bool:
    if bucket == "TRANSLITERATION_REQUIRED":
        return role == "DEVANAGARI"
    if bucket == "IDENTITY_REQUIRED":
        return role == "IDENTITY"
    if bucket == "TRANSLITERATION_OPTIONAL":
        # Optional Devanagari never counts toward required-target top-1.
        return False
    if bucket == "HUMAN_REVIEW_REQUIRED":
        return False
    return False


def apply_option_a_identity_policy(
    round_a: RoundAEntry, *, surface: str | None = None
) -> dict[str, Any]:
    """Product Option A — conservative identity (policy plan; not runtime activation)."""
    policy = round_a.preferred_rank_policy
    span = round_a.span_class
    latin_first_classes = {
        "ENGLISH_TERM",
        "ACRONYM_OR_IDENTIFIER",
        "PROPER_NAME_OR_ENTITY",
    }
    bucket = population_bucket_from_round_a(policy)
    identity_required = bucket == "IDENTITY_REQUIRED" or (
        span in latin_first_classes
        and policy
        in {
            "LATIN_IDENTITY_REQUIRED",
            "NO_TRANSLITERATION_ALLOWED",
            "LATIN_IDENTITY_PREFERRED_TARGET_OPTIONAL",
        }
    )
    optional_devanagari_excluded_from_required_top1 = (
        round_a.devanagari_retention == "OPTIONAL"
        or bucket == "TRANSLITERATION_OPTIONAL"
        or (
            span in latin_first_classes
            and policy != "DEVANAGARI_TARGET_REQUIRED"
        )
    )
    return {
        "product_policy": PRODUCT_POLICY,
        "evaluation_policy_bucket": bucket,
        "identity_safety_authoritative": identity_required
        or span in {"ENGLISH_TERM", "ACRONYM_OR_IDENTIFIER", "PROPER_NAME_OR_ENTITY"},
        "optional_devanagari_excluded_from_required_top1": optional_devanagari_excluded_from_required_top1,
        "surface_role_hint": candidate_role_hint(surface, 0),
        "linguist_approved": False,
        "production_approved": False,
        "runtime_activated": False,
        "adr_status": ADR_STATUS,
    }


def validate_cardinality_and_indices(
    import_obj: ReviewImportObject,
    mapping_entries: tuple[MappingEntry, ...],
    *,
    enforce_expected_totals: bool = True,
) -> None:
    a_ids = [e.review_id for e in import_obj.round_a]
    if len(a_ids) != len(set(a_ids)):
        raise Mai07R3BImportError("duplicate Round A review_id")
    a_set = set(a_ids)
    map_by_rid = {m.review_id: m for m in mapping_entries}
    if set(map_by_rid) != a_set:
        missing = a_set - set(map_by_rid)
        extra = set(map_by_rid) - a_set
        raise Mai07R3BImportError(
            f"mapping/Round A ID mismatch missing={len(missing)} extra={len(extra)}"
        )
    b_keys: set[tuple[str, int]] = set()
    by_review: dict[str, list[int]] = defaultdict(list)
    for b in import_obj.round_b:
        key = (b.review_id, b.candidate_index)
        if key in b_keys:
            raise Mai07R3BImportError(
                f"duplicate Round B candidate key: {b.review_id}#{b.candidate_index}"
            )
        b_keys.add(key)
        if b.review_id not in a_set:
            raise Mai07R3BImportError(
                f"Round B review_id not in Round A: {b.review_id}"
            )
        by_review[b.review_id].append(b.candidate_index)
    for rid, idxs in by_review.items():
        expected = list(range(len(idxs)))
        if sorted(idxs) != expected:
            raise Mai07R3BImportError(
                f"non-contiguous candidate indices for {rid}: {sorted(idxs)}"
            )
        order_len = len(map_by_rid[rid].candidate_order_indices)
        if len(idxs) != order_len:
            raise Mai07R3BImportError(
                f"candidate cardinality mismatch for {rid}: "
                f"round_b={len(idxs)} order_indices={order_len}"
            )
    if enforce_expected_totals:
        if len(import_obj.round_a) != EXPECTED_COUNTS["round_a"]:
            raise Mai07R3BImportError(
                f"round_a count {len(import_obj.round_a)} != {EXPECTED_COUNTS['round_a']}"
            )
        if len(import_obj.round_b) != EXPECTED_COUNTS["round_b"]:
            raise Mai07R3BImportError(
                f"round_b count {len(import_obj.round_b)} != {EXPECTED_COUNTS['round_b']}"
            )


def reject_round_b_overwrite_round_a(
    import_obj: ReviewImportObject,
    *,
    attempted_override: Mapping[str, str] | None = None,
) -> None:
    """Round B must never overwrite Round A preferred_rank_policy."""
    if attempted_override:
        raise Mai07R3BImportError(
            "Round B cannot overwrite Round A product-ranking policy"
        )
    # Structural guarantee: import object has no round_b field that mutates round_a.
    for a in import_obj.round_a:
        for b in import_obj.round_b:
            if b.review_id != a.review_id:
                continue
            # Acceptability labels are quality evidence only; policies stay on Round A.
            if hasattr(b, "preferred_rank_policy"):
                raise Mai07R3BImportError(
                    "Round B payload must not carry preferred_rank_policy"
                )


def assert_mapping_not_for_runtime_or_training(destination: Path | None = None) -> None:
    """Fail closed if blind mapping would be placed into runtime/training paths."""
    if destination is None:
        return
    text = str(destination).replace("\\", "/")
    name = Path(text).name
    if "BLIND_MAPPING" not in name.upper() and "blind_mapping" not in text.lower():
        return
    blocked_roots = (
        "/transliteration/infrastructure/",
        "/transliteration/resources/",
        "/training/",
        "/fine_tune/",
    )
    if any(r in text for r in blocked_roots):
        raise Mai07R3BImportError(
            "blind mapping cannot be imported into runtime/training paths"
        )


def assert_runtime_sources_do_not_consume_mapping(repo: Path = REPO) -> None:
    infra = (
        repo
        / "erp_bot/src/oip/modules/language_runtime/transliteration/infrastructure"
    )
    for path in infra.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        for token in FORBIDDEN_MAPPING_CONSUMER_TOKENS:
            if token in text:
                raise Mai07R3BImportError(
                    f"runtime infrastructure must not reference {token}: {path.name}"
                )


def official_acceptability_counts(
    entries: Iterable[RoundBEntry],
) -> dict[str, int]:
    counts = Counter(e.acceptability for e in entries)
    out = {k: int(counts.get(k, 0)) for k in OFFICIAL_B_COUNTS}
    return out


def build_adjudicated_cases(
    import_obj: ReviewImportObject,
    mapping_entries: tuple[MappingEntry, ...],
    *,
    candidate_surfaces: Mapping[tuple[str, int], str] | None = None,
) -> list[AdjudicatedCase]:
    """Join Round A/B via blind mapping; compute unique top-1 eligibility / ambiguity."""
    map_by_rid = {m.review_id: m for m in mapping_entries}
    a_by = {a.review_id: a for a in import_obj.round_a}
    b_by: dict[str, list[RoundBEntry]] = defaultdict(list)
    for b in import_obj.round_b:
        b_by[b.review_id].append(b)

    cases: list[AdjudicatedCase] = []
    for rid in sorted(a_by):
        a = a_by[rid]
        m = map_by_rid[rid]
        bucket = population_bucket_from_round_a(a.preferred_rank_policy)
        rows = sorted(b_by.get(rid, []), key=lambda x: x.candidate_index)
        order = m.candidate_order_indices
        cands: list[AdjudicatedCandidate] = []
        preferred_compatible: list[AdjudicatedCandidate] = []
        issues: list[str] = []
        for b in rows:
            src_idx = order[b.candidate_index]
            surface = None
            if candidate_surfaces is not None:
                surface = candidate_surfaces.get((rid, b.candidate_index))
            role = candidate_role_hint(surface, src_idx)
            top1 = False
            if b.acceptability == "ACCEPTABLE_PREFERRED":
                if is_top1_role_compatible(bucket, role):
                    top1 = True
                elif bucket == "TRANSLITERATION_REQUIRED" and role == "UNKNOWN":
                    # Without surfaces, do not invent unique gold.
                    top1 = False
                    issues.append("PREFERRED_WITHOUT_ROLE_SURFACE")
                elif bucket == "IDENTITY_REQUIRED" and role == "UNKNOWN":
                    top1 = False
                    issues.append("PREFERRED_WITHOUT_ROLE_SURFACE")
            elif b.acceptability == "ACCEPTABLE_ALTERNATIVE":
                top1 = False
            elif b.acceptability == "UNNATURAL_BUT_POSSIBLE":
                top1 = False
            elif b.acceptability == "INCORRECT":
                top1 = False
            elif b.acceptability == "CANNOT_DECIDE":
                top1 = False
                issues.append("CANDIDATE_CANNOT_DECIDE")
            cand = AdjudicatedCandidate(
                presentation_candidate_index=b.candidate_index,
                source_candidate_index=src_idx,
                acceptability=b.acceptability,
                top1_eligible=top1,
                role_hint=role,
            )
            cands.append(cand)
            if b.acceptability == "ACCEPTABLE_PREFERRED":
                preferred_compatible.append(cand)

        preferred_count = sum(
            1 for c in cands if c.acceptability == "ACCEPTABLE_PREFERRED"
        )
        if preferred_count > 1:
            issues.append("MULTIPLE_BULK_MAPPED_PREFERRED_CANDIDATES")

        if a.preferred_rank_policy in {"BOTH_EQUAL_REVIEW_REQUIRED", "CANNOT_DECIDE"}:
            issues.append("ROUND_A_POLICY_CANNOT_DECIDE")

        # Unique top-1 gold only when exactly one role-compatible preferred exists.
        eligible = [c for c in cands if c.top1_eligible]
        unique = False
        unique_idx: int | None = None
        ambiguity: str | None = None
        if bucket == "HUMAN_REVIEW_REQUIRED":
            ambiguity = "HUMAN_REVIEW_REQUIRED"
        elif preferred_count > 1 and len(eligible) != 1:
            ambiguity = "MULTIPLE_BULK_MAPPED_PREFERRED_CANDIDATES"
            # Explicitly do NOT collapse to unique top-1.
            unique = False
            unique_idx = None
        elif len(eligible) == 1:
            unique = True
            unique_idx = eligible[0].source_candidate_index
        elif len(eligible) > 1:
            ambiguity = "MULTIPLE_ROLE_COMPATIBLE_PREFERRED"
            unique = False
            unique_idx = None
        else:
            ambiguity = "NO_UNIQUE_TOP1_GOLD"
            unique = False
            unique_idx = None

        # Optional/optional-policy Devanagari never counts as required-target top-1.
        if bucket == "TRANSLITERATION_OPTIONAL":
            issues.append("OPTIONAL_DEVANAGARI_EXCLUDED_FROM_REQUIRED_TOP1")
            unique = False
            unique_idx = None
            if ambiguity is None:
                ambiguity = "OPTIONAL_DEVANAGARI_NOT_REQUIRED_TOP1"

        cases.append(
            AdjudicatedCase(
                review_id=rid,
                case_id=m.case_id,
                round_a=a,
                evaluation_policy_bucket=bucket,
                candidates=tuple(cands),
                unique_top1_gold_eligible=unique,
                unique_top1_source_candidate_index=unique_idx,
                ambiguity_reason=ambiguity,
                issues=tuple(sorted(set(issues))),
                prohibited_for_training=True,
            )
        )
    return cases


def compute_import_semantic_hash(
    import_obj: ReviewImportObject,
    mapping_entries: tuple[MappingEntry, ...],
    adjudicated: list[AdjudicatedCase],
) -> str:
    """Deterministic semantic hash of governed import+adjudication (not runtime)."""
    payload = {
        "schema": import_obj.schema,
        "provenance": import_obj.provenance,
        "prohibited_for_training": True,
        "professional_linguist_adjudication": False,
        "product_policy": PRODUCT_POLICY,
        "round_a": [asdict(x) for x in sorted(import_obj.round_a, key=lambda e: e.review_id)],
        "round_b": [
            asdict(x)
            for x in sorted(
                import_obj.round_b, key=lambda e: (e.review_id, e.candidate_index)
            )
        ],
        "mapping": [
            {
                "review_id": m.review_id,
                "case_id": m.case_id,
                "candidate_order_indices": list(m.candidate_order_indices),
            }
            for m in sorted(mapping_entries, key=lambda e: e.review_id)
        ],
        "adjudicated": [
            {
                "review_id": c.review_id,
                "case_id": c.case_id,
                "bucket": c.evaluation_policy_bucket,
                "unique_top1_gold_eligible": c.unique_top1_gold_eligible,
                "unique_top1_source_candidate_index": c.unique_top1_source_candidate_index,
                "ambiguity_reason": c.ambiguity_reason,
                "issues": list(c.issues),
                "candidates": [asdict(x) for x in c.candidates],
            }
            for c in sorted(adjudicated, key=lambda e: e.review_id)
        ],
    }
    blob = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256_bytes(blob.encode("utf-8"))


def load_locked_csv_surfaces(
    review_root: Path = REVIEW_ROOT,
) -> dict[tuple[str, int], str]:
    path = review_root / "MAI_07R3_ROUND_B_OFFICIAL_RESPONSES_LOCKED.csv"
    _require_hash(path, EXPECTED_HASHES["round_b_official"], "round_b_official")
    out: dict[tuple[str, int], str] = {}
    with path.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            out[(row["review_id"], int(row["candidate_index"]))] = row[
                "candidate_surface"
            ]
    return out


def verify_parent_artifacts(review_root: Path = REVIEW_ROOT) -> dict[str, str]:
    files = {
        "round_a_locked": review_root / "MAI_07R3_ROUND_A_RESPONSES_LOCKED.csv",
        "round_b_broad_locked": review_root / "MAI_07R3_ROUND_B_RESPONSES_LOCKED.csv",
        "round_b_official": review_root / "MAI_07R3_ROUND_B_OFFICIAL_RESPONSES_LOCKED.csv",
        "blind_mapping": review_root / "MAI_07R3_BLIND_MAPPING.json",
        "review_schema": review_root / "MAI_07R3_REVIEW_SCHEMA.json",
        "import_completed": review_root / "MAI_07R3_REVIEW_IMPORT_COMPLETED.jsonl",
        "bulk_decision": review_root / "MAI_07R3_BULK_SCHEMA_MAPPING_DECISION.json",
        "evaluation_semantics_v2": review_root / "MAI_07R3_EVALUATION_SEMANTICS_V2.json",
        "unblinded_adjudication": review_root / "MAI_07R3_UNBLINDED_ADJUDICATION.jsonl",
    }
    out: dict[str, str] = {}
    for label, path in files.items():
        out[label] = _require_hash(path, EXPECTED_HASHES[label], label)
    conflict = json.loads(
        (review_root / "MAI_07R3_ENGINEERING_CONFLICT_SUMMARY.json").read_text(
            encoding="utf-8"
        )
    )
    if int(conflict.get("conflict_count", -1)) != EXPECTED_COUNTS["conflicts"]:
        raise Mai07R3BImportError(
            f"conflict count {conflict.get('conflict_count')} != {EXPECTED_COUNTS['conflicts']}"
        )
    out["conflicts"] = str(EXPECTED_COUNTS["conflicts"])
    return out


def load_evaluation_semantics_v2(review_root: Path = REVIEW_ROOT) -> dict[str, Any]:
    path = review_root / "MAI_07R3_EVALUATION_SEMANTICS_V2.json"
    _require_hash(path, EXPECTED_HASHES["evaluation_semantics_v2"], "evaluation_semantics_v2")
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("product_policy") != PRODUCT_POLICY:
        raise Mai07R3BImportError("evaluation semantics product_policy mismatch")
    if data.get("frozen_v1_immutable") is not True:
        raise Mai07R3BImportError("evaluation semantics must keep frozen_v1_immutable=true")
    return data


def v2_dataset_plan() -> dict[str, Any]:
    """Typed plan only — R3B does not construct frozen dataset V2."""
    return {
        "dataset_id": "MAI_07_ROMANIZED_TRANSLITERATION_V2",
        "status": "PLANNED_NOT_BUILT_IN_R3B",
        "parent_dataset_hash": EXPECTED_HASHES["frozen_v1_dataset"],
        "prohibited_for_training": True,
        "requires": [
            "MAI_07R3B_IMPORT_PASSED",
            "OPTION_A_POLICY_LOCKED",
            "NON_VACUOUS_POPULATION_RECOMPUTE",
            "SEPARATE_FROZEN_QUALITY_AUTHORIZATION",
        ],
        "must_not": [
            "mutate_frozen_v1",
            "silent_top1_collapse_of_multiple_preferred",
            "enable_r1_r2_overlay",
            "start_mai08",
        ],
    }


def import_and_validate(
    repo: Path = REPO,
    *,
    review_root: Path | None = None,
) -> ImportValidationReport:
    review_root = review_root or (repo / "docs/mokxya-ai/reviews/mai07r3")
    errors: list[str] = []
    try:
        hashes = verify_parent_artifacts(review_root)
        schema = load_review_schema(review_root)
        mapping = load_blind_mapping(review_root)
        mapping_entries = parse_mapping_entries(mapping)
        import_obj = load_completed_import(
            review_root / "MAI_07R3_REVIEW_IMPORT_COMPLETED.jsonl", schema
        )
        validate_cardinality_and_indices(import_obj, mapping_entries)
        reject_round_b_overwrite_round_a(import_obj)
        assert_runtime_sources_do_not_consume_mapping(repo)
        # Ensure mapping was not materialised under runtime resources.
        runtime_mapping = (
            repo
            / "erp_bot/src/oip/modules/language_runtime/transliteration/resources"
            / "MAI_07R3_BLIND_MAPPING.json"
        )
        if runtime_mapping.exists():
            assert_mapping_not_for_runtime_or_training(runtime_mapping)

        b_counts = official_acceptability_counts(import_obj.round_b)
        if b_counts != OFFICIAL_B_COUNTS:
            raise Mai07R3BImportError(
                f"official Round B counts mismatch: {b_counts} != {OFFICIAL_B_COUNTS}"
            )
        # CANNOT_DECIDE preservation
        if b_counts["CANNOT_DECIDE"] != 4:
            raise Mai07R3BImportError("CANNOT_DECIDE count not preserved")

        surfaces = load_locked_csv_surfaces(review_root)
        adjudicated = build_adjudicated_cases(
            import_obj, mapping_entries, candidate_surfaces=surfaces
        )
        semantic = compute_import_semantic_hash(import_obj, mapping_entries, adjudicated)
        # Determinism check
        semantic2 = compute_import_semantic_hash(import_obj, mapping_entries, adjudicated)
        if semantic != semantic2:
            raise Mai07R3BImportError("non-deterministic import semantic hash")

        semantics_doc = load_evaluation_semantics_v2(review_root)
        decision = json.loads(
            (review_root / "MAI_07R3_BULK_SCHEMA_MAPPING_DECISION.json").read_text(
                encoding="utf-8"
            )
        )
        if decision.get("mapping") != BULK_MAPPING:
            raise Mai07R3BImportError("bulk mapping decision does not match authority")
        if decision.get("professional_linguist_adjudication") is not False:
            raise Mai07R3BImportError("bulk decision must set professional_linguist_adjudication=false")
        if decision.get("mai08_authorized") is not False:
            raise Mai07R3BImportError("bulk decision must keep mai08_authorized=false")

        policy = {
            "product_policy": PRODUCT_POLICY,
            "adr_status": ADR_STATUS,
            "linguist_approved": False,
            "production_approved": False,
            "quality_gates_passed": False,
            "bulk_provenance": BULK_PROVENANCE,
            "row_by_row_five_label_review_performed": False,
            "evaluation_semantics_policy_id": semantics_doc.get("policy_id"),
            "v2_dataset_plan": v2_dataset_plan(),
            "multiple_preferred_cases": sum(
                1
                for c in adjudicated
                if "MULTIPLE_BULK_MAPPED_PREFERRED_CANDIDATES" in c.issues
            ),
            "unique_top1_eligible_cases": sum(
                1 for c in adjudicated if c.unique_top1_gold_eligible
            ),
        }
        return ImportValidationReport(
            ok=True,
            import_semantic_hash=semantic,
            counts={
                "round_a": len(import_obj.round_a),
                "round_b": len(import_obj.round_b),
                "mapping": len(mapping_entries),
                "conflicts": EXPECTED_COUNTS["conflicts"],
                "adjudicated": len(adjudicated),
            },
            official_b_counts=b_counts,
            hashes=hashes,
            policy=policy,
            adjudicated_cases=adjudicated,
            errors=[],
        )
    except Mai07R3BImportError as exc:
        errors.append(str(exc))
        return ImportValidationReport(
            ok=False,
            import_semantic_hash="",
            errors=errors,
        )


def main() -> int:
    report = import_and_validate(REPO)
    summary = {
        "ok": report.ok,
        "import_semantic_hash": report.import_semantic_hash,
        "counts": report.counts,
        "official_b_counts": report.official_b_counts,
        "hashes": report.hashes,
        "policy": {
            k: v
            for k, v in report.policy.items()
            if k != "v2_dataset_plan"
        }
        | {"v2_dataset_plan_status": report.policy.get("v2_dataset_plan", {}).get("status")},
        "errors": report.errors,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
