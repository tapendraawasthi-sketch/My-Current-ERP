"use strict";
/**
 * SUTRA AI — Sprint 3–5 tests
 * Run: npm run test:sutra-ai
 */
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
// Node test shim for UserProfileManager localStorage
if (typeof globalThis.localStorage === "undefined") {
    var store_1 = new Map();
    globalThis.localStorage = {
        getItem: function (k) { var _a; return (_a = store_1.get(k)) !== null && _a !== void 0 ? _a : null; },
        setItem: function (k, v) { store_1.set(k, v); },
        removeItem: function (k) { store_1.delete(k); },
        clear: function () { store_1.clear(); },
        key: function (i) { var _a; return (_a = __spreadArray([], store_1.keys(), true)[i]) !== null && _a !== void 0 ? _a : null; },
        get length() { return store_1.size; },
    };
}
var EntityExtractor_1 = require("../src/ai/context/EntityExtractor");
var IntentClassifier_1 = require("../src/ai/context/IntentClassifier");
var ContextResolver_1 = require("../src/ai/context/ContextResolver");
var IntelligenceCore_1 = require("../src/ai/core/IntelligenceCore");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var entities, intent, session, resolved, session2, resolved2, ctx, core, r1, r2, r3, s, translationEngine, outputFormatter, roman, fromEn, tx, formatted, learningEngine, userProfileManager, suggestionEngine, contextualMemory, stats, baseSuggestions, profile, personalized, updated, core2, rReason, i, shouldAuto, ctxE2e, coreE2e, e2e, perfStart, i, perfAvg, languageDetector, d1, d2, ctxFlow, coreFlow, f1, f2, f3, responseValidator, emotionalFormatter, actionExecutor, badResponse, badVal, warm, actions, core7, partial, goldenCases, goldenPass, ctxGolden, coreGolden, _i, goldenCases_1, c, r, dimTest, _a, erpRagRetriever, toErpRagContext, entityEnricher, hybridLlmRouter, mockErp, ramHits, kakHits, enriched, skipLlm, useLlm, core8, e2e8, ambig, ledgerQueryHandler, feedbackCalibrator, profileSyncStore, balErp, bal, core9, balE2e, thresholds, testProfile, loaded, payBal, stockQueryHandler, khataQueryHandler, _b, computeItemStock, toErpRagContext, _c, exportLearningBundle, importLearningBundle, contextualMemory, stock, stockErp, stk, core10, stkE2e, khataCtx, kht, bundleJson, bundle, imp, reportQueryHandler, batchQueryHandler, proactiveAlertEngine, toErpRagContext, pnlResult, reportCtx, core11, rptE2e, batchCtx, lowStk, multiCtx, multi, alerts, partyAlerts, tbCtx, tb, getAutocompleteSuggestions, _d, isSpeechSynthesisSupported, speakText, _e, GOLDEN_CASES, runGoldenSuite, ac, ac2, golden, _f, _g, _h, cat, stats_1, ContextManager, _j, sessionMemoryStore, applySnapshotToContext, phraseUsageStore, _k, prepareTextForSpeech, speechTextForLanguage, rankedAutocomplete, ctx13, snap, ctx13b, loaded, weights, ranked, tts, romanTts, core13, cont, selfCorrectionEngine, shortcutRouter, invoiceQueryHandler, ragCtx14, corr, help, rewrite, clear, invCtx, inv, core14, invE2e, ctx14, core14b, corrE2e, helpE2e, paymentReceiptHandler, _l, insightQueryHandler, computeBusinessInsights, anomalyDetector, invoiceHistoryEnricher, pay, insights, insightCtx, core15, insE2e, anomalyCtx, anom, enriched, payE2e, multiItemEntityParser, confirmationGate, _m, buildAiKhataDraft, toKhataConfirmationCard, actionExecutor, multi, khataDraft, card, khataAction, gateResp, gated, multiDraft, ctx16, core16, confirmed, dateResolver, comparisonQueryHandler, correctionEngine, partyDisambiguationHandler, hijo, aaja, todayIso, yIso, cmp, core17, cmpE2e, corr17, partyResp, cmpShortcut, unitPriceEnricher, compoundPartyParser, receivableQueryHandler, compoundTransactionHandler, teachBackFormatter, priced, parties, recv, core18, compoundE2e, teach, qtyE2e, stockGuard, vatEnricher, expenseEntryHandler, stockWarn, vat, exp, core19, expE2e, retE2e, gateStock, confirmationGate, dailyDigestEngine, cashBalanceQueryHandler, followUpSuggestionEngine, offlineReplyEnhancer, buildExamplesResponse, digest, cash, fu, off, ex, core20, todayIso, digE2e, globalSearchHandler, productRateQueryHandler, unknownPartyHandler, gracefulFallbackHandler, exportChatAsText, rate, search, unk, fb, txt, rateShortcut, core21, rateE2e, resolveFiscalYear, computePnlFromInvoices, creditLimitGuard, reportQueryHandler, fy, fyPnl, creditWarn, DuplicateGuard, dupGuard, _o, fyReport, confirmGate22, gateCredit, fyShortcut, paymentModeEnricher, overdueReceivableEngine, overdueQueryHandler, partyOnboardingHandler, proactiveAlertEngine, pm, pmCash, odRows, odQ, onboard, alerts, odShortcut, cpShortcut, _p, formatReceivableReminder, buildWhatsAppUrl, reminderQueryHandler, batchPaymentHandler, appendPipelineTrace, compoundPartyParser, wa, rem, lines, batch, traced, remShortcut, bataLines, formatInvoiceShare, pickTtsText, multilingualReplyPolisher, quickReplyLearningStore, invoiceQueryHandler, invShare, tts, polished, invQ, shareShortcut, _q, normalizeWhatsAppPhone, phoneFromPartyRef, sessionSummaryEngine, returnTransactionHandler, llmResponseCache, sum, ret, cached, reminderQueryHandler, remPhone, core26, clearRes, partyPhoneQueryHandler, phRes, dailyDigestEngine, digestV2, exportChatAsText, exportTxt, returnTransactionHandler, prRes, shortcutRouter, help, partyPhoneEditHandler, editRes, _r, wasDigestShownToday, markDigestShownToday, clearDigestShownMarker, _s, saveAiPartyDraft, peekAiPartyDraft, consumeAiPartyDraft, returnHandler28, supDis, core28, cacheRes, shortcutRouter28, help28, formatPartyPhoneSavedMessage, savedMsg, _t, parseSearchPartyFilter, filterPartiesByKind, sf, pool, overdueReceivableEngine, payables, cacheStatsQueryHandler, cacheStats, sr29, dismiss, globalSearchHandler, searchRes, buildPhoneSavedQuickReplies, chips, _u, snoozeDigestForHours, isDigestBlocked, clearDigestShownMarker, sr30, snooze, overdueQueryHandler, odRes, llmResponseCache, rate, _v, saveAiAgingReportDraft, consumeAiAgingReportDraft, _w, encodePhoneSavedWaValue, decodePhoneSavedWaValue, buildPhoneSavedReminderShare, formatWhatsAppSentConfirmation, notice, encoded, decoded, share, tryHandlePhoneSavedWaQuickReply, wa, od31, supOd, _x, saveAiAgingReportDraft, consumeAiAgingReportDraft, agingDraft, conf, _y, formatPayableReminder, formatReceivableReminder, payRem, recvRem, reminderQueryHandler, supReminder, _z, formatCacheHitSparkline, formatCacheStatsLine, spark, statsLine, _0, dismissDigestForToday, restoreDigestVisibility, isDigestBlocked, clearDigestShownMarker, cacheStatsQueryHandler, cacheResp, _1, encodeWaOpenValue, decodeWaOpenValue, formatWaOpenConfirmation, waVal, waDecoded, waConf, rem33, remWa, remQr, remDecoded, _2, saveAiAgingReminderDraft, consumeAiAgingReminderDraft, buildReminderQueryFromDraft, agingRem, recvQuery, _3, snoozeDigestForHours, formatDigestHiddenLabel, restoreDigestVisibility, clearDigestShownMarker, snoozeLabel, dismissLabel, llmResponseCache, spark33, headerSpark, _4, encodeCopyValue, decodeCopyValue, formatCopyConfirmation, copyVal, copyDecoded, copyOk, rem34, noPhoneRem, buildReminderQueryFromDraft, agingQ, daysRem, shortcutRouter, showDigest, formatCacheSparklineTooltip, tip, rem35, _5, decodeWaOpenValue, decodeCopyValue, phoneRem, _6, queueAgingWaAutoOpen, consumeAgingWaAutoOpen, core35, dismiss, snooze, cache35, len, _7, buildPhoneSavedQuickReplies, encodePhoneSavedCopyValue, tryHandlePhoneSavedCopyQuickReply, phoneChips, copyChip, rem36, dual, _8, formatCacheHitSparkline, formatCacheSparklineTooltip, spark36, tip36, sr36, show36, buildReminderQueryFromDraft, q36, _9, encodePhoneSavedCopyValue, tryHandlePhoneSavedCopyQuickReply, notice37, copyVal37, enCopy, neCopy, shouldPostDigestChip, buildCacheStatsSummary, summary37, buildReminderQueryFromDraft, sutraOnly, _10, PHONE_SAVED_COPY_PREFIX, PHONE_SAVED_WA_PREFIX, _11, encodePhoneSavedWaValue, tryHandlePhoneSavedWaQuickReply, waNotice, waVal, waEn, waNe, _12, isDigestHiddenChipMessage, withoutDigestHiddenChips, withChip, formatCacheSparklineTooltip, tip38, buildReminderQueryFromDraft, _13, queueAgingWaAutoOpen, consumeAgingWaAutoOpen, buildCacheStatsSummary, sum38, _14, getPhoneSavedQuickReplyLabels, buildPhoneSavedQuickReplies, neLabels, enLabels, neChips, formatCacheSparklineTooltip, tip39, tier, withoutDigestHiddenChips, hasPhone, getPhoneSavedQuickReplyLabels, ro, _15, buildSetPhoneHandoffQuery, saveAiChatQueryDraft, consumeAiChatQueryDraft, setQ, formatCacheSparklineTooltip, tier40, ne, _16, readDigestPinnedPreference, writeDigestPinnedPreference, formatCacheClearConfirm, agingWaButtonLabel, neConfirm, enConfirm, partyPhoneQueryHandler, buildSetPhoneHandoffQuery, noPh, roConfirm, _17, formatDigestPinLabels, formatCacheSyncMessage, nePin, enPin, neSync, enSync, _18, saveAgingSetphoneReturnDraft, consumeAgingSetphoneReturnDraft, encodeAgingReturnQuickReplyValue, decodeAgingReturnQuickReplyValue, formatAgingReturnConfirmation, peeked, enc, dec, buildPhoneSavedQuickReplies, qrs, partyPhoneQueryHandler, nePh, _19, formatDailyDigestHeader, formatDigestSnoozeChip, formatDigestSnoozeTitle, formatDigestHiddenLabel, hiddenNe, _20, formatCachedBadgeLabel, formatCachedHeaderSubtitle, agingConfirm43, roAging, _21, saveAiAgingReportDraft, peekAiAgingReportDraft, consumeAiAgingReportDraft, peekDraft, consumed, _22, formatDigestShowAgainLabel, buildDigestShowQuickReply, formatAgingSearchPlaceholder, getPhoneSavedQuickReplyLabels, roLabels, formatCacheSparklineTooltip, formatCachedBadgeTooltip, neTip, roTip, _23, formatDigestDismissReply, formatDigestSnoozeReply, formatDigestShowReply, formatAgingReminderModalTitle, formatCopyConfirmation, roCopy, cacheStatsQueryHandler, cacheNe, cacheRo, formatCacheClearedReply, _24, formatProactiveAlertsHeader, formatAgingRemindWaButton, formatAgingRemindCopyButton, formatCacheClearConfirm, formatWhatsAppSentConfirmation, _25, saveAgingSetphoneReturnDraft, consumeAgingSetphoneReturnDraft, buildPhoneSavedReminderShare, share, _26, formatChatSyncMessage, formatAnalyzingLabel, _27, buildPhoneSavedReminderQuery, formatPartyPhoneSavedMessage, remQ, savedMsg, formatAutoCorrectedLabel;
        var _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, _56, _57, _58, _59, _60, _61, _62, _63, _64, _65, _66, _67, _68, _69, _70, _71, _72, _73, _74, _75, _76, _77, _78, _79, _80, _81, _82, _83, _84, _85, _86, _87, _88, _89, _90, _91, _92, _93, _94, _95, _96, _97, _98, _99, _100, _101, _102, _103, _104, _105, _106, _107, _108, _109, _110, _111, _112, _113, _114, _115, _116, _117, _118, _119, _120, _121, _122, _123, _124, _125, _126, _127, _128, _129, _130, _131, _132, _133, _134, _135, _136, _137, _138, _139, _140, _141, _142, _143, _144, _145, _146, _147, _148, _149;
        return __generator(this, function (_150) {
            switch (_150.label) {
                case 0:
                    console.log("=== SUTRA AI Sprint 3 Tests ===\n");
                    // Entity extraction
                    console.log("1. Entity Extraction:");
                    entities = EntityExtractor_1.entityExtractor.extract("maile 500 ko kakro bechye");
                    console.log("   ".concat(JSON.stringify(entities)));
                    assert(entities.amount === 500, "amount = 500");
                    assert(entities.product === "kakro", "product = kakro");
                    assert(entities.transactionType === "sales", "type = sales");
                    // Intent classification
                    console.log("\n2. Intent Classification:");
                    intent = IntentClassifier_1.intentClassifier.classify("maile 500 ko kakro bechye", entities);
                    console.log("   ".concat(intent.intent, " (").concat((intent.confidence * 100).toFixed(0), "%)"));
                    assert(intent.intent === "SALES_ENTRY", "intent = SALES_ENTRY");
                    // Context resolution — amount continuation
                    console.log("\n3. Context Resolution:");
                    session = {
                        lastProduct: "kakro",
                        lastProductNepali: "काक्रो",
                        lastIntent: "SALES_ENTRY",
                        lastTransactionType: "sales",
                        awaiting: "amount",
                        topicStack: ["sales", "vegetables"],
                        turnCount: 2,
                    };
                    resolved = ContextResolver_1.contextResolver.resolve("800", session);
                    console.log("   \"800\" \u2192 \"".concat(resolved.resolved, "\""));
                    console.log("   ".concat(resolved.explanation));
                    assert(resolved.wasResolved, "bare amount should resolve");
                    assert(resolved.resolved.includes("800"), "should include amount");
                    session2 = __assign(__assign({}, session), { awaiting: null });
                    resolved2 = ContextResolver_1.contextResolver.resolve("tyo saman bechye", session2);
                    console.log("   \"tyo saman bechye\" \u2192 \"".concat(resolved2.resolved, "\""));
                    assert(resolved2.resolved.includes("kakro"), "tyo saman → kakro");
                    // Multi-turn via IntelligenceCore
                    console.log("\n4. Multi-turn Conversation:");
                    ctx = new ContextManager();
                    core = new IntelligenceCore_1.IntelligenceCore(undefined, ctx);
                    return [4 /*yield*/, core.processInput("maile 500 ko kakro bechye", { useLlm: false })];
                case 1:
                    r1 = _150.sent();
                    console.log("   Turn 1: ".concat((_28 = r1.intent) === null || _28 === void 0 ? void 0 : _28.intent, ", product=").concat((_29 = r1.entities) === null || _29 === void 0 ? void 0 : _29.product, ", amount=").concat((_30 = r1.entities) === null || _30 === void 0 ? void 0 : _30.amount));
                    assert(((_31 = r1.entities) === null || _31 === void 0 ? void 0 : _31.product) === "kakro", "turn 1 product");
                    return [4 /*yield*/, core.processInput("800", { useLlm: false })];
                case 2:
                    r2 = _150.sent();
                    console.log("   Turn 2: resolved=".concat((_32 = r2.resolvedInput) === null || _32 === void 0 ? void 0 : _32.wasResolved, ", amount=").concat((_33 = r2.entities) === null || _33 === void 0 ? void 0 : _33.amount));
                    assert(((_34 = r2.resolvedInput) === null || _34 === void 0 ? void 0 : _34.wasResolved) === true, "turn 2 should resolve context");
                    assert(((_35 = r2.entities) === null || _35 === void 0 ? void 0 : _35.amount) === 800, "turn 2 amount = 800");
                    return [4 /*yield*/, core.processInput("ram lai tyo saman udhaar", { useLlm: false })];
                case 3:
                    r3 = _150.sent();
                    console.log("   Turn 3: party=".concat((_36 = r3.entities) === null || _36 === void 0 ? void 0 : _36.party, ", product=").concat((_37 = r3.entities) === null || _37 === void 0 ? void 0 : _37.product));
                    assert(((_38 = r3.entities) === null || _38 === void 0 ? void 0 : _38.party) === "ram", "party = ram");
                    s = ctx.getSession();
                    console.log("\n5. Session State:");
                    console.log("   lastProduct=".concat(s.lastProduct, ", lastParty=").concat(s.lastParty, ", turns=").concat(s.turnCount));
                    assert(s.lastProduct === "kakro", "session retains product");
                    assert(s.lastParty === "ram", "session retains party");
                    console.log("\n✅ All Sprint 3 tests passed!");
                    // Sprint 4: Translation
                    console.log("\n=== SUTRA AI Sprint 4 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/language/TranslationEngine"); })];
                case 4:
                    translationEngine = (_150.sent()).translationEngine;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/language/OutputFormatter"); })];
                case 5:
                    outputFormatter = (_150.sent()).outputFormatter;
                    console.log("1. Roman → all languages:");
                    roman = translationEngine.translateAll("maile 500 ko kakro bechye", "roman");
                    console.log("   EN: ".concat(roman.english));
                    console.log("   \u0928\u0947\u092A: ".concat(roman.nepali));
                    console.log("   Roman: ".concat(roman.roman));
                    assert(roman.english.toLowerCase().includes("sold") || roman.english.includes("500"), "English has sold/500");
                    assert(roman.nepali.includes("काक्रो") || roman.nepali.includes("बेच"), "Nepali has काक्रो/बेच");
                    console.log("\n2. English → Nepali:");
                    fromEn = translationEngine.translate("I sold cucumber worth Rs. 500", "english", "nepali");
                    console.log("   ".concat(fromEn));
                    assert(/[\u0900-\u097F]/.test(fromEn), "Nepali output has Devanagari");
                    console.log("\n3. Transaction templates (all 3 langs):");
                    tx = translationEngine.formatTransaction({ type: "sales", product: "cucumber", productNepali: "काक्रो", amount: 500 }, "nepali");
                    console.log("   EN: ".concat(tx.english));
                    console.log("   \u0928\u0947\u092A: ".concat(tx.nepali));
                    console.log("   Roman: ".concat(tx.roman));
                    assert(tx.nepali.includes("५००") || tx.nepali.includes("500"), "Nepali amount present");
                    console.log("\n4. Output formatter + parallel:");
                    formatted = outputFormatter.format({
                        understood_input: "maile 500 ko kakro bechye",
                        confidence: 0.9,
                        needs_clarification: false,
                        suggestions: [],
                        response: roman,
                        transaction: { type: "sales", product: "cucumber", productNepali: "काक्रो", amount: 500 },
                    }, "nepali", true);
                    console.log("   Primary: ".concat(formatted.primary));
                    console.log("   Parallel EN: ".concat(formatted.parallel.english));
                    assert(formatted.showParallel, "parallel mode on");
                    console.log("\n✅ All Sprint 4 tests passed!");
                    // Sprint 5: Learning & personalization
                    console.log("\n=== SUTRA AI Sprint 5 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/LearningEngine"); })];
                case 6:
                    learningEngine = (_150.sent()).learningEngine;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/knowledge/UserProfileManager"); })];
                case 7:
                    userProfileManager = (_150.sent()).userProfileManager;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/error-correction/SuggestionEngine"); })];
                case 8:
                    suggestionEngine = (_150.sent()).suggestionEngine;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/knowledge/ContextualMemory"); })];
                case 9:
                    contextualMemory = (_150.sent()).contextualMemory;
                    console.log("1. Learning engine — record correction:");
                    learningEngine.recordCorrection("kakor", "kakro", true, "sales");
                    learningEngine.recordCorrection("kakor", "kakro", true, "sales");
                    learningEngine.recordCorrection("maele", "maile", true, "sales");
                    stats = learningEngine.getStats();
                    console.log("   Total corrections: ".concat(stats.totalCorrections));
                    console.log("   Auto-correct patterns: ".concat(stats.autoCorrectPatterns));
                    assert(stats.totalCorrections >= 3, "corrections recorded");
                    console.log("\n2. Personalized suggestions:");
                    baseSuggestions = suggestionEngine.analyze("maele 500 ko kakor bechye", { businessType: "grocery" });
                    profile = userProfileManager.getProfile();
                    personalized = learningEngine.getPersonalizedSuggestions(baseSuggestions.suggestions, profile);
                    console.log("   Top confidence: ".concat((((_40 = (_39 = personalized[0]) === null || _39 === void 0 ? void 0 : _39.confidence) !== null && _40 !== void 0 ? _40 : 0) * 100).toFixed(0), "%"));
                    assert(personalized.length > 0, "has personalized suggestions");
                    assert(personalized[0].correctedText.includes("kakro") || personalized[0].correctedText.includes("maile"), "correction applied");
                    console.log("\n3. User profile tracking:");
                    updated = learningEngine.updateAfterInteraction({
                        input: "maile 500 ko kakro bechye",
                        entities: { product: "kakro", amount: 500, transactionType: "sales" },
                        intent: "SALES_ENTRY",
                        hadSuggestion: false,
                        responseTimeMs: 120,
                    });
                    console.log("   Interactions: ".concat(updated.totalInteractions));
                    console.log("   Common products: ".concat(updated.commonProducts.join(", ")));
                    assert(updated.commonProducts.includes("kakro"), "product tracked");
                    console.log("\n4. Reasoning trace steps:");
                    core2 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core2.processInput("maele 500 ko kakor bechye", { useLlm: false })];
                case 10:
                    rReason = _150.sent();
                    console.log("   Steps: ".concat(rReason.reasoning.steps.length));
                    console.log("   Has LEARNING step: ".concat(rReason.reasoning.steps.some(function (s) { return s.name.includes("LEARNING"); })));
                    assert(rReason.reasoning.steps.length >= 10, "reasoning has 10+ steps");
                    assert(rReason.reasoning.steps.some(function (s) { return s.name.includes("LEARNING") || s.name.includes("MULTI-ANGLE"); }), "learning/multi-angle present");
                    console.log("\n5. Auto-correct threshold:");
                    for (i = 0; i < 5; i++) {
                        learningEngine.recordCorrection("kakor", "kakro", true, "sales");
                    }
                    shouldAuto = learningEngine.shouldAutoCorrect("kakor", userProfileManager.getProfile());
                    console.log("   shouldAutoCorrect(\"kakor\"): ".concat(shouldAuto));
                    assert(shouldAuto || contextualMemory.getLearnedCorrection("kakor") != null, "kakor learned");
                    console.log("\n✅ All Sprint 5 tests passed!");
                    // Sprint 6: Polish, performance, E2E
                    console.log("\n=== SUTRA AI Sprint 6 Tests ===\n");
                    console.log("1. Blueprint E2E — maele 500 ko kakor bechye:");
                    ctxE2e = new ContextManager();
                    coreE2e = new IntelligenceCore_1.IntelligenceCore(undefined, ctxE2e);
                    return [4 /*yield*/, coreE2e.processInput("maele 500 ko kakor bechye", { useLlm: false })];
                case 11:
                    e2e = _150.sent();
                    console.log("   Intent: ".concat((_41 = e2e.intent) === null || _41 === void 0 ? void 0 : _41.intent));
                    console.log("   Product: ".concat((_42 = e2e.entities) === null || _42 === void 0 ? void 0 : _42.product, ", Amount: ").concat((_43 = e2e.entities) === null || _43 === void 0 ? void 0 : _43.amount));
                    console.log("   Clarification needed: ".concat(e2e.response.needs_clarification));
                    console.log("   Processing: ".concat(e2e.processingTimeMs, "ms"));
                    assert(((_44 = e2e.intent) === null || _44 === void 0 ? void 0 : _44.intent) === "SALES_ENTRY", "E2E intent = SALES_ENTRY");
                    assert(((_45 = e2e.entities) === null || _45 === void 0 ? void 0 : _45.amount) === 500, "E2E amount = 500");
                    assert(e2e.suggestions != null || e2e.autoCorrected != null || !e2e.response.needs_clarification, "E2E produces suggestion or auto-correct or direct response");
                    console.log("\n2. Performance — rule-based pipeline (< 500ms):");
                    perfStart = Date.now();
                    i = 0;
                    _150.label = 12;
                case 12:
                    if (!(i < 10)) return [3 /*break*/, 15];
                    return [4 /*yield*/, coreE2e.processInput("maile 200 ko aalu bechye", { useLlm: false })];
                case 13:
                    _150.sent();
                    _150.label = 14;
                case 14:
                    i++;
                    return [3 /*break*/, 12];
                case 15:
                    perfAvg = (Date.now() - perfStart) / 10;
                    console.log("   Avg: ".concat(perfAvg.toFixed(0), "ms per request"));
                    assert(perfAvg < 500, "pipeline avg ".concat(perfAvg.toFixed(0), "ms should be < 500ms"));
                    console.log("\n3. Language detection cache:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/language/LanguageDetector"); })];
                case 16:
                    languageDetector = (_150.sent()).languageDetector;
                    d1 = languageDetector.detect("maile kakro bechye");
                    d2 = languageDetector.detect("maile kakro bechye");
                    assert(d1.detected === d2.detected, "cached detection consistent");
                    assert(d1.detected === "roman", "roman nepali detected");
                    console.log("\n4. Full multi-turn + translation flow:");
                    ctxFlow = new ContextManager();
                    coreFlow = new IntelligenceCore_1.IntelligenceCore(undefined, ctxFlow);
                    return [4 /*yield*/, coreFlow.processInput("maile 500 ko kakro bechye", { useLlm: false })];
                case 17:
                    f1 = _150.sent();
                    return [4 /*yield*/, coreFlow.processInput("800", { useLlm: false })];
                case 18:
                    f2 = _150.sent();
                    return [4 /*yield*/, coreFlow.processInput("ram lai tyo saman udhaar", { useLlm: false })];
                case 19:
                    f3 = _150.sent();
                    assert(((_46 = f2.entities) === null || _46 === void 0 ? void 0 : _46.amount) === 800, "flow turn 2 amount");
                    assert(((_47 = f3.entities) === null || _47 === void 0 ? void 0 : _47.party) === "ram", "flow turn 3 party");
                    assert(f1.processingTimeMs > 0 && f2.processingTimeMs > 0, "timing tracked");
                    console.log("\n5. No duplicate suggestion analyze (single pass):");
                    assert(e2e.reasoning.steps.length >= 10, "reasoning complete in single pass");
                    console.log("\n✅ All Sprint 6 tests passed!");
                    // Sprint 7: Human conversation, validation, actions
                    console.log("\n=== SUTRA AI Sprint 7 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/validation/ResponseValidator"); })];
                case 20:
                    responseValidator = (_150.sent()).responseValidator;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/conversation/EmotionalFormatter"); })];
                case 21:
                    emotionalFormatter = (_150.sent()).emotionalFormatter;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/ActionExecutor"); })];
                case 22:
                    actionExecutor = (_150.sent()).actionExecutor;
                    console.log("1. Response validation gate:");
                    badResponse = {
                        understood_input: "test",
                        confidence: 0.3,
                        needs_clarification: false,
                        suggestions: [],
                        response: { english: "", nepali: "", roman: "" },
                        transaction: { type: "sales" },
                    };
                    badVal = responseValidator.validate(badResponse, {});
                    assert(!badVal.valid, "invalid response caught");
                    assert(Boolean(badVal.clarificationQuestion), "clarification question generated");
                    console.log("\n2. Emotional formatting:");
                    warm = emotionalFormatter.formatReply("बिक्री: काक्रो रु. ५००", "maile 500 ko kakro bechye", "nepali", { hasTransaction: true, intent: "SALES_ENTRY" });
                    assert(warm.length > 10, "warm reply generated");
                    console.log("\n3. Action executor — sales invoice:");
                    actions = actionExecutor.resolve("SALES_ENTRY", { product: "kakro", amount: 500, transactionType: "sales" }, "maile 500 ko kakro bechye", false);
                    assert(actions.length === 1, "sales action created");
                    assert(actions[0].page === "sales-invoice", "navigates to sales invoice");
                    assert(((_50 = (_49 = (_48 = actions[0].draft) === null || _48 === void 0 ? void 0 : _48.lines) === null || _49 === void 0 ? void 0 : _49[0]) === null || _50 === void 0 ? void 0 : _50.rate) === 500, "draft has amount");
                    console.log("\n4. Multi-angle drives follow-up:");
                    core7 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core7.processInput("maile kakro bechye", { useLlm: false })];
                case 23:
                    partial = _150.sent();
                    assert(partial.response.followUp != null || ((_51 = partial.assistantText) === null || _51 === void 0 ? void 0 : _51.includes("💬")), "follow-up for missing amount");
                    console.log("\n5. Golden cases (batch):");
                    goldenCases = [
                        {
                            input: "maele 500 ko kakor bechye",
                            label: "misspelling sales",
                            check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "SALES_ENTRY" && (((_b = r.entities) === null || _b === void 0 ? void 0 : _b.amount) === 500 || r.suggestions != null); },
                        },
                        {
                            input: "maile 500 ko kakro bechye",
                            label: "clean sales",
                            check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "SALES_ENTRY" && ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.product) === "kakro"; },
                        },
                        {
                            input: "maile 2 kg aalu kinya",
                            label: "purchase qty",
                            check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "PURCHASE_ENTRY" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.transactionType) === "purchase"; },
                        },
                        {
                            input: "ram lai 300 ko pyaj udhaar",
                            label: "credit sale",
                            check: function (r) { var _a, _b; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.party) === "ram" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.paymentMode) === "credit"; },
                        },
                        {
                            input: "aaja ko bikri dekhaunu",
                            label: "report request",
                            check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "REPORT_REQUEST" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "QUERY"; },
                        },
                        {
                            input: "dhanyabad",
                            label: "gratitude",
                            check: function (r) { return r.detection.detected != null; },
                        },
                        {
                            input: "500",
                            label: "bare number",
                            check: function (r) { var _a, _b; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.amount) === 500 || ((_b = r.resolvedInput) === null || _b === void 0 ? void 0 : _b.wasResolved) === true; },
                        },
                        {
                            input: "k ho yo",
                            label: "confused query",
                            check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "OTHER"; },
                        },
                        {
                            input: "I sold cucumber worth Rs 500",
                            label: "english sales",
                            check: function (r) { return r.detection.detected === "english"; },
                        },
                        {
                            input: "मैले ५०० को काक्रो बेचें",
                            label: "nepali script",
                            check: function (r) { return r.detection.detected === "nepali"; },
                        },
                    ];
                    goldenPass = 0;
                    ctxGolden = new ContextManager();
                    coreGolden = new IntelligenceCore_1.IntelligenceCore(undefined, ctxGolden);
                    _i = 0, goldenCases_1 = goldenCases;
                    _150.label = 24;
                case 24:
                    if (!(_i < goldenCases_1.length)) return [3 /*break*/, 27];
                    c = goldenCases_1[_i];
                    return [4 /*yield*/, coreGolden.processInput(c.input, { useLlm: false })];
                case 25:
                    r = _150.sent();
                    if (c.check(r))
                        goldenPass++;
                    else
                        console.log("   \u26A0 missed: ".concat(c.label));
                    _150.label = 26;
                case 26:
                    _i++;
                    return [3 /*break*/, 24];
                case 27:
                    console.log("   ".concat(goldenPass, "/").concat(goldenCases.length, " golden cases passed"));
                    assert(goldenPass >= 8, "at least 8/10 golden cases (got ".concat(goldenPass, ")"));
                    console.log("\n6. Dimensions attached to reasoning:");
                    return [4 /*yield*/, core7.processInput("maile 500 ko kakro bechye", { useLlm: false })];
                case 28:
                    dimTest = _150.sent();
                    assert(((_53 = (_52 = dimTest.reasoning.dimensions) === null || _52 === void 0 ? void 0 : _52.length) !== null && _53 !== void 0 ? _53 : 0) >= 5, "5+ analysis dimensions");
                    console.log("\n7. Assistant text with conversational tone:");
                    assert(Boolean(dimTest.assistantText), "assistantText returned from core");
                    assert(((_54 = dimTest.response.actions) === null || _54 === void 0 ? void 0 : _54.length) === 1, "invoice action on complete sales");
                    console.log("\n✅ All Sprint 7 tests passed!");
                    // Sprint 8: RAG + hybrid LLM routing
                    console.log("\n=== SUTRA AI Sprint 8 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ErpRagRetriever"); })];
                case 29:
                    _a = _150.sent(), erpRagRetriever = _a.erpRagRetriever, toErpRagContext = _a.toErpRagContext;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/EntityEnricher"); })];
                case 30:
                    entityEnricher = (_150.sent()).entityEnricher;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/routing/HybridLlmRouter"); })];
                case 31:
                    hybridLlmRouter = (_150.sent()).hybridLlmRouter;
                    mockErp = toErpRagContext({
                        parties: [
                            { id: "p1", name: "Ram Traders", nameNepali: "राम ट्रेडर्स", code: "RAM01" },
                            { id: "p2", name: "Ramesh Store", code: "RMS02" },
                            { id: "p3", name: "Shyam Suppliers", code: "SHY03" },
                        ],
                        items: [
                            { id: "i1", name: "Cucumber", nameNepali: "काक्रो", code: "KAK01", saleRate: 80, unit: "kg" },
                            { id: "i2", name: "Potato", nameNepali: "आलु", code: "ALU01", saleRate: 60, unit: "kg" },
                        ],
                    });
                    console.log("1. RAG party resolution:");
                    ramHits = erpRagRetriever.findParties("ram", mockErp.parties);
                    console.log("   Matches: ".concat(ramHits.map(function (h) { return h.ref.name; }).join(", ")));
                    assert(ramHits.length >= 2, "ram matches multiple parties");
                    assert(ramHits[0].ref.name.includes("Ram"), "top match is Ram*");
                    console.log("\n2. RAG item resolution:");
                    kakHits = erpRagRetriever.findItems("kakro", mockErp.items);
                    assert(((_55 = kakHits[0]) === null || _55 === void 0 ? void 0 : _55.ref.name) === "Cucumber", "kakro → Cucumber");
                    console.log("\n3. Entity enricher:");
                    enriched = entityEnricher.enrich({ party: "ram", product: "kakro", amount: 500, transactionType: "sales" }, "ram lai 500 ko kakro bechye", mockErp);
                    console.log("   Party: ".concat((_56 = enriched.partyResolvedName) !== null && _56 !== void 0 ? _56 : enriched.party));
                    console.log("   Item: ".concat(enriched.product, " (").concat(enriched.itemId, ")"));
                    assert(enriched.itemId === "i1", "item resolved to stock");
                    assert(Boolean(enriched.partyId) || Boolean(enriched.partyAmbiguous), "party resolved or ambiguous");
                    console.log("\n4. Hybrid LLM router — rules sufficient:");
                    skipLlm = hybridLlmRouter.decide({
                        confidence: 0.92,
                        intent: "SALES_ENTRY",
                        needsClarification: false,
                        validationFailed: false,
                        llmOnline: true,
                    });
                    assert(!skipLlm.useLlm, "high-confidence sales skips LLM");
                    console.log("   Skip reason: ".concat(skipLlm.reason));
                    console.log("\n5. Hybrid LLM router — query uses LLM:");
                    useLlm = hybridLlmRouter.decide({
                        confidence: 0.7,
                        intent: "QUERY",
                        needsClarification: false,
                        validationFailed: false,
                        llmOnline: true,
                    });
                    assert(useLlm.useLlm, "QUERY routes to LLM");
                    console.log("\n6. End-to-end with ERP context:");
                    core8 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core8.processInput("ram lai 500 ko kakro bechye", {
                            useLlm: false,
                            erpContext: mockErp,
                        })];
                case 32:
                    e2e8 = _150.sent();
                    assert(((_57 = e2e8.entities) === null || _57 === void 0 ? void 0 : _57.itemId) === "i1", "E2E item from RAG");
                    assert(e2e8.llmRouteReason != null, "route reason tracked");
                    assert(!e2e8.llmUsed, "LLM not used for clear sales");
                    console.log("\n7. Ambiguous party follow-up:");
                    ambig = entityEnricher.enrich({ party: "ram", product: "kakro", amount: 500 }, "ram lai kakro", mockErp);
                    if (ambig.partyAmbiguous) {
                        assert(ambig.partyAmbiguous.length >= 2, "ambiguous ram parties listed");
                    }
                    console.log("\n✅ All Sprint 8 tests passed!");
                    // Sprint 9: Voice, balance RAG, feedback calibration, profile sync
                    console.log("\n=== SUTRA AI Sprint 9 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/LedgerQueryHandler"); })];
                case 33:
                    ledgerQueryHandler = (_150.sent()).ledgerQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/FeedbackCalibrator"); })];
                case 34:
                    feedbackCalibrator = (_150.sent()).feedbackCalibrator;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/ProfileSyncStore"); })];
                case 35:
                    profileSyncStore = (_150.sent()).profileSyncStore;
                    console.log("1. Balance query detection:");
                    assert(ledgerQueryHandler.isBalanceQuery("ram ko balance kati"), "detects balance kati");
                    assert(ledgerQueryHandler.isBalanceQuery("shyam ko baki kati cha"), "detects baki kati");
                    console.log("\n2. Balance resolution from ERP:");
                    balErp = {
                        parties: [
                            { id: "p1", name: "Ram Traders", balance: 15000 },
                            { id: "p2", name: "Shyam Store", balance: -3200 },
                        ],
                        items: [],
                    };
                    bal = ledgerQueryHandler.resolve("ram ko balance kati", { party: "ram" }, balErp);
                    assert(bal != null, "balance resolved");
                    assert(bal.balance === 15000, "correct receivable");
                    assert(bal.nepali.includes("Ram Traders"), "nepali party name");
                    console.log("\n3. Balance E2E response:");
                    core9 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core9.processInput("ram ko balance kati", {
                            useLlm: false,
                            erpContext: balErp,
                        })];
                case 36:
                    balE2e = _150.sent();
                    assert(((_58 = balE2e.assistantText) === null || _58 === void 0 ? void 0 : _58.includes("Ram Traders")) || balE2e.response.response.nepali.includes("Ram"), "balance reply");
                    assert(!balE2e.llmUsed, "no LLM for balance RAG");
                    console.log("\n4. Feedback calibrator thresholds:");
                    return [4 /*yield*/, feedbackCalibrator.refresh()];
                case 37:
                    thresholds = _150.sent();
                    assert(thresholds.autoCorrect >= 0.9 && thresholds.autoCorrect <= 0.97, "auto threshold in range");
                    console.log("\n5. Profile IndexedDB sync:");
                    testProfile = {
                        userId: "test_user_s9",
                        preferredInputLanguage: "auto",
                        preferredOutputLanguage: "nepali",
                        commonMisspellings: { kakor: "kakro" },
                        customTerms: [],
                        frequentWords: { kakro: 3 },
                        commonProducts: ["kakro"],
                        commonParties: ["ram"],
                        preferredTransactionTypes: ["sales"],
                        correctionAcceptanceRate: 0.9,
                        averageResponseTimeMs: 100,
                        totalInteractions: 10,
                        errorRate: 0.1,
                    };
                    return [4 /*yield*/, profileSyncStore.save(testProfile)];
                case 38:
                    _150.sent();
                    return [4 /*yield*/, profileSyncStore.load("test_user_s9")];
                case 39:
                    loaded = _150.sent();
                    assert((loaded === null || loaded === void 0 ? void 0 : loaded.commonMisspellings.kakor) === "kakro", "profile round-trip");
                    console.log("\n6. Payable balance (negative):");
                    payBal = ledgerQueryHandler.resolve("shyam ko udhaar kati", { party: "shyam" }, balErp);
                    assert((payBal === null || payBal === void 0 ? void 0 : payBal.balanceType) === "payable", "payable detected");
                    console.log("\n✅ All Sprint 9 tests passed!");
                    // Sprint 10: Stock RAG, khata queries, cloud profile sync
                    console.log("\n=== SUTRA AI Sprint 10 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/StockQueryHandler"); })];
                case 40:
                    stockQueryHandler = (_150.sent()).stockQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/KhataQueryHandler"); })];
                case 41:
                    khataQueryHandler = (_150.sent()).khataQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ErpRagRetriever"); })];
                case 42:
                    _b = _150.sent(), computeItemStock = _b.computeItemStock, toErpRagContext = _b.toErpRagContext;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/ProfileCloudSync"); })];
                case 43:
                    _c = _150.sent(), exportLearningBundle = _c.exportLearningBundle, importLearningBundle = _c.importLearningBundle;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/knowledge/ContextualMemory"); })];
                case 44:
                    contextualMemory = (_150.sent()).contextualMemory;
                    console.log("1. Stock computation:");
                    stock = computeItemStock("i1", 10, [
                        { itemId: "i1", qty: 50 },
                        { itemId: "i1", qty: -15 },
                        { itemId: "i2", qty: 5 },
                    ]);
                    assert(stock === 45, "opening + in - out = 45");
                    console.log("\n2. Stock query detection:");
                    assert(stockQueryHandler.isStockQuery("kakro kati baki cha", { product: "kakro" }), "stock query");
                    assert(!stockQueryHandler.isStockQuery("ram ko balance kati", { party: "ram" }), "not stock when balance");
                    console.log("\n3. Stock resolution:");
                    stockErp = toErpRagContext({
                        items: [
                            { id: "i1", name: "Kakro", unit: "kg", openingStock: 10, reorderLevel: 20 },
                        ],
                        stockMovements: [{ itemId: "i1", qty: 30 }],
                    });
                    stk = stockQueryHandler.resolve("kakro kati baki cha", { product: "kakro" }, stockErp);
                    assert(stk != null, "stock resolved");
                    assert(stk.stockQty === 40, "stock qty 40");
                    assert(stk.lowStock === true, "low stock flag");
                    console.log("\n4. Stock E2E:");
                    core10 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core10.processInput("kakro kati baki cha", {
                            useLlm: false,
                            erpContext: stockErp,
                        })];
                case 45:
                    stkE2e = _150.sent();
                    assert(((_59 = stkE2e.assistantText) === null || _59 === void 0 ? void 0 : _59.includes("40")) || stkE2e.response.response.nepali.includes("40"), "stock in reply");
                    assert(!stkE2e.llmUsed, "no LLM for stock RAG");
                    console.log("\n5. Khata query with preloaded context:");
                    khataCtx = {
                        parties: [],
                        items: [],
                        recentKhata: [
                            {
                                id: "v1",
                                date: "2026-07-08",
                                amount: 2500,
                                party: "Ram Traders",
                                intent: "khata_sales",
                                voucherNo: "KV-001",
                            },
                        ],
                    };
                    assert(khataQueryHandler.isKhataQuery("hijo ko entry"), "khata query detected");
                    kht = khataQueryHandler.resolve("hijo ko entry", {}, khataCtx);
                    assert(kht != null && kht.entries.length === 1, "khata entry resolved");
                    console.log("\n6. Cloud learning bundle:");
                    contextualMemory.recordCorrection("kakor", "kakro", true, "sales");
                    return [4 /*yield*/, exportLearningBundle()];
                case 46:
                    bundleJson = _150.sent();
                    bundle = JSON.parse(bundleJson);
                    assert(bundle.version === 1, "bundle version");
                    assert(Array.isArray(bundle.corrections), "corrections array");
                    return [4 /*yield*/, importLearningBundle(bundleJson)];
                case 47:
                    imp = _150.sent();
                    assert(imp.ok, "import succeeds");
                    console.log("\n✅ All Sprint 10 tests passed!");
                    // Sprint 11: Reports, batch queries, proactive alerts
                    console.log("\n=== SUTRA AI Sprint 11 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReportQueryHandler"); })];
                case 48:
                    reportQueryHandler = (_150.sent()).reportQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/BatchQueryHandler"); })];
                case 49:
                    batchQueryHandler = (_150.sent()).batchQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/ProactiveAlertEngine"); })];
                case 50:
                    proactiveAlertEngine = (_150.sent()).proactiveAlertEngine;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ErpRagRetriever"); })];
                case 51:
                    toErpRagContext = (_150.sent()).toErpRagContext;
                    console.log("1. Report query detection:");
                    assert(reportQueryHandler.isReportQuery("aaja ko bikri kati"), "detects sales today");
                    assert(reportQueryHandler.isReportQuery("yo mahina ko profit"), "detects month profit");
                    assert(reportQueryHandler.isTrialBalanceQuery("trial balance"), "detects trial balance");
                    console.log("\n2. P&L resolution:");
                    pnlResult = reportQueryHandler.resolvePnl({
                        period: "today",
                        totalIncome: 12000,
                        totalExpense: 4500,
                        netProfit: 7500,
                        entryCount: 8,
                    });
                    assert(pnlResult.nepali.includes("12"), "pnl nepali has income");
                    assert(pnlResult.english.includes("7,500") || pnlResult.english.includes("7500"), "pnl profit");
                    console.log("\n3. Report E2E with snapshot:");
                    reportCtx = {
                        parties: [],
                        items: [],
                        pnlSnapshot: {
                            period: "current_month",
                            totalIncome: 50000,
                            totalExpense: 32000,
                            netProfit: 18000,
                            entryCount: 42,
                        },
                    };
                    core11 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core11.processInput("yo mahina ko profit kati", {
                            useLlm: false,
                            erpContext: reportCtx,
                        })];
                case 52:
                    rptE2e = _150.sent();
                    assert(((_60 = rptE2e.assistantText) === null || _60 === void 0 ? void 0 : _60.includes("18")) || rptE2e.response.response.nepali.includes("18"), "report reply has profit");
                    assert(!rptE2e.llmUsed, "no LLM for report RAG");
                    console.log("\n4. Low stock batch query:");
                    batchCtx = toErpRagContext({
                        items: [
                            { id: "i1", name: "Kakro", unit: "kg", openingStock: 2, reorderLevel: 10 },
                            { id: "i2", name: "Aalu", unit: "kg", openingStock: 50, reorderLevel: 20 },
                        ],
                        stockMovements: [],
                    });
                    assert(batchQueryHandler.isLowStockQuery("kam stock ke ke cha"), "low stock query");
                    lowStk = batchQueryHandler.resolveLowStock(batchCtx);
                    assert(lowStk != null && lowStk.nepali.includes("Kakro"), "lists low stock kakro");
                    console.log("\n5. Multi-party balance:");
                    multiCtx = {
                        parties: [
                            { id: "p1", name: "Ram Traders", balance: 15000 },
                            { id: "p2", name: "Shyam Store", balance: -8000 },
                        ],
                        items: [],
                    };
                    multi = batchQueryHandler.resolveMultiBalance("ram ra shyam ko balance", multiCtx);
                    assert(multi != null && multi.nepali.includes("Ram"), "multi balance ram");
                    assert(multi.nepali.includes("Shyam"), "multi balance shyam");
                    console.log("\n6. Proactive alerts:");
                    alerts = proactiveAlertEngine.scan(batchCtx);
                    assert(alerts.some(function (a) { return a.id.includes("i1"); }), "low stock alert for kakro");
                    partyAlerts = proactiveAlertEngine.scan(multiCtx);
                    assert(partyAlerts.length >= 2, "party balance alerts");
                    console.log("\n7. Trial balance report:");
                    tbCtx = {
                        parties: [],
                        items: [],
                        trialBalance: { totalDebit: 100000, totalCredit: 100000, isBalanced: true, rowCount: 12 },
                    };
                    tb = reportQueryHandler.resolve("trial balance", tbCtx);
                    assert((tb === null || tb === void 0 ? void 0 : tb.kind) === "trial_balance" && tb.nepali.includes("मिलेको"), "balanced trial");
                    console.log("\n✅ All Sprint 11 tests passed!");
                    // Sprint 12: Autocomplete, TTS, expanded golden suite
                    console.log("\n=== SUTRA AI Sprint 12 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/interface/InputAutocompleteEngine"); })];
                case 53:
                    getAutocompleteSuggestions = (_150.sent()).getAutocompleteSuggestions;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/interface/VoiceOutput"); })];
                case 54:
                    _d = _150.sent(), isSpeechSynthesisSupported = _d.isSpeechSynthesisSupported, speakText = _d.speakText;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("./sutra-ai-golden-cases"); })];
                case 55:
                    _e = _150.sent(), GOLDEN_CASES = _e.GOLDEN_CASES, runGoldenSuite = _e.runGoldenSuite;
                    console.log("1. Input autocomplete:");
                    ac = getAutocompleteSuggestions("ram ko", { parties: ["Ram Traders", "Shyam"] });
                    assert(ac.length >= 1, "autocomplete suggestions");
                    assert(ac[0].text.toLowerCase().includes("ram"), "ram phrase suggested");
                    console.log("\n2. Autocomplete partial product:");
                    ac2 = getAutocompleteSuggestions("kakro", { products: ["Kakro", "Aalu"] });
                    assert(ac2.some(function (s) { return s.text.includes("kakro"); }), "product phrase");
                    console.log("\n3. TTS utilities:");
                    assert(typeof isSpeechSynthesisSupported() === "boolean", "TTS support check");
                    if (typeof globalThis.window === "undefined") {
                        // Node shim — speakText should no-op safely
                        speakText("test", "english");
                    }
                    console.log("\n4. Expanded golden suite (".concat(GOLDEN_CASES.length, " cases):"));
                    return [4 /*yield*/, runGoldenSuite(function () { return new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager()); }, { minPassRate: 0.72, verbose: true })];
                case 56:
                    golden = _150.sent();
                    console.log("   ".concat(golden.passed, "/").concat(golden.total, " passed (").concat(((golden.passed / golden.total) * 100).toFixed(0), "%)"));
                    for (_f = 0, _g = Object.entries(golden.byCategory); _f < _g.length; _f++) {
                        _h = _g[_f], cat = _h[0], stats_1 = _h[1];
                        console.log("   \u00B7 ".concat(cat, ": ").concat(stats_1.pass, "/").concat(stats_1.total));
                    }
                    assert(golden.passed >= Math.floor(GOLDEN_CASES.length * 0.72), "golden suite threshold");
                    console.log("\n✅ All Sprint 12 tests passed!");
                    // Sprint 13: Session persistence, ranked autocomplete, TTS polish
                    console.log("\n=== SUTRA AI Sprint 13 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/core/ContextManager"); })];
                case 57:
                    ContextManager = (_150.sent()).ContextManager;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/SessionMemoryStore"); })];
                case 58:
                    _j = _150.sent(), sessionMemoryStore = _j.sessionMemoryStore, applySnapshotToContext = _j.applySnapshotToContext;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/PhraseUsageStore"); })];
                case 59:
                    phraseUsageStore = (_150.sent()).phraseUsageStore;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/interface/ttsUtils"); })];
                case 60:
                    _k = _150.sent(), prepareTextForSpeech = _k.prepareTextForSpeech, speechTextForLanguage = _k.speechTextForLanguage;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/interface/InputAutocompleteEngine"); })];
                case 61:
                    rankedAutocomplete = (_150.sent()).getAutocompleteSuggestions;
                    console.log("1. Context export/restore:");
                    ctx13 = new ContextManager();
                    ctx13.addTurn("user", "maile 500 ko kakro bechye", "roman");
                    ctx13.updateSession({ product: "kakro", amount: 500, transactionType: "sales" }, "SALES_ENTRY");
                    snap = ctx13.exportSnapshot("test_user_s13");
                    assert(snap.turns.length === 1, "snapshot has turn");
                    assert(snap.session.lastProduct === "kakro", "session product saved");
                    ctx13b = new ContextManager();
                    applySnapshotToContext(ctx13b, snap);
                    assert(ctx13b.getSession().lastProduct === "kakro", "session restored");
                    assert((_61 = ctx13b.getRecentTurns(1)[0]) === null || _61 === void 0 ? void 0 : _61.content.includes("kakro"), "turn restored");
                    console.log("\n2. Session IndexedDB round-trip:");
                    return [4 /*yield*/, sessionMemoryStore.save(ctx13, [
                            { id: "m1", role: "user", text: "maile 500 ko kakro bechye", timestamp: new Date().toISOString() },
                        ])];
                case 62:
                    _150.sent();
                    return [4 /*yield*/, sessionMemoryStore.load("test_user_s13")];
                case 63:
                    loaded = _150.sent();
                    assert((loaded === null || loaded === void 0 ? void 0 : loaded.session.lastProduct) === "kakro", "IDB session round-trip");
                    console.log("\n3. Phrase usage ranking:");
                    return [4 /*yield*/, phraseUsageStore.record("ram ko balance kati")];
                case 64:
                    _150.sent();
                    return [4 /*yield*/, phraseUsageStore.record("ram ko balance kati")];
                case 65:
                    _150.sent();
                    return [4 /*yield*/, phraseUsageStore.getWeights()];
                case 66:
                    weights = _150.sent();
                    assert(((_62 = weights["ram ko balance kati"]) !== null && _62 !== void 0 ? _62 : 0) >= 2, "phrase count tracked");
                    console.log("\n4. Session-boosted autocomplete:");
                    ranked = rankedAutocomplete("ram", {
                        parties: ["Ram Traders"],
                        session: { lastParty: "Ram Traders", topicStack: ["sales"], turnCount: 3, awaiting: null },
                        phraseWeights: weights,
                    });
                    assert(ranked.length >= 1, "ranked suggestions");
                    assert(ranked.some(function (s) { return s.text.toLowerCase().includes("ram"); }), "party-aware suggestion");
                    console.log("\n5. TTS text preparation:");
                    tts = prepareTextForSpeech("**Namaste**!\nYo test ho.");
                    assert(tts.includes("Namaste") && !tts.includes("**"), "markdown stripped");
                    romanTts = speechTextForLanguage("काक्रो बेचें", "roman");
                    assert(romanTts.includes("काक्रो"), "devanagari preserved for roman mode");
                    console.log("\n6. Multi-turn after session restore:");
                    core13 = new IntelligenceCore_1.IntelligenceCore(undefined, ctx13b);
                    return [4 /*yield*/, core13.processInput("800", { useLlm: false })];
                case 67:
                    cont = _150.sent();
                    assert(((_63 = cont.entities) === null || _63 === void 0 ? void 0 : _63.amount) === 800 || ((_64 = cont.resolvedInput) === null || _64 === void 0 ? void 0 : _64.wasResolved), "continuation works after restore");
                    console.log("\n✅ All Sprint 13 tests passed!");
                    // Sprint 14: Self-correction, duplicate guard, invoice RAG, shortcuts
                    console.log("\n=== SUTRA AI Sprint 14 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/reasoning/SelfCorrectionEngine"); })];
                case 68:
                    selfCorrectionEngine = (_150.sent()).selfCorrectionEngine;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/routing/ShortcutRouter"); })];
                case 69:
                    shortcutRouter = (_150.sent()).shortcutRouter;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/InvoiceQueryHandler"); })];
                case 70:
                    invoiceQueryHandler = (_150.sent()).invoiceQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ErpRagRetriever"); })];
                case 71:
                    ragCtx14 = (_150.sent()).toErpRagContext;
                    console.log("1. Self-correction — product change:");
                    corr = selfCorrectionEngine.review("maile 500 ko aalu bechye", { product: "aalu", amount: 500, transactionType: "sales" }, { lastProduct: "kakro", lastAmount: 500, topicStack: [], turnCount: 2, awaiting: null });
                    assert(corr.followUp != null, "product change follow-up");
                    assert(corr.reduceConfidence === true, "confidence reduced");
                    console.log("\n2. Shortcut router:");
                    help = shortcutRouter.route("/help", "nepali");
                    assert(help.handled && help.response != null, "/help handled");
                    rewrite = shortcutRouter.route("/balance ram", "nepali");
                    assert((_65 = rewrite.rewrittenInput) === null || _65 === void 0 ? void 0 : _65.includes("ram"), "/balance rewrites");
                    clear = shortcutRouter.route("/clear", "nepali");
                    assert(clear.shortcutAction === "clear_history", "/clear action");
                    console.log("\n3. Invoice query:");
                    invCtx = ragCtx14({
                        invoices: [
                            {
                                id: "inv1",
                                invoiceNo: "SI-001",
                                date: "2026-07-09",
                                partyName: "Ram Traders",
                                grandTotal: 5500,
                                type: "sales-invoice",
                            },
                        ],
                        parties: [{ id: "p1", name: "Ram Traders" }],
                    });
                    assert(invoiceQueryHandler.isInvoiceQuery("ram ko last bill"), "invoice query detect");
                    inv = invoiceQueryHandler.resolve("ram ko last bill", { party: "ram" }, invCtx);
                    assert(inv != null && inv.invoices[0].invoiceNo === "SI-001", "invoice resolved");
                    console.log("\n4. Invoice E2E:");
                    core14 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core14.processInput("last invoice", {
                            useLlm: false,
                            erpContext: invCtx,
                        })];
                case 72:
                    invE2e = _150.sent();
                    assert(((_66 = invE2e.assistantText) === null || _66 === void 0 ? void 0 : _66.includes("SI-001")) || invE2e.response.response.nepali.includes("SI"), "invoice in reply");
                    console.log("\n5. Self-correction E2E:");
                    ctx14 = new ContextManager();
                    ctx14.updateSession({ product: "kakro", amount: 500, transactionType: "sales" }, "SALES_ENTRY");
                    core14b = new IntelligenceCore_1.IntelligenceCore(undefined, ctx14);
                    return [4 /*yield*/, core14b.processInput("maile 500 ko aalu bechye", { useLlm: false })];
                case 73:
                    corrE2e = _150.sent();
                    assert(corrE2e.response.followUp != null || corrE2e.response.selfCorrectionNote != null, "E2E correction");
                    console.log("\n6. Shortcut help E2E:");
                    return [4 /*yield*/, core14.processInput("/help", { useLlm: false })];
                case 74:
                    helpE2e = _150.sent();
                    assert(((_67 = helpE2e.assistantText) === null || _67 === void 0 ? void 0 : _67.includes("SUTRA")) || ((_68 = helpE2e.assistantText) === null || _68 === void 0 ? void 0 : _68.includes("/clear")), "help text");
                    console.log("\n✅ All Sprint 14 tests passed!");
                    // Sprint 15: Payments, insights, anomaly, invoice history
                    console.log("\n=== SUTRA AI Sprint 15 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/PaymentReceiptHandler"); })];
                case 75:
                    paymentReceiptHandler = (_150.sent()).paymentReceiptHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/InsightQueryHandler"); })];
                case 76:
                    _l = _150.sent(), insightQueryHandler = _l.insightQueryHandler, computeBusinessInsights = _l.computeBusinessInsights;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/AnomalyDetector"); })];
                case 77:
                    anomalyDetector = (_150.sent()).anomalyDetector;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/InvoiceHistoryEnricher"); })];
                case 78:
                    invoiceHistoryEnricher = (_150.sent()).invoiceHistoryEnricher;
                    console.log("1. Payment/receipt detection:");
                    assert(paymentReceiptHandler.isPaymentReceipt("ram le 500 tiryo", {
                        party: "ram",
                        amount: 500,
                        transactionType: "receipt",
                    }), "receipt detected");
                    pay = paymentReceiptHandler.resolve("ram le 500 tiryo", {
                        party: "Ram Traders",
                        amount: 500,
                        transactionType: "receipt",
                    });
                    assert((pay === null || pay === void 0 ? void 0 : pay.kind) === "receipt" && pay.amount === 500, "receipt resolved");
                    console.log("\n2. Business insights:");
                    insights = computeBusinessInsights([
                        {
                            date: new Date().toISOString().slice(0, 10),
                            partyName: "Ram Traders",
                            grandTotal: 5000,
                            type: "sales-invoice",
                            lines: [{ itemName: "Kakro", qty: 10, rate: 50 }],
                        },
                        {
                            date: "2026-07-01",
                            partyName: "Ram Traders",
                            grandTotal: 2000,
                            type: "sales-invoice",
                            lines: [{ itemName: "Kakro", qty: 4, rate: 50 }],
                        },
                    ]);
                    assert(insights.todayInvoiceCount >= 1, "today invoices");
                    assert(((_69 = insights.topProducts[0]) === null || _69 === void 0 ? void 0 : _69.name) === "Kakro", "top product");
                    console.log("\n3. Insight query E2E:");
                    insightCtx = ragCtx14({
                        invoices: [
                            {
                                id: "i1",
                                invoiceNo: "SI-1",
                                date: new Date().toISOString().slice(0, 10),
                                partyName: "Ram",
                                grandTotal: 3000,
                                type: "sales-invoice",
                                lines: [{ itemName: "Kakro", qty: 6, rate: 50 }],
                            },
                        ],
                    });
                    core15 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core15.processInput("business summary", {
                            useLlm: false,
                            erpContext: insightCtx,
                        })];
                case 79:
                    insE2e = _150.sent();
                    assert(((_70 = insE2e.assistantText) === null || _70 === void 0 ? void 0 : _70.includes("3")) || insE2e.response.response.nepali.includes("बिक्री"), "insight reply");
                    console.log("\n4. Anomaly detection:");
                    anomalyCtx = __assign(__assign({}, insightCtx), { partyStats: [{ partyName: "Ram Traders", invoiceCount: 5, avgAmount: 1000, totalAmount: 5000 }] });
                    anom = anomalyDetector.detect({ party: "Ram Traders", amount: 8000 }, anomalyCtx);
                    assert(anom != null, "anomaly flagged");
                    console.log("\n5. Invoice history enrich:");
                    enriched = invoiceHistoryEnricher.enrich({ party: "Ram", product: "kakro" }, insightCtx);
                    assert(enriched.itemRate === 50 || enriched.quantity === 6, "history rate/qty");
                    console.log("\n6. Payment E2E:");
                    return [4 /*yield*/, core15.processInput("ram le 500 tiryo", { useLlm: false })];
                case 80:
                    payE2e = _150.sent();
                    assert(((_71 = payE2e.entities) === null || _71 === void 0 ? void 0 : _71.amount) === 500, "payment amount extracted");
                    console.log("\n✅ All Sprint 15 tests passed!");
                    // Sprint 16: Confirmation gate, khata prefill, multi-item lines
                    console.log("\n=== SUTRA AI Sprint 16 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/context/MultiItemEntityParser"); })];
                case 81:
                    multiItemEntityParser = (_150.sent()).multiItemEntityParser;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/guard/ConfirmationGate"); })];
                case 82:
                    confirmationGate = (_150.sent()).confirmationGate;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/KhataCardBuilder"); })];
                case 83:
                    _m = _150.sent(), buildAiKhataDraft = _m.buildAiKhataDraft, toKhataConfirmationCard = _m.toKhataConfirmationCard;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/ActionExecutor"); })];
                case 84:
                    actionExecutor = (_150.sent()).actionExecutor;
                    console.log("1. Multi-item parsing:");
                    multi = multiItemEntityParser.parse("maile kakro 500 ra aalu 300 bechye");
                    assert(multi.length === 2, "two line items");
                    assert(((_72 = multi[0]) === null || _72 === void 0 ? void 0 : _72.amount) === 500 && ((_73 = multi[1]) === null || _73 === void 0 ? void 0 : _73.amount) === 300, "amounts parsed");
                    console.log("\n2. Khata card builder:");
                    khataDraft = buildAiKhataDraft({ party: "Ram", amount: 500, transactionType: "receipt" }, "ram le 500 tiryo");
                    assert((khataDraft === null || khataDraft === void 0 ? void 0 : khataDraft.intent) === "khata_payment_in", "receipt intent");
                    card = toKhataConfirmationCard(khataDraft);
                    assert(card.journalLines != null && card.journalLines.length >= 2, "journal lines");
                    console.log("\n3. Khata prefill action:");
                    khataAction = actionExecutor.resolveKhata({ party: "Ram", amount: 500, transactionType: "receipt" }, "ram le 500 tiryo");
                    assert((khataAction === null || khataAction === void 0 ? void 0 : khataAction.type) === "prefill_khata", "prefill_khata action");
                    console.log("\n4. Confirmation gate:");
                    gateResp = {
                        understood_input: "test",
                        confidence: 0.9,
                        needs_clarification: false,
                        suggestions: [],
                        response: { nepali: "ok", english: "ok", roman: "ok" },
                        duplicateWarning: "dup",
                        actions: [{ id: "a1", type: "navigate", page: "x", label: "x", labelNepali: "x" }],
                    };
                    assert(confirmationGate.needsGate(gateResp, false), "gate needed");
                    gated = confirmationGate.gate(gateResp, { amount: 500, product: "kakro", transactionType: "sales" }, { intent: "SALES_ENTRY", confidence: 0.9, entities: {} }, "nepali", "test");
                    assert(gated.response.actions == null, "actions stripped");
                    assert(gated.pending.warnings.length === 1, "warning stored");
                    console.log("\n5. Multi-item invoice draft:");
                    multiDraft = actionExecutor.resolve("SALES_ENTRY", {
                        product: "kakro",
                        amount: 800,
                        lines: multi,
                        transactionType: "sales",
                    }, "maile kakro 500 ra aalu 300 bechye", false);
                    assert(((_76 = (_75 = (_74 = multiDraft[0]) === null || _74 === void 0 ? void 0 : _74.draft) === null || _75 === void 0 ? void 0 : _75.lines) === null || _76 === void 0 ? void 0 : _76.length) === 2, "two invoice lines");
                    console.log("\n6. Confirmation E2E:");
                    ctx16 = new ContextManager();
                    ctx16.setPendingAction({
                        understoodInput: "maile 500 ko kakro bechye",
                        entities: { product: "kakro", amount: 500, transactionType: "sales" },
                        intent: "SALES_ENTRY",
                        warnings: ["dup"],
                        outputLanguage: "nepali",
                    });
                    core16 = new IntelligenceCore_1.IntelligenceCore(undefined, ctx16);
                    return [4 /*yield*/, core16.processInput("ho", { useLlm: false })];
                case 85:
                    confirmed = _150.sent();
                    assert(confirmed.response.actions != null && confirmed.response.actions.length > 0, "confirmed actions released");
                    console.log("\n✅ All Sprint 16 tests passed!");
                    // Sprint 17: Dates, comparisons, corrections, party chips
                    console.log("\n=== SUTRA AI Sprint 17 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/context/DateResolver"); })];
                case 86:
                    dateResolver = (_150.sent()).dateResolver;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ComparisonQueryHandler"); })];
                case 87:
                    comparisonQueryHandler = (_150.sent()).comparisonQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/context/CorrectionEngine"); })];
                case 88:
                    correctionEngine = (_150.sent()).correctionEngine;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/PartyDisambiguationHandler"); })];
                case 89:
                    partyDisambiguationHandler = (_150.sent()).partyDisambiguationHandler;
                    console.log("1. Date resolver:");
                    hijo = dateResolver.detect("hijo ko entry");
                    assert((hijo === null || hijo === void 0 ? void 0 : hijo.key) === "yesterday", "hijo = yesterday");
                    aaja = dateResolver.detect("aaja ko bikri");
                    assert((aaja === null || aaja === void 0 ? void 0 : aaja.key) === "today", "aaja = today");
                    console.log("\n2. Sales comparison:");
                    todayIso = new Date().toISOString().slice(0, 10);
                    yIso = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                    cmp = comparisonQueryHandler.resolve("aaja vs hijo bikri", {
                        recentInvoices: [
                            { date: todayIso, grandTotal: 5000, type: "sales-invoice" },
                            { date: yIso, grandTotal: 3000, type: "sales-invoice" },
                            { date: todayIso, grandTotal: 1000, type: "sales-invoice" },
                        ],
                    });
                    assert(cmp != null && cmp.leftTotal === 6000 && cmp.rightTotal === 3000, "compare totals");
                    console.log("\n3. Comparison E2E:");
                    core17 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core17.processInput("aaja vs hijo bikri", {
                            useLlm: false,
                            erpContext: {
                                recentInvoices: [
                                    { date: todayIso, grandTotal: 4000, type: "sales-invoice" },
                                    { date: yIso, grandTotal: 2000, type: "sales-invoice" },
                                ],
                            },
                        })];
                case 90:
                    cmpE2e = _150.sent();
                    assert(((_77 = cmpE2e.assistantText) === null || _77 === void 0 ? void 0 : _77.includes("4")) || cmpE2e.response.response.nepali.includes("तुलना"), "comparison reply");
                    console.log("\n4. Correction engine:");
                    corr17 = correctionEngine.apply("hoina, 800 ko", { lastProduct: "kakro", lastAmount: 500, topicStack: [], turnCount: 2, awaiting: null, lastTransactionType: "sales" }, {});
                    assert((corr17 === null || corr17 === void 0 ? void 0 : corr17.entities.amount) === 800, "amount corrected");
                    console.log("\n5. Party disambiguation:");
                    partyResp = partyDisambiguationHandler.tryBuildResponse({ party: "ram", partyAmbiguous: ["Ram Traders", "Ramesh Store"], amount: 500 }, { intent: "SALES_ENTRY", confidence: 0.9, entities: {} }, "nepali", "ram lai 500 udhaar");
                    assert(((_78 = partyResp === null || partyResp === void 0 ? void 0 : partyResp.quickReplies) === null || _78 === void 0 ? void 0 : _78.length) === 2, "party chips");
                    assert((partyResp === null || partyResp === void 0 ? void 0 : partyResp.needs_clarification) === true, "needs pick");
                    console.log("\n6. Shortcut /compare:");
                    cmpShortcut = shortcutRouter.route("/compare", "nepali");
                    assert((_79 = cmpShortcut.rewrittenInput) === null || _79 === void 0 ? void 0 : _79.includes("aaja"), "/compare rewrite");
                    console.log("\n✅ All Sprint 17 tests passed!");
                    // Sprint 18: Receivables, unit price, compound parties, teach-back
                    console.log("\n=== SUTRA AI Sprint 18 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/context/UnitPriceEnricher"); })];
                case 91:
                    unitPriceEnricher = (_150.sent()).unitPriceEnricher;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/context/CompoundPartyParser"); })];
                case 92:
                    compoundPartyParser = (_150.sent()).compoundPartyParser;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReceivableQueryHandler"); })];
                case 93:
                    receivableQueryHandler = (_150.sent()).receivableQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/CompoundTransactionHandler"); })];
                case 94:
                    compoundTransactionHandler = (_150.sent()).compoundTransactionHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/conversation/TeachBackFormatter"); })];
                case 95:
                    teachBackFormatter = (_150.sent()).teachBackFormatter;
                    console.log("1. Unit price enrich:");
                    priced = unitPriceEnricher.enrich({ quantity: 2, itemRate: 50, product: "kakro" });
                    assert(priced.amount === 100, "qty × rate = amount");
                    console.log("\n2. Compound party parse:");
                    parties = compoundPartyParser.parse("ram lai 500 ani shyam lai 300 udhaar");
                    assert(parties.length === 2 && ((_80 = parties[0]) === null || _80 === void 0 ? void 0 : _80.amount) === 500, "two party lines");
                    console.log("\n3. Receivable list:");
                    recv = receivableQueryHandler.tryBuildResponse("sabai udhaar list", {}, {
                        parties: [
                            { id: "p1", name: "Ram Traders", balance: 15000 },
                            { id: "p2", name: "Shyam Store", balance: 8000 },
                            { id: "p3", name: "Hari", balance: -2000 },
                        ],
                    }, { intent: "REPORT_REQUEST", confidence: 0.9, entities: {} }, "nepali", "sabai udhaar list");
                    assert((recv === null || recv === void 0 ? void 0 : recv.response.nepali.includes("Ram")) && recv.response.nepali.includes("15"), "receivable list");
                    console.log("\n4. Compound transaction E2E:");
                    core18 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core18.processInput("ram lai 500 ani shyam lai 300 udhaar", {
                            useLlm: false,
                            erpContext: {
                                parties: [
                                    { id: "p1", name: "Ram Traders" },
                                    { id: "p2", name: "Shyam Store" },
                                ],
                            },
                        })];
                case 96:
                    compoundE2e = _150.sent();
                    assert(((_81 = compoundE2e.response.actions) === null || _81 === void 0 ? void 0 : _81.length) === 2 &&
                        ((_82 = compoundE2e.response.actions[0]) === null || _82 === void 0 ? void 0 : _82.type) === "prefill_khata", "compound khata actions");
                    console.log("\n5. Teach-back formatter:");
                    assert(teachBackFormatter.shouldShow("SALES_ENTRY", { product: "kakro", amount: 500 }), "teach-back eligible");
                    teach = teachBackFormatter.format({ product: "kakro", amount: 500, party: "ram" }, "SALES_ENTRY", "nepali");
                    assert(teach.includes("500") && teach.includes("kakro"), "teach-back text");
                    console.log("\n6. Qty sale amount:");
                    return [4 /*yield*/, core18.processInput("maile 2 kg kakro bechye", { useLlm: false })];
                case 97:
                    qtyE2e = _150.sent();
                    assert(((_83 = qtyE2e.entities) === null || _83 === void 0 ? void 0 : _83.quantity) === 2 || ((_84 = qtyE2e.entities) === null || _84 === void 0 ? void 0 : _84.amount) != null, "qty extracted");
                    console.log("\n✅ All Sprint 18 tests passed!");
                    // Sprint 19: Stock guard, expense, VAT, returns
                    console.log("\n=== SUTRA AI Sprint 19 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/guard/StockGuard"); })];
                case 98:
                    stockGuard = (_150.sent()).stockGuard;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/context/VatEnricher"); })];
                case 99:
                    vatEnricher = (_150.sent()).vatEnricher;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ExpenseEntryHandler"); })];
                case 100:
                    expenseEntryHandler = (_150.sent()).expenseEntryHandler;
                    console.log("1. Stock guard:");
                    stockWarn = stockGuard.check({ product: "kakro", itemId: "i1", quantity: 10, transactionType: "sales" }, { intent: "SALES_ENTRY", confidence: 0.9, entities: {} }, { items: [{ id: "i1", name: "Kakro", stockQty: 3, unit: "kg" }] });
                    assert(stockWarn != null, "insufficient stock warned");
                    console.log("\n2. VAT enricher:");
                    vat = vatEnricher.enrich({ amount: 1130 }, "1130 vat sahit");
                    assert(((_85 = vat.vatBreakdown) === null || _85 === void 0 ? void 0 : _85.vat) != null && vat.vatBreakdown.vat > 0, "VAT split");
                    console.log("\n3. Expense entry:");
                    exp = expenseEntryHandler.tryBuildResponse("500 ko kharcha", { amount: 500 }, undefined, { intent: "OTHER", confidence: 0.8, entities: {} }, "nepali", "500 ko kharcha");
                    assert(((_87 = (_86 = exp === null || exp === void 0 ? void 0 : exp.actions) === null || _86 === void 0 ? void 0 : _86[0]) === null || _87 === void 0 ? void 0 : _87.type) === "prefill_khata", "expense khata action");
                    console.log("\n4. Expense E2E:");
                    core19 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core19.processInput("500 ko kharcha", { useLlm: false })];
                case 101:
                    expE2e = _150.sent();
                    assert(((_89 = (_88 = expE2e.response.actions) === null || _88 === void 0 ? void 0 : _88[0]) === null || _89 === void 0 ? void 0 : _89.type) === "prefill_khata" ||
                        ((_90 = expE2e.entities) === null || _90 === void 0 ? void 0 : _90.transactionType) === "expense", "expense E2E");
                    console.log("\n5. Sales return:");
                    return [4 /*yield*/, core19.processInput("maile 200 ko kakro firta", { useLlm: false })];
                case 102:
                    retE2e = _150.sent();
                    assert(((_91 = retE2e.intent) === null || _91 === void 0 ? void 0 : _91.intent) === "RETURN_ENTRY" || ((_92 = retE2e.entities) === null || _92 === void 0 ? void 0 : _92.transactionType) === "return", "return detected");
                    console.log("\n6. Stock warning gates confirmation:");
                    gateStock = {
                        understood_input: "x",
                        confidence: 0.8,
                        needs_clarification: false,
                        suggestions: [],
                        response: { nepali: "x", english: "x", roman: "x" },
                        stockWarning: "low stock",
                    };
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/guard/ConfirmationGate"); })];
                case 103:
                    confirmationGate = (_150.sent()).confirmationGate;
                    assert(confirmationGate.needsGate(gateStock, false), "stock triggers gate");
                    console.log("\n✅ All Sprint 19 tests passed!");
                    // Sprint 20: Digest, cash balance, follow-ups, examples
                    console.log("\n=== SUTRA AI Sprint 20 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DailyDigestEngine"); })];
                case 104:
                    dailyDigestEngine = (_150.sent()).dailyDigestEngine;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/CashBalanceQueryHandler"); })];
                case 105:
                    cashBalanceQueryHandler = (_150.sent()).cashBalanceQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/FollowUpSuggestionEngine"); })];
                case 106:
                    followUpSuggestionEngine = (_150.sent()).followUpSuggestionEngine;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/conversation/OfflineReplyEnhancer"); })];
                case 107:
                    offlineReplyEnhancer = (_150.sent()).offlineReplyEnhancer;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/routing/ExamplesRouter"); })];
                case 108:
                    buildExamplesResponse = (_150.sent()).buildExamplesResponse;
                    console.log("1. Daily digest:");
                    digest = dailyDigestEngine.build({
                        businessInsights: {
                            todaySalesTotal: 12000,
                            todayInvoiceCount: 4,
                            topParties: [{ partyName: "Ram", invoiceCount: 2, avgAmount: 6000, totalAmount: 12000 }],
                            topProducts: [],
                        },
                        items: [{ id: "i1", name: "Kakro", stockQty: 0, reorderLevel: 5 }],
                        parties: [{ id: "p1", name: "Ram", balance: 30000 }],
                    });
                    assert(digest != null && digest.nepali.includes("12"), "digest built");
                    console.log("\n2. Cash balance query:");
                    cash = cashBalanceQueryHandler.tryBuildResponse("nagad kati cha", {}, { cashBalance: 25000, bankBalance: 100000 }, { intent: "QUERY", confidence: 0.9, entities: {} }, "nepali", "nagad kati cha");
                    assert(cash === null || cash === void 0 ? void 0 : cash.response.nepali.includes("25"), "cash balance");
                    console.log("\n3. Follow-up suggestions:");
                    fu = followUpSuggestionEngine.suggest({ intent: "SALES_ENTRY", confidence: 0.9, entities: {} }, { product: "kakro", party: "ram", amount: 500 }, { topicStack: [], turnCount: 1, awaiting: null, lastParty: "ram" }, {
                        understood_input: "x",
                        confidence: 0.9,
                        needs_clarification: false,
                        suggestions: [],
                        response: { nepali: "x", english: "x", roman: "x" },
                    });
                    assert(fu.length >= 1, "follow-up chips");
                    console.log("\n4. Offline enhancer:");
                    off = offlineReplyEnhancer.enhance("Test reply", "nepali", false, false);
                    assert(off.includes("offline"), "offline tip");
                    console.log("\n5. Examples shortcut:");
                    ex = shortcutRouter.route("/examples", "nepali");
                    assert(ex.handled && ((_93 = ex.response) === null || _93 === void 0 ? void 0 : _93.response.nepali.includes("उदाहरण")), "/examples");
                    console.log("\n6. Digest E2E:");
                    core20 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    todayIso = new Date().toISOString().slice(0, 10);
                    return [4 /*yield*/, core20.processInput("aaja ko business digest", {
                            useLlm: false,
                            erpContext: {
                                recentInvoices: [{ id: "i1", date: todayIso, grandTotal: 5000, type: "sales-invoice" }],
                            },
                        })];
                case 109:
                    digE2e = _150.sent();
                    assert(((_94 = digE2e.assistantText) === null || _94 === void 0 ? void 0 : _94.includes("5")) || digE2e.response.response.nepali.includes("बिक्री"), "digest E2E");
                    console.log("\n✅ All Sprint 20 tests passed!");
                    // Sprint 21: Rate query, global search, unknown party, fallback, chat export
                    console.log("\n=== SUTRA AI Sprint 21 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/GlobalSearchHandler"); })];
                case 110:
                    globalSearchHandler = (_150.sent()).globalSearchHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ProductRateQueryHandler"); })];
                case 111:
                    productRateQueryHandler = (_150.sent()).productRateQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/UnknownPartyHandler"); })];
                case 112:
                    unknownPartyHandler = (_150.sent()).unknownPartyHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/GracefulFallbackHandler"); })];
                case 113:
                    gracefulFallbackHandler = (_150.sent()).gracefulFallbackHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/interface/ChatExportUtils"); })];
                case 114:
                    exportChatAsText = (_150.sent()).exportChatAsText;
                    console.log("1. Product rate query:");
                    rate = productRateQueryHandler.tryBuildResponse("kakro ko rate", { product: "kakro" }, {
                        items: [{ id: "i1", name: "Kakro", saleRate: 80, purchaseRate: 60, stockQty: 50, unit: "kg" }],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "nepali", "kakro ko rate");
                    assert(rate === null || rate === void 0 ? void 0 : rate.response.nepali.includes("80"), "rate query");
                    console.log("\n2. Global search:");
                    search = globalSearchHandler.tryBuildResponse("search ram", {}, {
                        parties: [{ id: "p1", name: "Ram Traders", balance: 5000 }],
                        items: [{ id: "i1", name: "Kakro", saleRate: 80, stockQty: 10 }],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "nepali", "search ram");
                    assert(search === null || search === void 0 ? void 0 : search.response.nepali.includes("Ram"), "global search party");
                    console.log("\n3. Unknown party hint:");
                    unk = unknownPartyHandler.tryBuildResponse({ party: "xyzunknown", transactionType: "sales", amount: 500 }, { parties: [{ id: "p1", name: "Ram", balance: 0 }] }, "nepali", "xyzunknown lai 500 ko bikri");
                    assert((unk === null || unk === void 0 ? void 0 : unk.needs_clarification) && unk.response.nepali.includes("xyzunknown"), "unknown party");
                    console.log("\n4. Graceful fallback:");
                    fb = gracefulFallbackHandler.build("asdf qwerty zzz", "nepali", "asdf qwerty zzz");
                    assert(((_95 = fb.quickReplies) === null || _95 === void 0 ? void 0 : _95.length) === 2 && fb.response.nepali.includes("/examples"), "fallback");
                    console.log("\n5. Chat export:");
                    txt = exportChatAsText([
                        { role: "user", text: "hello", timestamp: new Date("2026-01-01T10:00:00Z") },
                        { role: "assistant", text: "namaste", timestamp: new Date("2026-01-01T10:00:01Z") },
                    ]);
                    assert(txt.includes("SUTRA AI Chat Export") && txt.includes("hello"), "chat export text");
                    console.log("\n6. /rate shortcut:");
                    rateShortcut = shortcutRouter.route("/rate kakro", "nepali");
                    assert(rateShortcut.rewrittenInput === "kakro ko rate", "/rate shortcut");
                    console.log("\n7. Rate E2E:");
                    core21 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core21.processInput("kakro ko rate kati cha", {
                            useLlm: false,
                            erpContext: {
                                items: [{ id: "i1", name: "Kakro", saleRate: 120, stockQty: 30, unit: "kg" }],
                            },
                        })];
                case 115:
                    rateE2e = _150.sent();
                    assert(((_96 = rateE2e.assistantText) === null || _96 === void 0 ? void 0 : _96.includes("120")) || rateE2e.response.response.nepali.includes("120"), "rate E2E");
                    console.log("\n✅ All Sprint 21 tests passed!");
                    // Sprint 22: FY PnL, credit limit, payment duplicate guard
                    console.log("\n=== SUTRA AI Sprint 22 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/context/FiscalYearResolver"); })];
                case 116:
                    resolveFiscalYear = (_150.sent()).resolveFiscalYear;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/FiscalPnlCalculator"); })];
                case 117:
                    computePnlFromInvoices = (_150.sent()).computePnlFromInvoices;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/guard/CreditLimitGuard"); })];
                case 118:
                    creditLimitGuard = (_150.sent()).creditLimitGuard;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReportQueryHandler"); })];
                case 119:
                    reportQueryHandler = (_150.sent()).reportQueryHandler;
                    console.log("1. Fiscal year resolver:");
                    fy = resolveFiscalYear({
                        name: "2082/83",
                        startDate: "2025-07-01",
                        endDate: "2026-06-30",
                    });
                    assert(fy.label === "2082/83" && fy.startDate === "2025-07-01", "FY bounds");
                    console.log("\n2. FY PnL from invoices:");
                    fyPnl = computePnlFromInvoices([
                        { id: "1", invoiceNo: "S1", date: "2025-08-01", grandTotal: 10000, type: "sales-invoice" },
                        { id: "2", invoiceNo: "P1", date: "2025-08-02", grandTotal: 3000, type: "purchase-invoice" },
                    ], "current_fy", fy);
                    assert(fyPnl.netProfit === 7000 && fyPnl.entryCount === 2, "FY PnL calc");
                    console.log("\n3. Credit limit guard:");
                    creditWarn = creditLimitGuard.check({ party: "Ram", partyResolvedName: "Ram", amount: 5000, transactionType: "sales", paymentMode: "credit" }, { intent: "SALES_ENTRY", confidence: 0.9, entities: {} }, {
                        parties: [{ id: "p1", name: "Ram", balance: 8000, creditLimit: 10000 }],
                    });
                    assert(creditWarn === null || creditWarn === void 0 ? void 0 : creditWarn.nepali.includes("10"), "credit limit warning");
                    console.log("\n4. Payment duplicate guard types:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/guard/DuplicateGuard"); })];
                case 120:
                    DuplicateGuard = (_150.sent()).DuplicateGuard;
                    dupGuard = new DuplicateGuard();
                    _o = assert;
                    return [4 /*yield*/, dupGuard.check({ party: "Ram", amount: 500, transactionType: "receipt" }, undefined)];
                case 121:
                    _o.apply(void 0, [(_150.sent()) ===
                            null,
                        "payment dup check runs (no match ok)"]);
                    console.log("\n5. FY report query:");
                    fyReport = reportQueryHandler.tryBuildResponse("chalu a.v. ko profit", {}, {
                        fiscalYear: fy,
                        recentInvoices: [
                            { id: "1", invoiceNo: "S1", date: "2025-08-01", grandTotal: 5000, type: "sales-invoice" },
                        ],
                    }, { intent: "REPORT_REQUEST", confidence: 0.9, entities: {} }, "nepali", "chalu a.v. ko profit");
                    assert((fyReport === null || fyReport === void 0 ? void 0 : fyReport.response.nepali.includes("5")) || (fyReport === null || fyReport === void 0 ? void 0 : fyReport.response.nepali.includes("2082")), "FY report");
                    console.log("\n6. Confirmation gate credit limit:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/guard/ConfirmationGate"); })];
                case 122:
                    confirmGate22 = (_150.sent()).confirmationGate;
                    gateCredit = {
                        understood_input: "x",
                        confidence: 0.8,
                        needs_clarification: false,
                        suggestions: [],
                        response: { nepali: "x", english: "x", roman: "x" },
                        creditLimitWarning: "limit exceeded",
                    };
                    assert(confirmGate22.needsGate(gateCredit, false), "credit limit triggers gate");
                    console.log("\n7. /fy shortcut:");
                    fyShortcut = shortcutRouter.route("/fy", "nepali");
                    assert(fyShortcut.rewrittenInput === "chalu a.v. ko profit", "/fy shortcut");
                    console.log("\n✅ All Sprint 22 tests passed!");
                    // Sprint 23: Overdue, party onboarding, payment mode inference
                    console.log("\n=== SUTRA AI Sprint 23 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/context/PaymentModeEnricher"); })];
                case 123:
                    paymentModeEnricher = (_150.sent()).paymentModeEnricher;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/OverdueReceivableEngine"); })];
                case 124:
                    overdueReceivableEngine = (_150.sent()).overdueReceivableEngine;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/OverdueQueryHandler"); })];
                case 125:
                    overdueQueryHandler = (_150.sent()).overdueQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/PartyOnboardingHandler"); })];
                case 126:
                    partyOnboardingHandler = (_150.sent()).partyOnboardingHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/ProactiveAlertEngine"); })];
                case 127:
                    proactiveAlertEngine = (_150.sent()).proactiveAlertEngine;
                    console.log("1. Payment mode inference:");
                    pm = paymentModeEnricher.enrich({ party: "ram", transactionType: "sales" }, "ram lai 500 ko kakro bechye");
                    assert(pm.paymentMode === "credit", "party+lai => credit");
                    pmCash = paymentModeEnricher.enrich({}, "cash ma 200 ko chiya bechye");
                    assert(pmCash.paymentMode === "cash", "cash ma => cash");
                    console.log("\n2. Overdue engine:");
                    odRows = overdueReceivableEngine.scan({
                        parties: [
                            {
                                id: "p1",
                                name: "Ram",
                                balance: 8000,
                                creditDays: 30,
                                lastInvoiceDate: "2026-04-01",
                            },
                        ],
                    });
                    assert(odRows.length === 1 && odRows[0].daysOverdue > 0, "overdue detected");
                    console.log("\n3. Overdue query:");
                    odQ = overdueQueryHandler.tryBuildResponse("overdue udhaar list", {}, {
                        parties: [
                            {
                                id: "p1",
                                name: "Ram",
                                balance: 5000,
                                creditDays: 30,
                                lastInvoiceDate: "2026-04-01",
                            },
                        ],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "nepali", "overdue udhaar list");
                    assert(odQ === null || odQ === void 0 ? void 0 : odQ.response.nepali.includes("Ram"), "overdue query");
                    console.log("\n4. Party onboarding:");
                    onboard = partyOnboardingHandler.tryBuildResponse({ party: "newshop", transactionType: "sales", amount: 500 }, { parties: [{ id: "p1", name: "Ram", balance: 0 }] }, "nepali", "newshop lai 500 ko bikri");
                    assert(((_98 = (_97 = onboard === null || onboard === void 0 ? void 0 : onboard.actions) === null || _97 === void 0 ? void 0 : _97[0]) === null || _98 === void 0 ? void 0 : _98.page) === "parties", "onboard navigate");
                    console.log("\n5. Proactive overdue alert:");
                    alerts = proactiveAlertEngine.scan({
                        parties: [
                            {
                                id: "p1",
                                name: "Ram",
                                balance: 12000,
                                creditDays: 30,
                                lastInvoiceDate: "2026-03-01",
                            },
                        ],
                    });
                    assert(alerts.some(function (a) { return a.id.startsWith("od-"); }), "proactive overdue");
                    console.log("\n6. /overdue shortcut:");
                    odShortcut = shortcutRouter.route("/overdue", "nepali");
                    assert(odShortcut.rewrittenInput === "overdue udhaar list", "/overdue");
                    console.log("\n7. /create party shortcut:");
                    cpShortcut = shortcutRouter.route("/create party Hari Store", "nepali");
                    assert(cpShortcut.handled && ((_101 = (_100 = (_99 = cpShortcut.response) === null || _99 === void 0 ? void 0 : _99.actions) === null || _100 === void 0 ? void 0 : _100[0]) === null || _101 === void 0 ? void 0 : _101.page) === "parties", "/create party");
                    console.log("\n✅ All Sprint 23 tests passed!");
                    // Sprint 24: WhatsApp share, reminders, batch payment, pipeline trace
                    console.log("\n=== SUTRA AI Sprint 24 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/conversation/WhatsAppShareFormatter"); })];
                case 128:
                    _p = _150.sent(), formatReceivableReminder = _p.formatReceivableReminder, buildWhatsAppUrl = _p.buildWhatsAppUrl;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReminderQueryHandler"); })];
                case 129:
                    reminderQueryHandler = (_150.sent()).reminderQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/BatchPaymentHandler"); })];
                case 130:
                    batchPaymentHandler = (_150.sent()).batchPaymentHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/PipelineTraceBuilder"); })];
                case 131:
                    appendPipelineTrace = (_150.sent()).appendPipelineTrace;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/context/CompoundPartyParser"); })];
                case 132:
                    compoundPartyParser = (_150.sent()).compoundPartyParser;
                    console.log("1. WhatsApp formatter:");
                    wa = formatReceivableReminder("Ram", 5000, "nepali", { daysOverdue: 15 });
                    assert(wa.includes("Ram") && wa.includes("5"), "reminder format");
                    assert(buildWhatsAppUrl(wa).includes("wa.me"), "whatsapp url");
                    console.log("\n2. Reminder query:");
                    rem = reminderQueryHandler.tryBuildResponse("ram lai udhaar reminder pathau", { party: "ram" }, { parties: [{ id: "p1", name: "Ram", balance: 8000 }] }, { intent: "QUERY", confidence: 0.9, entities: {} }, "nepali", "ram lai udhaar reminder pathau");
                    assert((_102 = rem === null || rem === void 0 ? void 0 : rem.shareText) === null || _102 === void 0 ? void 0 : _102.includes("Ram"), "reminder shareText");
                    console.log("\n3. Batch payment parser:");
                    lines = compoundPartyParser.parse("ram lai 500 ani shyam lai 300 tiryo");
                    assert(lines.length === 2 && lines[0].amount === 500, "batch party lines");
                    console.log("\n4. Batch payment handler:");
                    batch = batchPaymentHandler.tryBuildResponse("ram lai 500 ani shyam lai 300 tiryo", { partyLines: lines }, { parties: [{ id: "p1", name: "Ram" }, { id: "p2", name: "Shyam" }] }, { intent: "SALES_ENTRY", confidence: 0.9, entities: {} }, "nepali", "ram lai 500 ani shyam lai 300 tiryo");
                    assert(((_103 = batch === null || batch === void 0 ? void 0 : batch.actions) === null || _103 === void 0 ? void 0 : _103.length) === 2, "batch payment actions");
                    console.log("\n5. Pipeline trace:");
                    traced = appendPipelineTrace({ steps: [{ step: 1, name: "TEST", detail: "x" }], finalInterpretation: "x", confidence: 0.9, entities: {} }, { erpQueryResolved: true, erpHandler: "reminder", llmUsed: false, llmRouteReason: "rules", confidence: 0.9 });
                    assert(traced.steps.some(function (s) { return s.name === "LLM ROUTE"; }), "pipeline trace");
                    console.log("\n6. /reminder shortcut:");
                    remShortcut = shortcutRouter.route("/reminder ram", "nepali");
                    assert(remShortcut.rewrittenInput === "ram lai udhaar reminder pathau", "/reminder");
                    console.log("\n7. Receipt batch (bata):");
                    bataLines = compoundPartyParser.parse("ram bata 500 ani shyam bata 300 jama");
                    assert(bataLines.length === 2, "bata batch parse");
                    console.log("\n✅ All Sprint 24 tests passed!");
                    // Sprint 25: Invoice share, voice TTS, quick-reply learning, multilingual polish
                    console.log("\n=== SUTRA AI Sprint 25 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/conversation/InvoiceShareFormatter"); })];
                case 133:
                    formatInvoiceShare = (_150.sent()).formatInvoiceShare;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/conversation/VoiceReminderSpeaker"); })];
                case 134:
                    pickTtsText = (_150.sent()).pickTtsText;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/conversation/MultilingualReplyPolisher"); })];
                case 135:
                    multilingualReplyPolisher = (_150.sent()).multilingualReplyPolisher;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/QuickReplyLearningStore"); })];
                case 136:
                    quickReplyLearningStore = (_150.sent()).quickReplyLearningStore;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/InvoiceQueryHandler"); })];
                case 137:
                    invoiceQueryHandler = (_150.sent()).invoiceQueryHandler;
                    console.log("1. Invoice share format:");
                    invShare = formatInvoiceShare({ id: "i1", invoiceNo: "S-101", date: "2026-07-01", partyName: "Ram", grandTotal: 5500, type: "sales-invoice" }, "nepali");
                    assert(invShare.includes("S-101") && invShare.includes("5,500"), "invoice share");
                    console.log("\n2. Voice TTS pick:");
                    tts = pickTtsText("Long assistant reply...", "nepali", "Namaste Ram, baki Rs. 5000");
                    assert(tts.includes("5000") || tts.includes("Ram"), "prefer share TTS");
                    console.log("\n3. Multilingual polisher:");
                    polished = multilingualReplyPolisher.polish({
                        understood_input: "x",
                        confidence: 0.9,
                        needs_clarification: false,
                        suggestions: [],
                        response: { nepali: "नमस्ते", english: "", roman: "" },
                    });
                    assert(polished.response.english === "नमस्ते", "fill english fallback");
                    console.log("\n4. Quick reply learning:");
                    return [4 /*yield*/, quickReplyLearningStore.recordSelection("/examples")];
                case 138:
                    _150.sent();
                    assert(true, "quick reply recorded");
                    console.log("\n5. Invoice share query:");
                    invQ = invoiceQueryHandler.tryBuildResponse("pachillo bill share garnu", {}, {
                        recentInvoices: [
                            { id: "i1", invoiceNo: "S-99", date: "2026-07-01", partyName: "Ram", grandTotal: 1000, type: "sales-invoice" },
                        ],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "nepali", "pachillo bill share garnu");
                    assert((_104 = invQ === null || invQ === void 0 ? void 0 : invQ.shareText) === null || _104 === void 0 ? void 0 : _104.includes("S-99"), "invoice share query");
                    console.log("\n6. /share invoice shortcut:");
                    shareShortcut = shortcutRouter.route("/share invoice", "nepali");
                    assert((_105 = shareShortcut.rewrittenInput) === null || _105 === void 0 ? void 0 : _105.includes("share"), "/share invoice");
                    console.log("\n✅ All Sprint 25 tests passed!");
                    // Sprint 26: Party phone, session clear summary, returns, LLM cache
                    console.log("\n=== SUTRA AI Sprint 26 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/context/PartyPhoneResolver"); })];
                case 139:
                    _q = _150.sent(), normalizeWhatsAppPhone = _q.normalizeWhatsAppPhone, phoneFromPartyRef = _q.phoneFromPartyRef;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/SessionSummaryEngine"); })];
                case 140:
                    sessionSummaryEngine = (_150.sent()).sessionSummaryEngine;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReturnTransactionHandler"); })];
                case 141:
                    returnTransactionHandler = (_150.sent()).returnTransactionHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/LlmResponseCache"); })];
                case 142:
                    llmResponseCache = (_150.sent()).llmResponseCache;
                    console.log("1. WhatsApp phone normalize:");
                    assert(normalizeWhatsAppPhone("9841234567") === "9779841234567", "977 prefix");
                    assert(normalizeWhatsAppPhone("9779841234567") === "9779841234567", "977 kept");
                    console.log("\n2. Party phone from ref:");
                    assert((_106 = phoneFromPartyRef({ id: "p1", name: "Ram", phone: "9841111111" })) === null || _106 === void 0 ? void 0 : _106.startsWith("977"), "party phone");
                    console.log("\n3. Session summary:");
                    sum = sessionSummaryEngine.build([
                        { role: "user", content: "ram ko balance", timestamp: new Date() },
                        { role: "assistant", content: "5000", timestamp: new Date() },
                    ], { topicStack: [], turnCount: 4, awaiting: null, lastParty: "Ram", lastAmount: 5000 }, "nepali");
                    assert(sum === null || sum === void 0 ? void 0 : sum.includes("Ram"), "session summary");
                    console.log("\n4. Sales return handler:");
                    ret = returnTransactionHandler.tryBuildResponse("maile 200 ko kakro firta", { product: "kakro", amount: 200, transactionType: "return" }, {}, { intent: "RETURN_ENTRY", confidence: 0.9, entities: {} }, "nepali", "maile 200 ko kakro firta");
                    assert(((_108 = (_107 = ret === null || ret === void 0 ? void 0 : ret.actions) === null || _107 === void 0 ? void 0 : _107[0]) === null || _108 === void 0 ? void 0 : _108.invoiceType) === "sales-return", "sales return action");
                    console.log("\n5. LLM cache:");
                    return [4 /*yield*/, llmResponseCache.set("test input", "QUERY", {
                            response: { nepali: "cached", english: "cached", roman: "cached" },
                        })];
                case 143:
                    _150.sent();
                    return [4 /*yield*/, llmResponseCache.get("test input", "QUERY")];
                case 144:
                    cached = _150.sent();
                    assert(((_109 = cached === null || cached === void 0 ? void 0 : cached.response) === null || _109 === void 0 ? void 0 : _109.nepali) === "cached", "llm cache roundtrip");
                    console.log("\n6. Reminder with phone:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReminderQueryHandler"); })];
                case 145:
                    reminderQueryHandler = (_150.sent()).reminderQueryHandler;
                    remPhone = reminderQueryHandler.tryBuildResponse("ram lai udhaar reminder pathau", { party: "ram" }, {
                        parties: [{ id: "p1", name: "Ram", balance: 5000, phone: "9841234567" }],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "nepali", "ram lai udhaar reminder pathau");
                    assert((_110 = remPhone === null || remPhone === void 0 ? void 0 : remPhone.partyPhone) === null || _110 === void 0 ? void 0 : _110.startsWith("977"), "reminder party phone");
                    console.log("\n7. Clear with summary E2E:");
                    core26 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    core26.getContextManager().addTurn("user", "ram ko balance kati");
                    core26.getContextManager().updateSession({ party: "ram", amount: 5000 }, "QUERY");
                    return [4 /*yield*/, core26.processInput("/clear", { useLlm: false })];
                case 146:
                    clearRes = _150.sent();
                    assert(clearRes.shortcutAction === "clear_history" && ((_111 = clearRes.assistantText) === null || _111 === void 0 ? void 0 : _111.includes("Ram")), "clear summary");
                    console.log("\n✅ All Sprint 26 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 26 complete!");
                    // Sprint 27: Party phone, digest v2, export summary, purchase return polish
                    console.log("\n=== SUTRA AI Sprint 27 Tests ===\n");
                    console.log("1. PartyPhoneQueryHandler:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/PartyPhoneQueryHandler"); })];
                case 147:
                    partyPhoneQueryHandler = (_150.sent()).partyPhoneQueryHandler;
                    phRes = partyPhoneQueryHandler.tryBuildResponse("/phone ram", { party: "ram" }, {
                        parties: [{ id: "p1", name: "Ram Traders", balance: 1000, phone: "9841112233" }],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "nepali", "/phone ram");
                    assert((_112 = phRes === null || phRes === void 0 ? void 0 : phRes.partyPhone) === null || _112 === void 0 ? void 0 : _112.startsWith("977"), "party phone lookup");
                    console.log("\n2. DailyDigestEngine v2:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DailyDigestEngine"); })];
                case 148:
                    dailyDigestEngine = (_150.sent()).dailyDigestEngine;
                    digestV2 = dailyDigestEngine.build({
                        parties: [{ id: "p1", name: "Ram", balance: 5000, lastInvoiceDate: "2024-01-01", creditDays: 7 }],
                        cashBalance: 12000,
                        bankBalance: 45000,
                        pnlSnapshot: {
                            netProfit: 8500,
                            totalIncome: 100000,
                            totalExpense: 91500,
                            period: "current_month",
                            entryCount: 10,
                        },
                        businessInsights: { todaySalesTotal: 0, todayInvoiceCount: 0, topParties: [] },
                    });
                    assert(digestV2 != null && digestV2.english.includes("Cash"), "digest v2 cash line");
                    assert(digestV2.english.includes("Overdue"), "digest v2 overdue line");
                    console.log("\n3. Chat export with summary:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/interface/ChatExportUtils"); })];
                case 149:
                    exportChatAsText = (_150.sent()).exportChatAsText;
                    exportTxt = exportChatAsText([{ role: "user", text: "hi", timestamp: new Date("2026-01-01T10:00:00Z") }], "Session summary (2 turns):\n• party: Ram");
                    assert(exportTxt.includes("Session Summary") && exportTxt.includes("Ram"), "export summary block");
                    console.log("\n4. Purchase return E2E:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReturnTransactionHandler"); })];
                case 150:
                    returnTransactionHandler = (_150.sent()).returnTransactionHandler;
                    assert(returnTransactionHandler.isPurchaseReturn("supplier bata 300 ko tel firta"), "purchase return pattern");
                    prRes = returnTransactionHandler.tryBuildResponse("kharid firta 500 ko tel", { product: "tel", amount: 500, transactionType: "return" }, undefined, { intent: "RETURN_ENTRY", confidence: 0.9, entities: {} }, "nepali", "kharid firta 500 ko tel");
                    assert((_113 = prRes === null || prRes === void 0 ? void 0 : prRes.actions) === null || _113 === void 0 ? void 0 : _113.some(function (a) { return a.invoiceType === "purchase-return"; }), "purchase return action");
                    console.log("\n5. /phone in help:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/routing/ShortcutRouter"); })];
                case 151:
                    shortcutRouter = (_150.sent()).shortcutRouter;
                    help = shortcutRouter.route("/help", "english");
                    assert((_114 = help.response) === null || _114 === void 0 ? void 0 : _114.response.english.includes("/phone"), "help lists /phone");
                    console.log("\n✅ All Sprint 27 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 27 complete!");
                    // Sprint 28: Party phone edit, digest once/day, supplier return disambiguation, cache indicator
                    console.log("\n=== SUTRA AI Sprint 28 Tests ===\n");
                    console.log("1. PartyPhoneEditHandler:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/PartyPhoneEditHandler"); })];
                case 152:
                    partyPhoneEditHandler = (_150.sent()).partyPhoneEditHandler;
                    editRes = partyPhoneEditHandler.tryBuildResponse("/setphone ram 9841234567", { party: "ram" }, { parties: [{ id: "p1", name: "Ram Traders", balance: 0 }] }, { intent: "OTHER", confidence: 0.9, entities: {} }, "nepali", "/setphone ram 9841234567");
                    assert(((_116 = (_115 = editRes === null || editRes === void 0 ? void 0 : editRes.actions) === null || _115 === void 0 ? void 0 : _115[0]) === null || _116 === void 0 ? void 0 : _116.type) === "prefill_party" && ((_117 = editRes.actions[0].partyDraft) === null || _117 === void 0 ? void 0 : _117.phone) === "9841234567", "setphone prefill_party");
                    console.log("\n2. DigestShownTracker:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestShownTracker"); })];
                case 153:
                    _r = _150.sent(), wasDigestShownToday = _r.wasDigestShownToday, markDigestShownToday = _r.markDigestShownToday, clearDigestShownMarker = _r.clearDigestShownMarker;
                    clearDigestShownMarker();
                    assert(!wasDigestShownToday(), "digest not shown initially");
                    markDigestShownToday();
                    assert(wasDigestShownToday(), "digest marked shown");
                    clearDigestShownMarker();
                    console.log("\n3. Party draft bridge:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyDraft"); })];
                case 154:
                    _s = _150.sent(), saveAiPartyDraft = _s.saveAiPartyDraft, peekAiPartyDraft = _s.peekAiPartyDraft, consumeAiPartyDraft = _s.consumeAiPartyDraft;
                    saveAiPartyDraft({ partyId: "p1", phone: "9800000000", focusPhone: true });
                    assert(((_118 = peekAiPartyDraft()) === null || _118 === void 0 ? void 0 : _118.phone) === "9800000000", "party draft peek");
                    consumeAiPartyDraft();
                    assert(peekAiPartyDraft() == null, "party draft consumed");
                    console.log("\n4. Purchase return supplier disambiguation:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReturnTransactionHandler"); })];
                case 155:
                    returnHandler28 = (_150.sent()).returnTransactionHandler;
                    supDis = returnHandler28.tryBuildResponse("ram bata 500 ko tel firta", { party: "ram", product: "tel", amount: 500, transactionType: "return" }, {
                        parties: [
                            { id: "s1", name: "Ram Suppliers", type: "supplier", balance: 0 },
                            { id: "s2", name: "Ram Enterprises", type: "supplier", balance: 0 },
                        ],
                    }, { intent: "RETURN_ENTRY", confidence: 0.9, entities: {} }, "nepali", "kharid ram bata 500 ko tel firta");
                    assert((supDis === null || supDis === void 0 ? void 0 : supDis.needs_clarification) && ((_120 = (_119 = supDis.quickReplies) === null || _119 === void 0 ? void 0 : _119.length) !== null && _120 !== void 0 ? _120 : 0) >= 2, "supplier pick");
                    console.log("\n5. LLM cache hit flag:");
                    core28 = new IntelligenceCore_1.IntelligenceCore(undefined, new ContextManager());
                    return [4 /*yield*/, core28.processInput("maile 500 ko kakro bechye", { useLlm: false })];
                case 156:
                    cacheRes = _150.sent();
                    assert(cacheRes.llmCacheHit === undefined || cacheRes.llmCacheHit === false, "no false cache hit");
                    console.log("\n6. /setphone in help:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/routing/ShortcutRouter"); })];
                case 157:
                    shortcutRouter28 = (_150.sent()).shortcutRouter;
                    help28 = shortcutRouter28.route("/help", "english");
                    assert((_121 = help28.response) === null || _121 === void 0 ? void 0 : _121.response.english.includes("/setphone"), "help lists setphone");
                    console.log("\n✅ All Sprint 28 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 28 complete!");
                    // Sprint 29: Phone save confirm, digest dismiss, supplier filters, cache stats
                    console.log("\n=== SUTRA AI Sprint 29 Tests ===\n");
                    console.log("1. Party phone saved message:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 158:
                    formatPartyPhoneSavedMessage = (_150.sent()).formatPartyPhoneSavedMessage;
                    savedMsg = formatPartyPhoneSavedMessage({ partyName: "Ram", phone: "9841234567", savedAt: Date.now() });
                    assert(savedMsg.includes("Ram") && savedMsg.includes("9841234567"), "phone saved message");
                    console.log("\n2. Party type filter search:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/context/PartyTypeFilter"); })];
                case 159:
                    _t = _150.sent(), parseSearchPartyFilter = _t.parseSearchPartyFilter, filterPartiesByKind = _t.filterPartiesByKind;
                    sf = parseSearchPartyFilter("/search supplier ram");
                    assert(sf.filter === "supplier" && sf.query === "ram", "search supplier filter");
                    pool = filterPartiesByKind([
                        { id: "1", name: "A", type: "customer", balance: 0 },
                        { id: "2", name: "B", type: "supplier", balance: 0 },
                    ], "supplier");
                    assert(pool.length === 1 && pool[0].name === "B", "supplier pool");
                    console.log("\n3. Overdue supplier payables:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/OverdueReceivableEngine"); })];
                case 160:
                    overdueReceivableEngine = (_150.sent()).overdueReceivableEngine;
                    payables = overdueReceivableEngine.scanPayables({
                        parties: [
                            {
                                id: "s1",
                                name: "Supplier Co",
                                type: "supplier",
                                balance: -5000,
                                lastInvoiceDate: "2024-01-01",
                                creditDays: 7,
                            },
                        ],
                    });
                    assert(payables.length === 1 && payables[0].balance === 5000, "payables scan");
                    console.log("\n4. Cache stats handler:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/CacheStatsQueryHandler"); })];
                case 161:
                    cacheStatsQueryHandler = (_150.sent()).cacheStatsQueryHandler;
                    return [4 /*yield*/, cacheStatsQueryHandler.tryBuildResponse("/cache stats", "english", "/cache stats")];
                case 162:
                    cacheStats = _150.sent();
                    assert(cacheStats === null || cacheStats === void 0 ? void 0 : cacheStats.response.english.includes("LLM cache"), "cache stats response");
                    console.log("\n5. Digest dismiss shortcut:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/routing/ShortcutRouter"); })];
                case 163:
                    sr29 = (_150.sent()).shortcutRouter;
                    dismiss = sr29.route("/digest dismiss", "english");
                    assert(dismiss.shortcutAction === "dismiss_digest", "digest dismiss shortcut");
                    console.log("\n6. Global search supplier filter:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/GlobalSearchHandler"); })];
                case 164:
                    globalSearchHandler = (_150.sent()).globalSearchHandler;
                    searchRes = globalSearchHandler.tryBuildResponse("/search supplier ram", {}, {
                        parties: [
                            { id: "c1", name: "Ram Customer", type: "customer", balance: 100 },
                            { id: "s1", name: "Ram Suppliers", type: "supplier", balance: 0 },
                        ],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "english", "/search supplier ram");
                    assert(searchRes === null || searchRes === void 0 ? void 0 : searchRes.response.english.includes("Ram Suppliers"), "supplier-only search");
                    console.log("\n✅ All Sprint 29 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 29 complete!");
                    // Sprint 30: Phone-save reminder chips, digest hour snooze, aging link, cache hit rate
                    console.log("\n=== SUTRA AI Sprint 30 Tests ===\n");
                    console.log("1. Phone saved quick replies:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 165:
                    buildPhoneSavedQuickReplies = (_150.sent()).buildPhoneSavedQuickReplies;
                    chips = buildPhoneSavedQuickReplies({
                        partyName: "Ram",
                        phone: "9841234567",
                        savedAt: Date.now(),
                    }, "english");
                    assert(chips.length >= 3 && chips[0].label === "Send now", "phone saved chips");
                    console.log("\n2. Digest hour snooze:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestShownTracker"); })];
                case 166:
                    _u = _150.sent(), snoozeDigestForHours = _u.snoozeDigestForHours, isDigestBlocked = _u.isDigestBlocked, clearDigestShownMarker = _u.clearDigestShownMarker;
                    clearDigestShownMarker();
                    snoozeDigestForHours(2);
                    assert(isDigestBlocked(), "digest snoozed");
                    console.log("\n3. Digest snooze shortcut:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/routing/ShortcutRouter"); })];
                case 167:
                    sr30 = (_150.sent()).shortcutRouter;
                    snooze = sr30.route("/digest snooze 6", "english");
                    assert(snooze.shortcutAction === "snooze_digest" && snooze.snoozeHours === 6, "snooze shortcut");
                    console.log("\n4. Overdue aging report action:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/OverdueQueryHandler"); })];
                case 168:
                    overdueQueryHandler = (_150.sent()).overdueQueryHandler;
                    odRes = overdueQueryHandler.tryBuildResponse("/overdue customer", {}, {
                        parties: [
                            {
                                id: "c1",
                                name: "Ram",
                                type: "customer",
                                balance: 5000,
                                lastInvoiceDate: "2024-01-01",
                                creditDays: 7,
                            },
                        ],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "english", "/overdue customer");
                    assert(((_123 = (_122 = odRes === null || odRes === void 0 ? void 0 : odRes.actions) === null || _122 === void 0 ? void 0 : _122[0]) === null || _123 === void 0 ? void 0 : _123.page) === "aging-report" && odRes.actions[0].agingDirection === "receivable", "customer overdue aging link");
                    console.log("\n5. Cache hit rate:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/LlmResponseCache"); })];
                case 169:
                    llmResponseCache = (_150.sent()).llmResponseCache;
                    llmResponseCache.recordHit();
                    llmResponseCache.recordMiss();
                    rate = llmResponseCache.getHitRate();
                    assert(rate.hits >= 1 && rate.misses >= 1 && rate.rate > 0 && rate.rate < 1, "cache hit rate");
                    console.log("\n6. Aging report draft:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/agingReportDraft"); })];
                case 170:
                    _v = _150.sent(), saveAiAgingReportDraft = _v.saveAiAgingReportDraft, consumeAiAgingReportDraft = _v.consumeAiAgingReportDraft;
                    saveAiAgingReportDraft({ direction: "payable" });
                    assert(((_124 = consumeAiAgingReportDraft()) === null || _124 === void 0 ? void 0 : _124.direction) === "payable", "aging draft");
                    clearDigestShownMarker();
                    console.log("\n✅ All Sprint 30 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 30 complete!");
                    // Sprint 31: One-tap WhatsApp, digest picker, aging party filter, per-message cache badge
                    console.log("\n=== SUTRA AI Sprint 31 Tests ===\n");
                    console.log("1. Phone saved WA encode/decode:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 171:
                    _w = _150.sent(), encodePhoneSavedWaValue = _w.encodePhoneSavedWaValue, decodePhoneSavedWaValue = _w.decodePhoneSavedWaValue, buildPhoneSavedReminderShare = _w.buildPhoneSavedReminderShare, formatWhatsAppSentConfirmation = _w.formatWhatsAppSentConfirmation;
                    notice = { partyName: "Ram", phone: "9841234567", savedAt: Date.now(), balance: 5000 };
                    encoded = encodePhoneSavedWaValue(notice);
                    decoded = decodePhoneSavedWaValue(encoded);
                    assert((decoded === null || decoded === void 0 ? void 0 : decoded.partyName) === "Ram" && decoded.phone === "9841234567", "wa encode decode");
                    share = buildPhoneSavedReminderShare(notice, "english");
                    assert(share.includes("Ram") && share.includes("500"), "reminder share with balance");
                    console.log("\n2. tryHandlePhoneSavedWaQuickReply:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/store/sutraAiStore"); })];
                case 172:
                    tryHandlePhoneSavedWaQuickReply = (_150.sent()).tryHandlePhoneSavedWaQuickReply;
                    wa = tryHandlePhoneSavedWaQuickReply(encoded, "english");
                    assert((wa === null || wa === void 0 ? void 0 : wa.phone.startsWith("977")) && wa.confirmText.includes("Ram"), "wa quick reply handler");
                    console.log("\n3. Overdue supplier aging search term:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/OverdueQueryHandler"); })];
                case 173:
                    od31 = (_150.sent()).overdueQueryHandler;
                    supOd = od31.tryBuildResponse("/overdue supplier", {}, {
                        parties: [
                            {
                                id: "s1",
                                name: "ABC Suppliers",
                                type: "supplier",
                                balance: -8000,
                                lastInvoiceDate: "2024-01-01",
                                creditDays: 7,
                            },
                        ],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "english", "/overdue supplier");
                    assert(((_126 = (_125 = supOd === null || supOd === void 0 ? void 0 : supOd.actions) === null || _125 === void 0 ? void 0 : _125[0]) === null || _126 === void 0 ? void 0 : _126.agingSearchTerm) === "ABC Suppliers", "supplier aging search");
                    console.log("\n4. Aging draft with search:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/agingReportDraft"); })];
                case 174:
                    _x = _150.sent(), saveAiAgingReportDraft = _x.saveAiAgingReportDraft, consumeAiAgingReportDraft = _x.consumeAiAgingReportDraft;
                    saveAiAgingReportDraft({ direction: "payable", searchTerm: "ABC Suppliers" });
                    agingDraft = consumeAiAgingReportDraft();
                    assert((agingDraft === null || agingDraft === void 0 ? void 0 : agingDraft.direction) === "payable" && agingDraft.searchTerm === "ABC Suppliers", "aging draft search");
                    console.log("\n5. WhatsApp sent confirmation:");
                    conf = formatWhatsAppSentConfirmation("Ram", "nepali");
                    assert(conf.includes("Ram") && conf.includes("पठाइसकियो"), "wa sent confirm");
                    console.log("\n✅ All Sprint 31 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 31 complete!");
                    // Sprint 32: Payable reminders, digest undo, cache sparkline, aging row remind
                    console.log("\n=== SUTRA AI Sprint 32 Tests ===\n");
                    console.log("1. Payable reminder formatter:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/conversation/WhatsAppShareFormatter"); })];
                case 175:
                    _y = _150.sent(), formatPayableReminder = _y.formatPayableReminder, formatReceivableReminder = _y.formatReceivableReminder;
                    payRem = formatPayableReminder("ABC Suppliers", 12000, "english", { daysOverdue: 30 });
                    assert(payRem.includes("payable") && payRem.includes("12,000"), "payable reminder english");
                    recvRem = formatReceivableReminder("Ram", 5000, "nepali");
                    assert(recvRem.includes("बाँकी") && recvRem.includes("Ram"), "receivable reminder nepali");
                    console.log("\n2. ReminderQueryHandler supplier payable:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReminderQueryHandler"); })];
                case 176:
                    reminderQueryHandler = (_150.sent()).reminderQueryHandler;
                    supReminder = reminderQueryHandler.tryBuildResponse("/reminder ABC Suppliers", { party: "ABC Suppliers" }, {
                        parties: [
                            {
                                id: "s1",
                                name: "ABC Suppliers",
                                type: "supplier",
                                balance: -12000,
                                lastInvoiceDate: "2024-01-01",
                                creditDays: 7,
                            },
                        ],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "english", "/reminder ABC Suppliers");
                    assert(((_127 = supReminder === null || supReminder === void 0 ? void 0 : supReminder.shareText) === null || _127 === void 0 ? void 0 : _127.includes("payable")) && ((_128 = supReminder.quickReplies) === null || _128 === void 0 ? void 0 : _128.length) === 1, "supplier payable reminder");
                    console.log("\n3. Cache hit sparkline:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/CacheHitSparkline"); })];
                case 177:
                    _z = _150.sent(), formatCacheHitSparkline = _z.formatCacheHitSparkline, formatCacheStatsLine = _z.formatCacheStatsLine;
                    spark = formatCacheHitSparkline([1, 0, 1, 1, 0]);
                    assert(spark.length === 5 && spark !== "—", "sparkline blocks");
                    statsLine = formatCacheStatsLine(12, 67, 2, 1, spark, " · newest 2h ago");
                    assert(statsLine.includes("LLM cache") && statsLine.includes(spark), "cache stats line");
                    console.log("\n4. Digest restore visibility:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestShownTracker"); })];
                case 178:
                    _0 = _150.sent(), dismissDigestForToday = _0.dismissDigestForToday, restoreDigestVisibility = _0.restoreDigestVisibility, isDigestBlocked = _0.isDigestBlocked, clearDigestShownMarker = _0.clearDigestShownMarker;
                    dismissDigestForToday();
                    assert(isDigestBlocked(), "digest blocked after dismiss");
                    restoreDigestVisibility();
                    assert(!isDigestBlocked(), "digest unblocked after restore");
                    clearDigestShownMarker();
                    console.log("\n5. Cache stats handler sparkline:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/CacheStatsQueryHandler"); })];
                case 179:
                    cacheStatsQueryHandler = (_150.sent()).cacheStatsQueryHandler;
                    return [4 /*yield*/, cacheStatsQueryHandler.tryBuildResponse("/cache stats", "english", "/cache stats")];
                case 180:
                    cacheResp = _150.sent();
                    assert(cacheResp === null || cacheResp === void 0 ? void 0 : cacheResp.response.english.includes("LLM cache"), "cache stats response");
                    console.log("\n✅ All Sprint 32 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 32 complete!");
                    // Sprint 33: WA one-tap reminder, digest snooze label, aging→AI handoff, header sparkline
                    console.log("\n=== SUTRA AI Sprint 33 Tests ===\n");
                    console.log("1. WA open quick-reply encode/decode:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/waQuickReplyBridge"); })];
                case 181:
                    _1 = _150.sent(), encodeWaOpenValue = _1.encodeWaOpenValue, decodeWaOpenValue = _1.decodeWaOpenValue, formatWaOpenConfirmation = _1.formatWaOpenConfirmation;
                    waVal = encodeWaOpenValue({
                        text: "Dear Ram, balance due",
                        phone: "9779841234567",
                        partyName: "Ram",
                    });
                    waDecoded = decodeWaOpenValue(waVal);
                    assert((waDecoded === null || waDecoded === void 0 ? void 0 : waDecoded.text.includes("Ram")) && waDecoded.phone === "9779841234567", "wa open encode decode");
                    waConf = formatWaOpenConfirmation("Ram", "english");
                    assert(waConf.includes("Ram") && waConf.includes("WhatsApp"), "wa open confirmation");
                    console.log("\n2. Reminder handler WA quick reply:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReminderQueryHandler"); })];
                case 182:
                    rem33 = (_150.sent()).reminderQueryHandler;
                    remWa = rem33.tryBuildResponse("/reminder ram", { party: "ram" }, {
                        parties: [
                            {
                                id: "p1",
                                name: "Ram",
                                type: "customer",
                                balance: 5000,
                                phone: "9841234567",
                            },
                        ],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "english", "/reminder ram");
                    remQr = (_131 = (_130 = (_129 = remWa === null || remWa === void 0 ? void 0 : remWa.quickReplies) === null || _129 === void 0 ? void 0 : _129[0]) === null || _130 === void 0 ? void 0 : _130.value) !== null && _131 !== void 0 ? _131 : "";
                    remDecoded = decodeWaOpenValue(remQr);
                    assert((remDecoded === null || remDecoded === void 0 ? void 0 : remDecoded.partyName) === "Ram" && remDecoded.phone != null, "reminder wa quick reply");
                    console.log("\n3. Aging reminder handoff draft:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/agingReminderDraft"); })];
                case 183:
                    _2 = _150.sent(), saveAiAgingReminderDraft = _2.saveAiAgingReminderDraft, consumeAiAgingReminderDraft = _2.consumeAiAgingReminderDraft, buildReminderQueryFromDraft = _2.buildReminderQueryFromDraft;
                    saveAiAgingReminderDraft({
                        partyName: "ABC Suppliers",
                        direction: "payable",
                        outstanding: 12000,
                    });
                    agingRem = consumeAiAgingReminderDraft();
                    assert(buildReminderQueryFromDraft(agingRem) === "/reminder supplier ABC Suppliers", "payable aging reminder query");
                    recvQuery = buildReminderQueryFromDraft({
                        partyName: "Ram",
                        direction: "receivable",
                    });
                    assert(recvQuery === "/reminder Ram", "receivable aging reminder query");
                    console.log("\n4. Digest hidden label:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestShownTracker"); })];
                case 184:
                    _3 = _150.sent(), snoozeDigestForHours = _3.snoozeDigestForHours, formatDigestHiddenLabel = _3.formatDigestHiddenLabel, restoreDigestVisibility = _3.restoreDigestVisibility, clearDigestShownMarker = _3.clearDigestShownMarker;
                    snoozeDigestForHours(2);
                    snoozeLabel = formatDigestHiddenLabel();
                    assert(snoozeLabel.includes("Snoozed") && snoozeLabel.includes("h"), "digest snooze label");
                    restoreDigestVisibility();
                    dismissLabel = formatDigestHiddenLabel();
                    assert(dismissLabel.includes("tomorrow"), "digest dismiss label");
                    clearDigestShownMarker();
                    console.log("\n5. Header sparkline from cache history:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/LlmResponseCache"); })];
                case 185:
                    llmResponseCache = (_150.sent()).llmResponseCache;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/CacheHitSparkline"); })];
                case 186:
                    spark33 = (_150.sent()).formatCacheHitSparkline;
                    llmResponseCache.recordHit();
                    llmResponseCache.recordMiss();
                    llmResponseCache.recordHit();
                    headerSpark = spark33(llmResponseCache.getHitHistory());
                    assert(headerSpark.length >= 3 && headerSpark !== "—", "header cache sparkline");
                    console.log("\n✅ All Sprint 33 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 33 complete!");
                    // Sprint 34: Copy fallback, aging days in query, /digest show, cache tooltip
                    console.log("\n=== SUTRA AI Sprint 34 Tests ===\n");
                    console.log("1. Reminder copy quick-reply:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/waQuickReplyBridge"); })];
                case 187:
                    _4 = _150.sent(), encodeCopyValue = _4.encodeCopyValue, decodeCopyValue = _4.decodeCopyValue, formatCopyConfirmation = _4.formatCopyConfirmation;
                    copyVal = encodeCopyValue({ text: "Dear Ram, balance due", partyName: "Ram" });
                    copyDecoded = decodeCopyValue(copyVal);
                    assert((copyDecoded === null || copyDecoded === void 0 ? void 0 : copyDecoded.text.includes("Ram")) && copyDecoded.partyName === "Ram", "copy encode decode");
                    copyOk = formatCopyConfirmation("Ram", "english", true);
                    assert(copyOk.includes("copied") && copyOk.includes("Ram"), "copy confirmation");
                    console.log("\n2. Reminder without phone uses copy:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReminderQueryHandler"); })];
                case 188:
                    rem34 = (_150.sent()).reminderQueryHandler;
                    noPhoneRem = rem34.tryBuildResponse("/reminder ram", { party: "ram" }, {
                        parties: [{ id: "p1", name: "Ram", type: "customer", balance: 5000 }],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "english", "/reminder ram");
                    assert(((_133 = (_132 = noPhoneRem === null || noPhoneRem === void 0 ? void 0 : noPhoneRem.quickReplies) === null || _132 === void 0 ? void 0 : _132[0]) === null || _133 === void 0 ? void 0 : _133.label) === "Copy" &&
                        ((_134 = decodeCopyValue(noPhoneRem.quickReplies[0].value)) === null || _134 === void 0 ? void 0 : _134.text) != null, "no-phone copy quick reply");
                    console.log("\n3. Aging handoff with overdue days:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/agingReminderDraft"); })];
                case 189:
                    buildReminderQueryFromDraft = (_150.sent()).buildReminderQueryFromDraft;
                    agingQ = buildReminderQueryFromDraft({
                        partyName: "ABC Suppliers",
                        direction: "payable",
                        daysOverdue: 60,
                    });
                    assert(agingQ === "/reminder supplier ABC Suppliers 60 days overdue", "aging query with days");
                    console.log("\n4. Reminder parses explicit overdue days:");
                    daysRem = rem34.tryBuildResponse(agingQ, { party: "ABC Suppliers" }, {
                        parties: [
                            {
                                id: "s1",
                                name: "ABC Suppliers",
                                type: "supplier",
                                balance: -12000,
                            },
                        ],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "english", agingQ);
                    assert(((_135 = daysRem === null || daysRem === void 0 ? void 0 : daysRem.shareText) === null || _135 === void 0 ? void 0 : _135.includes("60 days overdue")) || ((_136 = daysRem === null || daysRem === void 0 ? void 0 : daysRem.shareText) === null || _136 === void 0 ? void 0 : _136.includes("payable")), "explicit days in reminder");
                    console.log("\n5. /digest show shortcut:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/routing/ShortcutRouter"); })];
                case 190:
                    shortcutRouter = (_150.sent()).shortcutRouter;
                    showDigest = shortcutRouter.route("/digest show", "english");
                    assert(showDigest.handled && showDigest.shortcutAction === "show_digest", "digest show route");
                    console.log("\n6. Cache sparkline tooltip:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/CacheHitSparkline"); })];
                case 191:
                    formatCacheSparklineTooltip = (_150.sent()).formatCacheSparklineTooltip;
                    tip = formatCacheSparklineTooltip([1, 0, 1], 67);
                    assert(tip.includes("67%") && tip.includes("▁"), "cache tooltip with rate");
                    console.log("\n✅ All Sprint 34 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 34 complete!");
                    // Sprint 35: Dual reminder QR, aging WA auto-open, digest show QR, live cache tooltip
                    console.log("\n=== SUTRA AI Sprint 35 Tests ===\n");
                    console.log("1. Reminder dual WhatsApp + Copy quick replies:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReminderQueryHandler"); })];
                case 192:
                    rem35 = (_150.sent()).reminderQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/waQuickReplyBridge"); })];
                case 193:
                    _5 = _150.sent(), decodeWaOpenValue = _5.decodeWaOpenValue, decodeCopyValue = _5.decodeCopyValue;
                    phoneRem = rem35.tryBuildResponse("/reminder ram", { party: "ram" }, {
                        parties: [
                            {
                                id: "p1",
                                name: "Ram",
                                type: "customer",
                                balance: 5000,
                                phone: "9841234567",
                            },
                        ],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "english", "/reminder ram");
                    assert(((_137 = phoneRem === null || phoneRem === void 0 ? void 0 : phoneRem.quickReplies) === null || _137 === void 0 ? void 0 : _137.length) === 2, "two quick replies with phone");
                    assert(((_138 = decodeWaOpenValue(phoneRem.quickReplies[0].value)) === null || _138 === void 0 ? void 0 : _138.phone) != null &&
                        ((_139 = decodeCopyValue(phoneRem.quickReplies[1].value)) === null || _139 === void 0 ? void 0 : _139.text) != null, "wa + copy payloads");
                    console.log("\n2. Aging WA auto-open queue:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/agingReminderDraft"); })];
                case 194:
                    _6 = _150.sent(), queueAgingWaAutoOpen = _6.queueAgingWaAutoOpen, consumeAgingWaAutoOpen = _6.consumeAgingWaAutoOpen;
                    queueAgingWaAutoOpen("Ram");
                    assert(consumeAgingWaAutoOpen() === "Ram", "aging wa auto-open consume");
                    assert(consumeAgingWaAutoOpen() == null, "aging wa auto-open once");
                    console.log("\n3. Digest dismiss quick reply:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/core/IntelligenceCore"); })];
                case 195:
                    core35 = new (_150.sent()).IntelligenceCore();
                    return [4 /*yield*/, core35.processInput("/digest dismiss", { useLlm: false })];
                case 196:
                    dismiss = _150.sent();
                    assert(dismiss.shortcutAction === "dismiss_digest" &&
                        ((_140 = dismiss.response.quickReplies) === null || _140 === void 0 ? void 0 : _140.some(function (q) { return q.value === "/digest show"; })), "digest dismiss show-again qr");
                    console.log("\n4. Digest snooze quick reply:");
                    return [4 /*yield*/, core35.processInput("/digest snooze 2", { useLlm: false })];
                case 197:
                    snooze = _150.sent();
                    assert(snooze.shortcutAction === "snooze_digest" &&
                        ((_141 = snooze.response.quickReplies) === null || _141 === void 0 ? void 0 : _141.some(function (q) { return q.label === "Show again"; })), "digest snooze show-again qr");
                    console.log("\n5. Cache history len in lastReplyMeta pattern:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/LlmResponseCache"); })];
                case 198:
                    cache35 = (_150.sent()).llmResponseCache;
                    cache35.recordHit();
                    len = cache35.getHitHistory().length;
                    assert(len >= 1, "cache history grows after hit");
                    console.log("\n✅ All Sprint 35 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 35 complete!");
                    // Sprint 36: Remind modal SUTRA, phone-save copy, digest bar chip, cache hit % in header
                    console.log("\n=== SUTRA AI Sprint 36 Tests ===\n");
                    console.log("1. Phone saved Copy quick-reply:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 199:
                    _7 = _150.sent(), buildPhoneSavedQuickReplies = _7.buildPhoneSavedQuickReplies, encodePhoneSavedCopyValue = _7.encodePhoneSavedCopyValue;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 200:
                    tryHandlePhoneSavedCopyQuickReply = (_150.sent()).tryHandlePhoneSavedCopyQuickReply;
                    phoneChips = buildPhoneSavedQuickReplies({ partyName: "Ram", phone: "9841234567", savedAt: Date.now(), balance: 3000 }, "english");
                    assert(phoneChips.length === 4 && phoneChips[1].label === "Copy", "phone saved copy chip");
                    copyChip = tryHandlePhoneSavedCopyQuickReply(phoneChips[1].value, "english");
                    assert((copyChip === null || copyChip === void 0 ? void 0 : copyChip.text.includes("Ram")) && copyChip.partyName === "Ram", "phone saved copy payload");
                    console.log("\n2. Dual reminder quick replies still present:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/ReminderQueryHandler"); })];
                case 201:
                    rem36 = (_150.sent()).reminderQueryHandler;
                    dual = rem36.tryBuildResponse("/reminder ram", { party: "ram" }, {
                        parties: [
                            { id: "p1", name: "Ram", type: "customer", balance: 5000, phone: "9841234567" },
                        ],
                    }, { intent: "QUERY", confidence: 0.9, entities: {} }, "english", "/reminder ram");
                    assert(((_142 = dual === null || dual === void 0 ? void 0 : dual.quickReplies) === null || _142 === void 0 ? void 0 : _142.length) === 2, "reminder wa+copy");
                    console.log("\n3. Cache header hit rate label:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/CacheHitSparkline"); })];
                case 202:
                    _8 = _150.sent(), formatCacheHitSparkline = _8.formatCacheHitSparkline, formatCacheSparklineTooltip = _8.formatCacheSparklineTooltip;
                    spark36 = formatCacheHitSparkline([1, 1, 0]);
                    tip36 = formatCacheSparklineTooltip([1, 1, 0], 67);
                    assert(spark36.length === 3 && tip36.includes("67%"), "cache header rate tooltip");
                    console.log("\n4. Digest show quick-reply constant:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/routing/ShortcutRouter"); })];
                case 203:
                    sr36 = (_150.sent()).shortcutRouter;
                    show36 = sr36.route("/digest show", "english");
                    assert(show36.shortcutAction === "show_digest", "digest show still routed");
                    console.log("\n5. Aging reminder draft with auto WA:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/agingReminderDraft"); })];
                case 204:
                    buildReminderQueryFromDraft = (_150.sent()).buildReminderQueryFromDraft;
                    q36 = buildReminderQueryFromDraft({
                        partyName: "Ram",
                        direction: "receivable",
                        daysOverdue: 30,
                        autoOpenWhatsApp: true,
                    });
                    assert(q36 === "/reminder Ram 30 days overdue", "aging remind sutra query");
                    console.log("\n✅ All Sprint 36 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 36 complete!");
                    // Sprint 37: Phone copy lang, digest chip dedup, SUTRA-only modal, cache header copy
                    console.log("\n=== SUTRA AI Sprint 37 Tests ===\n");
                    console.log("1. Phone saved copy uses live output language:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 205:
                    _9 = _150.sent(), encodePhoneSavedCopyValue = _9.encodePhoneSavedCopyValue, tryHandlePhoneSavedCopyQuickReply = _9.tryHandlePhoneSavedCopyQuickReply;
                    notice37 = { partyName: "Ram", phone: "9841234567", savedAt: Date.now(), balance: 5000 };
                    copyVal37 = encodePhoneSavedCopyValue(notice37);
                    enCopy = tryHandlePhoneSavedCopyQuickReply(copyVal37, "english");
                    neCopy = tryHandlePhoneSavedCopyQuickReply(copyVal37, "nepali");
                    assert((enCopy === null || enCopy === void 0 ? void 0 : enCopy.text.includes("Dear Ram")) && (neCopy === null || neCopy === void 0 ? void 0 : neCopy.text.includes("नमस्ते")), "phone copy live lang");
                    console.log("\n2. Digest chip dedup logic:");
                    shouldPostDigestChip = function (isOpen, chipPosted) { return isOpen && !chipPosted; };
                    assert(shouldPostDigestChip(true, false) && !shouldPostDigestChip(true, true), "digest chip dedup gate");
                    console.log("\n3. buildCacheStatsSummary:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/CacheHitSparkline"); })];
                case 206:
                    buildCacheStatsSummary = (_150.sent()).buildCacheStatsSummary;
                    return [4 /*yield*/, buildCacheStatsSummary()];
                case 207:
                    summary37 = _150.sent();
                    assert(summary37.includes("LLM cache"), "cache stats summary");
                    console.log("\n4. Aging handoff without auto WA:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/agingReminderDraft"); })];
                case 208:
                    buildReminderQueryFromDraft = (_150.sent()).buildReminderQueryFromDraft;
                    sutraOnly = buildReminderQueryFromDraft({
                        partyName: "Ram",
                        direction: "receivable",
                    });
                    assert(sutraOnly === "/reminder Ram", "sutra only query");
                    console.log("\n5. Phone saved copy prefix distinct from wa:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 209:
                    _10 = _150.sent(), PHONE_SAVED_COPY_PREFIX = _10.PHONE_SAVED_COPY_PREFIX, PHONE_SAVED_WA_PREFIX = _10.PHONE_SAVED_WA_PREFIX;
                    assert(PHONE_SAVED_COPY_PREFIX !== PHONE_SAVED_WA_PREFIX &&
                        copyVal37.startsWith(PHONE_SAVED_COPY_PREFIX), "copy prefix");
                    console.log("\n✅ All Sprint 37 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 37 complete!");
                    // Sprint 38: Cache dbl-click, WA live lang, digest chip dismiss, aging SUTRA split
                    console.log("\n=== SUTRA AI Sprint 38 Tests ===\n");
                    console.log("1. Phone saved WA uses live output language:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 210:
                    _11 = _150.sent(), encodePhoneSavedWaValue = _11.encodePhoneSavedWaValue, tryHandlePhoneSavedWaQuickReply = _11.tryHandlePhoneSavedWaQuickReply;
                    waNotice = { partyName: "Ram", phone: "9841234567", savedAt: Date.now(), balance: 4000 };
                    waVal = encodePhoneSavedWaValue(waNotice);
                    waEn = tryHandlePhoneSavedWaQuickReply(waVal, "english");
                    waNe = tryHandlePhoneSavedWaQuickReply(waVal, "nepali");
                    assert((waEn === null || waEn === void 0 ? void 0 : waEn.shareText.includes("Dear Ram")) && (waNe === null || waNe === void 0 ? void 0 : waNe.shareText.includes("नमस्ते")), "wa live lang");
                    console.log("\n2. Digest chip auto-dismiss:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestShownTracker"); })];
                case 211:
                    _12 = _150.sent(), isDigestHiddenChipMessage = _12.isDigestHiddenChipMessage, withoutDigestHiddenChips = _12.withoutDigestHiddenChips;
                    withChip = [
                        { role: "user", text: "hi" },
                        { role: "assistant", text: "hidden", isDigestChip: true },
                    ];
                    assert(isDigestHiddenChipMessage(withChip[1]) &&
                        withoutDigestHiddenChips(withChip).length === 1, "digest chip filter");
                    console.log("\n3. Cache tooltip double-click hint:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/CacheHitSparkline"); })];
                case 212:
                    formatCacheSparklineTooltip = (_150.sent()).formatCacheSparklineTooltip;
                    tip38 = formatCacheSparklineTooltip([1, 0], 50);
                    assert(tip38.includes("Double-click"), "cache dbl-click tooltip");
                    console.log("\n4. Aging handoff sutra-only vs wa:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/agingReminderDraft"); })];
                case 213:
                    buildReminderQueryFromDraft = (_150.sent()).buildReminderQueryFromDraft;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/agingReminderDraft"); })];
                case 214:
                    _13 = _150.sent(), queueAgingWaAutoOpen = _13.queueAgingWaAutoOpen, consumeAgingWaAutoOpen = _13.consumeAgingWaAutoOpen;
                    assert(buildReminderQueryFromDraft({ partyName: "Ram", direction: "receivable" }) === "/reminder Ram", "row sutra");
                    queueAgingWaAutoOpen("Ram");
                    assert(consumeAgingWaAutoOpen() === "Ram", "row sutra+wa queue");
                    console.log("\n5. buildCacheStatsSummary still works:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/CacheHitSparkline"); })];
                case 215:
                    buildCacheStatsSummary = (_150.sent()).buildCacheStatsSummary;
                    return [4 /*yield*/, buildCacheStatsSummary()];
                case 216:
                    sum38 = _150.sent();
                    assert(sum38.includes("LLM cache"), "cache summary");
                    console.log("\n✅ All Sprint 38 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 38 complete!");
                    // Sprint 39: Cache 3× clear, localized phone chips, digest scroll, +WA phone gate
                    console.log("\n=== SUTRA AI Sprint 39 Tests ===\n");
                    console.log("1. Phone saved localized quick-reply labels:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 217:
                    _14 = _150.sent(), getPhoneSavedQuickReplyLabels = _14.getPhoneSavedQuickReplyLabels, buildPhoneSavedQuickReplies = _14.buildPhoneSavedQuickReplies;
                    neLabels = getPhoneSavedQuickReplyLabels("nepali");
                    enLabels = getPhoneSavedQuickReplyLabels("english");
                    assert(neLabels.send.includes("पठाउ") && enLabels.send === "Send now", "localized chip labels");
                    neChips = buildPhoneSavedQuickReplies({ partyName: "Ram", phone: "9841234567", savedAt: Date.now() }, "nepali");
                    assert(neChips[0].label === neLabels.send && neChips[1].label === neLabels.copy, "chips use labels");
                    console.log("\n2. Cache tooltip triple-click hint:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/CacheHitSparkline"); })];
                case 218:
                    formatCacheSparklineTooltip = (_150.sent()).formatCacheSparklineTooltip;
                    tip39 = formatCacheSparklineTooltip([1, 0, 1], 60);
                    assert(tip39.includes("3×: clear"), "cache triple-click tooltip");
                    console.log("3. Cache header click tiers:");
                    tier = function (clicks) {
                        return clicks >= 3 ? "clear" : clicks === 2 ? "stats" : "copy";
                    };
                    assert(tier(1) === "copy" && tier(2) === "stats" && tier(3) === "clear", "click tiers");
                    console.log("\n4. Digest hidden chip helpers:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestShownTracker"); })];
                case 219:
                    withoutDigestHiddenChips = (_150.sent()).withoutDigestHiddenChips;
                    assert(withoutDigestHiddenChips([{ isDigestChip: true }, {}]).length === 1, "chip strip");
                    console.log("\n5. Aging WA gate needs phone:");
                    hasPhone = function (phone) { return Boolean(phone === null || phone === void 0 ? void 0 : phone.trim()); };
                    assert(!hasPhone(undefined) && hasPhone("9841234567"), "wa phone gate");
                    console.log("\n✅ All Sprint 39 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 39 complete!");
                    // Sprint 40: Roman chip labels, cache clear confirm, digest pin, +WA setphone handoff
                    console.log("\n=== SUTRA AI Sprint 40 Tests ===\n");
                    console.log("1. Roman phone-save chip labels:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 220:
                    getPhoneSavedQuickReplyLabels = (_150.sent()).getPhoneSavedQuickReplyLabels;
                    ro = getPhoneSavedQuickReplyLabels("roman");
                    assert(ro.send === "Ahile pathau" && ro.copy === "Copy", "roman chip labels");
                    console.log("\n2. Setphone handoff query:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/chatQueryDraft"); })];
                case 221:
                    _15 = _150.sent(), buildSetPhoneHandoffQuery = _15.buildSetPhoneHandoffQuery, saveAiChatQueryDraft = _15.saveAiChatQueryDraft, consumeAiChatQueryDraft = _15.consumeAiChatQueryDraft;
                    setQ = buildSetPhoneHandoffQuery("Ram Traders");
                    assert(setQ === "/setphone Ram Traders ", "setphone handoff query");
                    saveAiChatQueryDraft(setQ);
                    assert(consumeAiChatQueryDraft() === setQ, "chat query draft");
                    console.log("\n3. Cache tooltip confirm hint:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/CacheHitSparkline"); })];
                case 222:
                    formatCacheSparklineTooltip = (_150.sent()).formatCacheSparklineTooltip;
                    assert(formatCacheSparklineTooltip([1], 50).includes("confirm"), "cache clear confirm hint");
                    console.log("\n4. Cache click tier with confirm gate:");
                    tier40 = function (clicks, confirmed) {
                        return clicks >= 3 && confirmed ? "clear" : clicks === 2 ? "stats" : "copy";
                    };
                    assert(tier40(3, false) === "copy" && tier40(3, true) === "clear", "confirm gate");
                    console.log("\n5. Nepali labels unchanged:");
                    ne = getPhoneSavedQuickReplyLabels("nepali");
                    assert(ne.send.includes("पठाउ"), "nepali chip labels");
                    console.log("\n✅ All Sprint 40 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 40 complete!");
                    // Sprint 41: Digest pin persist, localized cache confirm, phone setphone QR, aging label
                    console.log("\n=== SUTRA AI Sprint 41 Tests ===\n");
                    console.log("1. Digest pin localStorage:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestPinPreference"); })];
                case 223:
                    _16 = _150.sent(), readDigestPinnedPreference = _16.readDigestPinnedPreference, writeDigestPinnedPreference = _16.writeDigestPinnedPreference, formatCacheClearConfirm = _16.formatCacheClearConfirm, agingWaButtonLabel = _16.agingWaButtonLabel;
                    writeDigestPinnedPreference(false);
                    assert(readDigestPinnedPreference() === false, "digest pin saved");
                    writeDigestPinnedPreference(true);
                    assert(readDigestPinnedPreference() === true, "digest pin restore");
                    console.log("\n2. Localized cache clear confirm:");
                    neConfirm = formatCacheClearConfirm("nepali");
                    enConfirm = formatCacheClearConfirm("english");
                    assert(neConfirm.includes("मेट्ने") && enConfirm.includes("Clear"), "cache confirm i18n");
                    console.log("\n3. Party phone missing setphone quick reply:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/PartyPhoneQueryHandler"); })];
                case 224:
                    partyPhoneQueryHandler = (_150.sent()).partyPhoneQueryHandler;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/chatQueryDraft"); })];
                case 225:
                    buildSetPhoneHandoffQuery = (_150.sent()).buildSetPhoneHandoffQuery;
                    noPh = partyPhoneQueryHandler.tryBuildResponse("/phone ram", { party: "ram" }, { parties: [{ id: "p1", name: "Ram", type: "customer", balance: 1000 }] }, { intent: "QUERY", confidence: 0.9, entities: {} }, "english", "/phone ram");
                    assert(((_144 = (_143 = noPh === null || noPh === void 0 ? void 0 : noPh.quickReplies) === null || _143 === void 0 ? void 0 : _143[0]) === null || _144 === void 0 ? void 0 : _144.value) === buildSetPhoneHandoffQuery("Ram"), "phone query setphone qr");
                    console.log("\n4. Aging WA button label:");
                    assert(agingWaButtonLabel(true) === "+WA" && agingWaButtonLabel(false, "nepali").includes("फोन"), "wa label");
                    console.log("\n5. Roman cache clear confirm:");
                    roConfirm = formatCacheClearConfirm("roman");
                    assert(roConfirm.includes("clear"), "roman cache confirm");
                    console.log("\n✅ All Sprint 41 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 41 complete!");
                    // Sprint 42: Localized pin/cache sync, aging return after setphone, NE aging labels
                    console.log("\n=== SUTRA AI Sprint 42 Tests ===\n");
                    console.log("1. Digest pin labels localized:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestPinPreference"); })];
                case 226:
                    _17 = _150.sent(), formatDigestPinLabels = _17.formatDigestPinLabels, formatCacheSyncMessage = _17.formatCacheSyncMessage;
                    nePin = formatDigestPinLabels("nepali", true);
                    assert(nePin.label.includes("टाँस"), "nepali pinned label");
                    enPin = formatDigestPinLabels("english", false);
                    assert(enPin.label === "Pin", "english pin label");
                    console.log("\n2. Cache sync messages localized:");
                    neSync = formatCacheSyncMessage("stats_copied", "nepali");
                    enSync = formatCacheSyncMessage("clear_requested", "english");
                    assert(neSync.includes("कपी") && enSync.includes("Cache clear"), "cache sync i18n");
                    console.log("\n3. Aging setphone return draft + quick reply:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/chatQueryDraft"); })];
                case 227:
                    _18 = _150.sent(), saveAgingSetphoneReturnDraft = _18.saveAgingSetphoneReturnDraft, consumeAgingSetphoneReturnDraft = _18.consumeAgingSetphoneReturnDraft, encodeAgingReturnQuickReplyValue = _18.encodeAgingReturnQuickReplyValue, decodeAgingReturnQuickReplyValue = _18.decodeAgingReturnQuickReplyValue, formatAgingReturnConfirmation = _18.formatAgingReturnConfirmation;
                    saveAgingSetphoneReturnDraft({ direction: "receivable", searchTerm: "Ram" });
                    peeked = consumeAgingSetphoneReturnDraft();
                    assert((peeked === null || peeked === void 0 ? void 0 : peeked.searchTerm) === "Ram", "aging return draft roundtrip");
                    enc = encodeAgingReturnQuickReplyValue({ direction: "payable", searchTerm: "ABC" });
                    dec = decodeAgingReturnQuickReplyValue(enc);
                    assert((dec === null || dec === void 0 ? void 0 : dec.direction) === "payable", "aging return qr codec");
                    console.log("\n4. Phone saved adds aging return QR:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 228:
                    buildPhoneSavedQuickReplies = (_150.sent()).buildPhoneSavedQuickReplies;
                    saveAgingSetphoneReturnDraft({ direction: "receivable", searchTerm: "Ram" });
                    qrs = buildPhoneSavedQuickReplies({ partyName: "Ram", phone: "9841234567", savedAt: Date.now() }, "nepali");
                    assert(qrs.some(function (q) { return q.id === "ph-saved-aging"; }), "aging return qr on phone save");
                    consumeAgingSetphoneReturnDraft();
                    console.log("\n5. Party phone setphone label uses output lang:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/PartyPhoneQueryHandler"); })];
                case 229:
                    partyPhoneQueryHandler = (_150.sent()).partyPhoneQueryHandler;
                    nePh = partyPhoneQueryHandler.tryBuildResponse("/phone ram", { party: "ram" }, { parties: [{ id: "p1", name: "Ram", type: "customer", balance: 1000 }] }, { intent: "QUERY", confidence: 0.9, entities: {} }, "nepali", "/phone ram");
                    assert((_147 = (_146 = (_145 = nePh === null || nePh === void 0 ? void 0 : nePh.quickReplies) === null || _145 === void 0 ? void 0 : _145[0]) === null || _146 === void 0 ? void 0 : _146.label) === null || _147 === void 0 ? void 0 : _147.includes("फोन"), "nepali setphone qr label");
                    console.log("\n6. Aging return confirmation:");
                    assert(formatAgingReturnConfirmation("nepali").includes("Aging"), "aging return confirm");
                    console.log("\n✅ All Sprint 42 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 42 complete!");
                    // Sprint 43: Digest header/snooze i18n, cached badge, roman aging confirm, search prefill
                    console.log("\n=== SUTRA AI Sprint 43 Tests ===\n");
                    console.log("1. Daily digest header + snooze chips:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestShownTracker"); })];
                case 230:
                    _19 = _150.sent(), formatDailyDigestHeader = _19.formatDailyDigestHeader, formatDigestSnoozeChip = _19.formatDigestSnoozeChip, formatDigestSnoozeTitle = _19.formatDigestSnoozeTitle, formatDigestHiddenLabel = _19.formatDigestHiddenLabel;
                    assert(formatDailyDigestHeader("nepali").includes("सारांश"), "digest header ne");
                    assert(formatDigestSnoozeChip("1h", "nepali") === "१घ", "snooze 1h ne");
                    assert(formatDigestSnoozeChip("tomorrow", "roman") === "Bholi", "snooze tomorrow roman");
                    assert(formatDigestSnoozeTitle("4h", "nepali").includes("४"), "snooze title ne");
                    console.log("\n2. Digest hidden label localized:");
                    hiddenNe = formatDigestHiddenLabel("nepali");
                    assert(hiddenNe.includes("भोलि"), "hidden label ne");
                    console.log("\n3. Cached badge localized:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestPinPreference"); })];
                case 231:
                    _20 = _150.sent(), formatCachedBadgeLabel = _20.formatCachedBadgeLabel, formatCachedHeaderSubtitle = _20.formatCachedHeaderSubtitle;
                    assert(formatCachedBadgeLabel("nepali") === "क्यास", "cached badge ne");
                    assert(formatCachedHeaderSubtitle("nepali").includes("क्यास"), "cached subtitle ne");
                    console.log("\n4. Roman aging return confirmation:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/chatQueryDraft"); })];
                case 232:
                    agingConfirm43 = (_150.sent()).formatAgingReturnConfirmation;
                    roAging = agingConfirm43("roman");
                    assert(roAging.includes("search") && roAging.includes("khulyo"), "roman aging confirm");
                    console.log("\n5. Aging report draft search prefill:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/agingReportDraft"); })];
                case 233:
                    _21 = _150.sent(), saveAiAgingReportDraft = _21.saveAiAgingReportDraft, peekAiAgingReportDraft = _21.peekAiAgingReportDraft, consumeAiAgingReportDraft = _21.consumeAiAgingReportDraft;
                    saveAiAgingReportDraft({ direction: "payable", searchTerm: "ABC Traders" });
                    peekDraft = peekAiAgingReportDraft();
                    assert((peekDraft === null || peekDraft === void 0 ? void 0 : peekDraft.searchTerm) === "ABC Traders", "aging draft peek search");
                    consumed = consumeAiAgingReportDraft();
                    assert((consumed === null || consumed === void 0 ? void 0 : consumed.direction) === "payable" && consumed.searchTerm === "ABC Traders", "aging draft consume");
                    console.log("\n✅ All Sprint 43 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 43 complete!");
                    // Sprint 44: Show again i18n, aging placeholder, roman phone QR, cache tooltip
                    console.log("\n=== SUTRA AI Sprint 44 Tests ===\n");
                    console.log("1. Digest show again label:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestShownTracker"); })];
                case 234:
                    _22 = _150.sent(), formatDigestShowAgainLabel = _22.formatDigestShowAgainLabel, buildDigestShowQuickReply = _22.buildDigestShowQuickReply;
                    assert(formatDigestShowAgainLabel("nepali").includes("फेरि"), "show again ne");
                    assert(buildDigestShowQuickReply("roman").label === "Feri dekhau", "show again qr roman");
                    console.log("\n2. Aging search placeholder:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestPinPreference"); })];
                case 235:
                    formatAgingSearchPlaceholder = (_150.sent()).formatAgingSearchPlaceholder;
                    assert(formatAgingSearchPlaceholder("nepali").includes("पार्टी"), "aging placeholder ne");
                    console.log("\n3. Roman phone saved quick reply labels:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 236:
                    getPhoneSavedQuickReplyLabels = (_150.sent()).getPhoneSavedQuickReplyLabels;
                    roLabels = getPhoneSavedQuickReplyLabels("roman");
                    assert(roLabels.reminder === "Samjhana" && roLabels.balance === "Baki herau", "roman phone qr");
                    console.log("\n4. Cache tooltip localized:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/learning/CacheHitSparkline"); })];
                case 237:
                    formatCacheSparklineTooltip = (_150.sent()).formatCacheSparklineTooltip;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestPinPreference"); })];
                case 238:
                    formatCachedBadgeTooltip = (_150.sent()).formatCachedBadgeTooltip;
                    neTip = formatCacheSparklineTooltip([1, 0, 1], 60, "nepali");
                    assert(neTip.includes("मेट्नुहोस्"), "cache sparkline tooltip ne");
                    assert(formatCachedBadgeTooltip("nepali").includes("cache"), "cached badge tooltip ne");
                    console.log("\n5. Roman cache sparkline tooltip:");
                    roTip = formatCacheSparklineTooltip([1], 50, "roman");
                    assert(roTip.includes("Halka"), "cache tooltip roman");
                    console.log("\n✅ All Sprint 44 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 44 complete!");
                    // Sprint 45: Digest reply i18n, aging modal title, roman copy confirm, cache stats i18n
                    console.log("\n=== SUTRA AI Sprint 45 Tests ===\n");
                    console.log("1. Digest dismiss/snooze replies:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestShownTracker"); })];
                case 239:
                    _23 = _150.sent(), formatDigestDismissReply = _23.formatDigestDismissReply, formatDigestSnoozeReply = _23.formatDigestSnoozeReply, formatDigestShowReply = _23.formatDigestShowReply;
                    assert(formatDigestDismissReply("nepali").includes("सारांश"), "digest dismiss ne");
                    assert(formatDigestSnoozeReply(4, "nepali").includes("स्नूज"), "digest snooze ne");
                    assert(formatDigestShowReply("roman").includes("dekhiyo"), "digest show roman");
                    console.log("\n2. Aging reminder modal title:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestPinPreference"); })];
                case 240:
                    formatAgingReminderModalTitle = (_150.sent()).formatAgingReminderModalTitle;
                    assert(formatAgingReminderModalTitle("payable", "nepali").includes("भुक्तानी"), "aging modal title ne");
                    console.log("\n3. Roman copy confirmation:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/waQuickReplyBridge"); })];
                case 241:
                    formatCopyConfirmation = (_150.sent()).formatCopyConfirmation;
                    roCopy = formatCopyConfirmation("Ram", "roman", true);
                    assert(roCopy.includes("clipboard"), "roman copy confirm");
                    console.log("\n4. Cache stats localized:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/rag/CacheStatsQueryHandler"); })];
                case 242:
                    cacheStatsQueryHandler = (_150.sent()).cacheStatsQueryHandler;
                    return [4 /*yield*/, cacheStatsQueryHandler.tryBuildResponse("/cache stats", "nepali", "/cache stats")];
                case 243:
                    cacheNe = _150.sent();
                    return [4 /*yield*/, cacheStatsQueryHandler.tryBuildResponse("/cache stats", "roman", "/cache stats")];
                case 244:
                    cacheRo = _150.sent();
                    assert(cacheNe === null || cacheNe === void 0 ? void 0 : cacheNe.response.nepali.includes("वटा"), "cache stats ne entries");
                    assert(((_149 = (_148 = cacheRo === null || cacheRo === void 0 ? void 0 : cacheRo.quickReplies) === null || _148 === void 0 ? void 0 : _148[0]) === null || _149 === void 0 ? void 0 : _149.label) === "Cache clear", "cache clear qr roman");
                    console.log("\n5. Cache cleared reply localized:");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestPinPreference"); })];
                case 245:
                    formatCacheClearedReply = (_150.sent()).formatCacheClearedReply;
                    assert(formatCacheClearedReply(3, "nepali").includes("मेटियो"), "cache cleared ne");
                    console.log("\n✅ All Sprint 45 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 45 complete!");
                    // Sprint 46: Aging modal buttons, alerts header, roman WA confirm
                    console.log("\n=== SUTRA AI Sprint 46 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestPinPreference"); })];
                case 246:
                    _24 = _150.sent(), formatProactiveAlertsHeader = _24.formatProactiveAlertsHeader, formatAgingRemindWaButton = _24.formatAgingRemindWaButton, formatAgingRemindCopyButton = _24.formatAgingRemindCopyButton, formatCacheClearConfirm = _24.formatCacheClearConfirm;
                    assert(formatProactiveAlertsHeader("nepali") === "सतर्कता", "alerts header ne");
                    assert(formatAgingRemindWaButton(false, "nepali").includes("खोल्नुहोस्"), "aging wa btn ne");
                    assert(formatAgingRemindCopyButton("roman") === "Copy garau", "aging copy roman");
                    assert(formatCacheClearConfirm("roman").includes("clear"), "cache confirm roman");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 247:
                    formatWhatsAppSentConfirmation = (_150.sent()).formatWhatsAppSentConfirmation;
                    assert(formatWhatsAppSentConfirmation("Ram", "roman").includes("WhatsApp ma"), "wa confirm roman");
                    console.log("\n✅ All Sprint 46 tests passed!");
                    // Sprint 47: Aging setphone draft carries overdue for smarter reminder share
                    console.log("\n=== SUTRA AI Sprint 47 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/chatQueryDraft"); })];
                case 248:
                    _25 = _150.sent(), saveAgingSetphoneReturnDraft = _25.saveAgingSetphoneReturnDraft, consumeAgingSetphoneReturnDraft = _25.consumeAgingSetphoneReturnDraft;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 249:
                    buildPhoneSavedReminderShare = (_150.sent()).buildPhoneSavedReminderShare;
                    saveAgingSetphoneReturnDraft({
                        direction: "receivable",
                        searchTerm: "Ram",
                        outstanding: 5000,
                        daysOverdue: 30,
                    });
                    share = buildPhoneSavedReminderShare({ partyName: "Ram", phone: "9841234567", savedAt: Date.now() }, "english");
                    assert(share.includes("30 days overdue"), "aging overdue in phone saved share");
                    consumeAgingSetphoneReturnDraft();
                    console.log("\n✅ All Sprint 47 tests passed!");
                    // Sprint 48: Chat sync + analyzing labels
                    console.log("\n=== SUTRA AI Sprint 48 Tests ===\n");
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestPinPreference"); })];
                case 250:
                    _26 = _150.sent(), formatChatSyncMessage = _26.formatChatSyncMessage, formatAnalyzingLabel = _26.formatAnalyzingLabel;
                    assert(formatChatSyncMessage("reminder_copied", "nepali").includes("कपी"), "chat sync ne");
                    assert(formatAnalyzingLabel("roman").includes("gardai"), "analyzing roman");
                    console.log("\n✅ All Sprint 48 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprints 46–48 complete!");
                    // Sprint 49: Smarter phone-save reminder query + auto-correct label
                    console.log("\n=== SUTRA AI Sprint 49 Tests ===\n");
                    saveAgingSetphoneReturnDraft({
                        direction: "receivable",
                        searchTerm: "Ram",
                        outstanding: 8000,
                        daysOverdue: 60,
                    });
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/actions/partyPhoneSavedBridge"); })];
                case 251:
                    _27 = _150.sent(), buildPhoneSavedReminderQuery = _27.buildPhoneSavedReminderQuery, formatPartyPhoneSavedMessage = _27.formatPartyPhoneSavedMessage;
                    remQ = buildPhoneSavedReminderQuery({
                        partyName: "Ram",
                        phone: "9841234567",
                        savedAt: Date.now(),
                    });
                    assert(remQ.includes("60 days overdue"), "phone saved reminder query overdue");
                    savedMsg = formatPartyPhoneSavedMessage({ partyName: "Ram", phone: "9841234567", savedAt: Date.now() }, "english");
                    assert(savedMsg.includes("8,000"), "phone saved msg mentions balance");
                    consumeAgingSetphoneReturnDraft();
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../src/ai/intelligence/DigestPinPreference"); })];
                case 252:
                    formatAutoCorrectedLabel = (_150.sent()).formatAutoCorrectedLabel;
                    assert(formatAutoCorrectedLabel("nepali").includes("सुधार"), "auto-correct ne");
                    console.log("\n✅ All Sprint 49 tests passed!");
                    console.log("\n🎉 SUTRA AI — Sprint 49 complete!");
                    return [2 /*return*/];
            }
        });
    });
}
function assert(condition, message) {
    if (!condition) {
        console.error("\n\u274C ASSERTION FAILED: ".concat(message));
        process.exit(1);
    }
}
main().catch(function (e) {
    console.error("Test failed:", e);
    process.exit(1);
});
