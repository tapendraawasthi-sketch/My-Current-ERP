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
 * Verify built-in e-Khata brain works with NO LLM env vars set.
 * Run: npx tsx scripts/verify-builtin-brain.ts
 */
var selfContainedAi_1 = require("../src/lib/selfContainedAi");
var processMessage_1 = require("../src/lib/ekhata/processMessage");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var erpBotUrl, selfContained, cases, passed, failed, _i, cases_1, _a, q, expect, r, ok, detail;
        var _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    console.log("=== Built-in brain verification (no VITE_ERP_BOT_URL) ===\n");
                    erpBotUrl = (_b = globalThis.import_meta_env) === null || _b === void 0 ? void 0 : _b.VITE_ERP_BOT_URL;
                    selfContained = !(erpBotUrl === null || erpBotUrl === void 0 ? void 0 : erpBotUrl.trim());
                    console.log("self-contained mode (no erp_bot URL):", selfContained);
                    console.log("label:", selfContainedAi_1.SELF_CONTAINED_STATUS.label);
                    cases = [
                        { q: "what is sampati", expect: "accounting-brain or framework-brain" },
                        { q: "Ram le 1500 diyo", expect: "entry khata_payment_in" },
                        { q: "i sold 200 cups today for Rs. 50 each", expect: "entry amount 10000" },
                        { q: "faithful representation k ho", expect: "framework-brain" },
                        { q: "namaste", expect: "chat brain" },
                    ];
                    passed = 0;
                    failed = 0;
                    _i = 0, cases_1 = cases;
                    _g.label = 1;
                case 1:
                    if (!(_i < cases_1.length)) return [3 /*break*/, 4];
                    _a = cases_1[_i], q = _a.q, expect = _a.expect;
                    return [4 /*yield*/, (0, processMessage_1.processEKhataMessageAsync)(q, { preferLlm: false, llmOnline: false })];
                case 2:
                    r = _g.sent();
                    ok = true;
                    detail = "";
                    if (q.includes("sampati") && r.kind !== "chat") {
                        ok = false;
                        detail = "expected chat";
                    }
                    if (q.includes("sampati") && r.reply.toLowerCase().includes("jatayu")) {
                        ok = false;
                        detail = "Wikipedia hijack";
                    }
                    if (q.includes("Ram le") && (r.kind !== "entry" || ((_c = r.card) === null || _c === void 0 ? void 0 : _c.intent) !== "khata_payment_in")) {
                        ok = false;
                        detail = "got ".concat(r.kind, " ").concat((_d = r.card) === null || _d === void 0 ? void 0 : _d.intent);
                    }
                    if (q.includes("200 cups") && (((_e = r.card) === null || _e === void 0 ? void 0 : _e.amount) !== 10000)) {
                        ok = false;
                        detail = "amount=".concat((_f = r.card) === null || _f === void 0 ? void 0 : _f.amount);
                    }
                    if (q.includes("faithful") && r.engine !== "framework-brain" && r.engine !== "accounting-brain") {
                        ok = false;
                        detail = "engine=".concat(r.engine);
                    }
                    if (q === "namaste" && r.kind !== "chat") {
                        ok = false;
                        detail = "kind=".concat(r.kind);
                    }
                    if (ok) {
                        passed++;
                        console.log("\nPASS  ".concat(q));
                        console.log("      \u2192 ".concat(r.kind, " | engine: ").concat(r.engine).concat(r.card ? " | ".concat(r.card.intent, " NPR ").concat(r.card.amount) : ""));
                    }
                    else {
                        failed++;
                        console.log("\nFAIL  ".concat(q, " (").concat(expect, ") \u2014 ").concat(detail));
                    }
                    _g.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("\n=== Live pipeline: ".concat(passed, " passed, ").concat(failed, " failed ==="));
                    process.exit(failed > 0 ? 1 : 0);
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (e) {
    console.error(e);
    process.exit(1);
});
