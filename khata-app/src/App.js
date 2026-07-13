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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
var react_1 = require("react");
var khataApi_1 = require("./api/khataApi");
var BalanceSummary_1 = require("./components/BalanceSummary");
var ChatWindow_1 = require("./components/ChatWindow");
var InputBar_1 = require("./components/InputBar");
var InsightBar_1 = require("./components/InsightBar");
var OnboardingFlow_1 = require("./components/OnboardingFlow");
var PremiumGate_1 = require("./components/PremiumGate");
var TrustModal_1 = require("./components/TrustModal");
var featureFlags_1 = require("./lib/featureFlags");
var insightEngine_1 = require("./lib/insightEngine");
var offlineQueue_1 = require("./lib/offlineQueue");
var paymentReconcile_1 = require("./lib/paymentReconcile");
function createId() {
    return "".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2, 8));
}
function App() {
    var _this = this;
    var _a = (0, react_1.useState)((0, featureFlags_1.hasCompletedOnboarding)()), ready = _a[0], setReady = _a[1];
    var _b = (0, react_1.useState)([
        {
            id: "welcome",
            role: "assistant",
            text: "Namaste! Mobile Khata ma tapai lai ke record garne?",
        },
    ]), messages = _b[0], setMessages = _b[1];
    var _c = (0, react_1.useState)(null), pendingCard = _c[0], setPendingCard = _c[1];
    var _d = (0, react_1.useState)(false), loading = _d[0], setLoading = _d[1];
    var _e = (0, react_1.useState)(null), toast = _e[0], setToast = _e[1];
    var _f = (0, react_1.useState)(false), syncing = _f[0], setSyncing = _f[1];
    var _g = (0, react_1.useState)(!navigator.onLine), offline = _g[0], setOffline = _g[1];
    var _h = (0, react_1.useState)(false), showTrust = _h[0], setShowTrust = _h[1];
    var _j = (0, react_1.useState)(false), showPremium = _j[0], setShowPremium = _j[1];
    var _k = (0, react_1.useState)([]), insights = _k[0], setInsights = _k[1];
    var _l = (0, react_1.useState)(false), insightsDismissed = _l[0], setInsightsDismissed = _l[1];
    var _m = (0, react_1.useState)({
        udhaar_out_total: 0,
        udhaar_in_total: 0,
        recent_credit_sales: [],
        recent_payments_in: [],
    }), balance = _m[0], setBalance = _m[1];
    var _o = (0, react_1.useState)(null), activeChip = _o[0], setActiveChip = _o[1];
    var _p = (0, react_1.useState)(null), paymentLinks = _p[0], setPaymentLinks = _p[1];
    var refreshBalance = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var data, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, khataApi_1.fetchBalance)()];
                case 1:
                    data = _b.sent();
                    setBalance(data);
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }, []);
    var refreshInsights = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var data, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, khataApi_1.fetchInsights)()];
                case 1:
                    data = _b.sent();
                    setInsights((0, insightEngine_1.pickVisibleInsights)(data.insights));
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }, []);
    var runSync = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!navigator.onLine)
                        return [2 /*return*/];
                    setSyncing(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 5, 6]);
                    return [4 /*yield*/, (0, khataApi_1.syncOfflineQueue)()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, refreshBalance()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, refreshInsights()];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    setSyncing(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); }, [refreshBalance, refreshInsights]);
    (0, react_1.useEffect)(function () {
        if (!ready)
            return;
        refreshBalance();
        refreshInsights();
    }, [ready, refreshBalance, refreshInsights]);
    (0, react_1.useEffect)(function () {
        var handleOnline = function () {
            setOffline(false);
            runSync();
        };
        var handleOffline = function () { return setOffline(true); };
        var handleVisible = function () {
            if (document.visibilityState === "visible")
                runSync();
        };
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        document.addEventListener("visibilitychange", handleVisible);
        return function () {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            document.removeEventListener("visibilitychange", handleVisible);
        };
    }, [runSync]);
    (0, react_1.useEffect)(function () {
        var cleanup;
        (0, offlineQueue_1.registerNetworkListener)(function () {
            runSync();
        }).then(function (unsub) {
            cleanup = unsub;
        });
        return function () { return cleanup === null || cleanup === void 0 ? void 0 : cleanup(); };
    }, [runSync]);
    var showToast = function (text) {
        setToast(text);
        window.setTimeout(function () { return setToast(null); }, 3500);
    };
    if (!ready) {
        return (<OnboardingFlow_1.default onComplete={function (phone) {
                (0, featureFlags_1.setPhoneId)(phone);
                setReady(true);
            }}/>);
    }
    var handleSend = function (text) { return __awaiter(_this, void 0, void 0, function () {
        var result_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setMessages(function (prev) { return __spreadArray(__spreadArray([], prev, true), [{ id: createId(), role: "user", text: text }], false); });
                    setLoading(true);
                    setPendingCard(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, (0, khataApi_1.parseTransaction)(text)];
                case 2:
                    result_1 = _a.sent();
                    if (result_1.clarifying_question) {
                        setMessages(function (prev) { return __spreadArray(__spreadArray([], prev, true), [
                            { id: createId(), role: "assistant", text: result_1.clarifying_question },
                        ], false); });
                        return [2 /*return*/];
                    }
                    if (result_1.card)
                        setPendingCard(result_1.card);
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    setMessages(function (prev) { return __spreadArray(__spreadArray([], prev, true), [
                        {
                            id: createId(),
                            role: "assistant",
                            text: error_1 instanceof Error ? error_1.message : "Could not parse entry",
                        },
                    ], false); });
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleConfirm = function () { return __awaiter(_this, void 0, void 0, function () {
        var card, result, error_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!pendingCard)
                        return [2 /*return*/];
                    card = pendingCard;
                    if ((0, featureFlags_1.isFreeTierLimitReached)()) {
                        if (!(0, featureFlags_1.wasUpgradeDismissedThisSession)())
                            setShowPremium(true);
                    }
                    setLoading(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 5, 6, 7]);
                    return [4 /*yield*/, (0, khataApi_1.confirmTransaction)(card)];
                case 2:
                    result = _c.sent();
                    setPendingCard(null);
                    (0, featureFlags_1.incrementTransactionCount)();
                    if (result.offline) {
                        showToast("Saved offline — will sync when connected");
                    }
                    else {
                        showToast("Transaction saved ✓");
                        if (card.intent === "khata_credit_sale") {
                            setPaymentLinks({
                                esewa: (0, paymentReconcile_1.buildEsewaLink)(card.amount, (_a = card.party) !== null && _a !== void 0 ? _a : "Khata payment"),
                                khalti: (0, paymentReconcile_1.buildKhaltiLink)(card.amount, (_b = card.party) !== null && _b !== void 0 ? _b : "Khata payment"),
                            });
                        }
                    }
                    return [4 /*yield*/, refreshBalance()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, refreshInsights()];
                case 4:
                    _c.sent();
                    return [3 /*break*/, 7];
                case 5:
                    error_2 = _c.sent();
                    showToast(error_2 instanceof Error ? error_2.message : "Save failed");
                    return [3 /*break*/, 7];
                case 6:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var handleCancel = function () {
        setPendingCard(null);
        setMessages(function (prev) { return __spreadArray(__spreadArray([], prev, true), [
            { id: createId(), role: "assistant", text: "Ok, kei gardina." },
        ], false); });
    };
    return (<div className="mx-auto flex h-full max-w-md flex-col bg-[#f5f6fa]">
      <header className="border-b border-gray-200 bg-white px-3 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Mobile Khata</h1>
            <p className="mt-0.5 text-[11px] text-gray-500">Chat-first personal ledger</p>
          </div>
          <button type="button" onClick={function () { return setShowTrust(true); }} className="text-[11px] text-[#1557b0]">
            Privacy
          </button>
        </div>
        {(offline || syncing) && (<p className="mt-1 text-[11px] text-amber-700">
            {offline ? "Offline mode" : "Syncing…"}
          </p>)}
      </header>

      {!insightsDismissed && (<InsightBar_1.default insights={insights} onDismiss={function () { return setInsightsDismissed(true); }} onPartyClick={function () {
                if (!(0, featureFlags_1.canViewPartySummary)() && !(0, featureFlags_1.wasUpgradeDismissedThisSession)()) {
                    setShowPremium(true);
                }
            }} onGrowthLadderYes={function () {
                setMessages(function (prev) { return __spreadArray(__spreadArray([], prev, true), [
                    {
                        id: createId(),
                        role: "assistant",
                        text: "NPR 50 lakh pachhi darta garna parne huna sakchha. Thulo byapar bhaye Sutra ERP Pro le formal billing ra VAT report garna madat garchha.",
                    },
                ], false); });
                setInsights(function (prev) { return prev.filter(function (item) { return item.type !== "growth_ladder"; }); });
            }} onGrowthLadderNo={function () {
                (0, featureFlags_1.dismissVatMessageFor30Days)();
                setInsights(function (prev) { return prev.filter(function (item) { return item.type !== "growth_ladder"; }); });
            }}/>)}

      <BalanceSummary_1.default udhaarOut={balance.udhaar_out_total} udhaarIn={balance.udhaar_in_total} recentCreditSales={balance.recent_credit_sales} recentPaymentsIn={balance.recent_payments_in} activeChip={activeChip} onChipClick={function (chip) {
            if (chip === "out" && balance.recent_credit_sales.length > 10 && !(0, featureFlags_1.canViewPartySummary)()) {
                if (!(0, featureFlags_1.wasUpgradeDismissedThisSession)())
                    setShowPremium(true);
            }
            setActiveChip(chip);
        }} onCloseList={function () { return setActiveChip(null); }}/>

      <ChatWindow_1.default messages={messages} pendingCard={pendingCard} loading={loading} onConfirm={handleConfirm} onCancel={handleCancel}/>

      <InputBar_1.default disabled={loading} onSend={handleSend}/>

      <TrustModal_1.default open={showTrust} onClose={function () { return setShowTrust(false); }}/>
      <PremiumGate_1.default open={showPremium} onDismiss={function () {
            (0, featureFlags_1.markUpgradeDismissedThisSession)();
            setShowPremium(false);
        }}/>

      {toast && (<div className="fixed bottom-20 left-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-[12px] text-white shadow-lg">
          <p>{toast}</p>
          {paymentLinks && (<div className="mt-2 flex gap-2">
              <a href={paymentLinks.esewa} className="rounded bg-white/10 px-2 py-1 text-[11px]">
                Send eSewa link
              </a>
              <a href={paymentLinks.khalti} className="rounded bg-white/10 px-2 py-1 text-[11px]">
                Send Khalti link
              </a>
            </div>)}
        </div>)}
    </div>);
}
