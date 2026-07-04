const MERCHANT_ID = import.meta.env.VITE_ESEWA_MERCHANT_ID ?? "";
const KHALTI_KEY = import.meta.env.VITE_KHALTI_PUBLIC_KEY ?? "";

export function buildEsewaLink(amount: number, note: string): string {
  const params = new URLSearchParams({
    amt: String(amount),
    txAmt: String(amount),
    psc: "0",
    tAmt: String(amount),
    pid: note.slice(0, 40),
    scd: MERCHANT_ID,
  });
  return `esewa://pay?${params.toString()}`;
}

export function buildKhaltiLink(amount: number, note: string): string {
  const params = new URLSearchParams({
    amount: String(amount),
    purchase_order_name: note.slice(0, 40),
    public_key: KHALTI_KEY,
  });
  return `khalti://pay?${params.toString()}`;
}
