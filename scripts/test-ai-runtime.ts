/**
 * AI Execution Runtime tests
 * Run: npm run test:ai-runtime
 */
import { setMigrationFlagOverride, clearMigrationFlagOverrides } from "../src/platform/flags/registry";
import {
  createAiRequest,
  processAiRequest,
  getToolRouter,
  getConfidenceEvaluator,
  getApprovalGate,
  classifyStepRisk,
  bootstrapAiRuntime,
  isAiRuntimeBootstrapped,
  resetAiRuntime,
  resetToolRouter,
  resetMemoryStore,
  resetConfidenceEvaluator,
  resetApprovalGate,
} from "../src/platform/ai-runtime";

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

async function runTests() {
  clearMigrationFlagOverrides();
  setMigrationFlagOverride("MIGRATION_AI_RUNTIME", true);
  setMigrationFlagOverride("MIGRATION_QUERY_BUS", true);
  setMigrationFlagOverride("MIGRATION_COMMAND_BUS", true);
  setMigrationFlagOverride("MIGRATION_AI_PROPOSALS", true);

  resetAiRuntime();
  resetToolRouter();
  resetMemoryStore();
  resetConfidenceEvaluator();
  resetApprovalGate();

  bootstrapAiRuntime();
  check("bootstrap", isAiRuntimeBootstrapped());

  const router = getToolRouter();
  check("tool count", router.listTools().length === 10);

  const calc = await router.invoke({
    toolId: "calculator",
    action: "eval",
    payload: { expression: "100 + 200" },
  });
  check("calculator tool", calc.success && calc.data?.result === 300);

  const confidence = getConfidenceEvaluator().evaluate({ score: 0.9, risk: "none" });
  check("confidence high", confidence.level === "high" && confidence.nextAction === "proceed");

  const lowConfidence = getConfidenceEvaluator().evaluate({
    score: 0.1,
    missingEvidence: ["test"],
    risk: "high",
  });
  check("confidence refuse", lowConfidence.nextAction === "refuse");

  const risk = classifyStepRisk({
    id: "s1",
    order: 1,
    kind: "command",
    commandType: "DELETE_VOUCHER",
    payload: {},
    description: "delete",
    requiresApproval: true,
  });
  check("high risk delete", risk.level === "critical" && risk.requiresApproval);

  const gate = getApprovalGate();
  check("isHighRiskCommand", gate.isHighRiskCommand("REVERSE_VOUCHER"));

  const queryRequest = createAiRequest({
    sessionId: "test-session-1",
    input: "show trial balance",
    tenantId: "tenant-1",
  });

  const queryResult = await processAiRequest(queryRequest);
  check("structured output", typeof queryResult === "object" && queryResult.stage === "complete");
  check("has intent", queryResult.intent.category === "report" || queryResult.intent.category === "query");
  check("has explanation", queryResult.explanation.length > 0);
  check("no plain text only", queryResult.intent !== undefined && queryResult.confidence !== undefined);

  const commandRequest = createAiRequest({
    sessionId: "test-session-2",
    input: "delete voucher 123",
  });

  const commandResult = await processAiRequest(commandRequest);
  check("command plan", commandResult.plan !== null);
  check(
    "approval or pending",
    commandResult.commands.some((c) => c.status === "pending") ||
      commandResult.warnings.some((w) => w.includes("approval")),
  );

  clearMigrationFlagOverrides();
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
