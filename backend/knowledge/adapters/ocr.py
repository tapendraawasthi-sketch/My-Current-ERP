"""Optional OCR backends for image documents."""

from __future__ import annotations


def ocr_image_bytes(data: bytes) -> str:
    """Extract text from image bytes using optional OCR libraries."""
    try:
        from erp_bot.src.nios.ocr.invoice_parser import (
            try_paddle_ocr,
            try_tesseract_ocr,
        )

        return try_paddle_ocr(data) or try_tesseract_ocr(data) or ""
    except Exception:
        pass

    try:
        import io

        from PIL import Image
        import pytesseract

        img = Image.open(io.BytesIO(data))
        return pytesseract.image_to_string(img, lang="eng").strip()
    except Exception:
        return ""
