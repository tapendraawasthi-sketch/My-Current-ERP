/**
 * Verify built-in e-Khata brain works with NO LLM env vars set.
 * Run: npx tsx scripts/verify-builtin-brain.ts
 */
import { SELF_CONTAINED_STATUS } from "../src/lib/selfContainedAi";
import { processEKhataMessageAsync } from "../src/lib/ekhata/processMessage";

async function main() {
  console.log("=== Built-in brain verification (no VITE_ERP_BOT_URL) ===\n");

  // import.meta.env only exists under Vite; in Node/tsx we treat unset URL as self-contained
  const erpBotUrl = (globalThis as { import_meta_env?: Record<string, string> }).import_meta_env?.VITE_ERP_BOT_URL;
  const selfContained = !erpBotUrl?.trim();
  console.log("self-contained mode (no erp_bot URL):", selfContained);
  console.log("label:", SELF_CONTAINED_STATUS.label);

  const cases: Array<{ q: string; expect: string }> = [
    { q: "what is sampati", expect: "accounting-brain or framework-brain" },
    { q: "Ram le 1500 diyo", expect: "entry khata_payment_in" },
    { q: "i sold 200 cups today for Rs. 50 each", expect: "entry amount 10000" },
    { q: "faithful representation k ho", expect: "framework-brain" },
    { q: "namaste", expect: "chat brain" },
  ];

  let passed = 0;
  let failed = 0;

  for (const { q, expect } of cases) {
    const r = await processEKhataMessageAsync(q, { preferLlm: false, llmOnline: false });
    let ok = true;
    let detail = "";

    if (q.includes("sampati") && r.kind !== "chat") {
      ok = false;
      detail = "expected chat";
    }
    if (q.includes("sampati") && r.reply.toLowerCase().includes("jatayu")) {
      ok = false;
      detail = "Wikipedia hijack";
    }
    if (q.includes("Ram le") && (r.kind !== "entry" || r.card?.intent !== "khata_payment_in")) {
      ok = false;
      detail = `got ${r.kind} ${r.card?.intent}`;
    }
    if (q.includes("200 cups") && (r.card?.amount !== 10000)) {
      ok = false;
      detail = `amount=${r.card?.amount}`;
    }
    if (q.includes("faithful") && r.engine !== "framework-brain" && r.engine !== "accounting-brain") {
      ok = false;
      detail = `engine=${r.engine}`;
    }
    if (q === "namaste" && r.kind !== "chat") {
      ok = false;
      detail = `kind=${r.kind}`;
    }

    if (ok) {
      passed++;
      console.log(`\nPASS  ${q}`);
      console.log(`      → ${r.kind} | engine: ${r.engine}${r.card ? ` | ${r.card.intent} NPR ${r.card.amount}` : ""}`);
    } else {
      failed++;
      console.log(`\nFAIL  ${q} (${expect}) — ${detail}`);
    }
  }

  console.log(`\n=== Live pipeline: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
