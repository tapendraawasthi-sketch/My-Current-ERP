# PROTECTED_SPAN_POLICY

## Kinds

URL, EMAIL, PHONE_CANDIDATE, PAN_CANDIDATE, VAT_IDENTIFIER, INVOICE_REFERENCE, VOUCHER_REFERENCE, ACCOUNT_CODE, LEGAL_CITATION, DATE/TIME/FY literals, MONEY/PERCENT/DECIMAL/NUMBER literals, FILE_PATH, CODE/JSON fragments, HASHTAG_OR_HANDLE, …

## Priority (high → low)

code/json → URL → email → explicit PAN/VAT/invoice/voucher/account → legal → FY → path → date → percent → money → phone → handles → decimal → number.

## Guarantees

- Atomic: not split into language tokens.
- Exact surface + offsets retained.
- Does not prove company membership or authorize accounting use.
- Digits alone ≠ PAN; contextual prefixes required.
- Digits alone ≠ money without money context pattern.

## Future

MAI-06 must not rewrite protected spans without type-specific rules. MAI-07 must not transliterate them.
