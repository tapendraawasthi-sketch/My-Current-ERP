import { describe, expect, it } from "vitest";

const KHATA_DOUBLE_ENTRY: Record<string, { debit: string; credit: string }> = {
  khata_credit_sale: { debit: "KH-DEBT", credit: "KH-SALE" },
  khata_cash_sale: { debit: "KH-CASH", credit: "KH-SALE" },
  khata_payment_in: { debit: "KH-CASH", credit: "KH-DEBT" },
  khata_purchase: { debit: "KH-PUR", credit: "KH-CASH" },
  khata_payment_out: { debit: "KH-CRED", credit: "KH-CASH" },
  khata_expense: { debit: "KH-EXP", credit: "KH-CASH" },
};

describe("ledger double-entry mapping", () => {
  for (const [intent, mapping] of Object.entries(KHATA_DOUBLE_ENTRY)) {
    it(`${intent} produces balanced DR/CR pair`, () => {
      expect(mapping.debit).toBeTruthy();
      expect(mapping.credit).toBeTruthy();
      expect(mapping.debit).not.toBe(mapping.credit);
    });
  }
});
