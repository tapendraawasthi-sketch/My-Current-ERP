# LANGUAGE_FORM_TAXONOMY

Offset unit: UNICODE_CODE_POINT.

## Script categories

DEVANAGARI, LATIN, ASCII_DIGIT, DEVANAGARI_DIGIT, COMMON_PUNCTUATION, WHITESPACE, SYMBOL, EMOJI, CONTROL, UNKNOWN, MIXED.

Script is not language.

## Language-form categories

| Form | Meaning |
|------|---------|
| NEPALI_DEVANAGARI | Devanagari letter spans |
| ROMANIZED_NEPALI | High-confidence Romanized Nepali (lexicon) |
| ENGLISH | English function/content |
| TECHNICAL_ACCOUNTING_ENGLISH | cash/bank/VAT/… |
| SHARED_OR_AMBIGUOUS_LATIN | ma/bill/may/… abstention |
| NAMED_ENTITY_CANDIDATE | Likely names (not transliterated) |
| IDENTIFIER_OR_CODE | Protected non-numeric ids |
| NUMERIC | Digits/money/dates etc. |
| PUNCTUATION_OR_SYMBOL | Non-language |
| UNKNOWN | Residual |

## Rules

- Latin ≠ English automatically.
- Ambiguous forms must not be force-labeled.
- Technical English may appear inside Nepali text.
- No transliteration in MAI-05.
- Protected spans override ordinary language-form with IDENTIFIER_OR_CODE/NUMERIC.
