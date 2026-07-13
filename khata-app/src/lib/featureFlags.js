"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VAT_TRIGGER_RATIO = exports.VAT_THRESHOLD_NPR = exports.FREE_TIER_MONTHLY_LIMIT = void 0;
exports.getPhoneId = getPhoneId;
exports.setPhoneId = setPhoneId;
exports.hasCompletedOnboarding = hasCompletedOnboarding;
exports.getTier = getTier;
exports.setTier = setTier;
exports.isPremium = isPremium;
exports.incrementTransactionCount = incrementTransactionCount;
exports.getMonthlyTransactionCount = getMonthlyTransactionCount;
exports.isFreeTierLimitReached = isFreeTierLimitReached;
exports.canViewExtendedHistory = canViewExtendedHistory;
exports.canExport = canExport;
exports.canViewPartySummary = canViewPartySummary;
exports.canUseMultiStaff = canUseMultiStaff;
exports.markUpgradeDismissedThisSession = markUpgradeDismissedThisSession;
exports.wasUpgradeDismissedThisSession = wasUpgradeDismissedThisSession;
exports.dismissVatMessageFor30Days = dismissVatMessageFor30Days;
exports.isVatMessageSuppressed = isVatMessageSuppressed;
exports.FREE_TIER_MONTHLY_LIMIT = 500;
exports.VAT_THRESHOLD_NPR = 5000000;
exports.VAT_TRIGGER_RATIO = 0.8;
var PHONE_KEY = "khata_phone_id";
var TIER_KEY = "khata_tier";
var TX_COUNTER_KEY = "khata_tx_counter";
var UPGRADE_DISMISSED_KEY = "khata_upgrade_dismissed_session";
var VAT_DISMISSED_KEY = "khata_vat_dismissed_at";
function getPhoneId() {
    return localStorage.getItem(PHONE_KEY);
}
function setPhoneId(phone) {
    localStorage.setItem(PHONE_KEY, phone);
}
function hasCompletedOnboarding() {
    return Boolean(getPhoneId());
}
function getTier() {
    return localStorage.getItem(TIER_KEY) === "premium" ? "premium" : "free";
}
function setTier(tier) {
    localStorage.setItem(TIER_KEY, tier);
}
function isPremium() {
    return getTier() === "premium";
}
function currentMonthKey() {
    var now = new Date();
    return "".concat(now.getFullYear(), "-").concat(now.getMonth() + 1);
}
function incrementTransactionCount() {
    var raw = localStorage.getItem(TX_COUNTER_KEY);
    var parsed = raw ? JSON.parse(raw) : { month: currentMonthKey(), count: 0 };
    if (parsed.month !== currentMonthKey()) {
        parsed.month = currentMonthKey();
        parsed.count = 0;
    }
    parsed.count += 1;
    localStorage.setItem(TX_COUNTER_KEY, JSON.stringify(parsed));
    return parsed.count;
}
function getMonthlyTransactionCount() {
    var raw = localStorage.getItem(TX_COUNTER_KEY);
    if (!raw)
        return 0;
    var parsed = JSON.parse(raw);
    return parsed.month === currentMonthKey() ? parsed.count : 0;
}
function isFreeTierLimitReached() {
    if (isPremium())
        return false;
    return getMonthlyTransactionCount() >= exports.FREE_TIER_MONTHLY_LIMIT;
}
function canViewExtendedHistory() {
    return isPremium();
}
function canExport() {
    return isPremium();
}
function canViewPartySummary() {
    return isPremium();
}
function canUseMultiStaff() {
    return isPremium();
}
function markUpgradeDismissedThisSession() {
    sessionStorage.setItem(UPGRADE_DISMISSED_KEY, "1");
}
function wasUpgradeDismissedThisSession() {
    return sessionStorage.getItem(UPGRADE_DISMISSED_KEY) === "1";
}
function dismissVatMessageFor30Days() {
    localStorage.setItem(VAT_DISMISSED_KEY, new Date().toISOString());
}
function isVatMessageSuppressed() {
    var raw = localStorage.getItem(VAT_DISMISSED_KEY);
    if (!raw)
        return false;
    var dismissedAt = new Date(raw).getTime();
    return Date.now() - dismissedAt < 30 * 24 * 60 * 60 * 1000;
}
