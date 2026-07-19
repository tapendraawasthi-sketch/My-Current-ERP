/**
 * NEXT-05 / ADR_0075 — short-lived confirm tokens on Model B product path.
 * Does not post. AI confirm_oec_candidate remains non-authority.
 */

import { generateId } from "@/lib/db";
import type { KhataConfirmationCard } from "./types";

export const CONFIRM_PATH_ADR = "ADR_0075" as const;
export const CONFIRM_PATH_STEP = "NEXT-05" as const;
export const PRODUCT_MUTATION_PATH = "DEXIE_EXECUTE_ORBIX_CONFIRM" as const;
export const NL_ASSENT_POSTS = false as const;
export const AI_CONFIRM_OEC_IS_AUTHORITY = false as const;
export const CONFIRM_TOKEN_TTL_MS = 15 * 60 * 1000;

export type ConfirmTokenBind = {
  companyId: string | null | undefined;
  draftId?: string | null;
  previewHash?: string | null;
};

export type ConfirmTokenErrorCode =
  | "confirm_token_required"
  | "confirm_token_unknown"
  | "confirm_token_expired"
  | "confirm_token_reuse"
  | "confirm_token_tenant_mismatch";

type TokenRecord = {
  token: string;
  companyId: string;
  draftId: string | null;
  previewHash: string | null;
  mintedAt: number;
  consumedAt: number | null;
};

const tokens = new Map<string, TokenRecord>();

function normalizeCompanyId(companyId: string | null | undefined): string {
  return String(companyId || "").trim();
}

export function mintConfirmToken(bind: ConfirmTokenBind, now = Date.now()): string {
  const companyId = normalizeCompanyId(bind.companyId);
  if (!companyId) {
    throw new Error("CONFIRM_TOKEN_COMPANY_REQUIRED");
  }
  const token = `orbix-confirm-${generateId()}`;
  tokens.set(token, {
    token,
    companyId,
    draftId: bind.draftId != null ? String(bind.draftId) : null,
    previewHash: bind.previewHash != null ? String(bind.previewHash) : null,
    mintedAt: now,
    consumedAt: null,
  });
  return token;
}

export function validateConfirmToken(
  token: string | null | undefined,
  bind: ConfirmTokenBind,
  now = Date.now(),
): { ok: true } | { ok: false; error_code: ConfirmTokenErrorCode } {
  const raw = String(token || "").trim();
  if (!raw) {
    return { ok: false, error_code: "confirm_token_required" };
  }
  const rec = tokens.get(raw);
  if (!rec) {
    return { ok: false, error_code: "confirm_token_unknown" };
  }
  if (rec.consumedAt != null) {
    return { ok: false, error_code: "confirm_token_reuse" };
  }
  if (now - rec.mintedAt > CONFIRM_TOKEN_TTL_MS) {
    return { ok: false, error_code: "confirm_token_expired" };
  }
  const companyId = normalizeCompanyId(bind.companyId);
  if (!companyId || companyId !== rec.companyId) {
    return { ok: false, error_code: "confirm_token_tenant_mismatch" };
  }
  return { ok: true };
}

export function consumeConfirmToken(
  token: string | null | undefined,
  bind: ConfirmTokenBind,
  now = Date.now(),
): { ok: true } | { ok: false; error_code: ConfirmTokenErrorCode } {
  const validated = validateConfirmToken(token, bind, now);
  if (!validated.ok) return validated;
  const raw = String(token || "").trim();
  const rec = tokens.get(raw);
  if (!rec || rec.consumedAt != null) {
    return { ok: false, error_code: "confirm_token_reuse" };
  }
  rec.consumedAt = now;
  tokens.set(raw, rec);
  return { ok: true };
}

export function ensureCardConfirmToken(
  card: KhataConfirmationCard,
  companyId: string | null | undefined,
): KhataConfirmationCard {
  const existing = String(card.confirm_token || "").trim();
  if (existing) {
    const peek = validateConfirmToken(existing, {
      companyId,
      draftId: card.draft_id,
      previewHash: card.preview_hash,
    });
    if (peek.ok) return card;
  }
  const token = mintConfirmToken({
    companyId,
    draftId: card.draft_id,
    previewHash: card.preview_hash,
  });
  return { ...card, confirm_token: token };
}

export function postingSuccessHasReceipt(payload: {
  voucher_id?: string | null;
  voucher_number?: string | null;
  invoice_id?: string | null;
  invoice_number?: string | null;
  journal_id?: string | null;
  posting_id?: string | null;
}): boolean {
  const fields = [
    payload.voucher_id,
    payload.voucher_number,
    payload.invoice_id,
    payload.invoice_number,
    payload.journal_id,
  ];
  return fields.some((v) => String(v || "").trim().length > 0);
}

/** NL chat assent must never be treated as a post command. */
export function nlAssentMayPost(_utterance: string | null | undefined): false {
  return false;
}

export function clearConfirmTokensForTests(): void {
  tokens.clear();
}

export function confirmPathHonestySnapshot() {
  return {
    authority: CONFIRM_PATH_ADR,
    step: CONFIRM_PATH_STEP,
    productMutationPath: PRODUCT_MUTATION_PATH,
    nlAssentPosts: NL_ASSENT_POSTS,
    aiConfirmOecIsAuthority: AI_CONFIRM_OEC_IS_AUTHORITY,
    confirmTokenTtlMs: CONFIRM_TOKEN_TTL_MS,
    oecIsSoleMutationAuthority: false,
    productionApproved: false,
  };
}
