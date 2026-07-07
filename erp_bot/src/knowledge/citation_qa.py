"""
Citation-enforced Q&A from retrieved knowledge passages.
"""

from __future__ import annotations

import logging
from typing import Any

from ollama import Client

from ..config import OLLAMA_BASE_URL, PRIMARY_MODEL, PRIMARY_MODEL_OPTIONS
from .hybrid_rag import get_hybrid_rag
from .knowledge_registry import ROUTE_TO_TASK, format_tiered_context, search_tiered_knowledge

logger = logging.getLogger(__name__)

CITATION_SYSTEM = """You are e-Khata, expert Nepal accountant and IFRS/NAS teacher.

RULES:
1. Answer ONLY from [RETRIEVED PASSAGES] and [TIERED KNOWLEDGE] below.
2. On conflict: professional/legal segments beat general language/concepts.
   - Compliance (VAT, TDS, SSF, filing) → trust legal-compliance sources.
   - NFRS/recognition/framework → trust accounting-standards sources.
3. Cite source: Para ID, section name, or IRD/VAT rule when available.
4. If passages do not contain the answer, say clearly in user's language:
   "Yo bare ma mero srot ma jaankari chaina" — do NOT guess.
5. Match user language (Nepali/English/mixed).
6. Keep under 8 sentences unless user asks for detail.
7. NEVER use Wikipedia or general world knowledge for accounting terms."""


def answer_with_citations(
    question: str,
    *,
    top_k: int = 5,
    extra_context: str = "",
    task: str = "accounting_qa",
) -> tuple[str, list[dict[str, Any]]]:
    """Retrieve hybrid RAG + tiered segments and generate cited answer."""
    passages = get_hybrid_rag().search(question, top_k=top_k, task=task)

    tiered_hits = search_tiered_knowledge(question, task=task, top_k=top_k)
    tiered_block = format_tiered_context(question, task=task, max_chars=2000)

    if not passages and not tiered_hits:
        return "", []

    block_parts: list[str] = []
    if tiered_block:
        block_parts.append(tiered_block)
    if passages:
        block_parts.append(
            "\n\n---\n\n".join(
                f"[{p.get('id', 'doc')}] "
                f"(segment={p.get('metadata', {}).get('segment', 'legacy')}) "
                f"{p.get('text', '')[:1200]}"
                for p in passages
            )
        )
    block = "\n\n".join(block_parts)

    client = Client(host=OLLAMA_BASE_URL)
    messages = [
        {"role": "system", "content": CITATION_SYSTEM},
        {
            "role": "user",
            "content": (
                f"[RETRIEVED PASSAGES — task={task}]\n{block}\n\n"
                f"{extra_context}\n\n"
                f"Question: {question}"
            ),
        },
    ]

    try:
        response = client.chat(
            model=PRIMARY_MODEL,
            messages=messages,
            options={
                "temperature": float(PRIMARY_MODEL_OPTIONS.get("temperature", 0.2)),
                "num_ctx": int(PRIMARY_MODEL_OPTIONS.get("num_ctx", 8192)),
            },
        )
        merged_passages = passages + [
            {"id": c.id, "text": c.content, "metadata": {"segment": c.segment, "authority": c.authority}}
            for c in tiered_hits
        ]
        return (response.message.content or "").strip(), merged_passages
    except Exception as exc:
        logger.warning("Citation QA failed: %s", exc)
        if tiered_hits:
            top = tiered_hits[0].content[:500]
            return f"(Retrieved — {tiered_hits[0].segment})\n{top}", passages
        top = passages[0].get("text", "")[:500] if passages else ""
        return f"(Retrieved)\n{top}", passages


def task_for_route(route_mode: str) -> str:
    """Map domain router mode to registry task key."""
    return ROUTE_TO_TASK.get(route_mode, "accounting_qa")
