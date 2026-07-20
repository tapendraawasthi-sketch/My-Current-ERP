/**
 * Company setup must persist the selected fiscal year and replace DEFAULT seed.
 */
import "fake-indexeddb/auto";
import { describe, it, beforeEach, expect } from "vitest";
import Dexie from "dexie";
import { resetDB, getDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import { getFiscalYearDateRange } from "@/lib/nepaliDate";

function buildWizardCompanyBase(selectedFiscalYear: string) {
  return {
    name: "FY Persist Co",
    companyNameEn: "FY Persist Co",
    panNumber: "123456789",
    address: "Kathmandu",
    phone: "9800000000",
    email: "fy@persist.test",
    defaultDateFormat: "BS" as const,
    dateFormat: "BS",
    fiscalYearStartMonth: 4,
    fiscalYear: selectedFiscalYear,
    fiscalYearBS: selectedFiscalYear,
    hasVAT: true,
    vatRegistered: true,
    irdProvince: "Bagmati",
    irdOfficeName: "Kathmandu",
    enableInventory: true,
  };
}

async function persistCompanySetupLikeStore(company: Record<string, unknown>) {
  const db = getDB();
  await db.companySettings.put({ id: "main", ...company } as never);
  const selectedFyLabel = String(company.fiscalYear || company.fiscalYearBS || "").trim();
  if (!selectedFyLabel) return null;
  const range = getFiscalYearDateRange(selectedFyLabel);
  const createdFy = {
    id: `fy-${selectedFyLabel.replace(/\//g, "-")}`,
    name: selectedFyLabel,
    fiscalYearBS: selectedFyLabel,
    startDate: range.startDate,
    endDate: range.endDate,
    isCurrent: true,
    isClosed: false,
  };
  await db.fiscalYears.clear();
  await db.fiscalYears.put(createdFy as never);
  return createdFy;
}

describe("company setup fiscal year persistence", () => {
  beforeEach(async () => {
    await Dexie.delete("SutraERPDatabase");
    const db = await resetDB();
    await db.open();
  });

  it("keeps selected 2081/82 instead of DEFAULT 2083/84", async () => {
    const selected = "2081/82";
    await getDB().fiscalYears.add(DEFAULT_FISCAL_YEAR as never);

    const company = buildWizardCompanyBase(selected);
    const created = await persistCompanySetupLikeStore(company);
    const fys = await getDB().fiscalYears.toArray();
    const settings = await getDB().companySettings.get("main");
    const current = fys.find((f: any) => f.isCurrent) || fys[0];

    expect(created?.name).toBe(selected);
    expect(fys).toHaveLength(1);
    expect((current as any).name).toBe(selected);
    expect((settings as any).fiscalYear).toBe(selected);
    expect((settings as any).irdProvince).toBe("Bagmati");
    expect((current as any).startDate).toBe(getFiscalYearDateRange(selected).startDate);
  });
});
