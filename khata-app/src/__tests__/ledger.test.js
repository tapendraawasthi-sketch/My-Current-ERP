"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var KHATA_DOUBLE_ENTRY = {
    khata_credit_sale: { debit: "KH-DEBT", credit: "KH-SALE" },
    khata_cash_sale: { debit: "KH-CASH", credit: "KH-SALE" },
    khata_payment_in: { debit: "KH-CASH", credit: "KH-DEBT" },
    khata_purchase: { debit: "KH-PUR", credit: "KH-CASH" },
    khata_payment_out: { debit: "KH-CRED", credit: "KH-CASH" },
    khata_expense: { debit: "KH-EXP", credit: "KH-CASH" },
};
(0, vitest_1.describe)("ledger double-entry mapping", function () {
    var _loop_1 = function (intent, mapping) {
        (0, vitest_1.it)("".concat(intent, " produces balanced DR/CR pair"), function () {
            (0, vitest_1.expect)(mapping.debit).toBeTruthy();
            (0, vitest_1.expect)(mapping.credit).toBeTruthy();
            (0, vitest_1.expect)(mapping.debit).not.toBe(mapping.credit);
        });
    };
    for (var _i = 0, _a = Object.entries(KHATA_DOUBLE_ENTRY); _i < _a.length; _i++) {
        var _b = _a[_i], intent = _b[0], mapping = _b[1];
        _loop_1(intent, mapping);
    }
});
