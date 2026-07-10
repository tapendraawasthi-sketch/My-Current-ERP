"""Text extraction and OCR for knowledge documents."""

from __future__ import annotations

import logging
import re
from io import BytesIO

from backend.knowledge.config import OCR_MIME_PREFIXES, OCR_PDF_SCAN_THRESHOLD_CHARS
from backend.knowledge.models import ExtractionResult

logger = logging.getLogger(__name__)


from backend.knowledge.adapters.ocr import ocr_image_bytes


def _extract_pdf(data: bytes) -> tuple[str, bool]:
    """Extract text from PDF; returns (text, needs_ocr)."""
    text = ""
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=data, filetype="pdf")
        parts = [page.get_text() for page in doc]
        text = "\n\n".join(p.strip() for p in parts if p.strip())
    except Exception:
        try:
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(data))
            parts = [page.extract_text() or "" for page in reader.pages]
            text = "\n\n".join(p.strip() for p in parts if p.strip())
        except Exception as exc:
            logger.warning("PDF extraction failed: %s", exc)

    needs_ocr = len(text.strip()) < OCR_PDF_SCAN_THRESHOLD_CHARS
    return text, needs_ocr


def _extract_docx(data: bytes) -> str:
    try:
        from docx import Document

        doc = Document(BytesIO(data))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as exc:
        logger.warning("DOCX extraction failed: %s", exc)
        return ""


def _to_markdown(text: str, *, title: str) -> str:
    cleaned = text.strip()
    if not cleaned:
        return f"# {title}\n\n_(No extractable text)_"
    if cleaned.startswith("#"):
        return cleaned
    return f"# {title}\n\n{cleaned}"


class DocumentTextExtractor:
    """Extracts markdown from uploaded files with optional OCR."""

    def extract(
        self, data: bytes, *, mime_type: str, filename: str
    ) -> ExtractionResult:
        mime = (mime_type or "application/octet-stream").lower()
        title = filename.rsplit("/", 1)[-1]
        ocr_used = False
        requires_ocr = False
        text = ""

        if mime.startswith("text/") or mime in {
            "application/json",
            "application/xml",
        }:
            text = data.decode("utf-8", errors="replace")
        elif mime == "application/pdf":
            text, requires_ocr = _extract_pdf(data)
            if requires_ocr:
                ocr_used = False  # PDF page raster OCR is a future enhancement
        elif mime in {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        }:
            text = _extract_docx(data)
        elif any(mime.startswith(p) for p in OCR_MIME_PREFIXES):
            requires_ocr = True
            text = ocr_image_bytes(data)
            ocr_used = bool(text.strip())
        else:
            try:
                text = data.decode("utf-8", errors="strict")
            except Exception:
                requires_ocr = True
                text = ""

        markdown = _to_markdown(text, title=title)
        return ExtractionResult(
            markdown=markdown,
            requires_ocr=requires_ocr,
            ocr_used=ocr_used,
            source_mime=mime,
        )
