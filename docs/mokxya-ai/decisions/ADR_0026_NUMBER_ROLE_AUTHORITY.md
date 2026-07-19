# ADR_0026 — Number / Date / Money / Quantity / Duration / ID Role Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-09-NUMBER-DATE-MONEY-QUANTITY-DURATION-ID-ROLES (slice 1)
- **Extends:** ADR_0006 (protected spans), ADR_0025 (MAI-08)

## Context

Shop utterances put durations (`5 maina ko`), invoice numbers, PAN/phone IDs, and
money in the same digit stream. Legacy extractors treat `\d+ ko` as money and the
eval adapter defaults unmatched numerals to `amount`.

## Decision

1. MAI-09 owns **number-role candidates** on `LanguageFrame` via
   `NumberRoleBundleV1` — annotation / candidates only; never mutates raw.
2. Role taxonomy (slice 1): `duration`, `quantity`, `amount`, `percentage`,
   `invoice_number`, `identifier`, `date`, `unknown`.
3. Duration cues (`maina` / `mahina` / `month` / `महिना`) win **before** amount.
4. MAI-05 protected `PHONE_CANDIDATE` / `PAN_CANDIDATE` / `INVOICE_REFERENCE`
   surfaces must not become `amount`.
5. Unmatched numerals default to `unknown`, not `amount`.
6. BS/AD conversion and lakh/crore expansion are slice 2+; reuse existing
   `nepaliDate` when date roles are promoted.
7. Slice 1 is engineering-gated: `production_approved=false`.

## Rejected

| Alternative | Why |
|-------------|-----|
| Keep first-digit-as-money default | Roadmap gate failure |
| Auto-write amount into drafts from candidates | Silent mutation |

## Related

- `docs/mokxya-ai/MAI_09_NUMBER_DATE_MONEY_QUANTITY_DURATION_ID_ROLES.md`
- `erp_bot/src/oip/modules/language_runtime/number_roles/`
