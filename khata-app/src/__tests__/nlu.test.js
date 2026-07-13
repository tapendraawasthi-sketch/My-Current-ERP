"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var insightEngine_1 = require("../lib/insightEngine");
var GROWTH_LADDER_MESSAGE = "Tapaaiko byapar badhdai chha! Kasai kasai le NPR 50 lakh pachhi VAT darta garna parcha. Thaha paauna chahanu hunchha?";
(0, vitest_1.describe)("growth ladder copy", function () {
    (0, vitest_1.it)("does not contain banned compliance words", function () {
        var banned = ["IRD", "tax", "kaanuun", "danda"];
        for (var _i = 0, banned_1 = banned; _i < banned_1.length; _i++) {
            var word = banned_1[_i];
            (0, vitest_1.expect)(GROWTH_LADDER_MESSAGE.toLowerCase()).not.toContain(word.toLowerCase());
        }
    });
});
(0, vitest_1.describe)("insight selection", function () {
    (0, vitest_1.it)("shows at most two insights with daily total first", function () {
        var _a;
        var insights = [
            { id: "1", type: "weekly_trend", message: "trend" },
            { id: "2", type: "daily_total", message: "daily" },
            { id: "3", type: "unpaid_udhaar", message: "unpaid" },
        ];
        var visible = (0, insightEngine_1.pickVisibleInsights)(insights);
        (0, vitest_1.expect)(visible).toHaveLength(2);
        (0, vitest_1.expect)((_a = visible[0]) === null || _a === void 0 ? void 0 : _a.type).toBe("daily_total");
    });
});
(0, vitest_1.describe)("NLU integration", function () {
    (0, vitest_1.it)("documents Python NLU suite location", function () {
        (0, vitest_1.expect)("erp_bot/scripts/test_falcon_trader_nlu.py").toContain("test_falcon");
    });
});
