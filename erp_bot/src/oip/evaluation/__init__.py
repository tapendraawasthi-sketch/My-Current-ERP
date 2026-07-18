"""MAI-04 canonical MokXya AI frozen evaluation package.

Non-canonical peers (not extended as MAI-04 authority):
- erp_bot/scripts/eval_khata_benchmark.py (legacy khata golden)
- knowledgebase/scripts/run_kb_evaluation.py (retrieval/KB)
- oip.modules.quality_gate (runtime action quality, not frozen AI suite)
"""

from __future__ import annotations

RUNNER_VERSION = "mai-04.1.0"
SCORER_VERSION = "mai-04.1.0"
EVAL_SCHEMA_VERSION = "1.0.0"

__all__ = [
    "EVAL_SCHEMA_VERSION",
    "RUNNER_VERSION",
    "SCORER_VERSION",
]
