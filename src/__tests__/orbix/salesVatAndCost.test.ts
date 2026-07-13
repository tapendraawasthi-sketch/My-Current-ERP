import { describe, expect, it } from "vitest";
import { computeSalesVat } from "@/domains/sales/salesVatEngine";
import {
  allocateSalesLineCost,
  computeMovingWeightedAverageUnitCost,
} from "@/domains/sales/costAllocation";

describe("salesVatEngine", () => {
  it("computes exclusive VAT deterministically", () => {
    const result = computeSalesVat({
      transactionDate: "2026-07-12",
      priceMode: "exclusive",
      invoiceDiscount: "0",
      vatRegistered: true,
      items: [
        {
          itemId: "item-1",
          quantity: "2",
          rate: "1000.00",
          isTaxable: true,
          vatRate: 13,
        },
      ],
    });
    expect(result.taxable_amount).toBe("2000.00");
    expect(result.vat_amount).toBe("260.00");
    expect(result.grand_total).toBe("2260.00");
    expect(result.rule_version).toBeTruthy();
  });

  it("derives base from inclusive price", () => {
    const result = computeSalesVat({
      transactionDate: "2026-07-12",
      priceMode: "inclusive",
      invoiceDiscount: "0",
      vatRegistered: true,
      items: [
        {
          itemId: "item-1",
          quantity: "1",
          rate: "1130.00",
          isTaxable: true,
          vatRate: 13,
        },
      ],
    });
    expect(result.taxable_amount).toBe("1000.00");
    expect(result.vat_amount).toBe("130.00");
    expect(result.grand_total).toBe("1130.00");
  });

  it("treats exempt lines without VAT", () => {
    const result = computeSalesVat({
      transactionDate: "2026-07-12",
      priceMode: "exclusive",
      vatRegistered: true,
      items: [
        {
          itemId: "item-e",
          quantity: "1",
          rate: "500.00",
          isTaxable: false,
          vatRate: 13,
        },
      ],
    });
    expect(result.vat_amount).toBe("0.00");
    expect(result.exempt_amount).toBe("500.00");
    expect(result.grand_total).toBe("500.00");
  });
});

describe("costAllocation MWA", () => {
  it("uses moving weighted average from stock movements", async () => {
    const movements = [
      {
        itemId: "item-1",
        warehouseId: "wh-main",
        date: "2026-01-01",
        type: "opening",
        qty: 10,
        rate: 100,
        amount: 1000,
      },
      {
        itemId: "item-1",
        warehouseId: "wh-main",
        date: "2026-01-02",
        type: "purchase-invoice",
        qty: 10,
        rate: 200,
        amount: 2000,
      },
    ];
    const db = {
      stockMovements: {
        where: () => ({
          equals: () => ({
            toArray: async () => movements,
          }),
        }),
      },
    } as any;

    const item = { id: "item-1", costPrice: 999 } as any;
    const { unitCost } = await computeMovingWeightedAverageUnitCost(
      db,
      "item-1",
      "wh-main",
      "2026-07-12",
      item,
    );
    expect(unitCost).toBe(150);

    const alloc = await allocateSalesLineCost({
      db,
      salesLineId: "line-1",
      item,
      warehouseId: "wh-main",
      quantity: 5,
      valuationMethod: "moving_weighted_average",
      postingId: "post-1",
      invoiceId: "inv-1",
      companyId: "co-1",
      transactionDate: "2026-07-12",
      nowIso: new Date().toISOString(),
    });

    expect(alloc.unit_cost).toBe("150.00");
    expect(alloc.total_cost).toBe("750.00");
    expect(alloc.valuation_method).toBe("moving_weighted_average");
  });
});
