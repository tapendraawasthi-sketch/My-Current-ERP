"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Validate generated training corpus size and sample parse accuracy.
 * Run: npm run validate:ekhata-corpus
 */
var fs_1 = require("fs");
var path_1 = require("path");
var parseKhata_1 = require("../src/lib/ekhata/parseKhata");
var corpusPath = (0, path_1.join)(process.cwd(), "data/ekhata/lora-instruction-dataset.jsonl");
var lines = (0, fs_1.readFileSync)(corpusPath, "utf-8").trim().split("\n").filter(Boolean);
var passed = 0;
var failed = 0;
function check(name, ok) {
    if (ok) {
        passed++;
        console.log("PASS ".concat(name));
    }
    else {
        failed++;
        console.log("FAIL ".concat(name));
    }
}
check("corpus has 5000+ examples", lines.length >= 5000);
// Sample 50 entry examples and verify parser matches
var entrySamples = lines
    .map(function (l) { return JSON.parse(l); })
    .filter(function (r) { return r.instruction.includes("parser"); })
    .slice(0, 50);
var parseOk = 0;
for (var _i = 0, entrySamples_1 = entrySamples; _i < entrySamples_1.length; _i++) {
    var sample = entrySamples_1[_i];
    var expected = JSON.parse(sample.output);
    var result = (0, parseKhata_1.parseKhataMessage)(sample.input);
    if (((_a = result.card) === null || _a === void 0 ? void 0 : _a.intent) === expected.intent && result.card.amount === expected.amount) {
        parseOk++;
    }
}
check("parser matches ".concat(parseOk, "/").concat(entrySamples.length, " sampled entries"), parseOk >= entrySamples.length * 0.85);
console.log("\nCorpus: ".concat(lines.length, " examples"));
console.log("=== Validation: ".concat(passed, " passed, ").concat(failed, " failed ==="));
process.exit(failed > 0 ? 1 : 0);
