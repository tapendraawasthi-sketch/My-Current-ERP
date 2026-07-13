"use strict";
/**
 * SUTRA AI — expanded golden test corpus (Sprint 12)
 * Categories: misspellings, sales, purchase, queries, reports, edge, adversarial
 */
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
exports.GOLDEN_CASES = void 0;
exports.runGoldenSuite = runGoldenSuite;
exports.GOLDEN_CASES = [
    // Misspellings
    {
        input: "maele 500 ko kakor bechye",
        label: "maele+kakor",
        category: "misspelling",
        check: function (r) {
            var _a, _b;
            return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "SALES_ENTRY" &&
                (((_b = r.entities) === null || _b === void 0 ? void 0 : _b.amount) === 500 || r.suggestions != null || r.autoCorrected != null);
        },
    },
    {
        input: "maile 500 ko kakro bechye",
        label: "clean sales",
        category: "misspelling",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "SALES_ENTRY" && ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.product) === "kakro"; },
    },
    {
        input: "maile kakor becheko",
        label: "kakor+becheko",
        category: "misspelling",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "SALES_ENTRY" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.product) != null; },
    },
    {
        input: "timile 200 ko pyaj bechyo",
        label: "pyaj variant",
        category: "misspelling",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "SALES_ENTRY" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.amount) === 200; },
    },
    {
        input: "maile 1 kg tamatar bechye",
        label: "qty unit",
        category: "misspelling",
        check: function (r) { var _a, _b; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.quantity) === 1 || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.unit) === "kg"; },
    },
    // Sales / purchase
    {
        input: "maile 500 ko kakro bechye",
        label: "sales entry",
        category: "sales",
        check: function (r) { var _a; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "SALES_ENTRY"; },
    },
    {
        input: "maile 2 kg aalu kinya",
        label: "purchase",
        category: "purchase",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "PURCHASE_ENTRY" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.transactionType) === "purchase"; },
    },
    {
        input: "ram lai 300 ko pyaj udhaar",
        label: "credit sale",
        category: "sales",
        check: function (r) { var _a, _b; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.party) === "ram" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.paymentMode) === "credit"; },
    },
    {
        input: "cash ma 1500 ko chiya bechye",
        label: "cash sale",
        category: "sales",
        check: function (r) { var _a, _b; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.paymentMode) === "cash" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.amount) === 1500; },
    },
    {
        input: "supplier bata 5000 ko saman kine",
        label: "purchase supplier",
        category: "purchase",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "PURCHASE_ENTRY" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.transactionType) === "purchase"; },
    },
    // Queries
    {
        input: "ram ko balance kati",
        label: "balance query",
        category: "query",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "REPORT_REQUEST"; },
    },
    {
        input: "kakro kati baki cha",
        label: "stock query",
        category: "query",
        check: function (r) { var _a; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY"; },
    },
    {
        input: "k ho yo",
        label: "confused",
        category: "query",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "OTHER"; },
    },
    {
        input: "hijo ko entry",
        label: "khata query",
        category: "query",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "REPORT_REQUEST"; },
    },
    {
        input: "dhanyabad",
        label: "gratitude",
        category: "query",
        check: function (r) { return r.detection.detected != null; },
    },
    // Reports
    {
        input: "aaja ko bikri dekhaunu",
        label: "sales report",
        category: "report",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "REPORT_REQUEST" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "QUERY"; },
    },
    {
        input: "yo mahina ko profit",
        label: "profit report",
        category: "report",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "REPORT_REQUEST" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "QUERY"; },
    },
    {
        input: "trial balance",
        label: "trial balance",
        category: "report",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "REPORT_REQUEST" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "QUERY"; },
    },
    {
        input: "kam stock ke ke cha",
        label: "low stock batch",
        category: "report",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "REPORT_REQUEST"; },
    },
    // Mixed language
    {
        input: "I sold cucumber worth Rs 500",
        label: "english sales",
        category: "mixed",
        check: function (r) { return r.detection.detected === "english"; },
    },
    {
        input: "sold 500 kakro to ram",
        label: "english roman mix",
        category: "mixed",
        check: function (r) { var _a; return r.detection.detected === "english" || ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.product) != null; },
    },
    {
        input: "मैले ५०० को काक्रो बेचें",
        label: "nepali script",
        category: "mixed",
        check: function (r) { return r.detection.detected === "nepali"; },
    },
    {
        input: "ram lai 500 udhaar diye",
        label: "roman nepali mix",
        category: "mixed",
        check: function (r) { var _a, _b; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.party) === "ram" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.paymentMode) === "credit"; },
    },
    // Multi-turn (fresh context each)
    {
        input: "500",
        label: "bare amount",
        category: "multiturn",
        freshContext: true,
        check: function (r) { var _a, _b; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.amount) === 500 || ((_b = r.resolvedInput) === null || _b === void 0 ? void 0 : _b.wasResolved) === true; },
    },
    {
        input: "800",
        label: "continuation amount",
        category: "multiturn",
        check: function (r) { var _a, _b; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.amount) === 800 || ((_b = r.resolvedInput) === null || _b === void 0 ? void 0 : _b.wasResolved) === true; },
    },
    // Edge cases
    {
        input: "0",
        label: "zero amount",
        category: "edge",
        freshContext: true,
        check: function (r) { var _a; return r.response.needs_clarification || ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.amount) === 0; },
    },
    {
        input: "   ",
        label: "whitespace",
        category: "edge",
        freshContext: true,
        check: function (r) { return r.intent != null; },
    },
    {
        input: "maile bechye",
        label: "missing product amount",
        category: "edge",
        freshContext: true,
        check: function (r) { return r.response.followUp != null || r.response.needs_clarification; },
    },
    {
        input: "99999999 ko kakro",
        label: "huge amount",
        category: "edge",
        freshContext: true,
        check: function (r) { var _a; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.amount) === 99999999 || r.response.needs_clarification; },
    },
    {
        input: "yes ho",
        label: "confirmation",
        category: "edge",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "CONFIRMATION" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "OTHER"; },
    },
    {
        input: "hoina galat ho",
        label: "rejection",
        category: "edge",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "REJECTION" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "CORRECTION"; },
    },
    // Adversarial
    {
        input: "DROP TABLE users;",
        label: "sql inject",
        category: "adversarial",
        freshContext: true,
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "OTHER" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "QUERY"; },
    },
    {
        input: "asdfghjkl qwerty",
        label: "gibberish",
        category: "adversarial",
        freshContext: true,
        check: function (r) { var _a; return r.response.confidence < 0.95 || ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "OTHER"; },
    },
    {
        input: "<script>alert(1)</script>",
        label: "xss attempt",
        category: "adversarial",
        freshContext: true,
        check: function (r) { return r.intent != null; },
    },
    // Entity extraction
    {
        input: "maile 500 ko kakro bechye",
        label: "entity amount",
        category: "entity",
        check: function (r) { var _a; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.amount) === 500; },
    },
    {
        input: "maile 500 ko kakro bechye",
        label: "entity product",
        category: "entity",
        check: function (r) { var _a; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.product) === "kakro"; },
    },
    {
        input: "ram lai 500 ko kakro bechye",
        label: "entity party",
        category: "entity",
        check: function (r) { var _a; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.party) === "ram"; },
    },
    // Returns
    {
        input: "kakro return gare",
        label: "return entry",
        category: "return",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "RETURN_ENTRY" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.transactionType) === "return"; },
    },
    // Balance / stock with ERP context
    {
        input: "ram ko balance kati",
        label: "balance erp",
        category: "erp",
        check: function (r) { var _a; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || r.llmRouteReason != null; },
    },
    {
        input: "kakro kati baki cha",
        label: "stock erp",
        category: "erp",
        check: function (r) { var _a; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY"; },
    },
    // Reasoning
    {
        input: "maile 500 ko kakro bechye",
        label: "reasoning steps",
        category: "reasoning",
        check: function (r) { var _a, _b; return ((_b = (_a = r.reasoning.steps) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) >= 3; },
    },
    {
        input: "maile 500 ko kakro bechye",
        label: "dimensions",
        category: "reasoning",
        check: function (r) { var _a, _b; return ((_b = (_a = r.reasoning.dimensions) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) >= 4; },
    },
    // Detection
    {
        input: "hello how are you",
        label: "english detect",
        category: "detection",
        check: function (r) { return r.detection.detected === "english"; },
    },
    {
        input: "namaste tapai kasto hunuhuncha",
        label: "roman detect",
        category: "detection",
        check: function (r) {
            return r.detection.detected === "roman" || r.detection.detected === "nepali";
        },
    },
    // Payment modes
    {
        input: "nagad ma 200 ko chiya",
        label: "nagad cash",
        category: "payment",
        check: function (r) { var _a, _b; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.paymentMode) === "cash" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.amount) === 200; },
    },
    {
        input: "bank bata transfer gare 5000",
        label: "bank payment",
        category: "payment",
        check: function (r) { var _a, _b; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.paymentMode) === "bank" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.amount) === 5000; },
    },
    // More misspellings
    {
        input: "maile 500 ko kakro becheko",
        label: "becheko suffix",
        category: "misspelling",
        check: function (r) { var _a; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "SALES_ENTRY"; },
    },
    {
        input: "maile 500 ko kakro bechya",
        label: "bechya suffix",
        category: "misspelling",
        check: function (r) { var _a; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "SALES_ENTRY"; },
    },
    {
        input: "timile kakro kinyo",
        label: "kinyo purchase",
        category: "misspelling",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "PURCHASE_ENTRY" || ((_b = r.entities) === null || _b === void 0 ? void 0 : _b.transactionType) === "purchase"; },
    },
    // Clarification
    {
        input: "maile kakro bechye",
        label: "needs amount",
        category: "clarify",
        freshContext: true,
        check: function (r) { return r.response.followUp != null || r.response.needs_clarification; },
    },
    {
        input: "500 ko bechye",
        label: "needs product",
        category: "clarify",
        freshContext: true,
        check: function (r) { return r.response.followUp != null || r.response.needs_clarification; },
    },
    // Intent variety
    {
        input: "hijo ko bikri dekhaunu",
        label: "yesterday report",
        category: "report",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "REPORT_REQUEST" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "QUERY"; },
    },
    {
        input: "ledger khola",
        label: "ledger nav",
        category: "report",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "REPORT_REQUEST" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "QUERY"; },
    },
    {
        input: "ram ra shyam ko balance",
        label: "multi balance",
        category: "query",
        check: function (r) { var _a; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY"; },
    },
    // Sprint 16–21 features
    {
        input: "kakro ko rate",
        label: "product rate",
        category: "query",
        check: function (r) { var _a; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || r.response.response.nepali.includes("दर"); },
    },
    {
        input: "search ram",
        label: "global search",
        category: "query",
        check: function (r) { var _a; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || /search|khoj|Party/i.test(r.response.response.english); },
    },
    {
        input: "/compare",
        label: "compare shortcut",
        category: "report",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "REPORT_REQUEST"; },
    },
    {
        input: "/receivable",
        label: "receivable shortcut",
        category: "query",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "REPORT_REQUEST"; },
    },
    {
        input: "/digest",
        label: "digest shortcut",
        category: "report",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "REPORT_REQUEST"; },
    },
    {
        input: "nagad kati cha",
        label: "cash balance",
        category: "query",
        check: function (r) { var _a; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY"; },
    },
    {
        input: "xyzunknown lai 500 ko bikri",
        label: "unknown party",
        category: "clarify",
        freshContext: true,
        check: function (r) { return r.response.needs_clarification || r.response.followUp != null; },
    },
    {
        input: "asdf qwerty zzz nonsense",
        label: "graceful fallback",
        category: "clarify",
        freshContext: true,
        check: function (r) {
            var _a;
            return ((_a = r.response.quickReplies) === null || _a === void 0 ? void 0 : _a.some(function (q) { return q.value === "/examples"; })) ||
                r.response.response.nepali.includes("examples") ||
                r.response.response.nepali.includes("बुझिन");
        },
    },
    {
        input: "chalu a.v. ko profit",
        label: "fy profit",
        category: "report",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "REPORT_REQUEST" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "QUERY"; },
    },
    {
        input: "/fy",
        label: "fy shortcut",
        category: "report",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "REPORT_REQUEST" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "QUERY"; },
    },
    {
        input: "/overdue",
        label: "overdue shortcut",
        category: "query",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "REPORT_REQUEST"; },
    },
    {
        input: "ram lai 500 ko kakro bechye",
        label: "credit sale inferred",
        category: "sales",
        check: function (r) { var _a, _b; return ((_a = r.entities) === null || _a === void 0 ? void 0 : _a.paymentMode) === "credit" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "SALES_ENTRY"; },
    },
    {
        input: "purano udhaar ko list",
        label: "overdue query",
        category: "query",
        check: function (r) { var _a, _b; return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY" || ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "REPORT_REQUEST"; },
    },
    {
        input: "ram lai udhaar reminder pathau",
        label: "reminder query",
        category: "query",
        check: function (r) { var _a; return r.response.shareText != null || ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY"; },
    },
    {
        input: "ram lai 500 ani shyam lai 300 tiryo",
        label: "batch payment",
        category: "payment",
        check: function (r) { var _a, _b, _c; return ((_b = (_a = r.response.actions) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) >= 2 || ((_c = r.entities) === null || _c === void 0 ? void 0 : _c.partyLines) != null; },
    },
    {
        input: "/share invoice",
        label: "invoice share shortcut",
        category: "query",
        check: function (r) { var _a; return r.response.shareText != null || ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "QUERY"; },
    },
    {
        input: "maile 200 ko kakro firta",
        label: "sales return",
        category: "sales",
        check: function (r) {
            var _a, _b;
            return ((_a = r.intent) === null || _a === void 0 ? void 0 : _a.intent) === "RETURN_ENTRY" ||
                ((_b = r.response.actions) === null || _b === void 0 ? void 0 : _b.some(function (a) { return a.invoiceType === "sales-return"; }));
        },
    },
    {
        input: "/phone ram",
        label: "party phone shortcut",
        category: "query",
        check: function (r) { return r.response.partyPhone != null || r.response.actions != null; },
    },
    {
        input: "supplier bata 300 ko tel firta",
        label: "purchase return",
        category: "sales",
        check: function (r) {
            var _a, _b;
            return ((_a = r.response.actions) === null || _a === void 0 ? void 0 : _a.some(function (a) { return a.invoiceType === "purchase-return"; })) ||
                ((_b = r.intent) === null || _b === void 0 ? void 0 : _b.intent) === "RETURN_ENTRY";
        },
    },
    {
        input: "/setphone ram 9841234567",
        label: "set phone shortcut",
        category: "query",
        check: function (r) { var _a; return (_a = r.response.actions) === null || _a === void 0 ? void 0 : _a.some(function (a) { var _a; return a.type === "prefill_party" && ((_a = a.partyDraft) === null || _a === void 0 ? void 0 : _a.phone) != null; }); },
    },
    {
        input: "/cache stats",
        label: "cache stats",
        category: "query",
        check: function (r) {
            return r.response.response.english.includes("LLM cache") ||
                /[▁▂▃▄▅▆▇]/.test(r.response.response.english);
        },
    },
    {
        input: "/digest dismiss",
        label: "digest dismiss",
        category: "query",
        check: function (r) { var _a; return r.shortcutAction === "dismiss_digest" || ((_a = r.assistantText) === null || _a === void 0 ? void 0 : _a.includes("digest")); },
    },
    {
        input: "/digest snooze 4",
        label: "digest snooze",
        category: "query",
        check: function (r) { var _a; return r.shortcutAction === "snooze_digest" || ((_a = r.assistantText) === null || _a === void 0 ? void 0 : _a.includes("snooze")); },
    },
    {
        input: "/digest show",
        label: "digest show",
        category: "query",
        check: function (r) { var _a; return r.shortcutAction === "show_digest" || ((_a = r.assistantText) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes("digest")); },
    },
    {
        input: "/overdue supplier",
        label: "supplier overdue aging",
        category: "query",
        check: function (r) {
            var _a;
            return (_a = r.response.actions) === null || _a === void 0 ? void 0 : _a.some(function (a) { return a.page === "aging-report" && a.agingDirection === "payable"; });
        },
    },
    {
        input: "/reminder ram",
        label: "receivable reminder",
        category: "query",
        check: function (r) {
            return r.response.shareText != null ||
                r.response.response.english.toLowerCase().includes("reminder");
        },
    },
    {
        input: "/reminder supplier ABC",
        label: "payable reminder",
        category: "query",
        check: function (r) {
            var _a;
            return ((_a = r.response.shareText) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes("payable")) ||
                r.response.response.english.toLowerCase().includes("reminder");
        },
    },
];
function runGoldenSuite(coreFactory, opts) {
    return __awaiter(this, void 0, void 0, function () {
        var minRate, passed, byCategory, sharedCore, _i, GOLDEN_CASES_1, c, r, ok, rate;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    minRate = (_a = opts === null || opts === void 0 ? void 0 : opts.minPassRate) !== null && _a !== void 0 ? _a : 0.8;
                    passed = 0;
                    byCategory = {};
                    sharedCore = coreFactory();
                    _i = 0, GOLDEN_CASES_1 = exports.GOLDEN_CASES;
                    _b.label = 1;
                case 1:
                    if (!(_i < GOLDEN_CASES_1.length)) return [3 /*break*/, 4];
                    c = GOLDEN_CASES_1[_i];
                    if (c.freshContext) {
                        sharedCore = coreFactory();
                    }
                    return [4 /*yield*/, sharedCore.processInput(c.input, { useLlm: false })];
                case 2:
                    r = _b.sent();
                    ok = c.check(r);
                    if (ok)
                        passed++;
                    if (!byCategory[c.category])
                        byCategory[c.category] = { pass: 0, total: 0 };
                    byCategory[c.category].total += 1;
                    if (ok)
                        byCategory[c.category].pass += 1;
                    else if (opts === null || opts === void 0 ? void 0 : opts.verbose) {
                        console.log("   \u26A0 [".concat(c.category, "] ").concat(c.label));
                    }
                    _b.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    rate = passed / exports.GOLDEN_CASES.length;
                    if (rate < minRate) {
                        throw new Error("Golden suite: ".concat(passed, "/").concat(exports.GOLDEN_CASES.length, " (").concat((rate * 100).toFixed(0), "%) below ").concat((minRate * 100).toFixed(0), "% threshold"));
                    }
                    return [2 /*return*/, { passed: passed, total: exports.GOLDEN_CASES.length, byCategory: byCategory }];
            }
        });
    });
}
