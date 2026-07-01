import { useStore } from "@/store/useStore";

export function formatMoney(value: number): string {
  const symbol = useStore.getState().companySettings?.currencySymbol || "Rs.";
  return `${symbol} ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
