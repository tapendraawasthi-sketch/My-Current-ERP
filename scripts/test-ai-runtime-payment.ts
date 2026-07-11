/**
 * AI Runtime — bank payment scenario
 * Run: npm run test:ai-runtime-payment
 *
 * Flow: "I paid Ram 50,000 by bank"
 *   → Intent Extraction → Accounting Reasoning → Journal Proposal
 *   → Confidence → Approval → Command Bus → Explain
 */
import { setMigrationFlagOverride, clearMigrationFlagOverrides } from "../src/platform/flags/registry";
import {
  createAiRequest,
  processAiRequest,
  extractAccountingIntent,
  buildJournalProposal,
  resetAiRuntime,
  resetMemoryStore,
  bootstrapAiRuntime,
} from "../src/platform/ai-runtime";

const INPUT = "I paid Ram 50,000 by bank";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}

async function run() {
  clearMigrationFlagOverrides();
  setMigrationFlagOverride("MIGRATION_AI_RUNTIME", true);
  setMigrationFlagOverride("MIGRATION_QUERY_BUS", true);
  setMigrationFlagOverride("MIGRATION_COMMAND_BUS", true);
  setMigrationFlagOverride("MIGRATION_AI_PROPOSALS", true);

  resetAiRuntime();
  resetMemoryStore();
  bootstrapAiRuntime();

  console.log("\n=== Intent Extraction ===");
  const extract = extractAccountingIntent(INPUT);
  check("extract intent", extract?.khataIntent === "khata_payment_out", extract?.khataIntent);
  check("party Ram", extract?.party?.toLowerCase() === "ram", extract?.party ?? "null");
  check("amount 50000", extract?.amount === 50000, String(extract?.amount));
  check("payment mode bank", extract?.paymentMode === "bank", extract?.paymentMode);

  console.log("\n=== Journal Proposal ===");
  const proposal = extract ? buildJournalProposal(extract) : null;
  check("balanced journal", proposal?.balanced === true);
  const dr = proposal?.lines.find((l) => l.debit > 0);
  const cr = proposal?.lines.find((l) => l.credit > 0);
  check("debit creditor", dr?.accountCode === "KH-CRED", dr?.accountCode);
  check("credit bank", cr?.accountCode === "KH-BANK", cr?.accountCode);
  check("amount on lines", dr?.debit === 50000 && cr?.credit === 50000);

  console.log("\n=== Full Pipeline ===");
  const result = await processAiRequest(
    createAiRequest({ sessionId: "payment-test", input: INPUT, tenantId: "t1" }),
  );

  check("structured output", result.stage === "complete" || result.stage === "refused");
  check("intent khata_payment_out", result.intent.action === "khata_payment_out", result.intent.action);
  check("confidence present", result.confidence.score > 0.5, String(result.confidence.score));
  check("explanation mentions bank or creditor", /bank|creditor|payable/i.test(result.explanation));
  check(
    "command proposed",
    result.commands.length > 0 && result.commands[0].commandType === "PostKhataEntry",
    result.commands[0]?.commandType,
  );
  check(
    "pending approval",
    result.commands.some((c) => c.status === "pending") ||
      result.warnings.some((w) => w.includes("approval")),
  );

  console.log("\n=== Explanation ===");
  console.log(result.explanation.slice(0, 500));

  clearMigrationFlagOverrides();
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
