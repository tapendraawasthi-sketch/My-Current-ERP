import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import path from "path";

const BASE = process.env.PREVIEW_URL || "http://localhost:3000";
const OUT_DIR = path.resolve("preview-screenshots");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  // Gateway / login — pick first company if shown
  const companyBtn = page.locator("button, [role='button']").filter({ hasText: /company|open|select/i }).first();
  if (await companyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await companyBtn.click();
    await page.waitForTimeout(1000);
  }

  const userInput = page.locator('input[name="username"], input[placeholder*="sername" i], input[type="text"]').first();
  const passInput = page.locator('input[name="password"], input[type="password"]').first();

  if (await userInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await userInput.fill("admin");
    await passInput.fill("admin123");
    const submit = page.locator('button[type="submit"], button').filter({ hasText: /sign in|login|submit/i }).first();
    await submit.click();
    await page.waitForTimeout(4000);
  }

  await page.screenshot({ path: path.join(OUT_DIR, "01-dashboard.png"), fullPage: false });

  // Open e-Khata via launcher or shortcut
  const launcher = page.locator('[aria-label="Open e-Khata ledger chat"]');
  if (await launcher.isVisible({ timeout: 8000 }).catch(() => false)) {
    await launcher.click();
  } else {
    await page.keyboard.press("Control+Shift+K");
  }
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(OUT_DIR, "02-ekhata-panel.png"), fullPage: false });

  // Type a sample message
  const chatInput = page.locator('[data-component="ekhata-input"]');
  if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await chatInput.fill("Ram lai 500 udhaar diye");
    await page.screenshot({ path: path.join(OUT_DIR, "03-ekhata-typing.png"), fullPage: false });
    await chatInput.press("Enter");
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(OUT_DIR, "04-ekhata-response.png"), fullPage: false });
  }

  console.log(`Screenshots saved to ${OUT_DIR}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
