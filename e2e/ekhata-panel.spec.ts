import { test, expect } from "@playwright/test";
import { getKhataVouchers, getPartyByName } from "./helpers/indexedDb";

async function openHarness(page: import("@playwright/test").Page) {
  await page.goto("/e2e/ekhata.html");
  const ready = page.getByTestId("ekhata-harness-ready");
  const loading = page.getByTestId("ekhata-harness-loading");
  const error = page.getByTestId("ekhata-harness-error");

  await Promise.race([
    ready.waitFor({ state: "visible", timeout: 45_000 }),
    error.waitFor({ state: "visible", timeout: 45_000 }).then(async () => {
      const msg = await error.textContent();
      throw new Error(`Harness bootstrap failed: ${msg ?? "unknown"}`);
    }),
  ]);

  await expect(loading).toHaveCount(0);
  await expect(page.locator('[data-component="ekhata-panel"]')).toBeVisible();
}

async function sendEkhataMessage(page: import("@playwright/test").Page, text: string) {
  const input = page.locator('[data-component="ekhata-input"]');
  await input.fill(text);
  await page.locator('[aria-label="Send message"]').click();
}

async function waitForConfirmCard(page: import("@playwright/test").Page) {
  await expect(page.getByText(/Confirm CA Journal Entry/i)).toBeVisible({ timeout: 20_000 });
}

test.describe("e-Khata panel", () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test("credit sale shows balanced confirm card", async ({ page }) => {
    await sendEkhataMessage(page, "Ram lai 500 udhaar diye");
    await waitForConfirmCard(page);
    await expect(page.getByText("NPR 500")).toBeVisible();
    await expect(page.getByText("Journal Balanced")).toBeVisible();
  });

  test("cash sale confirm and cancel", async ({ page }) => {
    await sendEkhataMessage(page, "aaja 200 ko nagad bikri vayo");
    await waitForConfirmCard(page);
    await page.getByRole("button", { name: "Cancel ✗" }).click();
    await expect(page.getByText("Confirm CA Journal Entry")).toHaveCount(0);
  });

  test("accounting question stays in chat", async ({ page }) => {
    await sendEkhataMessage(page, "sampatti k ho");
    await expect(page.getByText("Confirm CA Journal Entry")).toHaveCount(0);
    await expect(page.locator('[data-component="ekhata-panel"]')).toContainText(/asset|sampatti/i);
  });

  test("payment received entry", async ({ page }) => {
    await sendEkhataMessage(page, "Shyam le 2000 tiryo");
    await waitForConfirmCard(page);
    await expect(page.getByText("NPR 2,000")).toBeVisible();
  });

  test("confirm posts balanced voucher to Dexie", async ({ page }) => {
    const before = await getKhataVouchers(page);

    await sendEkhataMessage(page, "Ram lai 500 udhaar diye");
    await waitForConfirmCard(page);
    await page.getByRole("button", { name: "Confirm ✓" }).click();

    await expect(page.getByText(/Safalta! Entry save bhayo/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/KH-\d+/)).toBeVisible();
    await expect(page.getByText("Confirm CA Journal Entry")).toHaveCount(0);

    await expect
      .poll(async () => (await getKhataVouchers(page)).length, { timeout: 10_000 })
      .toBe(before.length + 1);

    const vouchers = await getKhataVouchers(page);
    const posted = vouchers[vouchers.length - 1];
    expect(posted.type).toBe("khata_credit_sale");
    expect(posted.status).toBe("posted");
    expect(posted.grandTotal).toBe(500);
    expect(posted.totalDebit).toBe(500);
    expect(posted.totalCredit).toBe(500);
    expect(posted.voucherNo).toMatch(/^KH-\d+$/);

    const party = await getPartyByName(page, "Ram");
    expect(party?.name).toBe("Ram");
  });

  test("cash sale confirm writes voucher with correct amount", async ({ page }) => {
    await sendEkhataMessage(page, "aaja 200 ko nagad bikri vayo");
    await waitForConfirmCard(page);
    await page.getByRole("button", { name: "Confirm ✓" }).click();
    await expect(page.getByText(/Safalta! Entry save bhayo/i)).toBeVisible({ timeout: 20_000 });

    const vouchers = await getKhataVouchers(page);
    const posted = vouchers.find((v) => v.type === "khata_cash_sale" && v.grandTotal === 200);
    expect(posted).toBeTruthy();
    expect(posted?.totalDebit).toBe(200);
    expect(posted?.totalCredit).toBe(200);
  });

  test("payment received confirm posts khata_payment_in to Dexie", async ({ page }) => {
    const before = await getKhataVouchers(page);

    await sendEkhataMessage(page, "Shyam le 2000 tiryo");
    await waitForConfirmCard(page);
    await expect(page.getByText("NPR 2,000")).toBeVisible();
    await page.getByRole("button", { name: "Confirm ✓" }).click();

    await expect(page.getByText(/Safalta! Entry save bhayo/i)).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () => (await getKhataVouchers(page)).length, { timeout: 10_000 })
      .toBe(before.length + 1);

    const vouchers = await getKhataVouchers(page);
    const posted = vouchers.find((v) => v.type === "khata_payment_in" && v.grandTotal === 2000);
    expect(posted).toBeTruthy();
    expect(posted?.status).toBe("posted");
    expect(posted?.totalDebit).toBe(2000);
    expect(posted?.totalCredit).toBe(2000);
    expect(posted?.voucherNo).toMatch(/^KH-\d+$/);

    const party = await getPartyByName(page, "Shyam");
    expect(party?.name).toBe("Shyam");
  });

  test("payment made confirm posts khata_payment_out to Dexie", async ({ page }) => {
    const before = await getKhataVouchers(page);

    await sendEkhataMessage(page, "Hari lai 1500 payment gareko");
    await waitForConfirmCard(page);
    await expect(page.getByText("NPR 1,500")).toBeVisible();
    await page.getByRole("button", { name: "Confirm ✓" }).click();

    await expect(page.getByText(/Safalta! Entry save bhayo/i)).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () => (await getKhataVouchers(page)).length, { timeout: 10_000 })
      .toBe(before.length + 1);

    const vouchers = await getKhataVouchers(page);
    const posted = vouchers.find((v) => v.type === "khata_payment_out" && v.grandTotal === 1500);
    expect(posted).toBeTruthy();
    expect(posted?.status).toBe("posted");
    expect(posted?.totalDebit).toBe(1500);
    expect(posted?.totalCredit).toBe(1500);

    const party = await getPartyByName(page, "Hari");
    expect(party?.name).toBe("Hari");
  });

  test("expense confirm posts khata_expense to Dexie", async ({ page }) => {
    const before = await getKhataVouchers(page);

    await sendEkhataMessage(page, "electricity kharcha 3500");
    await waitForConfirmCard(page);
    await expect(page.getByText("NPR 3,500")).toBeVisible();
    await page.getByRole("button", { name: "Confirm ✓" }).click();

    await expect(page.getByText(/Safalta! Entry save bhayo/i)).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () => (await getKhataVouchers(page)).length, { timeout: 10_000 })
      .toBe(before.length + 1);

    const vouchers = await getKhataVouchers(page);
    const posted = vouchers.find((v) => v.type === "khata_expense" && v.grandTotal === 3500);
    expect(posted).toBeTruthy();
    expect(posted?.status).toBe("posted");
    expect(posted?.totalDebit).toBe(3500);
    expect(posted?.totalCredit).toBe(3500);
  });

  test("cash purchase confirm posts khata_purchase to Dexie", async ({ page }) => {
    const before = await getKhataVouchers(page);

    await sendEkhataMessage(page, "kharid 4500 cash ma");
    await waitForConfirmCard(page);
    await expect(page.getByText("NPR 4,500")).toBeVisible();
    await page.getByRole("button", { name: "Confirm ✓" }).click();

    await expect(page.getByText(/Safalta! Entry save bhayo/i)).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () => (await getKhataVouchers(page)).length, { timeout: 10_000 })
      .toBe(before.length + 1);

    const vouchers = await getKhataVouchers(page);
    const posted = vouchers.find((v) => v.type === "khata_purchase" && v.grandTotal === 4500);
    expect(posted).toBeTruthy();
    expect(posted?.status).toBe("posted");
    expect(posted?.totalDebit).toBe(4500);
    expect(posted?.totalCredit).toBe(4500);
  });

  test("credit purchase confirm posts khata_credit_purchase to Dexie", async ({ page }) => {
    const before = await getKhataVouchers(page);

    await sendEkhataMessage(page, "Gita bata 6000 udhaar ma saman kineko");
    await waitForConfirmCard(page);
    await expect(page.getByText("NPR 6,000")).toBeVisible();
    await page.getByRole("button", { name: "Confirm ✓" }).click();

    await expect(page.getByText(/Safalta! Entry save bhayo/i)).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () => (await getKhataVouchers(page)).length, { timeout: 10_000 })
      .toBe(before.length + 1);

    const vouchers = await getKhataVouchers(page);
    const posted = vouchers.find(
      (v) => v.type === "khata_credit_purchase" && v.grandTotal === 6000,
    );
    expect(posted).toBeTruthy();
    expect(posted?.status).toBe("posted");
    expect(posted?.totalDebit).toBe(6000);
    expect(posted?.totalCredit).toBe(6000);

    const party = await getPartyByName(page, "Gita");
    expect(party?.name).toBe("Gita");
  });

  test("compound batch confirm posts two vouchers to Dexie", async ({ page }) => {
    const before = await getKhataVouchers(page);

    await sendEkhataMessage(page, "aaja 8500 ko nagad bikri vayo, electricity kharcha 8000");
    await waitForConfirmCard(page);
    await expect(page.getByText(/2 transactions/i)).toBeVisible();
    await expect(page.getByText("NPR 16,500")).toBeVisible();
    await page.getByRole("button", { name: "Confirm All ✓" }).click();

    await expect(page.getByText(/Safalta! 2 entries save bhayo/i)).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () => (await getKhataVouchers(page)).length, { timeout: 10_000 })
      .toBe(before.length + 2);

    const vouchers = await getKhataVouchers(page);
    const cashSale = vouchers.find((v) => v.type === "khata_cash_sale" && v.grandTotal === 8500);
    const expense = vouchers.find((v) => v.type === "khata_expense" && v.grandTotal === 8000);
    expect(cashSale?.status).toBe("posted");
    expect(expense?.status).toBe("posted");
    expect(cashSale?.totalDebit).toBe(8500);
    expect(expense?.totalDebit).toBe(8000);
  });
});
