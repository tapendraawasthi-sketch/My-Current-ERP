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
exports.enqueueTransaction = enqueueTransaction;
exports.listQueuedTransactions = listQueuedTransactions;
exports.removeQueuedTransaction = removeQueuedTransaction;
exports.replayQueue = replayQueue;
exports.createIdempotencyKey = createIdempotencyKey;
exports.registerNetworkListener = registerNetworkListener;
exports.isOnline = isOnline;
var platform_1 = require("./platform");
var DB_NAME = "mobile-khata-offline";
var STORE_NAME = "confirm_queue";
var DB_VERSION = 1;
function openDb() {
    return new Promise(function (resolve, reject) {
        var request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function () {
            var db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = function () { return resolve(request.result); };
        request.onerror = function () { return reject(request.error); };
    });
}
function enqueueTransaction(clientIdempotencyKey, payload) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, openDb()];
                case 1:
                    db = _a.sent();
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var tx = db.transaction(STORE_NAME, "readwrite");
                            tx.objectStore(STORE_NAME).add({
                                client_idempotency_key: clientIdempotencyKey,
                                payload: payload,
                                created_at: new Date().toISOString(),
                            });
                            tx.oncomplete = function () { return resolve(); };
                            tx.onerror = function () { return reject(tx.error); };
                        })];
                case 2:
                    _a.sent();
                    db.close();
                    return [2 /*return*/];
            }
        });
    });
}
function listQueuedTransactions() {
    return __awaiter(this, void 0, void 0, function () {
        var db, rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, openDb()];
                case 1:
                    db = _a.sent();
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var tx = db.transaction(STORE_NAME, "readonly");
                            var request = tx.objectStore(STORE_NAME).getAll();
                            request.onsuccess = function () { return resolve(request.result); };
                            request.onerror = function () { return reject(request.error); };
                        })];
                case 2:
                    rows = _a.sent();
                    db.close();
                    return [2 /*return*/, rows.sort(function (a, b) { var _a, _b; return Number((_a = a.id) !== null && _a !== void 0 ? _a : 0) - Number((_b = b.id) !== null && _b !== void 0 ? _b : 0); })];
            }
        });
    });
}
function removeQueuedTransaction(id) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, openDb()];
                case 1:
                    db = _a.sent();
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var tx = db.transaction(STORE_NAME, "readwrite");
                            tx.objectStore(STORE_NAME).delete(id);
                            tx.oncomplete = function () { return resolve(); };
                            tx.onerror = function () { return reject(tx.error); };
                        })];
                case 2:
                    _a.sent();
                    db.close();
                    return [2 /*return*/];
            }
        });
    });
}
function replayQueue(sendFn) {
    return __awaiter(this, void 0, void 0, function () {
        var queued, replayed, _i, queued_1, item;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, listQueuedTransactions()];
                case 1:
                    queued = _a.sent();
                    replayed = 0;
                    _i = 0, queued_1 = queued;
                    _a.label = 2;
                case 2:
                    if (!(_i < queued_1.length)) return [3 /*break*/, 6];
                    item = queued_1[_i];
                    if (item.id == null)
                        return [3 /*break*/, 5];
                    return [4 /*yield*/, sendFn(item.payload)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, removeQueuedTransaction(item.id)];
                case 4:
                    _a.sent();
                    replayed += 1;
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6: return [2 /*return*/, replayed];
            }
        });
    });
}
function createIdempotencyKey() {
    return crypto.randomUUID();
}
function registerNetworkListener(onOnline) {
    return __awaiter(this, void 0, void 0, function () {
        var Network, handle_1, _a, handler;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(0, platform_1.isNativePlatform)()) return [3 /*break*/, 5];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@capacitor/network"); })];
                case 2:
                    Network = (_b.sent()).Network;
                    return [4 /*yield*/, Network.addListener("networkStatusChange", function (status) {
                            if (status.connected) {
                                onOnline();
                            }
                        })];
                case 3:
                    handle_1 = _b.sent();
                    return [2 /*return*/, function () { return handle_1.remove(); }];
                case 4:
                    _a = _b.sent();
                    return [3 /*break*/, 5];
                case 5:
                    handler = function () { return onOnline(); };
                    window.addEventListener("online", handler);
                    return [2 /*return*/, function () { return window.removeEventListener("online", handler); }];
            }
        });
    });
}
function isOnline() {
    return __awaiter(this, void 0, void 0, function () {
        var Network, status_1, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(0, platform_1.isNativePlatform)()) return [3 /*break*/, 5];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@capacitor/network"); })];
                case 2:
                    Network = (_b.sent()).Network;
                    return [4 /*yield*/, Network.getStatus()];
                case 3:
                    status_1 = _b.sent();
                    return [2 /*return*/, status_1.connected];
                case 4:
                    _a = _b.sent();
                    return [2 /*return*/, navigator.onLine];
                case 5: return [2 /*return*/, navigator.onLine];
            }
        });
    });
}
