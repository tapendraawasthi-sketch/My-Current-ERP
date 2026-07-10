"""OCR invoice parser — regex/heuristic extraction (PaddleOCR-ready hook)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class OcrLineItem:
    description: str
    qty: float
    rate: float
    amount: float


@dataclass
class OcrInvoiceFields:
    invoice_number: str | None = None
    invoice_date: str | None = None
    seller_pan: str | None = None
    buyer_pan: str | None = None
    party_name: str | None = None
    subtotal: float | None = None
    vat_amount: float | None = None
    grand_total: float | None = None
    lines: list[OcrLineItem] = field(default_factory=list)
    raw_text: str = ""
    confidence: float = 0.0


_PAN = re.compile(r"\b(\d{9})\b")
_INVOICE_NO = re.compile(
    r"(?:invoice|bill)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]*)",
    re.I,
)
_DATE = re.compile(r"(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})")
_GRAND_TOTAL = re.compile(
    r"(?:grand\s*total|total\s*amount)\s*[:\-]?\s*(?:rs\.?|npr)?\s*([\d,]+(?:\.\d{2})?)",
    re.I,
)
_SUBTOTAL = re.compile(r"subtotal\s*[:\-]?\s*(?:rs\.?|npr)?\s*([\d,]+(?:\.\d{2})?)", re.I)
_VAT = re.compile(r"vat\s*[:\-]?\s*(?:rs\.?|npr)?\s*([\d,]+(?:\.\d{2})?)", re.I)
_LINE = re.compile(
    r"^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$",
    re.M,
)


def parse_invoice_text(text: str) -> OcrInvoiceFields:
    fields = OcrInvoiceFields(raw_text=text)
    pans = _PAN.findall(text)
    if pans:
        fields.seller_pan = pans[0]
        if len(pans) > 1:
            fields.buyer_pan = pans[1]

    m = _INVOICE_NO.search(text)
    if m:
        fields.invoice_number = m.group(1)

    m = _DATE.search(text)
    if m:
        fields.invoice_date = m.group(1)

    m = _VAT.search(text)
    if m:
        fields.vat_amount = float(m.group(1).replace(",", ""))

    m = _GRAND_TOTAL.search(text)
    if m:
        fields.grand_total = float(m.group(1).replace(",", ""))
    else:
        m = _SUBTOTAL.search(text)
        if m:
            fields.grand_total = float(m.group(1).replace(",", ""))

    for lm in _LINE.finditer(text):
        fields.lines.append(
            OcrLineItem(
                description=lm.group(1).strip(),
                qty=float(lm.group(2)),
                rate=float(lm.group(3)),
                amount=float(lm.group(4)),
            )
        )

    if fields.lines:
        fields.subtotal = sum(l.amount for l in fields.lines)

    hits = sum(
        1
        for v in [fields.invoice_number, fields.grand_total, fields.seller_pan, fields.lines]
        if v
    )
    fields.confidence = min(1.0, hits / 4)
    return fields


def try_tesseract_ocr(image_bytes: bytes) -> str | None:
    """Optional Tesseract hook via pytesseract + Pillow."""
    try:
        import io

        from PIL import Image  # type: ignore
        import pytesseract  # type: ignore

        img = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(img, lang="eng+hin")
        return text.strip() or None
    except Exception:
        return None

def try_paddle_ocr(image_bytes: bytes) -> str | None:
    """Optional PaddleOCR hook — returns None if not installed."""
    try:
        from paddleocr import PaddleOCR  # type: ignore

        ocr = PaddleOCR(use_angle_cls=True, lang="en")
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".png", delete=True) as f:
            f.write(image_bytes)
            f.flush()
            result = ocr.ocr(f.name, cls=True)
        lines: list[str] = []
        for block in result or []:
            for line in block or []:
                if line and len(line) > 1:
                    lines.append(str(line[1][0]))
        return "\n".join(lines)
    except Exception:
        return None
