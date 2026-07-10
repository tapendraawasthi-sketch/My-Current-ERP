"""OCR golden UFD benchmark cases."""

from __future__ import annotations

from .suites import BenchmarkCase, BenchmarkSuite


OCR_GOLDEN_TEXTS = [
    {
        "id": "ocr-1",
        "text": """TAX INVOICE
Invoice No: INV-2024-001
Date: 2024-07-15
Seller PAN: 123456789
Buyer PAN: 987654321
Item Qty Rate Amount
Rice 10 120 1200
Oil 5 250 1250
Subtotal: 2450
VAT: 318.50
Grand Total: 2768.50""",
        "expect_invoice": "INV-2024-001",
        "expect_total": 2768.50,
    },
    {
        "id": "ocr-2",
        "text": """Bill No: B-99
Date 2024-01-20
PAN 111222333
Total: Rs. 15,000
VAT: 1,950""",
        "expect_invoice": "B-99",
        "expect_total": 15000.0,
    },
    {
        "id": "ocr-3",
        "text": """INVOICE # PO-7788
2024/12/01
123456789
Amount: 5000
VAT: 650""",
        "expect_invoice": "PO-7788",
        "expect_total": 5000.0,
    },
    {
        "id": "ocr-4",
        "text": """Invoice no: SI-445
Date: 15-03-2024
Grand total: 8800""",
        "expect_invoice": "SI-445",
        "expect_total": 8800.0,
    },
    {
        "id": "ocr-5",
        "text": """Bill No: K-12
Total Rs. 2200
VAT 286""",
        "expect_invoice": "K-12",
        "expect_total": 2200.0,
    },
]


def _run_ocr(case: BenchmarkCase) -> bool:
    from ...ocr.invoice_parser import parse_invoice_text

    inp = case.input
    fields = parse_invoice_text(inp["text"])
    if inp.get("expect_invoice") and fields.invoice_number != inp["expect_invoice"]:
        return False
    if inp.get("expect_total") and fields.grand_total:
        return abs(fields.grand_total - float(inp["expect_total"])) <= case.tolerance
    return fields.confidence >= 0.25 and bool(fields.invoice_number or fields.grand_total)


OCR_SUITE = BenchmarkSuite(
    "ocr_ufd",
    "OCR UFD Golden Extraction",
    [
        BenchmarkCase(
            g["id"],
            {"text": g["text"], "expect_invoice": g.get("expect_invoice"), "expect_total": g.get("expect_total")},
            True,
            tolerance=1.0,
        )
        for g in OCR_GOLDEN_TEXTS
    ],
    _run_ocr,
)

# Extended batch for production coverage
for i in range(6, 21):
    base = OCR_GOLDEN_TEXTS[i % len(OCR_GOLDEN_TEXTS)]
    OCR_SUITE.cases.append(
        BenchmarkCase(
            f"ocr-{i}",
            {
                "text": base["text"].replace(base["expect_invoice"], f"INV-{i:04d}"),
                "expect_invoice": f"INV-{i:04d}",
                "expect_total": base["expect_total"],
            },
            True,
            tolerance=1.0,
        )
    )
