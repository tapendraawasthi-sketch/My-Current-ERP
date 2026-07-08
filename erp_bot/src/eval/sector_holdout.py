"""Sector NLU hold-out evaluation — build splits and score v2 pipeline."""

from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

SECTOR_KB_ROOT = Path("data/ekhata/knowledge/general/sector")
DEFAULT_HOLDOUT_PATH = Path("data/ekhata/sector-nlu-holdout.json")
DEFAULT_BASELINE_PATH = Path("data/ekhata/sector_nlu_eval_baseline.json")

_USER_INPUT_RE = re.compile(r"^User input:\s*(.+)$", re.M)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _holdout_key(sector_slug: str, user_input: str) -> str:
    return f"{sector_slug}\0{user_input}"


def is_holdout_row(sector_slug: str, user_input: str, holdout_pct: int = 10) -> bool:
    """Deterministic ~holdout_pct% split per sector (stable across runs)."""
    digest = hashlib.sha256(_holdout_key(sector_slug, user_input).encode()).hexdigest()
    bucket = int(digest[:8], 16) % 100
    return bucket < holdout_pct


def extract_user_input(row: dict[str, Any]) -> str:
    if row.get("user_input"):
        return str(row["user_input"]).strip()
    content = str(row.get("content") or "")
    m = _USER_INPUT_RE.search(content)
    if m:
        return m.group(1).strip()
    title = str(row.get("title") or "").strip()
    return title.replace("…", "").strip()


def _parse_amount(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if value > 0 else None
    text = str(value).strip().lower()
    if not text or text in {"unknown", "null", "none", ""}:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)", text.replace(",", ""))
    return float(m.group(1)) if m else None


def load_sector_intent_map() -> dict[str, str]:
    from ..nlu.knowledge_enrich import SECTOR_INTENT_TO_NLU

    return dict(SECTOR_INTENT_TO_NLU)


def iter_sector_kb_rows(kb_root: Path | None = None) -> list[dict[str, Any]]:
    root = kb_root or (_repo_root() / SECTOR_KB_ROOT)
    rows: list[dict[str, Any]] = []
    for path in sorted(root.rglob("nepal-sector-nlu.jsonl")):
        slug = path.parent.name
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            user_input = extract_user_input(row)
            if not user_input:
                continue
            row["_sector_slug"] = slug
            row["_user_input"] = user_input
            rows.append(row)
    return rows


def build_holdout_cases(
    *,
    holdout_pct: int = 10,
    kb_root: Path | None = None,
) -> dict[str, Any]:
    from ..nlu.erp_action_policy import classify_erp_action
    from ..nlu.engine import ParsedEntry

    intent_map = load_sector_intent_map()
    all_rows = iter_sector_kb_rows(kb_root)
    cases: list[dict[str, Any]] = []
    sector_counts: dict[str, int] = {}

    for row in all_rows:
        slug = row["_sector_slug"]
        user_input = row["_user_input"]
        if not is_holdout_row(slug, user_input, holdout_pct):
            continue

        record_intent = str(row.get("intent") or "")
        erp_action = str(row.get("erp_action") or "")
        amount = _parse_amount(row.get("amount"))
        party_raw = row.get("party")
        party = None if not party_raw or str(party_raw).lower() in {"unknown", ""} else str(party_raw)

        expected_nlu = row.get("nlu_intent") or intent_map.get(record_intent, "unknown")
        expected_policy = classify_erp_action(erp_action) if erp_action else "hold"

        parsed_stub = ParsedEntry(
            intent="unknown",  # type: ignore[arg-type]
            narration=user_input,
            confidence=float(row.get("confidence") or 0.5),
            amount=amount,
            party=party,
        )
        from ..nlu.erp_action_policy import resolve_erp_action_policy

        policy = resolve_erp_action_policy(
            erp_action=erp_action or None,
            confidence=float(row.get("confidence") or 0.5),
            parsed=parsed_stub,
            clarification_needed=bool(row.get("clarification_needed")),
            required_fields=list(row.get("missing_fields") or row.get("required_fields") or []),
        )
        expected_policy = policy.policy_action

        case_id = hashlib.md5(_holdout_key(slug, user_input).encode()).hexdigest()[:12]
        cases.append(
            {
                "id": f"{slug}-{case_id}",
                "sector_slug": slug,
                "sector": row.get("sector") or slug,
                "user_input": user_input,
                "intent": record_intent,
                "expected_nlu_intent": expected_nlu,
                "erp_action": erp_action,
                "expected_policy": expected_policy,
                "expected_skip_posting": policy.skip_posting,
                "clarification_needed": bool(row.get("clarification_needed")),
                "amount": row.get("amount"),
                "party": party_raw,
                "confidence": float(row.get("confidence") or 0),
            }
        )
        sector_counts[slug] = sector_counts.get(slug, 0) + 1

    return {
        "version": "1.0.0",
        "description": "Sector NLU hold-out eval set (~10% per sector, deterministic hash split)",
        "holdout_pct": holdout_pct,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sector_counts": sector_counts,
        "total": len(cases),
        "cases": cases,
    }


def save_holdout(path: Path | None = None, *, holdout_pct: int = 10) -> Path:
    out = path or (_repo_root() / DEFAULT_HOLDOUT_PATH)
    out.parent.mkdir(parents=True, exist_ok=True)
    data = build_holdout_cases(holdout_pct=holdout_pct)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def load_holdout(path: Path | None = None) -> dict[str, Any]:
    p = path or (_repo_root() / DEFAULT_HOLDOUT_PATH)
    if not p.exists():
        save_holdout(p)
    return json.loads(p.read_text(encoding="utf-8"))


@dataclass
class SectorCaseResult:
    id: str
    sector_slug: str
    passed: bool
    scores: dict[str, bool] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    input: str = ""


def score_sector_case(case: dict[str, Any], *, tier: str = "enrich") -> SectorCaseResult:
    """Score one hold-out case against v2 NLU pipeline (offline by default)."""
    from ..nlu.engine import ParsedEntry
    from ..nlu.erp_action_policy import classify_erp_action
    from ..nlu.knowledge_enrich import enrich_parsed_entry, search_nlu_knowledge

    user_input = case["user_input"]
    sector_slug = case["sector_slug"]
    scores: dict[str, bool] = {}
    notes: list[str] = []

    hits = search_nlu_knowledge(
        user_input, top_k=5, sector_profile=sector_slug, session_sector=sector_slug
    )
    sector_hits = [
        h
        for h in hits
        if h.metadata.get("sector_slug") == sector_slug
        or sector_slug in h.tags
        or h.segment.endswith(sector_slug)
    ]
    scores["retrieval_sector_top5"] = bool(sector_hits)
    if not scores["retrieval_sector_top5"]:
        notes.append(f"no sector hit in top5 (got {[h.segment for h in hits[:3]]})")

    intent_map = load_sector_intent_map()
    top_sector = sector_hits[0] if sector_hits else None

    if case.get("intent") and top_sector:
        scores["retrieval_intent_top5"] = top_sector.metadata.get("intent") == case["intent"]
        if not scores["retrieval_intent_top5"]:
            notes.append(
                f"retrieval intent: expected {case['intent']}, "
                f"got {top_sector.metadata.get('intent')}"
            )

    expected_nlu = case.get("expected_nlu_intent") or "unknown"
    if expected_nlu != "unknown" and top_sector:
        mapped = top_sector.metadata.get("nlu_intent") or intent_map.get(
            str(top_sector.metadata.get("intent") or "")
        )
        scores["retrieval_nlu_intent"] = mapped == expected_nlu
        if not scores["retrieval_nlu_intent"]:
            notes.append(f"retrieval nlu_intent: expected {expected_nlu}, got {mapped}")

    amount = _parse_amount(case.get("amount"))
    party = case.get("party")
    party_str = None if not party or str(party).lower() == "unknown" else str(party)

    parsed = ParsedEntry(
        intent="unknown",  # type: ignore[arg-type]
        narration=user_input,
        confidence=float(case.get("confidence") or 0.5),
        amount=amount,
        party=party_str,
    )
    enriched = enrich_parsed_entry(
        parsed,
        user_input,
        sector_profile=sector_slug,
        session_sector=sector_slug,
    )

    expected_nlu = case.get("expected_nlu_intent") or "unknown"
    if expected_nlu != "unknown" and enriched.intent != "unknown":
        scores["enrich_intent"] = enriched.intent == expected_nlu
        if not scores["enrich_intent"]:
            notes.append(f"enrich intent: expected {expected_nlu}, got {enriched.intent}")

    erp_action = case.get("erp_action") or ""
    if erp_action:
        got_policy = enriched.policy_action or classify_erp_action(erp_action)
        expected_policy = case.get("expected_policy")
        if case.get("clarification_needed") and expected_policy == "post":
            expected_policy = "clarify"
        scores["enrich_policy"] = got_policy == expected_policy
        if not scores["enrich_policy"]:
            notes.append(
                f"policy: expected {expected_policy}, got {got_policy}"
            )

    scores["enrich_skip_posting"] = enriched.skip_posting == bool(case.get("expected_skip_posting"))
    if not scores["enrich_skip_posting"]:
        notes.append(
            f"skip_posting: expected {case.get('expected_skip_posting')}, got {enriched.skip_posting}"
        )

    if tier == "parse":
        from ..nlu.engine import get_nlu_engine

        full = get_nlu_engine().parse(
            user_input,
            {
                "business_sector_slug": sector_slug,
                "business_sector": sector_slug,
                "session_id": f"eval-{case['id']}",
            },
        )
        if expected_nlu != "unknown":
            scores["parse_intent"] = full.intent == expected_nlu
            if not scores["parse_intent"]:
                notes.append(f"parse intent: expected {expected_nlu}, got {full.intent}")

    required = ["retrieval_sector_top5", "enrich_skip_posting"]
    if erp_action:
        required.append("enrich_policy")
    if expected_nlu != "unknown":
        required.append("retrieval_nlu_intent")
    if case.get("intent"):
        required.append("retrieval_intent_top5")

    applicable = {k: scores[k] for k in required if k in scores}
    passed = bool(applicable) and all(applicable.values())
    return SectorCaseResult(
        id=case["id"],
        sector_slug=sector_slug,
        passed=passed,
        scores=scores,
        notes=notes,
        input=user_input,
    )


def run_sector_holdout_eval(
    *,
    tier: str = "enrich",
    holdout_path: Path | None = None,
    limit: int | None = None,
    sectors: set[str] | None = None,
    verbose: bool = False,
) -> dict[str, Any]:
    data = load_holdout(holdout_path)
    cases = data["cases"]
    if sectors:
        cases = [c for c in cases if c["sector_slug"] in sectors]
    if limit:
        cases = cases[:limit]

    results: list[SectorCaseResult] = []
    for i, case in enumerate(cases, 1):
        r = score_sector_case(case, tier=tier)
        results.append(r)
        if verbose:
            mark = "PASS" if r.passed else "FAIL"
            print(f"[{i}/{len(cases)}] {mark} {r.id} ({r.sector_slug})", flush=True)

    sector_stats: dict[str, dict[str, Any]] = {}
    for r in results:
        st = sector_stats.setdefault(
            r.sector_slug, {"total": 0, "passed": 0, "metric_sums": {}}
        )
        st["total"] += 1
        if r.passed:
            st["passed"] += 1
        for k, v in r.scores.items():
            st["metric_sums"][k] = st["metric_sums"].get(k, 0) + (1 if v else 0)

    for st in sector_stats.values():
        n = st["total"]
        st["pass_rate"] = round(st["passed"] / n, 3) if n else 0.0
        st["metric_rates"] = {
            k: round(v / n, 3) for k, v in st["metric_sums"].items()
        }

    total = len(results)
    passed = sum(1 for r in results if r.passed)
    return {
        "tier": tier,
        "total": total,
        "passed": passed,
        "pass_rate": round(passed / total, 3) if total else 0.0,
        "sector_stats": sector_stats,
        "failures": [asdict(r) for r in results if not r.passed][:100],
        "results": [asdict(r) for r in results],
    }


def compare_to_baseline(
    report: dict[str, Any],
    baseline_path: Path | None = None,
    *,
    max_regression: float = 0.02,
) -> dict[str, Any]:
    """Return regression summary vs saved baseline (per-sector pass rate)."""
    base_path = baseline_path or (_repo_root() / DEFAULT_BASELINE_PATH)
    if not base_path.exists():
        return {
            "has_baseline": False,
            "regressions": [],
            "ok": True,
        }

    baseline = json.loads(base_path.read_text(encoding="utf-8"))
    base_stats = baseline.get("sector_stats") or {}
    curr_stats = report.get("sector_stats") or {}
    regressions: list[dict[str, Any]] = []

    for slug, st in base_stats.items():
        if slug not in curr_stats:
            continue
        old_rate = float(st.get("pass_rate") or 0)
        new_rate = float(curr_stats[slug].get("pass_rate") or 0)
        delta = new_rate - old_rate
        if delta < -max_regression:
            regressions.append(
                {
                    "sector_slug": slug,
                    "baseline_pass_rate": old_rate,
                    "current_pass_rate": new_rate,
                    "delta": round(delta, 3),
                }
            )

    overall_old = float(baseline.get("pass_rate") or 0)
    overall_new = float(report.get("pass_rate") or 0)
    overall_delta = overall_new - overall_old

    return {
        "has_baseline": True,
        "baseline_pass_rate": overall_old,
        "current_pass_rate": overall_new,
        "overall_delta": round(overall_delta, 3),
        "regressions": regressions,
        "ok": not regressions and overall_delta >= -max_regression,
    }
