"""Model swap benchmark — workflows pass with mock reasoner."""

from __future__ import annotations

import asyncio

from .suites import BenchmarkCase, BenchmarkSuite


def _run_model_swap(case: BenchmarkCase) -> bool:
    from ...learning.evolution.reasoner_adapter import evolution_registry, ReasonerRequest
    from ...marketplace.skills import marketplace

    async def _test():
        adapter = evolution_registry.get(case.input.get("adapter", "reasoner.mock"))
        resp = await adapter.reason(ReasonerRequest(prompt=case.input.get("prompt", "VAT rate Nepal")))
        if not resp.text:
            return False
        wf_id = case.input.get("workflow")
        if wf_id:
            wf = marketplace.workflows.get(wf_id)
            if wf:
                composed = marketplace.compose_workflow(wf.id)
                if not composed:
                    return False
        return resp.confidence >= float(case.expected)

    return asyncio.run(_test())


MODEL_SWAP_SUITE = BenchmarkSuite(
    "model_swap",
    "Intelligence Evolution — model swap",
    [
        BenchmarkCase("mswap-1", {"adapter": "reasoner.mock", "prompt": "VAT 13%"}, 0.9),
        BenchmarkCase("mswap-2", {"adapter": "reasoner.deterministic", "prompt": "balance"}, 0.9),
        BenchmarkCase(
            "mswap-3",
            {"adapter": "reasoner.mock", "workflow": "workflow.tax.monthly_vat", "prompt": "file VAT"},
            0.9,
        ),
        BenchmarkCase(
            "mswap-4",
            {"adapter": "reasoner.mock", "workflow": "workflow.erp.sales_invoice", "prompt": "sales"},
            0.9,
        ),
        BenchmarkCase(
            "mswap-5",
            {"adapter": "reasoner.mock", "workflow": "workflow.payroll.run", "prompt": "payroll"},
            0.9,
        ),
    ],
    _run_model_swap,
)
