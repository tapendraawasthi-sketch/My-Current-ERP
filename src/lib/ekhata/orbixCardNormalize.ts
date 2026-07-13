import type { AccountClass, KhataConfirmationCard, KhataIntent } from "./types";

/** Map backend khata card JSON to frontend KhataConfirmationCard. */
export function normalizeOrbixCard(
  raw: Record<string, unknown> | null | undefined,
): KhataConfirmationCard | null {
  if (!raw) return null;

  const journalLines = Array.isArray(raw.journalLines)
    ? raw.journalLines.map((line: Record<string, unknown>) => ({
        accountCode: String(line.accountCode ?? line.account_code ?? ""),
        accountName: String(line.accountName ?? line.account_name ?? ""),
        accountClass: (line.accountClass as AccountClass | undefined) ?? "asset",
        debit: Number(line.debit ?? 0),
        credit: Number(line.credit ?? 0),
        narration: line.narration ? String(line.narration) : undefined,
      }))
    : undefined;

  return {
    intent: String(raw.intent ?? "khata_expense") as KhataIntent,
    party: raw.party != null ? String(raw.party) : null,
    amount: Number(raw.amount ?? 0),
    item: raw.item != null ? String(raw.item) : null,
    date: raw.date != null ? String(raw.date) : new Date().toISOString().slice(0, 10),
    raw_text: String(raw.raw_text ?? raw.narration ?? ""),
    journalLines,
    caExplanation: raw.narration ? String(raw.narration) : undefined,
    draft_id: raw.draft_id != null ? String(raw.draft_id) : null,
    preview_hash: raw.preview_hash != null ? String(raw.preview_hash) : null,
    preview_version: (raw.preview_version as string | number | null) ?? null,
    idempotency_key: raw.idempotency_key != null ? String(raw.idempotency_key) : null,
    // Phase 9 settlement fields — must survive confirm → domain commands
    party_id: raw.party_id != null ? String(raw.party_id) : null,
    cash_or_bank_account_id:
      raw.cash_or_bank_account_id != null ? String(raw.cash_or_bank_account_id) : null,
    from_account_id: raw.from_account_id != null ? String(raw.from_account_id) : null,
    to_account_id: raw.to_account_id != null ? String(raw.to_account_id) : null,
    receipt_type: raw.receipt_type != null ? String(raw.receipt_type) : null,
    payment_type: raw.payment_type != null ? String(raw.payment_type) : null,
    contra_type: raw.contra_type != null ? String(raw.contra_type) : null,
    settlement_kind: raw.settlement_kind != null ? String(raw.settlement_kind) : null,
    bank_charge: raw.bank_charge != null ? Number(raw.bank_charge) : null,
    withholding: raw.withholding != null ? Number(raw.withholding) : null,
    allocations: Array.isArray(raw.allocations)
      ? (raw.allocations as KhataConfirmationCard["allocations"])
      : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
    bank_recon_kind: raw.bank_recon_kind != null ? String(raw.bank_recon_kind) : null,
    bank_account_id: raw.bank_account_id != null ? String(raw.bank_account_id) : null,
    statement_line_id: raw.statement_line_id != null ? String(raw.statement_line_id) : null,
    erp_document_ids: Array.isArray(raw.erp_document_ids)
      ? raw.erp_document_ids.map(String)
      : null,
    cheque_id: raw.cheque_id != null ? String(raw.cheque_id) : null,
    cheque_number: raw.cheque_number != null ? String(raw.cheque_number) : null,
    cheque_next_status: raw.cheque_next_status != null ? String(raw.cheque_next_status) : null,
    adjustment_type: raw.adjustment_type != null ? String(raw.adjustment_type) : null,
    expected_statement_line_version:
      raw.expected_statement_line_version != null
        ? Number(raw.expected_statement_line_version)
        : null,
    reference: raw.reference != null ? String(raw.reference) : null,
  } as KhataConfirmationCard;
}
