"""Memory recall/write tools bound to a MemoryStore instance.

Registered by the engine (which owns the store) via ``register(registry, store)``
so the tool handlers can close over the store.
"""

from __future__ import annotations

from ..memory.store import MemoryStore
from ..schemas import EvidenceRef, ToolResult
from .registry import ToolRegistry, ToolSpec

_MEM_SEQ = 0


def _next_evidence_id() -> str:
    global _MEM_SEQ
    _MEM_SEQ += 1
    return f"ev_mem_{_MEM_SEQ:04d}"


def register(registry: ToolRegistry, store: MemoryStore) -> None:
    async def _recall_memory(args: dict) -> ToolResult:
        query = str(args.get("query", "")).strip()
        session_id = args.get("session_id")
        user_id = args.get("user_id")
        types = args.get("memory_types") or ["episodic", "semantic"]

        evidence: list[EvidenceRef] = []
        found: list[dict] = []

        if "episodic" in types:
            episodes = await store.search_episodes(
                query=query, user_id=user_id, session_id=session_id, k=int(args.get("k", 5))
            )
            for ep in episodes:
                snippet = f"{ep.get('user_message','')} -> {ep.get('summary') or ep.get('agent_answer','')[:120]}"
                evidence.append(
                    EvidenceRef(
                        id=_next_evidence_id(),
                        source_type="memory",
                        uri=f"episode:{ep.get('id')}",
                        snippet=snippet[:400],
                    )
                )
                found.append(
                    {
                        "type": "episodic",
                        "user_message": ep.get("user_message"),
                        "intent": ep.get("intent"),
                        "summary": ep.get("summary"),
                        "created_at": ep.get("created_at"),
                    }
                )

        if "semantic" in types:
            facts = await store.search_semantic_facts(query=query, k=int(args.get("k", 5)))
            for f in facts:
                evidence.append(
                    EvidenceRef(
                        id=_next_evidence_id(),
                        source_type="memory",
                        uri=f"fact:{f.get('id')}",
                        snippet=f"{f['subject']} {f['predicate']} {f['object']}",
                    )
                )
                found.append(
                    {
                        "type": "semantic",
                        "subject": f["subject"],
                        "predicate": f["predicate"],
                        "object": f["object"],
                        "confidence": f["confidence"],
                    }
                )

        return ToolResult(
            ok=True,
            summary=f"Recalled {len(found)} memory item(s).",
            evidence=evidence,
            data={"memories": found},
        )

    async def _write_memory(args: dict) -> ToolResult:
        kind = str(args.get("kind", "fact"))
        content = str(args.get("content", "")).strip()
        if not content:
            return ToolResult(ok=False, error="content is required")

        fid = await store.write_semantic_fact(
            {
                "namespace": kind,
                "subject": str(args.get("subject") or content[:60]),
                "predicate": "is",
                "object": content,
                "confidence": float(args.get("confidence", 0.6)),
                "source_type": "memory",
            }
        )
        return ToolResult(ok=True, summary=f"Stored {kind} memory.", data={"fact_id": fid})

    registry.register(
        ToolSpec(
            name="recall_memory",
            description="Recall episodic (past turns) and semantic (durable facts) memory relevant to the query.",
            input_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "session_id": {"type": "string"},
                    "user_id": {"type": "string"},
                    "memory_types": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["query"],
            },
        ),
        _recall_memory,
    )
    registry.register(
        ToolSpec(
            name="write_memory",
            description="Persist a durable preference/fact/summary for future recall.",
            input_schema={
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["preference", "fact", "summary"]},
                    "content": {"type": "string"},
                    "subject": {"type": "string"},
                    "confidence": {"type": "number"},
                },
                "required": ["content"],
            },
            read_only=False,
        ),
        _write_memory,
    )
