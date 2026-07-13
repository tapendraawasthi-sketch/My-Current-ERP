"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * AI Execution Runtime tests
 * Run: npm run test:ai-runtime
 */
var registry_1 = require("../src/platform/flags/registry");
var ai_runtime_1 = require("../src/platform/ai-runtime");
var passed = 0;
var failed = 0;
function check(name, ok, detail) {
    if (ok) {
        passed += 1;
        console.log("PASS ".concat(name));
    }
    else {
        failed += 1;
        console.log("FAIL ".concat(name).concat(detail ? ": ".concat(detail) : ""));
    }
}
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var router, calc, confidence, lowConfidence, risk, gate, queryRequest, queryResult, commandRequest, commandResult;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    (0, registry_1.clearMigrationFlagOverrides)();
                    (0, registry_1.setMigrationFlagOverride)("MIGRATION_AI_RUNTIME", true);
                    (0, registry_1.setMigrationFlagOverride)("MIGRATION_QUERY_BUS", true);
                    (0, registry_1.setMigrationFlagOverride)("MIGRATION_COMMAND_BUS", true);
                    (0, registry_1.setMigrationFlagOverride)("MIGRATION_AI_PROPOSALS", true);
                    (0, ai_runtime_1.resetAiRuntime)();
                    (0, ai_runtime_1.resetToolRouter)();
                    (0, ai_runtime_1.resetMemoryStore)();
                    (0, ai_runtime_1.resetConfidenceEvaluator)();
                    (0, ai_runtime_1.resetApprovalGate)();
                    (0, ai_runtime_1.bootstrapAiRuntime)();
                    check("bootstrap", (0, ai_runtime_1.isAiRuntimeBootstrapped)());
                    router = (0, ai_runtime_1.getToolRouter)();
                    check("tool count", router.listTools().length === 10);
                    return [4 /*yield*/, router.invoke({
                            toolId: "calculator",
                            action: "eval",
                            payload: { expression: "100 + 200" },
                        })];
                case 1:
                    calc = _b.sent();
                    check("calculator tool", calc.success && ((_a = calc.data) === null || _a === void 0 ? void 0 : _a.result) === 300);
                    confidence = (0, ai_runtime_1.getConfidenceEvaluator)().evaluate({ score: 0.9, risk: "none" });
                    check("confidence high", confidence.level === "high" && confidence.nextAction === "proceed");
                    lowConfidence = (0, ai_runtime_1.getConfidenceEvaluator)().evaluate({
                        score: 0.1,
                        missingEvidence: ["test"],
                        risk: "high",
                    });
                    check("confidence refuse", lowConfidence.nextAction === "refuse");
                    risk = (0, ai_runtime_1.classifyStepRisk)({
                        id: "s1",
                        order: 1,
                        kind: "command",
                        commandType: "DELETE_VOUCHER",
                        payload: {},
                        description: "delete",
                        requiresApproval: true,
                    });
                    check("high risk delete", risk.level === "critical" && risk.requiresApproval);
                    gate = (0, ai_runtime_1.getApprovalGate)();
                    check("isHighRiskCommand", gate.isHighRiskCommand("REVERSE_VOUCHER"));
                    queryRequest = (0, ai_runtime_1.createAiRequest)({
                        sessionId: "test-session-1",
                        input: "show trial balance",
                        tenantId: "tenant-1",
                    });
                    return [4 /*yield*/, (0, ai_runtime_1.processAiRequest)(queryRequest)];
                case 2:
                    queryResult = _b.sent();
                    check("structured output", typeof queryResult === "object" && queryResult.stage === "complete");
                    check("has intent", queryResult.intent.category === "report" || queryResult.intent.category === "query");
                    check("has explanation", queryResult.explanation.length > 0);
                    check("no plain text only", queryResult.intent !== undefined && queryResult.confidence !== undefined);
                    commandRequest = (0, ai_runtime_1.createAiRequest)({
                        sessionId: "test-session-2",
                        input: "delete voucher 123",
                    });
                    return [4 /*yield*/, (0, ai_runtime_1.processAiRequest)(commandRequest)];
                case 3:
                    commandResult = _b.sent();
                    check("command plan", commandResult.plan !== null);
                    check("approval or pending", commandResult.commands.some(function (c) { return c.status === "pending"; }) ||
                        commandResult.warnings.some(function (w) { return w.includes("approval"); }));
                    (0, registry_1.clearMigrationFlagOverrides)();
                    console.log("\n=== Results: ".concat(passed, " passed, ").concat(failed, " failed ==="));
                    process.exit(failed > 0 ? 1 : 0);
                    return [2 /*return*/];
            }
        });
    });
}
runTests().catch(function (err) {
    console.error(err);
    process.exit(1);
});
