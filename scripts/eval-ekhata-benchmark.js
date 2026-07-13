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
 * e-Khata benchmark — scores /v2/chat against curated accounting questions.
 * Run: npm run test:ekhata-benchmark
 *
 * Requires erp_bot running with Ollama online.
 */
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var BOT_URL = (process.env.ERP_BOT_BACKEND_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
var CASES = [
    { id: "fw-1", bucket: "framework", input: "sampatti ke ho?", expectContains: ["asset", "sampatti", "economic"], blockWikipedia: true },
    { id: "fw-2", bucket: "framework", input: "faithful representation k ho?", expectContains: ["faithful", "biswasilo", "representation"] },
    { id: "fw-3", bucket: "framework", input: "what is liability in accounting?", expectContains: ["liability", "obligation", "dayitwo"] },
    { id: "entry-1", bucket: "entry", input: "Ram lai 500 udhaar diye", expectAction: "confirm", expectContains: ["500", "Ram"] },
    { id: "entry-2", bucket: "entry", input: "Ram lai 11300 ko saman becheko VAT sahit", expectAction: "confirm", expectContains: ["11300", "1300", "10000"] },
    { id: "entry-3", bucket: "entry", input: "cash ma 2000 kharcha office", expectAction: "confirm" },
    { id: "report-1", bucket: "report", input: "trial balance dekhau", expectAction: "report", expectContains: ["Trial", "Dr", "Cr"] },
    { id: "edu-1", bucket: "education", input: "depreciation bhannale ke ho?", expectContains: ["depreciation", "asset", "purano"] },
    { id: "query-1", bucket: "query", input: "VAT rate Nepal ma kati ho?", expectContains: ["13", "vat"] },
    { id: "slot-1", bucket: "multiturn", input: "Ram le tiryo", expectAction: "clarify" },
];
function askV2(message, sessionId) {
    return __awaiter(this, void 0, void 0, function () {
        var resp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch("".concat(BOT_URL, "/v2/chat"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ message: message, session_id: sessionId, context: {} }),
                    })];
                case 1:
                    resp = _a.sent();
                    if (!resp.ok)
                        throw new Error("HTTP ".concat(resp.status));
                    return [2 /*return*/, resp.json()];
            }
        });
    });
}
function scoreCase(c, res) {
    var text = (res.message || "").toLowerCase();
    if (c.expectAction && res.action !== c.expectAction) {
        return { pass: false, reason: "action=".concat(res.action, " expected ").concat(c.expectAction) };
    }
    if (c.expectContains) {
        var hit = c.expectContains.some(function (k) { return text.includes(k.toLowerCase()); });
        if (!hit)
            return { pass: false, reason: "missing keywords: ".concat(c.expectContains.join(", ")) };
    }
    if (c.blockWikipedia && /wikipedia|demigod|sampati bird/i.test(res.message)) {
        return { pass: false, reason: "Wikipedia/hallucination detected" };
    }
    return { pass: true, reason: "ok" };
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var status_1, _a, passed, results, _i, CASES_1, c, sessionId, res, _b, pass, reason, e_1, pct, outPath, writeFileSync;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log("e-Khata benchmark \u2192 ".concat(BOT_URL, "/v2/chat\n"));
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fetch("".concat(BOT_URL, "/status"))];
                case 2:
                    status_1 = _c.sent();
                    if (!status_1.ok)
                        throw new Error("erp_bot not reachable");
                    return [3 /*break*/, 4];
                case 3:
                    _a = _c.sent();
                    console.error("FAIL: Start erp_bot first (cd erp_bot && python -m src.api.server)");
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4:
                    passed = 0;
                    results = [];
                    _i = 0, CASES_1 = CASES;
                    _c.label = 5;
                case 5:
                    if (!(_i < CASES_1.length)) return [3 /*break*/, 10];
                    c = CASES_1[_i];
                    sessionId = "bench-".concat(c.id, "-").concat(Date.now());
                    _c.label = 6;
                case 6:
                    _c.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, askV2(c.input, sessionId)];
                case 7:
                    res = _c.sent();
                    _b = scoreCase(c, res), pass = _b.pass, reason = _b.reason;
                    results.push({ id: c.id, pass: pass, reason: reason });
                    if (pass)
                        passed += 1;
                    console.log("".concat(pass ? "✓" : "✗", " [").concat(c.bucket, "] ").concat(c.id, ": ").concat(reason));
                    if (!pass)
                        console.log("   \u2192 ".concat(res.message.slice(0, 120), "..."));
                    return [3 /*break*/, 9];
                case 8:
                    e_1 = _c.sent();
                    results.push({ id: c.id, pass: false, reason: String(e_1) });
                    console.log("\u2717 [".concat(c.bucket, "] ").concat(c.id, ": ").concat(e_1));
                    return [3 /*break*/, 9];
                case 9:
                    _i++;
                    return [3 /*break*/, 5];
                case 10:
                    pct = Math.round((passed / CASES.length) * 100);
                    console.log("\nScore: ".concat(passed, "/").concat(CASES.length, " (").concat(pct, "%)"));
                    outPath = (0, node_path_1.join)(process.cwd(), "data", "ekhata", "benchmark-last-run.json");
                    if (!(0, node_fs_1.existsSync)((0, node_path_1.join)(process.cwd(), "data", "ekhata"))) return [3 /*break*/, 12];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("node:fs"); })];
                case 11:
                    writeFileSync = (_c.sent()).writeFileSync;
                    writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), passed: passed, total: CASES.length, results: results }, null, 2));
                    console.log("Wrote ".concat(outPath));
                    _c.label = 12;
                case 12:
                    process.exit(passed === CASES.length ? 0 : 1);
                    return [2 /*return*/];
            }
        });
    });
}
main();
