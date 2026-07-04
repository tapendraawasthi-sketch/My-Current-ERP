export const FREE_TIER_MONTHLY_LIMIT = 500;
export const VAT_THRESHOLD_NPR = 5_000_000;
export const VAT_TRIGGER_RATIO = 0.8;

const PHONE_KEY = "khata_phone_id";
const TIER_KEY = "khata_tier";
const TX_COUNTER_KEY = "khata_tx_counter";
const UPGRADE_DISMISSED_KEY = "khata_upgrade_dismissed_session";
const VAT_DISMISSED_KEY = "khata_vat_dismissed_at";

export type KhataTier = "free" | "premium";

export function getPhoneId(): string | null {
  return localStorage.getItem(PHONE_KEY);
}

export function setPhoneId(phone: string): void {
  localStorage.setItem(PHONE_KEY, phone);
}

export function hasCompletedOnboarding(): boolean {
  return Boolean(getPhoneId());
}

export function getTier(): KhataTier {
  return localStorage.getItem(TIER_KEY) === "premium" ? "premium" : "free";
}

export function setTier(tier: KhataTier): void {
  localStorage.setItem(TIER_KEY, tier);
}

export function isPremium(): boolean {
  return getTier() === "premium";
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

export function incrementTransactionCount(): number {
  const raw = localStorage.getItem(TX_COUNTER_KEY);
  const parsed = raw ? JSON.parse(raw) : { month: currentMonthKey(), count: 0 };
  if (parsed.month !== currentMonthKey()) {
    parsed.month = currentMonthKey();
    parsed.count = 0;
  }
  parsed.count += 1;
  localStorage.setItem(TX_COUNTER_KEY, JSON.stringify(parsed));
  return parsed.count;
}

export function getMonthlyTransactionCount(): number {
  const raw = localStorage.getItem(TX_COUNTER_KEY);
  if (!raw) return 0;
  const parsed = JSON.parse(raw) as { month: string; count: number };
  return parsed.month === currentMonthKey() ? parsed.count : 0;
}

export function isFreeTierLimitReached(): boolean {
  if (isPremium()) return false;
  return getMonthlyTransactionCount() >= FREE_TIER_MONTHLY_LIMIT;
}

export function canViewExtendedHistory(): boolean {
  return isPremium();
}

export function canExport(): boolean {
  return isPremium();
}

export function canViewPartySummary(): boolean {
  return isPremium();
}

export function canUseMultiStaff(): boolean {
  return isPremium();
}

export function markUpgradeDismissedThisSession(): void {
  sessionStorage.setItem(UPGRADE_DISMISSED_KEY, "1");
}

export function wasUpgradeDismissedThisSession(): boolean {
  return sessionStorage.getItem(UPGRADE_DISMISSED_KEY) === "1";
}

export function dismissVatMessageFor30Days(): void {
  localStorage.setItem(VAT_DISMISSED_KEY, new Date().toISOString());
}

export function isVatMessageSuppressed(): boolean {
  const raw = localStorage.getItem(VAT_DISMISSED_KEY);
  if (!raw) return false;
  const dismissedAt = new Date(raw).getTime();
  return Date.now() - dismissedAt < 30 * 24 * 60 * 60 * 1000;
}
