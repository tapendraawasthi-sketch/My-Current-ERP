/**
 * Authoritative money helpers — store amounts as integer paisa (1 NPR = 100 paisa).
 * Avoids IEEE-754 drift for command validation and reconciliation.
 */

export type Paisa = number;

export function parseMoneyToPaisa(value: string | number | null | undefined): Paisa {
  if (value === null || value === undefined || value === "") {
    throw new Error("Amount is required");
  }
  const raw = typeof value === "number" ? value.toFixed(2) : String(value).replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw) && !/^-?\d+\.\d+$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${value}`);
    return Math.round(n * 100);
  }
  const [whole, frac = ""] = raw.split(".");
  const frac2 = (frac + "00").slice(0, 2);
  const sign = whole.startsWith("-") ? -1 : 1;
  const absWhole = whole.replace("-", "");
  return sign * (Number(absWhole) * 100 + Number(frac2));
}

export function paisaToNumber(paisa: Paisa): number {
  return Math.round(paisa) / 100;
}

export function paisaToString(paisa: Paisa): string {
  return paisaToNumber(paisa).toFixed(2);
}

export function assertQtyRateTotal(
  qty: string | number,
  rate: string | number,
  amount: string | number,
): void {
  const q = parseMoneyToPaisa(qty);
  // quantity may be whole units — treat as paisa of "units * 100" only if decimal qty;
  // for integer qty use Number
  const qtyNum = typeof qty === "number" ? qty : Number(String(qty).replace(/,/g, ""));
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
    throw new Error("Quantity must be greater than zero");
  }
  const rateP = parseMoneyToPaisa(rate);
  const amtP = parseMoneyToPaisa(amount);
  const expected = Math.round(qtyNum * rateP);
  if (Math.abs(expected - amtP) > 1) {
    throw new Error(
      `Quantity × rate (${paisaToString(expected)}) does not match amount (${paisaToString(amtP)})`,
    );
  }
}
