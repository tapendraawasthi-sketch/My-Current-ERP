"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEsewaLink = buildEsewaLink;
exports.buildKhaltiLink = buildKhaltiLink;
var MERCHANT_ID = (_a = import.meta.env.VITE_ESEWA_MERCHANT_ID) !== null && _a !== void 0 ? _a : "";
var KHALTI_KEY = (_b = import.meta.env.VITE_KHALTI_PUBLIC_KEY) !== null && _b !== void 0 ? _b : "";
function buildEsewaLink(amount, note) {
    var params = new URLSearchParams({
        amt: String(amount),
        txAmt: String(amount),
        psc: "0",
        tAmt: String(amount),
        pid: note.slice(0, 40),
        scd: MERCHANT_ID,
    });
    return "esewa://pay?".concat(params.toString());
}
function buildKhaltiLink(amount, note) {
    var params = new URLSearchParams({
        amount: String(amount),
        purchase_order_name: note.slice(0, 40),
        public_key: KHALTI_KEY,
    });
    return "khalti://pay?".concat(params.toString());
}
