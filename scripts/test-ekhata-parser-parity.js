"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * TS vs Python parser parity on stratified corpus samples.
 * Run: npm run test:ekhata-python-parity
 */
var child_process_1 = require("child_process");
var fs_1 = require("fs");
var path_1 = require("path");
var parseKhata_1 = require("../src/lib/ekhata/parseKhata");
var corpusPath = (0, path_1.join)(process.cwd(), "data/ekhata/lora-instruction-dataset.jsonl");
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
var rows = (0, fs_1.readFileSync)(corpusPath, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(function (line) { return JSON.parse(line); })
    .filter(function (r) { return r.instruction.includes("parser"); });
var byIntent = new Map();
for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
    var row = rows_1[_i];
    var expected = JSON.parse(row.output);
    var bucket = (_a = byIntent.get(expected.intent)) !== null && _a !== void 0 ? _a : [];
    bucket.push(row);
    byIntent.set(expected.intent, bucket);
}
var samples = __spreadArray([], byIntent.values(), true).flatMap(function (bucket) { return bucket.slice(0, 2); }).slice(0, 120);
var payload = {
    samples: samples.map(function (row) {
        var expected = JSON.parse(row.output);
        return { input: row.input, expected: expected };
    }),
};
var py = (0, child_process_1.spawnSync)("python3", ["scripts/test-ekhata-python-parity.py"], {
    cwd: process.cwd(),
    input: JSON.stringify(payload),
    encoding: "utf-8",
});
if (py.status !== 0 || py.error) {
    console.error(py.stderr || py.error);
    process.exit(1);
}
var pyData = JSON.parse(py.stdout);
var tsIntentOk = 0;
var pyIntentOk = 0;
var crossOk = 0;
var mismatches = [];
for (var _c = 0, _d = pyData.results; _c < _d.length; _c++) {
    var row = _d[_c];
    var tsIntent = (0, parseKhata_1.classifyKhataIntent)(row.input);
    var pyIntent = (_b = row.py_intent) !== null && _b !== void 0 ? _b : null;
    if (tsIntent === row.expected_intent)
        tsIntentOk += 1;
    if (pyIntent === row.expected_intent)
        pyIntentOk += 1;
    if (tsIntent === pyIntent)
        crossOk += 1;
    else if (mismatches.length < 5) {
        mismatches.push("".concat(row.input.slice(0, 40), " TS=").concat(tsIntent, " PY=").concat(pyIntent));
    }
}
var n = pyData.results.length;
check("TS intent match ".concat(tsIntentOk, "/").concat(n), tsIntentOk / n >= 0.88);
check("Python intent match ".concat(pyIntentOk, "/").concat(n), pyIntentOk / n >= 0.88);
check("TS/Python cross-match ".concat(crossOk, "/").concat(n), crossOk / n >= 0.92, mismatches.join("; "));
console.log("\n=== Parser parity: ".concat(passed, " passed, ").concat(failed, " failed ==="));
process.exit(failed > 0 ? 1 : 0);
