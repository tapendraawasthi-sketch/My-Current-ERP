/**
 * Browser UI verification — e-Khata must call erp_bot and return distinct LLM replies.
 * Run: node scripts/verify-ekhata-browser.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.EKHATA_TEST_URL || "http://localhost:3001";
const TIMEOUT = 180_000;

async function clickNext(page) {
  await page.getByRole("button", { name: /Next/i }).click();
}

async function completeSignupIfNeeded(page) {
  const wizard = page.locator("text=Welcome to Sutra ERP");
  if (!(await wizard.isVisible({ timeout: 5_000 }).catch(() => false))) return;

  console.log("Completing first-run signup wizard ...");

  await page.getByPlaceholder("e.g. Sutra Traders Pvt. Ltd.").fill("E-Khata Test Co");
  await page.locator("select").first().selectOption("Sole Proprietorship");
  await page.getByPlaceholder("Street / Tole / Ward").fill("Thamel");
  await page.getByPlaceholder("e.g. Kathmandu").first().fill("Kathmandu");
  await page.getByPlaceholder("01-4XXXXXX or 98XXXXXXXX").fill("9800000000");
  await page.getByPlaceholder("info@company.com").fill("test@example.com");
  await clickNext(page);

  await page.getByPlaceholder("e.g. 123456789").fill("123456789");
  await page.locator("select").nth(0).selectOption("Bagmati");
  await page.locator("select").nth(1).selectOption("2083/84");
  await clickNext(page);

  await clickNext(page); // step 3 accounting defaults
  await page.locator('h2:has-text("Admin Account")').waitFor({ timeout: 15_000 });

  await page.getByPlaceholder("e.g. Tapendra Awasthi").fill("Test Admin");
  await page.getByPlaceholder("admin", { exact: true }).fill("admin");
  const pwdFields = page.locator('input[type="password"]');
  await pwdFields.nth(0).fill("admin123");
  await pwdFields.nth(1).fill("admin123");
  await page.getByRole("button", { name: /Finish & Launch/i }).click();

  await wizard.waitFor({ state: "hidden", timeout: 60_000 });
  console.log("Signup complete.");
}

async function loginIfNeeded(page) {
  const gateway = page.locator("text=Select a company to open");
  if (await gateway.isVisible({ timeout: 8_000 }).catch(() => false)) {
    console.log("Opening company from gateway ...");
    await page.getByRole("button", { name: /Open/i }).click();
  }

  const signInHeading = page.locator('h2:has-text("Sign In")');
  if (await signInHeading.isVisible({ timeout: 10_000 }).catch(() => false)) {
    console.log("Signing in as admin ...");
    await page.getByPlaceholder("e.g. admin").fill("admin");
    await page.getByPlaceholder("••••••••").fill("admin123");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await signInHeading.waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
  }
}

async function main() {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });
  const page = await browser.newPage();

  try {
    console.log(`Opening ${BASE} ...`);
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3_000);

    await completeSignupIfNeeded(page);
    await loginIfNeeded(page);

    const launcher = page.locator('[aria-label="Open e-Khata ledger chat"]');
    await launcher.waitFor({ state: "visible", timeout: 90_000 });
    await launcher.click();

    const panel = page.locator('[data-component="ekhata-panel"]');
    await panel.waitFor({ state: "visible", timeout: 10_000 });

    const subtitle = panel.locator("p.text-emerald-100");
    await page.waitForTimeout(2_000); // let /status check finish
    const subtitleText = (await subtitle.textContent())?.trim() ?? "";
    console.log("Header subtitle:", subtitleText);

    if (subtitleText.includes("Built-in CA Brain") && !subtitleText.includes("Live LLM")) {
      throw new Error(`Still showing built-in brain header: "${subtitleText}"`);
    }

    const input = page.locator('[data-component="ekhata-input"]');

    async function sendAndGetReply(text) {
      const before = await panel.locator(".flex.justify-start .rounded-md").count();
      await input.fill(text);
      await input.press("Enter");
      await page.waitForFunction(
        (prev) =>
          document.querySelectorAll('[data-component="ekhata-panel"] .flex.justify-start .rounded-md')
            .length > prev,
        before,
        { timeout: TIMEOUT },
      );
      const bubbles = panel.locator(".flex.justify-start .rounded-md");
      const reply = (await bubbles.last().textContent())?.trim() ?? "";
      console.log(`\nUser: ${text}`);
      console.log(`Bot:  ${reply.slice(0, 220)}${reply.length > 220 ? "…" : ""}`);
      return reply;
    }

    const r1 = await sendAndGetReply("hello");
    const r2 = await sendAndGetReply("k xa halkbr");

    if (r1 === r2) {
      throw new Error(`Identical replies:\n  1: ${r1}\n  2: ${r2}`);
    }
    const canned = "Subha prabhat! Bihanai ko energy ramro";
    if (r1.includes(canned) || r2.includes(canned)) {
      throw new Error("Got canned morning greeting template instead of LLM reply");
    }

    console.log("\n✅ Browser UI test PASSED — two distinct non-canned LLM replies.");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("\n❌ Browser UI test FAILED:", e.message || e);
  process.exit(1);
});
