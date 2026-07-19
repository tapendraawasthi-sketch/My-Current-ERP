import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import Dexie from "dexie";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resetDB, getDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import { computeInvoiceVAT } from "@/lib/taxUtils";
import { computeSalesVat } from "@/domains/sales/salesVatEngine";
import {
  postSalesTransaction,
  seedOrbixSalesE2ECompany,
  E2E_SALES_COMPANY_ID,
  E2E_SALES_ITEM_ID,
  E2E_SALES_USER_AUTHORIZED,
} from "@/domains/sales";
import {
  postPurchaseTransaction,
  seedOrbixE2ECompany,
  E2E_COMPANY_ID,
  E2E_ITEM_ID,
  E2E_USER_AUTHORIZED,
} from "@/domains/purchase";
import {
  INVOICE_FORM_TOTALS_DISCLAIMER,
  ORBIX_CONFIRM_PREVIEW_HEADING,
  ORBIX_CONFIRM_PREVIEW_HINT,
} from "@/platform/calc/calcAuthorityPolicy";
import {
  CALC_PREVIEW_RESIDUAL_ADR,
  GAP_P2_002_CLOSED,
  KNOWN_PAISA_DRIFT_ON_LAUNCH_FIXTURES,
  PRODUCTION_APPROVED,
  calcPreviewResidualSnapshot,
  paisaDrift,
} from "@/platform/calc/calcPreviewResidualPolicy";

const ROOT = join(__dirname, "../../..");

async function prepareSalesDb() {
  await Dexie.delete("SutraERPDatabase");
  const db = await resetDB();
  await db.open();
  await db.fiscalYears.put({
    ...DEFAULT_FISCAL_YEAR,
    id: DEFAULT_FISCAL_YEAR.id || "fy-default",
    isCurrent: true,
  } as any);
  await seedOrbixSalesE2ECompany();
  await db.fiscalYears.put({
    id: "fy-e2e-sales-aligned",
    name: "E2E sales aligned",
    startDate: DEFAULT_FISCAL_YEAR.startDate,
    endDate: DEFAULT_FISCAL_YEAR.endDate,
    status: "open",
    isCurrent: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
  } as any);
  return getDB();
}

async function preparePurchaseDb() {
  await Dexie.delete("SutraERPDatabase");
  const db = await resetDB();
  await db.open();
  await db.fiscalYears.put({
    ...DEFAULT_FISCAL_YEAR,
    id: DEFAULT_FISCAL_YEAR.id || "fy-default",
    isCurrent: true,
  } as any);
  await seedOrbixE2ECompany();
  await db.fiscalYears.put({
    id: "fy-e2e-aligned",
    name: "E2E aligned",
    startDate: DEFAULT_FISCAL_YEAR.startDate,
    endDate: DEFAULT_FISCAL_YEAR.endDate,
    status: "open",
    isCurrent: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
  } as any);
  return getDB();
}

describe("PR-B4 calc preview residual", () => {
  it("declares residual honesty and REDUCED gap", () => {
    const snap = calcPreviewResidualSnapshot();
    expect(snap.authority).toBe(CALC_PREVIEW_RESIDUAL_ADR);
    expect(snap.authority).toBe("ADR_0087");
    expect(snap.step).toBe("PR-B4");
    expect(snap.calcAuthorityOnConfirm).toBe("DEXIE_DOMAIN_ENGINE");
    expect(snap.uiCalculatesAuthoritativeTotals).toBe(false);
    expect(snap.gapP2002RegisterStatus).toBe("REDUCED");
    expect(snap.gapP2002Closed).toBe(false);
    expect(GAP_P2_002_CLOSED).toBe(false);
    expect(snap.knownPaisaDriftOnLaunchFixtures).toBe(false);
    expect(KNOWN_PAISA_DRIFT_ON_LAUNCH_FIXTURES).toBe(false);
    expect(snap.productionApproved).toBe(false);
    expect(PRODUCTION_APPROVED).toBe(false);
  });

  it("wires form and Orbix card to policy label constants", () => {
    const form = readFileSync(
      join(ROOT, "src/components/invoice/SalesInvoiceForm.tsx"),
      "utf8",
    );
    expect(form).toContain("INVOICE_FORM_TOTALS_DISCLAIMER");
    expect(form).not.toContain("Authoritative total");
    expect(INVOICE_FORM_TOTALS_DISCLAIMER.toLowerCase()).toContain("display estimate");

    const card = readFileSync(
      join(ROOT, "src/components/ekhata/OrbixJournalCard.tsx"),
      "utf8",
    );
    expect(card).toContain("ORBIX_CONFIRM_PREVIEW_HEADING");
    expect(card).toContain("ORBIX_CONFIRM_PREVIEW_HINT");
    expect(ORBIX_CONFIRM_PREVIEW_HEADING).toBe("Confirm preview");
    expect(ORBIX_CONFIRM_PREVIEW_HINT.toLowerCase()).toContain("domain engine");
    expect(card).not.toContain("Authoritative preview");
  });

  describe("paisa spot-check fixtures", () => {
    it("LAUNCH_SALE_CASH_UNTAXED: display vs posted drift 0", { timeout: 30000 }, async () => {
      const db = await prepareSalesDb();
      const displayGrand = computeInvoiceVAT(
        [{ qty: 1, rate: 60000, isTaxable: false }],
        13,
      ).grandTotal;
      expect(displayGrand).toBe(60000);

      const result = await postSalesTransaction({
        commandId: "prb4-sale-1",
        requestId: "prb4-sale-req-1",
        draftId: "prb4-draft-sale-1",
        draftVersion: 2,
        previewVersion: 2,
        previewHash: "prb4-sale-hash",
        idempotencyKey: "prb4-sale-idem",
        companyId: E2E_SALES_COMPANY_ID,
        userId: E2E_SALES_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "orbix",
        sale: {
          transactionDate: "2026-07-12",
          paymentMethod: "cash",
          paymentAccountId: "acc-cash",
          warehouseId: "wh-main",
          items: [
            {
              itemId: E2E_SALES_ITEM_ID,
              quantity: "1",
              unit: "pcs",
              rate: "60000.00",
              lineAmount: "60000.00",
            },
          ],
          subtotal: "60000.00",
          grandTotal: "60000.00",
          currency: "NPR",
          narration: "PR-B4 sale fixture",
        },
      });
      expect(result.type).toBe("posting_completed");
      if (result.type !== "posting_completed") return;
      const invoice = await db.invoices.get(result.payload.invoice_id);
      const posted = Number(invoice?.grandTotal);
      expect(paisaDrift(displayGrand, posted)).toBe(0);
    });

    it("LAUNCH_PURCHASE_CASH: display vs posted drift 0", { timeout: 30000 }, async () => {
      const db = await preparePurchaseDb();
      const displayGrand = 1 * 50000;
      const result = await postPurchaseTransaction({
        commandId: "prb4-pur-1",
        requestId: "prb4-pur-req-1",
        draftId: "prb4-draft-pur-1",
        draftVersion: 2,
        previewVersion: 2,
        previewHash: "prb4-pur-hash",
        idempotencyKey: "prb4-pur-idem",
        companyId: E2E_COMPANY_ID,
        userId: E2E_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "orbix",
        purchase: {
          transactionDate: "2026-07-12",
          paymentMethod: "cash",
          paymentAccountId: "acc-cash",
          items: [
            {
              itemId: E2E_ITEM_ID,
              quantity: "1",
              unit: "pcs",
              rate: "50000.00",
              amount: "50000.00",
            },
          ],
          subtotal: "50000.00",
          grandTotal: "50000.00",
          currency: "NPR",
          narration: "PR-B4 purchase fixture",
        },
      });
      expect(result.type).toBe("posting_completed");
      if (result.type !== "posting_completed") return;
      const invoice = await db.invoices.get(result.payload.invoice_id);
      const posted = Number(invoice?.grandTotal);
      expect(paisaDrift(displayGrand, posted)).toBe(0);
    });

    it("LAUNCH_SALE_VAT_EXCLUSIVE: UI estimate vs engine vs posted drift 0", { timeout: 30000 }, async () => {
      const db = await prepareSalesDb();
      await db.companySettings.update("main", {
        vatNumber: "605012345",
        vatRegistered: true,
      } as any);
      await db.items.update(E2E_SALES_ITEM_ID, {
        isTaxable: true,
        vatRate: 13,
      } as any);

      const displayGrand = computeInvoiceVAT(
        [{ qty: 2, rate: 1000, isTaxable: true, vatRate: 13 }],
        13,
      ).grandTotal;
      const engine = computeSalesVat({
        transactionDate: "2026-07-12",
        priceMode: "exclusive",
        invoiceDiscount: "0",
        vatRegistered: true,
        items: [
          {
            itemId: E2E_SALES_ITEM_ID,
            quantity: "2",
            rate: "1000.00",
            isTaxable: true,
            vatRate: 13,
          },
        ],
      });
      expect(displayGrand).toBe(2260);
      expect(Number(engine.grand_total)).toBe(2260);
      expect(paisaDrift(displayGrand, Number(engine.grand_total))).toBe(0);

      const result = await postSalesTransaction({
        commandId: "prb4-vat-1",
        requestId: "prb4-vat-req-1",
        draftId: "prb4-draft-vat-1",
        draftVersion: 2,
        previewVersion: 2,
        previewHash: "prb4-vat-hash",
        idempotencyKey: "prb4-vat-idem",
        companyId: E2E_SALES_COMPANY_ID,
        userId: E2E_SALES_USER_AUTHORIZED,
        userRole: "accountant",
        orbixMode: "accountant",
        source: "orbix",
        sale: {
          transactionDate: "2026-07-12",
          paymentMethod: "cash",
          paymentAccountId: "acc-cash",
          warehouseId: "wh-main",
          taxAmount: "260.00",
          items: [
            {
              itemId: E2E_SALES_ITEM_ID,
              quantity: "2",
              unit: "pcs",
              rate: "1000.00",
              lineAmount: "2000.00",
            },
          ],
          subtotal: "2000.00",
          grandTotal: "2260.00",
          currency: "NPR",
          narration: "PR-B4 VAT exclusive fixture",
        },
      });
      expect(result.type).toBe("posting_completed");
      if (result.type !== "posting_completed") return;
      const invoice = await db.invoices.get(result.payload.invoice_id);
      const posted = Number(invoice?.grandTotal);
      expect(paisaDrift(displayGrand, posted)).toBe(0);
      expect(paisaDrift(Number(engine.grand_total), posted)).toBe(0);
    });
  });
});
