#!/usr/bin/env python3
"""End-to-end /khata/chat verification — four original test messages."""

from __future__ import annotations

import sys
import time
import uuid

import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:8765"

TESTS = [
    "what is sampati",
    "Ram le 500 ko saman kinyo",
    "faithful representation k ho",
    "udhaar bikri ko entry k hunchha",
]


def chat(message: str, session_id: str) -> dict:
    resp = httpx.post(
        f"{BASE}/khata/chat",
        json={"message": message, "session_id": session_id},
        timeout=1800,
    )
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    st = httpx.get(f"{BASE}/status", timeout=15).json()
    print("STATUS:", st.get("status"), "| ollama:", st.get("ollama"), "| model:", st.get("model"))
    print("=" * 70)

    for msg in TESTS:
        sid = "e2e-" + uuid.uuid4().hex[:8]
        print(f"USER: {msg}")
        t0 = time.time()
        data = chat(msg, sid)
        elapsed = round(time.time() - t0, 1)
        print(f"ENGINE: {data.get('engine')} | KIND: {data.get('kind')} | {elapsed}s")
        print(f"REPLY:\n{data.get('reply', '')}\n")
        print("-" * 70)

    print("VARIATION TEST (same meaning, different wording)")
    a = chat("what is sampati", "var-a")
    b = chat("sampatti k ho", "var-b")
    print("A) what is sampati")
    print(a.get("reply", ""))
    print()
    print("B) sampatti k ho")
    print(b.get("reply", ""))
    print()
    print("IDENTICAL:", a.get("reply") == b.get("reply"))


if __name__ == "__main__":
    main()
