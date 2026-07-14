#!/usr/bin/env python3
"""Optional semantic index: embed a bounded high-value slice via local Ollama+Chroma.

Never required for lexical retrieval. Skips cleanly when services unavailable.
Does not embed evaluation-only corpora into the production semantic collection.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import (  # noqa: E402
    REPO_ROOT,
    atomic_write_json,
    load_config,
    rel_to_repo,
    setup_logging,
    utc_now_iso,
)

logger = setup_logging("build_semantic_index")

PROD_COLLECTIONS = (
    "language_rules",
    "lexicon",
    "normalization_examples",
    "intent_examples",
    "safety_rules",
    "authorization_rules",
)


def iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                yield json.loads(line)


def ollama_reachable(base_url: str = "http://localhost:11434") -> bool:
    try:
        import urllib.request

        with urllib.request.urlopen(base_url + "/api/tags", timeout=2) as resp:
            return resp.status == 200
    except Exception:
        return False


def run(
    *,
    repo_root: Path,
    semantic_dir: Path,
    manifests_dir: Path,
    max_docs: int,
) -> int:
    cfg = load_config(repo_root)
    semantic_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)
    jsonl_dir = repo_root / cfg["paths"]["processed_jsonl_dir"]
    status_path = semantic_dir / "semantic_index_status.json"

    try:
        import chromadb
    except ImportError:
        payload = {
            "generated_at": utc_now_iso(),
            "status": "pending",
            "message": "chromadb not installed",
            "docs_indexed": 0,
        }
        atomic_write_json(status_path, payload)
        atomic_write_json(manifests_dir / "semantic_index_manifest.json", payload)
        return 0

    if not ollama_reachable():
        payload = {
            "generated_at": utc_now_iso(),
            "status": "pending",
            "message": "Ollama unreachable at localhost:11434 — lexical index remains primary",
            "docs_indexed": 0,
        }
        atomic_write_json(status_path, payload)
        atomic_write_json(manifests_dir / "semantic_index_manifest.json", payload)
        logger.info("Semantic skipped: Ollama unreachable")
        return 0

    # Use existing Ollama embed endpoint via http to avoid tight ollama package coupling.
    import urllib.request

    embed_model = "nomic-embed-text"

    def embed(text: str) -> list[float] | None:
        req = urllib.request.Request(
            "http://localhost:11434/api/embeddings",
            data=json.dumps({"model": embed_model, "prompt": text[:4000]}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            vec = data.get("embedding")
            return vec if isinstance(vec, list) else None
        except Exception as exc:
            logger.warning("embed failed: %s", exc)
            return None

    client = chromadb.PersistentClient(path=str(semantic_dir / "chroma"))
    collection = client.get_or_create_collection(name="onli_np_kb_prod")

    ids: list[str] = []
    docs: list[str] = []
    metas: list[dict[str, Any]] = []
    embeddings: list[list[float]] = []

    for name in PROD_COLLECTIONS:
        path = jsonl_dir / f"{name}.jsonl"
        if not path.exists():
            continue
        for rec in iter_jsonl(path):
            if len(ids) >= max_docs:
                break
            rid = str(rec.get("record_id") or "")
            text = str(rec.get("content_text") or rec.get("raw_input") or "")
            if not rid or not text.strip():
                continue
            vec = embed(text)
            if not vec:
                # Abort remaining if embeddings fail repeatedly
                if len(embeddings) == 0:
                    payload = {
                        "generated_at": utc_now_iso(),
                        "status": "pending",
                        "message": f"Embedding model {embed_model} unavailable",
                        "docs_indexed": 0,
                    }
                    atomic_write_json(status_path, payload)
                    atomic_write_json(manifests_dir / "semantic_index_manifest.json", payload)
                    return 0
                continue
            ids.append(rid)
            docs.append(text[:2000])
            metas.append(
                {
                    "source_file_id": str(rec.get("source_file_id") or ""),
                    "collection": str(rec.get("collection") or name),
                    "record_type": str(rec.get("record_type") or ""),
                    "execution_allowed": False,
                }
            )
            embeddings.append(vec)
            if len(ids) % 25 == 0:
                logger.info("Embedded %s/%s…", len(ids), max_docs)
        if len(ids) >= max_docs:
            break

    if ids:
        # Upsert in chunks
        for i in range(0, len(ids), 50):
            collection.upsert(
                ids=ids[i : i + 50],
                documents=docs[i : i + 50],
                metadatas=metas[i : i + 50],
                embeddings=embeddings[i : i + 50],
            )

    payload = {
        "generated_at": utc_now_iso(),
        "status": "partial" if ids else "pending",
        "message": (
            f"Bounded production semantic slice indexed ({len(ids)} docs). "
            "Evaluation corpora excluded. Lexical remains authoritative for safety."
        ),
        "docs_indexed": len(ids),
        "max_docs": max_docs,
        "embed_model": embed_model,
        "index_path": rel_to_repo(repo_root, semantic_dir / "chroma"),
        "collections_included": list(PROD_COLLECTIONS),
        "evaluation_excluded": True,
    }
    atomic_write_json(status_path, payload)
    atomic_write_json(manifests_dir / "semantic_index_manifest.json", payload)
    logger.info("Semantic index status=%s docs=%s", payload["status"], len(ids))
    return 0


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    parser = argparse.ArgumentParser(description="Optional bounded semantic KB index")
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--semantic-dir", type=Path, default=None)
    parser.add_argument("--manifests-dir", type=Path, default=None)
    parser.add_argument("--max-docs", type=int, default=500)
    args = parser.parse_args(argv)
    repo_root = args.repo_root.resolve()
    return run(
        repo_root=repo_root,
        semantic_dir=(args.semantic_dir or repo_root / cfg["paths"]["indexes_semantic_dir"]).resolve(),
        manifests_dir=(args.manifests_dir or repo_root / cfg["paths"]["manifests_dir"]).resolve(),
        max_docs=args.max_docs,
    )


if __name__ == "__main__":
    sys.exit(main())
