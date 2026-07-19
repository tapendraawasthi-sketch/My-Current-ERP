/**
 * PR-B2 / ADR_0085 — hard-deny Node khata confirm when markers show Orbix launch
 * sales/purchase product path (Model B Dexie). Fail-closed; draft_mutations=0.
 */

export const LAUNCH_MUTATION_ADR = "ADR_0085" as const;
export const PRODUCT_MUTATION_PATH = "DEXIE_EXECUTE_ORBIX_CONFIRM" as const;

export const LAUNCH_EVENT_IDS = [
  "sales_invoice_draft",
  "purchase_invoice_draft",
] as const;

/** Khata intents that overlap launch inventory sales/purchase. */
export const LAUNCH_OVERLAP_KHATA_INTENTS = [
  "khata_purchase",
  "khata_cash_sale",
  "khata_credit_sale",
] as const;

const LAUNCH_CHANNELS = new Set([
  "orbix",
  "ai",
  "ask_mokxya",
  "accountant",
  "accountant_mode",
  "launch",
  "mokxya",
]);

export type LaunchMutationDenyInput = {
  intent?: string | null;
  launch_event_id?: string | null;
  channel?: string | null;
  source?: string | null;
  product_mutation_path?: string | null;
  confirm_token?: string | null;
};

export type LaunchMutationDenyResult = {
  deny: boolean;
  error_code: string | null;
  message: string | null;
  draft_mutations: 0;
  authority: typeof LAUNCH_MUTATION_ADR;
  product_mutation_path: typeof PRODUCT_MUTATION_PATH;
};

const SAFE_ALLOW: LaunchMutationDenyResult = {
  deny: false,
  error_code: null,
  message: null,
  draft_mutations: 0,
  authority: LAUNCH_MUTATION_ADR,
  product_mutation_path: PRODUCT_MUTATION_PATH,
};

function norm(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function evaluateNodeKhataLaunchDeny(
  input: LaunchMutationDenyInput,
): LaunchMutationDenyResult {
  const intent = norm(input.intent);
  if (
    !(LAUNCH_OVERLAP_KHATA_INTENTS as readonly string[]).includes(intent)
  ) {
    return SAFE_ALLOW;
  }

  const launchEvent = norm(input.launch_event_id);
  const channel = norm(input.channel) || norm(input.source);
  const productPath = String(input.product_mutation_path || "").trim();
  const token = String(input.confirm_token || "").trim();

  const launchMarked =
    (LAUNCH_EVENT_IDS as readonly string[]).includes(launchEvent) ||
    productPath === PRODUCT_MUTATION_PATH ||
    token.startsWith("orbix-confirm-") ||
    LAUNCH_CHANNELS.has(channel) ||
    channel.includes("orbix") ||
    channel.includes("launch");

  if (!launchMarked) {
    return SAFE_ALLOW;
  }

  return {
    deny: true,
    error_code: "LAUNCH_MUTATION_NODE_KHATA_DENIED",
    message:
      "Launch sales/purchase posts must use executeOrbixConfirm → Dexie " +
      "(ADR_0085). Node /khata/confirm is hard-denied for this launch marker.",
    draft_mutations: 0,
    authority: LAUNCH_MUTATION_ADR,
    product_mutation_path: PRODUCT_MUTATION_PATH,
  };
}
