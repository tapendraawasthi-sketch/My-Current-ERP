"""
Nearest-neighbor intent classifier — map user text to training intents via hybrid KB.

When hybrid top-1 similarity exceeds threshold, apply intent (and optional slots)
without calling the LLM.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any, Literal

from ..knowledge.knowledge_registry import KnowledgeChunk
from ..knowledge.sector_profile import effective_sector_profile
from ..vectorstore.nlu_knowledge_store import chunk_embed_text
from .engine import ParsedEntry, PaymentMethod
from .hybrid_nlu_search import HybridNLUHit, hybrid_search_nlu_scored
from .text_normalize import extract_amount, normalize_for_matching

NN_INTENT_THRESHOLD = float(os.getenv("NLU_NN_INTENT_THRESHOLD", "0.72"))
NN_PARSE_THRESHOLD = float(os.getenv("NLU_NN_PARSE_THRESHOLD", "0.78"))

_USER_INPUT_RE = re.compile(r"^User input:\s*(.+)$", re.M)


@dataclass(frozen=True)
class NeighborMatch:
    chunk: KnowledgeChunk
    similarity: float
    record_intent: str
    nlu_intent: str | None
    training_confidence: float
    should_apply: bool
    source: Literal["sector", "phase3", "phase4", "other"]


def extract_example_user_input(chunk: KnowledgeChunk) -> str:
    content = chunk.content or ""
    m = _USER_INPUT_RE.search(content)
    if m:
        return m.group(1).strip()
    title = (chunk.title or "").replace("…", "").strip()
    if title:
        return title
    return chunk_embed_text(chunk).split(" | ")[0]


def _token_set(text: str) -> set[str]:
    norm = normalize_for_matching(text)
    return {t for t in re.findall(r"[\w\u0900-\u097F]+", norm) if len(t) >= 2}


def text_similarity(query: str, example: str) -> float:
    """Token Jaccard + substring bonus for short utterances."""
    q_tokens = _token_set(query)
    e_tokens = _token_set(example)
    if not q_tokens or not e_tokens:
        return 0.0

    inter = len(q_tokens & e_tokens)
    union = len(q_tokens | e_tokens)
    jaccard = inter / union if union else 0.0

    q_norm = normalize_for_matching(query)
    e_norm = normalize_for_matching(example)
    substring_bonus = 0.0
    if len(q_norm) >= 8 and q_norm in e_norm:
        substring_bonus = 0.25
    elif len(e_norm) >= 8 and e_norm in q_norm:
        substring_bonus = 0.2

    # Numeric overlap (amounts often anchor the match)
    q_nums = set(re.findall(r"\d+", q_norm))
    e_nums = set(re.findall(r"\d+", e_norm))
    num_bonus = 0.15 if q_nums and q_nums & e_nums else 0.0

    return min(1.0, jaccard + substring_bonus + num_bonus)


def _chunk_source(chunk: KnowledgeChunk) -> Literal["sector", "phase3", "phase4", "other"]:
    if chunk.id.startswith("sector-"):
        return "sector"
    if chunk.id.startswith("phase3-"):
        return "phase3"
    if chunk.id.startswith("phase4-"):
        return "phase4"
    return "other"


def _resolve_nlu_intent(chunk: KnowledgeChunk, intent_map: dict[str, str]) -> str | None:
    mapped = chunk.metadata.get("nlu_intent") or intent_map.get(
        str(chunk.metadata.get("intent") or "")
    )
    if not mapped or mapped == "unknown":
        return None
    return str(mapped)


def score_neighbor_match(
    query: str,
    hit: HybridNLUHit,
    *,
    sector_slug: str | None,
    intent_map: dict[str, str],
) -> NeighborMatch:
    chunk = hit.chunk
    example = extract_example_user_input(chunk)
    text_sim = text_similarity(query, example)
    training_conf = float(chunk.metadata.get("confidence") or 0.5)

    rrf_part = min(1.0, hit.score / 12.0)
    semantic_part = min(1.0, hit.semantic_score)

    similarity = (
        0.42 * text_sim
        + 0.22 * rrf_part
        + 0.14 * training_conf
        + 0.14 * semantic_part
        + 0.08 * min(1.0, hit.lexical_score / 4.0)
    )

    meta_slug = str(chunk.metadata.get("sector_slug") or "")
    if sector_slug and (meta_slug == sector_slug or sector_slug in chunk.tags):
        similarity = min(1.0, similarity + 0.06)

    record_intent = str(chunk.metadata.get("intent") or "")
    nlu_intent = _resolve_nlu_intent(chunk, intent_map)

    should_apply = (
        similarity >= NN_INTENT_THRESHOLD
        and nlu_intent is not None
        and _chunk_source(chunk) in {"sector", "phase3"}
    )

    return NeighborMatch(
        chunk=chunk,
        similarity=round(similarity, 4),
        record_intent=record_intent,
        nlu_intent=nlu_intent,
        training_confidence=training_conf,
        should_apply=should_apply,
        source=_chunk_source(chunk),
    )


def find_best_neighbor(
    message: str,
    hits: list[HybridNLUHit],
    *,
    sector_slug: str | None = None,
    intent_map: dict[str, str] | None = None,
) -> NeighborMatch | None:
    if not hits:
        return None

    if intent_map is None:
        from .knowledge_enrich import SECTOR_INTENT_TO_NLU

        mapping: dict[str, str] = SECTOR_INTENT_TO_NLU
    else:
        mapping = intent_map
    candidates = [
        score_neighbor_match(message, hit, sector_slug=sector_slug, intent_map=mapping)
        for hit in hits[:5]
    ]
    candidates.sort(key=lambda m: -m.similarity)
    best = candidates[0]
    return best if best.similarity >= NN_INTENT_THRESHOLD * 0.85 else None


def apply_neighbor_to_parsed(
    parsed: ParsedEntry,
    match: NeighborMatch,
    *,
    message: str,
) -> ParsedEntry:
    """Merge nearest-neighbor intent into an existing ParsedEntry."""
    if not match.nlu_intent or not match.should_apply:
        return parsed

    updates: dict[str, Any] = {}
    should_override = (
        parsed.intent == "unknown"
        or parsed.confidence < match.similarity
        or (parsed.intent != match.nlu_intent and parsed.confidence < 0.88)
    )
    if should_override:
        updates["intent"] = match.nlu_intent  # type: ignore[assignment]
        updates["confidence"] = max(parsed.confidence, min(0.92, match.similarity))

    chunk_amount = match.chunk.metadata.get("amount")
    if parsed.amount is None and chunk_amount:
        amt = extract_amount(str(chunk_amount)) or extract_amount(message)
        if amt:
            updates["amount"] = amt

    party = match.chunk.metadata.get("party")
    if not parsed.party and party and str(party).lower() not in {"unknown", ""}:
        updates["party"] = str(party)

    pm = str(match.chunk.metadata.get("payment_mode") or "").lower()
    if parsed.payment_method == "unknown" and pm:
        if pm in {"cash", "nagad"}:
            updates["payment_method"] = "cash"
        elif pm in {"bank", "transfer"}:
            updates["payment_method"] = "bank"
        elif pm == "esewa":
            updates["payment_method"] = "esewa"
        elif pm == "khalti":
            updates["payment_method"] = "khalti"

    refs = list(parsed.knowledge_refs)
    if match.chunk.id not in refs:
        refs.append(match.chunk.id)
    updates["knowledge_refs"] = refs

    return parsed.model_copy(update=updates) if updates else parsed


def parse_with_nearest_neighbor(
    message: str,
    session_context: dict | None = None,
) -> ParsedEntry | None:
    """
    Full NN parse path — returns ParsedEntry when similarity clears parse threshold.
    Skips LLM when confidence is high enough.
    """
    sector_slug = effective_sector_profile(
        sector_profile=(session_context or {}).get("business_sector_slug"),
        query=message,
        session_sector=(session_context or {}).get("business_sector"),
    )

    hits = hybrid_search_nlu_scored(
        message,
        top_k=5,
        sector_profile=sector_slug,
        session_sector=(session_context or {}).get("business_sector"),
    )
    match = find_best_neighbor(message, hits, sector_slug=sector_slug)
    if not match or not match.should_apply or match.similarity < NN_PARSE_THRESHOLD:
        return None

    amount = extract_amount(message)
    party = None
    payment_method: PaymentMethod = "unknown"

    parsed = ParsedEntry(
        intent=match.nlu_intent or "unknown",  # type: ignore[arg-type]
        amount=amount,
        party=party,
        narration=message,
        confidence=match.similarity,
    )
    return apply_neighbor_to_parsed(parsed, match, message=message)


def try_apply_nearest_neighbor(
    parsed: ParsedEntry,
    message: str,
    hits: list[HybridNLUHit],
    *,
    sector_slug: str | None = None,
) -> tuple[ParsedEntry, str | None]:
    """Apply NN intent during enrich when top hit is confident."""
    match = find_best_neighbor(message, hits, sector_slug=sector_slug)
    if not match or not match.should_apply:
        return parsed, None
    updated = apply_neighbor_to_parsed(parsed, match, message=message)
    return updated, match.chunk.id
