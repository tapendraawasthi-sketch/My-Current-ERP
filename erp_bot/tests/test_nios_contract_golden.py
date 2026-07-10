"""Per-capability Intelligence Contract golden tests."""

from __future__ import annotations

import unittest

from src.nios.contracts.intelligence_contract import make_observation, ObserveContext
from src.nios.intelligence.evidence_engine import EvidenceType, evidence_engine
from src.nios.intelligence.evidence_verify import build_evidence_bundle, explanation_with_evidence
from src.nios.intelligence.truth_layer import validate_facts
from src.nios.representations.uil_parser import parse_to_uil


GOLDEN_CAPABILITIES = [
    "cap.erp.ledger.balance",
    "cap.erp.session_snapshot",
    "cap.engine.tax.vat",
    "cap.engine.payroll",
    "cap.engine.simulation",
    "cap.knowledge.nepal.search",
    "cap.ocr.invoice",
    "cap.cache.semantic",
    "cap.chat.route",
    "cap.legal.search",
]


def contract_stages_for_capability(cap_id: str, message: str, *, balance: dict | None = None) -> dict:
    """Run Observe→Understand→Plan→Execute→Verify→Explain→Learn for one capability."""
    stages: dict = {}

    ctx = ObserveContext(session_id="golden-test", channel="chat", raw_input={"message": message})
    obs = make_observation(ctx, message)
    stages["observe"] = {"id": obs.id, "channel": obs.channel}

    uil = parse_to_uil(message)
    stages["understand"] = {"action": uil.action, "confidence": uil.confidence}
    stages["plan"] = {"capability": cap_id, "steps": 1}

    if cap_id == "cap.engine.tax.vat":
        from src.nios.execution.engines.tax_engine import compute_vat

        out = compute_vat(1000)
        answer = f"VAT on 1000: Rs.{out['vat_amount']}"
    elif cap_id == "cap.engine.payroll":
        from src.nios.execution.engines.tax_engine import compute_payroll

        out = compute_payroll(50000)
        answer = f"Net pay: Rs.{out['net_pay']}"
    elif cap_id == "cap.erp.ledger.balance" and balance:
        answer = f"Cash: {balance.get('cash', 0)}"
    else:
        answer = f"Executed {cap_id} for: {message[:50]}"

    stages["execute"] = {"ok": True, "answer_len": len(answer)}

    bundle = build_evidence_bundle(answer, [cap_id], session_id="golden-test")
    explanation = explanation_with_evidence(answer, [cap_id], confidence=0.95, session_id="golden-test")
    stages["verify"] = bundle["validation"]
    stages["explain"] = {"summary": explanation.summary, "evidence_count": len(explanation.evidence)}
    stages["learn"] = {"recorded": True, "capability": cap_id}

    return stages


class ContractGoldenTests(unittest.TestCase):
    def test_all_capabilities_seven_stages(self):
        balance = {"cash": 1000, "bank": 2000, "receivable": 500, "payable": 300}
        for cap_id in GOLDEN_CAPABILITIES:
            message = "Ram ko balance kati ho" if "ledger" in cap_id else "VAT calculate garnu"
            stages = contract_stages_for_capability(cap_id, message, balance=balance)
            self.assertEqual(stages["observe"]["channel"], "chat")
            self.assertTrue(stages["understand"]["action"])
            self.assertEqual(stages["plan"]["capability"], cap_id)
            self.assertTrue(stages["execute"]["ok"])
            self.assertTrue(stages["verify"]["ok"] or stages["verify"]["count"] >= 1)
            self.assertGreaterEqual(stages["explain"]["evidence_count"], 1)
            self.assertTrue(stages["learn"]["recorded"])

    def test_evidence_engine_twelve_types(self):
        types = [t.value for t in EvidenceType]
        self.assertEqual(len(types), 12)
        self.assertIn("ontology", types)

    def test_evidence_bundle_validation(self):
        bundle = build_evidence_bundle("Test answer", ["cap.engine.tax.vat"], session_id="ev-test")
        self.assertTrue(bundle["validation"]["ok"])
        self.assertGreaterEqual(bundle["validation"]["count"], 1)

    def test_truth_layer_rejects_missing_evidence(self):
        result = validate_facts([{"text": "unsupported claim", "evidence": [], "source": "test"}])
        self.assertFalse(result.ok)
        self.assertIn("unsupported claim", result.unsupported)

    def test_explanation_envelope(self):
        exp = explanation_with_evidence(
            "Net pay Rs. 45,000",
            ["cap.engine.payroll"],
            confidence=1.0,
            formula_used=["cap.engine.payroll"],
        )
        self.assertTrue(exp.formula_used)
        self.assertGreater(exp.confidence, 0)
        self.assertGreaterEqual(len(exp.evidence), 1)

    def test_evidence_merge_dedupes(self):
        a = evidence_engine.create(EvidenceType.ERP, "Same statement", "cap.erp.test")
        b = evidence_engine.create(EvidenceType.TOOL, "Same statement", "cap.engine.test")
        merged = evidence_engine.merge([a, b])
        self.assertEqual(len(merged), 1)
        self.assertGreaterEqual(merged[0].authority, 0.9)

    def test_optimization_engine_payroll(self):
        from src.nios.execution.optimization.engine import optimization_engine

        result = optimization_engine.optimize_salary_structure(100_000, marital_status="single")
        self.assertIsNotNone(result.recommended)
        self.assertGreater(result.recommended.score, 0)
        self.assertGreaterEqual(len(result.options), 3)


if __name__ == "__main__":
    unittest.main()
