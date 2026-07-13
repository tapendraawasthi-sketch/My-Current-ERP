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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTransaction = parseTransaction;
exports.confirmTransaction = confirmTransaction;
exports.syncOfflineQueue = syncOfflineQueue;
exports.fetchBalance = fetchBalance;
exports.fetchInsights = fetchInsights;
var types_1 = require("../types");
var offlineQueue_1 = require("../lib/offlineQueue");
var API_BASE = (_a = import.meta.env.VITE_API_BASE) !== null && _a !== void 0 ? _a : "";
function request(path, init) {
    return __awaiter(this, void 0, void 0, function () {
        var response, body;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, fetch("".concat(API_BASE).concat(path), __assign({ headers: __assign({ "Content-Type": "application/json" }, ((_a = init === null || init === void 0 ? void 0 : init.headers) !== null && _a !== void 0 ? _a : {})) }, init))];
                case 1:
                    response = _c.sent();
                    return [4 /*yield*/, response.json()];
                case 2:
                    body = _c.sent();
                    if (!response.ok || body.success === false) {
                        throw new Error((_b = body.error) !== null && _b !== void 0 ? _b : "Request failed");
                    }
                    return [2 /*return*/, body.data];
            }
        });
    });
}
function isOfflineError(error) {
    return !navigator.onLine || (error instanceof TypeError && error.message.includes("fetch"));
}
function postConfirmPayload(payload) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, request("/api/khata/confirm", {
                    method: "POST",
                    body: JSON.stringify(payload),
                })];
        });
    });
}
function parseTransaction(raw_text) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, request("/api/khata/transaction", {
                    method: "POST",
                    body: JSON.stringify({
                        tenant_id: types_1.TENANT_ID,
                        company_id: types_1.COMPANY_ID,
                        user_id: types_1.USER_ID,
                        raw_text: raw_text,
                    }),
                })];
        });
    });
}
function confirmTransaction(card, idempotencyKey) {
    return __awaiter(this, void 0, void 0, function () {
        var key, payload, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    key = idempotencyKey !== null && idempotencyKey !== void 0 ? idempotencyKey : (0, offlineQueue_1.createIdempotencyKey)();
                    payload = __assign(__assign({ tenant_id: types_1.TENANT_ID, company_id: types_1.COMPANY_ID, user_id: types_1.USER_ID }, card), { client_idempotency_key: key });
                    if (!!navigator.onLine) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, offlineQueue_1.enqueueTransaction)(key, payload)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { offline: true }];
                case 2:
                    _a.trys.push([2, 4, , 7]);
                    return [4 /*yield*/, postConfirmPayload(payload)];
                case 3:
                    result = _a.sent();
                    return [2 /*return*/, { offline: false, voucher_id: result.voucher_id }];
                case 4:
                    error_1 = _a.sent();
                    if (!isOfflineError(error_1)) return [3 /*break*/, 6];
                    return [4 /*yield*/, (0, offlineQueue_1.enqueueTransaction)(key, payload)];
                case 5:
                    _a.sent();
                    return [2 /*return*/, { offline: true }];
                case 6: throw error_1;
                case 7: return [2 /*return*/];
            }
        });
    });
}
function syncOfflineQueue() {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            if (!navigator.onLine)
                return [2 /*return*/, 0];
            return [2 /*return*/, (0, offlineQueue_1.replayQueue)(function (payload) { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, postConfirmPayload(payload)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); })];
        });
    });
}
function fetchBalance() {
    return __awaiter(this, void 0, void 0, function () {
        var params;
        return __generator(this, function (_a) {
            params = new URLSearchParams({
                tenant_id: types_1.TENANT_ID,
                company_id: types_1.COMPANY_ID,
            });
            return [2 /*return*/, request("/api/khata/balance?".concat(params.toString()))];
        });
    });
}
function fetchInsights() {
    return __awaiter(this, void 0, void 0, function () {
        var params;
        return __generator(this, function (_a) {
            params = new URLSearchParams({
                tenant_id: types_1.TENANT_ID,
                company_id: types_1.COMPANY_ID,
            });
            return [2 /*return*/, request("/api/khata/insights?".concat(params.toString()))];
        });
    });
}
