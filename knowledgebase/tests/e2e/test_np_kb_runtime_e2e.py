"""Dev E2E: NP KB enrichment must never authorize execution."""

from __future__ import annotations

import os
import re
import sys
import types
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
ADAPTER = REPO / "erp_bot" / "src" / "nlu" / "np_kb_adapter.py"


def _load_adapter():
    code = ADAPTER.read_text(encoding="utf-8")
    mod = types.ModuleType("np_kb_adapter")
    sys.modules["np_kb_adapter"] = mod
    mod.__dict__["__file__"] = str(ADAPTER)
    exec(compile(code, str(ADAPTER), "exec"), mod.__dict__)
    return mod


def test_enabled_kb_never_allows_execution_and_can_retrieve():
    mod = _load_adapter()
    cfg = mod.NpKbConfig(
        enabled=True,
        root=REPO / "knowledgebase",
        lexical_enabled=True,
        citations_enabled=True,
        review_policy="development_all",
        min_quality_score=0.0,
        lexical_top_k=3,
    )
    res = mod.interpret_user_text("bank reconciliation vat payroll", cfg=cfg)
    assert res.enabled is True
    assert res.execution_allowed is False
    assert res.interpretation_only is True
    # Index should exist from Phase 5; tolerate empty env in CI without DB
    lex = REPO / "knowledgebase" / "indexes" / "lexical" / "kb_lexical.sqlite"
    if lex.exists():
        assert len(res.citations) >= 1


def test_disabled_kb_skips_cleanly():
    mod = _load_adapter()
    os.environ["ORBIX_NP_KB_ENABLED"] = "false"
    res = mod.interpret_user_text("sales report")
    assert res.enabled is False
    assert res.execution_allowed is False
