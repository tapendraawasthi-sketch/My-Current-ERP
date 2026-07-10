"""OCR → UIL → draft invoice pipeline."""

from __future__ import annotations

import base64
from typing import Any

from ..execution.engines.tax_engine import compute_vat
from ..governance.engine import governance_engine
from ..intelligence.evidence_engine import EvidenceType, evidence_engine
from ..intelligence.provenance_graph import provenance_graph
from ..representations.uil_parser import parse_to_uil
from .invoice_parser import OcrInvoiceFields, parse_invoice_text, try_paddle_ocr, try_tesseract_ocr


class OcrPipeline:
    def process_text(self, text: str, *, actor_id: str | None = None, session_id: str | None = None) -> dict[str, Any]:
        fields = parse_invoice_text(text)
        return self._to_draft(fields, actor_id=actor_id, session_id=session_id, ocr_engine="text")

    def process_image(
        self,
        image_bytes: bytes,
        *,
        actor_id: str | None = None,
        session_id: str | None = None,
        filename: str | None = None,
    ) -> dict[str, Any]:
        text = try_paddle_ocr(image_bytes)
        engine = "paddleocr" if text else ""
        if not text:
            text = try_tesseract_ocr(image_bytes)
            engine = "tesseract" if text else ""
        if not text:
            return {
                "ok": False,
                "error": "OCR engine unavailable — install paddleocr or tesseract, or paste invoice text",
                "draft": None,
                "hint": "POST text to /ocr/invoice or upload a clearer photo",
            }
        fields = parse_invoice_text(text)
        result = self._to_draft(fields, actor_id=actor_id, session_id=session_id, ocr_engine=engine)
        result["ocr_engine"] = engine
        result["filename"] = filename
        result["image_size"] = len(image_bytes)
        if filename:
            result["preview_data_url"] = f"data:image/jpeg;base64,{base64.b64encode(image_bytes[:50000]).decode()}"
        return result

    def _to_draft(
        self,
        fields: OcrInvoiceFields,
        *,
        actor_id: str | None,
        session_id: str | None,
        ocr_engine: str,
    ) -> dict[str, Any]:
        uil = parse_to_uil(fields.raw_text or "create invoice from ocr")
        if fields.party_name:
            uil.goals.append(f"party:{fields.party_name}")

        taxable = fields.subtotal or (fields.grand_total or 0) - (fields.vat_amount or 0)
        vat = compute_vat(max(0, taxable))

        draft = {
            "invoiceNo": fields.invoice_number,
            "date": fields.invoice_date,
            "partyName": fields.party_name,
            "sellerPan": fields.seller_pan,
            "buyerPan": fields.buyer_pan,
            "lines": [
                {
                    "itemName": l.description,
                    "qty": l.qty,
                    "rate": l.rate,
                    "amount": l.amount,
                }
                for l in fields.lines
            ],
            "subtotal": fields.subtotal or vat["taxable_amount"],
            "vatAmount": fields.vat_amount or vat["vat_amount"],
            "grandTotal": fields.grand_total or vat["grand_total"],
            "type": "purchase",
            "source": "cap.ocr.invoice",
        }

        gate = governance_engine.gate_action(
            "cap.ocr.invoice",
            confidence=fields.confidence,
            actor_id=actor_id,
            payload={"invoice_no": fields.invoice_number},
        )

        ev = evidence_engine.create(
            EvidenceType.OCR,
            f"Invoice {fields.invoice_number or 'unknown'} — Rs.{fields.grand_total or vat['grand_total']}",
            "cap.ocr.invoice",
            confidence=fields.confidence,
            metadata={"engine": ocr_engine, "line_count": len(fields.lines)},
        )
        provenance_graph.record_evidence(
            ev.id,
            ev.type.value,
            ev.statement,
            ev.source,
            capability_id="cap.ocr.invoice",
            session_id=session_id,
            metadata={"ocr_engine": ocr_engine},
        )

        return {
            "ok": True,
            "confidence": fields.confidence,
            "ocr_engine": ocr_engine,
            "evidence_id": ev.id,
            "uil": {
                "id": uil.id,
                "action": uil.action,
                "goals": uil.goals,
                "confidence": uil.confidence,
            },
            "draft": draft,
            "governance": gate,
            "fields": {
                "invoice_number": fields.invoice_number,
                "grand_total": fields.grand_total,
                "line_count": len(fields.lines),
            },
        }


ocr_pipeline = OcrPipeline()
