"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Expanded e-Khata corpus benchmark — stratified samples from 5190+ training set.
 * Run: npm run test:ekhata-corpus-benchmark
 */
var fs_1 = require("fs");
var path_1 = require("path");
var domainRouter_1 = require("../src/lib/ekhata/domainRouter");
var parseKhata_1 = require("../src/lib/ekhata/parseKhata");
var corpusPath = (0, path_1.join)(process.cwd(), "data/ekhata/lora-instruction-dataset.jsonl");
var domainPath = (0, path_1.join)(process.cwd(), "data/ekhata/domain-classifier-dataset.jsonl");
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
function loadJsonl(path) {
    return (0, fs_1.readFileSync)(path, "utf-8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(function (line) { return JSON.parse(line); });
}
function stratifiedSample(rows, perIntent) {
    var _a, _b;
    var byIntent = new Map();
    for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
        var row = rows_1[_i];
        var expected = JSON.parse(row.output);
        var intent = (_a = expected.intent) !== null && _a !== void 0 ? _a : "unknown";
        var bucket = (_b = byIntent.get(intent)) !== null && _b !== void 0 ? _b : [];
        bucket.push(row);
        byIntent.set(intent, bucket);
    }
    var out = [];
    for (var _c = 0, byIntent_1 = byIntent; _c < byIntent_1.length; _c++) {
        var _d = byIntent_1[_c], bucket = _d[1];
        out.push.apply(out, bucket.slice(0, perIntent));
    }
    return out;
}
var corpus = loadJsonl(corpusPath);
var domainRows = loadJsonl(domainPath);
check("corpus has 5000+ examples", corpus.length >= 5000);
var entryRows = corpus.filter(function (r) { return r.instruction.includes("parser"); });
var qaRows = corpus.filter(function (r) { return r.instruction.includes("CA assistant"); });
var domainOnly = domainRows.length >= 500;
check("entry examples present", entryRows.length >= 1500);
check("Q&A examples present", qaRows.length >= 800);
check("domain classifier dataset present", domainOnly);
var entrySamples = stratifiedSample(entryRows.map(function (r) {
    var expected = JSON.parse(r.output);
    return __assign(__assign({}, r), { intent: expected.intent });
}), 3);
var parseIntentOk = 0;
var parseAmountOk = 0;
var parseFailures = [];
for (var _i = 0, entrySamples_1 = entrySamples; _i < entrySamples_1.length; _i++) {
    var sample = entrySamples_1[_i];
    var expected = JSON.parse(sample.output);
    var result = (0, parseKhata_1.parseKhataMessage)(sample.input);
    var intentMatch = ((_a = result.card) === null || _a === void 0 ? void 0 : _a.intent) === expected.intent;
    var amountMatch = ((_b = result.card) === null || _b === void 0 ? void 0 : _b.amount) === expected.amount;
    if (intentMatch)
        parseIntentOk += 1;
    if (intentMatch && amountMatch)
        parseAmountOk += 1;
    if (!intentMatch && parseFailures.length < 5) {
        parseFailures.push("".concat(sample.input.slice(0, 50), " \u2192 ").concat((_d = (_c = result.card) === null || _c === void 0 ? void 0 : _c.intent) !== null && _d !== void 0 ? _d : "null", " (want ").concat(expected.intent, ")"));
    }
}
var intentRate = parseIntentOk / entrySamples.length;
var amountRate = parseAmountOk / entrySamples.length;
check("parser intent ".concat(parseIntentOk, "/").concat(entrySamples.length, " (").concat((intentRate * 100).toFixed(1), "%)"), intentRate >= 0.88, parseFailures.join("; "));
check("parser intent+amount ".concat(parseAmountOk, "/").concat(entrySamples.length, " (").concat((amountRate * 100).toFixed(1), "%)"), amountRate >= 0.82);
// Domain router on classifier samples
var domainSample = domainRows.slice(0, 120);
var domainOk = 0;
for (var _e = 0, domainSample_1 = domainSample; _e < domainSample_1.length; _e++) {
    var row = domainSample_1[_e];
    var expected = JSON.parse(row.output);
    var route = (0, domainRouter_1.classifyDomain)(row.input);
    if (route.domain === expected.domain && route.blockWebSearch === expected.blockWebSearch) {
        domainOk += 1;
    }
}
check("domain router ".concat(domainOk, "/").concat(domainSample.length), domainOk / domainSample.length >= 0.9);
// Accounting terms must block web
var blockCases = [
    "what is sampati",
    "provision k ho",
    "capital maintenance meaning",
    "udhaar k ho",
    "faithful representation k ho",
];
var blockOk = 0;
for (var _f = 0, blockCases_1 = blockCases; _f < blockCases_1.length; _f++) {
    var q = blockCases_1[_f];
    if ((0, domainRouter_1.shouldBlockWebSearch)(q))
        blockOk += 1;
}
check("web block for accounting terms ".concat(blockOk, "/").concat(blockCases.length), blockOk === blockCases.length);
// External facts should not block
check("web allowed for weather", !(0, domainRouter_1.shouldBlockWebSearch)("what is the weather today"));
console.log("\nCorpus size: ".concat(corpus.length, " | Sampled entries: ").concat(entrySamples.length));
console.log("=== Corpus benchmark: ".concat(passed, " passed, ").concat(failed, " failed ==="));
process.exit(failed > 0 ? 1 : 0);
