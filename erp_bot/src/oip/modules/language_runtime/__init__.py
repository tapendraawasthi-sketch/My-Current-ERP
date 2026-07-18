"""MAI-05 language runtime — span-level script/language-form/protected spans.

Does not normalize, transliterate, or rewrite text. Detection and annotation only.
"""

from __future__ import annotations

ANALYZER_VERSION = "mai-05.1.0"
OFFSET_UNIT = "UNICODE_CODE_POINT"
MAX_INPUT_CODEPOINTS = 20000
MAX_SPANS = 5000

__all__ = ["ANALYZER_VERSION", "OFFSET_UNIT", "MAX_INPUT_CODEPOINTS", "MAX_SPANS"]
