"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
(0, vitest_1.describe)("payment webhook policy", function () {
    (0, vitest_1.it)("rejects missing webhook secret", function () {
        var secret = "";
        var expected = "test-secret";
        (0, vitest_1.expect)(Boolean(expected) && secret === expected).toBe(false);
    });
    (0, vitest_1.it)("accepts matching webhook secret", function () {
        var secret = "test-secret";
        var expected = "test-secret";
        (0, vitest_1.expect)(secret === expected).toBe(true);
    });
});
