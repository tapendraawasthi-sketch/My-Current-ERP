#!/usr/bin/env python3
"""
e-Khata / erp_bot startup health check.

Offline checks run without Ollama or a running server.
Optional flags probe live services.

Usage:
    python3 erp_bot/scripts/health_check.py
    python3 erp_bot/scripts/health_check.py --server http://localhost:8765
    python3 erp_bot/scripts/health_check.py --ollama
    python3 erp_bot/scripts/health_check.py --full
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path

BOT_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BOT_ROOT.parent
sys.path.insert(0, str(BOT_ROOT))

DEFAULT_PORT = os.getenv("API_PORT", "8765")
DEFAULT_BASE = f"http://127.0.0.1:{DEFAULT_PORT}"


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str = ""


def _run(name: str, fn) -> CheckResult:
    try:
        detail = fn() or ""
        return CheckResult(name, True, str(detail))
    except Exception as exc:
        return CheckResult(name, False, str(exc))


def check_erp_path() -> str:
    from src.config import ERP_PATH

    if not ERP_PATH.exists():
        raise RuntimeError(f"ERP_PATH missing: {ERP_PATH}")
    return str(ERP_PATH)


def check_vocabulary_master() -> str:
    master = REPO_ROOT / "data" / "ekhata" / "vocabulary" / "master.json"
    if not master.exists():
        raise RuntimeError("vocabulary master.json missing — run build_vocabulary_master.py")
    data = json.loads(master.read_text(encoding="utf-8"))
    count = int(data.get("term_count") or 0)
    if count < 500:
        raise RuntimeError(f"term_count too low: {count}")
    return f"{count} terms"


def check_lora_dataset() -> str:
    path = REPO_ROOT / "data" / "ekhata" / "lora-instruction-dataset.jsonl"
    if not path.exists():
        raise RuntimeError("lora-instruction-dataset.jsonl missing")
    lines = sum(1 for _ in path.open(encoding="utf-8"))
    if lines < 100:
        raise RuntimeError(f"dataset too small: {lines} lines")
    return f"{lines} lines"


def check_sector_kb() -> str:
    from src.knowledge.knowledge_registry import load_all_chunks

    chunks = load_all_chunks()
    sector = [c for c in chunks if c.id.startswith("sector-")]
    if len(sector) < 500:
        raise RuntimeError(f"sector chunks low: {len(sector)}")
    return f"{len(sector)} sector chunks ({len(chunks)} total)"


def check_holdout_baseline() -> str:
    baseline = REPO_ROOT / "data" / "ekhata" / "sector_nlu_eval_baseline.json"
    if not baseline.exists():
        raise RuntimeError("sector_nlu_eval_baseline.json missing")
    data = json.loads(baseline.read_text(encoding="utf-8"))
    rate = float(data.get("pass_rate") or 0)
    passed = int(data.get("passed") or 0)
    total = int(data.get("total") or 0)
    if rate < 0.99:
        raise RuntimeError(f"baseline {passed}/{total} ({rate:.1%})")
    return f"{passed}/{total} ({rate:.1%})"


def check_conversation_manager() -> str:
    from src.conversation.manager import get_conversation_manager

    mgr = get_conversation_manager()
    ctx = {
        "business_sector": "mobile-repair-shop",
        "business_sector_slug": "mobile-repair-shop",
        "cash_balance": 50000,
    }
    sid = f"health-{uuid.uuid4().hex[:8]}"
    resp = mgr.handle_message(
        "aaja 200 ko nagad bikri vayo",
        session_id=sid,
        context=ctx,
    )
    if resp.action != "confirm":
        raise RuntimeError(f"expected confirm, got {resp.action}: {resp.message[:80]}")
    return f"confirm card ok (intent={resp.metadata.get('intent')})"


def check_chroma_collections() -> str:
    from src.vectorstore.ca_knowledge_store import get_ca_knowledge_count
    from src.vectorstore.nlu_knowledge_store import get_nlu_knowledge_count
    from src.vectorstore.nepali_grammar_store import get_nepali_grammar_count

    ca = get_ca_knowledge_count()
    nlu = get_nlu_knowledge_count()
    ng = get_nepali_grammar_count()
    parts = [f"ca={ca}", f"nlu={nlu}", f"grammar={ng}"]
    if ca == 0 and nlu == 0:
        return "lexical-only (Chroma empty — OK offline; run ingest when Ollama up)"
    return ", ".join(parts)


def check_ollama(base_url: str) -> str:
    import httpx

    resp = httpx.get(f"{base_url.rstrip('/')}/api/tags", timeout=10)
    resp.raise_for_status()
    models = [m.get("name", "") for m in resp.json().get("models", [])]
    if not models:
        raise RuntimeError("no models pulled")
    return f"{len(models)} models: {', '.join(models[:4])}"


def check_server(base: str) -> str:
    import httpx

    st = httpx.get(f"{base.rstrip('/')}/status", timeout=15)
    st.raise_for_status()
    data = st.json()
    if data.get("status") != "online":
        raise RuntimeError(f"status={data.get('status')}")

    sid = f"health-v2-{uuid.uuid4().hex[:8]}"
    chat = httpx.post(
        f"{base.rstrip('/')}/v2/chat",
        json={
            "message": "aaja 200 ko nagad bikri vayo",
            "session_id": sid,
            "context": {
                "business_sector": "mobile-repair-shop",
                "business_sector_slug": "mobile-repair-shop",
            },
        },
        timeout=120,
    )
    chat.raise_for_status()
    body = chat.json()
    action = body.get("action")
    if action not in ("confirm", "clarify"):
        raise RuntimeError(f"v2/chat action={action}")
    return f"online ollama={data.get('ollama')} v2={action}"


def run_subprocess_test(script: str) -> str:
    path = BOT_ROOT / "scripts" / script
    proc = subprocess.run(
        [sys.executable, str(path)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=300,
    )
    if proc.returncode != 0:
        tail = (proc.stdout + proc.stderr).strip().splitlines()[-5:]
        raise RuntimeError("\n".join(tail))
    last = [ln for ln in proc.stdout.splitlines() if "passed" in ln.lower()]
    return last[-1] if last else "ok"


def main() -> int:
    parser = argparse.ArgumentParser(description="e-Khata startup health check")
    parser.add_argument(
        "--server",
        nargs="?",
        const=DEFAULT_BASE,
        default="",
        help=f"Probe HTTP API (optional URL, default {DEFAULT_BASE})",
    )
    parser.add_argument("--ollama", action="store_true", help="Check Ollama /api/tags")
    parser.add_argument(
        "--ollama-url",
        default=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    )
    parser.add_argument("--full", action="store_true", help="Run production + holdout test scripts")
    args = parser.parse_args()

    results: list[CheckResult] = []

    offline = [
        ("erp_path", check_erp_path),
        ("vocabulary_master", check_vocabulary_master),
        ("lora_dataset", check_lora_dataset),
        ("sector_kb", check_sector_kb),
        ("holdout_baseline", check_holdout_baseline),
        ("chroma_collections", check_chroma_collections),
        ("conversation_smoke", check_conversation_manager),
    ]
    for name, fn in offline:
        results.append(_run(name, fn))

    if args.full:
        for script in ("test_production_smoke.py", "test_sector_nlu_holdout.py"):
            results.append(_run(script, lambda s=script: run_subprocess_test(s)))

    if args.ollama:
        results.append(_run("ollama", lambda: check_ollama(args.ollama_url)))

    if args.server:
        results.append(_run("http_server", lambda: check_server(args.server)))

    failed = 0
    print("e-Khata Health Check")
    print("=" * 60)
    for r in results:
        mark = "OK" if r.ok else "FAIL"
        print(f"[{mark}] {r.name}" + (f" — {r.detail}" if r.detail else ""))
        if not r.ok:
            failed += 1

    print("=" * 60)
    print(f"{len(results) - failed}/{len(results)} checks passed")
    if failed:
        print("\nHints:")
        print("  Ollama:  ollama serve && ollama pull qwen3:4b nomic-embed-text")
        print("  Server:  python3 erp_bot/scripts/start.py")
        print("  Ingest:  python3 erp_bot/scripts/ingest_nlu_knowledge_embeddings.py --force")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
