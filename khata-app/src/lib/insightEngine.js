"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickVisibleInsights = pickVisibleInsights;
var featureFlags_1 = require("./featureFlags");
function pickVisibleInsights(insights) {
    var filtered = insights.filter(function (item) {
        if (item.type === "growth_ladder" && (0, featureFlags_1.isVatMessageSuppressed)()) {
            return false;
        }
        return true;
    });
    var daily = filtered.find(function (item) { return item.type === "daily_total"; });
    var others = filtered.filter(function (item) { return item.type !== "daily_total"; });
    var picked = daily ? [daily] : [];
    for (var _i = 0, others_1 = others; _i < others_1.length; _i++) {
        var item = others_1[_i];
        if (picked.length >= 2)
            break;
        picked.push(item);
    }
    return picked.slice(0, 2);
}
