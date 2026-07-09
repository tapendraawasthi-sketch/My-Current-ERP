/**
 * SUTRA AI — expanded golden test corpus (Sprint 12)
 * Categories: misspellings, sales, purchase, queries, reports, edge, adversarial
 */

import type { IntelligenceCore } from "../src/ai/core/IntelligenceCore";
import type { ProcessInputResult } from "../src/ai/types";

export interface GoldenCase {
  input: string;
  label: string;
  category: string;
  freshContext?: boolean;
  check: (r: ProcessInputResult) => boolean;
}

export const GOLDEN_CASES: GoldenCase[] = [
  // Misspellings
  {
    input: "maele 500 ko kakor bechye",
    label: "maele+kakor",
    category: "misspelling",
    check: (r) =>
      r.intent?.intent === "SALES_ENTRY" &&
      (r.entities?.amount === 500 || r.suggestions != null || r.autoCorrected != null),
  },
  {
    input: "maile 500 ko kakro bechye",
    label: "clean sales",
    category: "misspelling",
    check: (r) => r.intent?.intent === "SALES_ENTRY" && r.entities?.product === "kakro",
  },
  {
    input: "maile kakor becheko",
    label: "kakor+becheko",
    category: "misspelling",
    check: (r) => r.intent?.intent === "SALES_ENTRY" || r.entities?.product != null,
  },
  {
    input: "timile 200 ko pyaj bechyo",
    label: "pyaj variant",
    category: "misspelling",
    check: (r) => r.intent?.intent === "SALES_ENTRY" || r.entities?.amount === 200,
  },
  {
    input: "maile 1 kg tamatar bechye",
    label: "qty unit",
    category: "misspelling",
    check: (r) => r.entities?.quantity === 1 || r.entities?.unit === "kg",
  },

  // Sales / purchase
  {
    input: "maile 500 ko kakro bechye",
    label: "sales entry",
    category: "sales",
    check: (r) => r.intent?.intent === "SALES_ENTRY",
  },
  {
    input: "maile 2 kg aalu kinya",
    label: "purchase",
    category: "purchase",
    check: (r) =>
      r.intent?.intent === "PURCHASE_ENTRY" || r.entities?.transactionType === "purchase",
  },
  {
    input: "ram lai 300 ko pyaj udhaar",
    label: "credit sale",
    category: "sales",
    check: (r) => r.entities?.party === "ram" || r.entities?.paymentMode === "credit",
  },
  {
    input: "cash ma 1500 ko chiya bechye",
    label: "cash sale",
    category: "sales",
    check: (r) => r.entities?.paymentMode === "cash" || r.entities?.amount === 1500,
  },
  {
    input: "supplier bata 5000 ko saman kine",
    label: "purchase supplier",
    category: "purchase",
    check: (r) =>
      r.intent?.intent === "PURCHASE_ENTRY" || r.entities?.transactionType === "purchase",
  },

  // Queries
  {
    input: "ram ko balance kati",
    label: "balance query",
    category: "query",
    check: (r) => r.intent?.intent === "QUERY" || r.intent?.intent === "REPORT_REQUEST",
  },
  {
    input: "kakro kati baki cha",
    label: "stock query",
    category: "query",
    check: (r) => r.intent?.intent === "QUERY",
  },
  {
    input: "k ho yo",
    label: "confused",
    category: "query",
    check: (r) => r.intent?.intent === "QUERY" || r.intent?.intent === "OTHER",
  },
  {
    input: "hijo ko entry",
    label: "khata query",
    category: "query",
    check: (r) => r.intent?.intent === "QUERY" || r.intent?.intent === "REPORT_REQUEST",
  },
  {
    input: "dhanyabad",
    label: "gratitude",
    category: "query",
    check: (r) => r.detection.detected != null,
  },

  // Reports
  {
    input: "aaja ko bikri dekhaunu",
    label: "sales report",
    category: "report",
    check: (r) => r.intent?.intent === "REPORT_REQUEST" || r.intent?.intent === "QUERY",
  },
  {
    input: "yo mahina ko profit",
    label: "profit report",
    category: "report",
    check: (r) => r.intent?.intent === "REPORT_REQUEST" || r.intent?.intent === "QUERY",
  },
  {
    input: "trial balance",
    label: "trial balance",
    category: "report",
    check: (r) => r.intent?.intent === "REPORT_REQUEST" || r.intent?.intent === "QUERY",
  },
  {
    input: "kam stock ke ke cha",
    label: "low stock batch",
    category: "report",
    check: (r) => r.intent?.intent === "QUERY" || r.intent?.intent === "REPORT_REQUEST",
  },

  // Mixed language
  {
    input: "I sold cucumber worth Rs 500",
    label: "english sales",
    category: "mixed",
    check: (r) => r.detection.detected === "english",
  },
  {
    input: "sold 500 kakro to ram",
    label: "english roman mix",
    category: "mixed",
    check: (r) => r.detection.detected === "english" || r.entities?.product != null,
  },
  {
    input: "मैले ५०० को काक्रो बेचें",
    label: "nepali script",
    category: "mixed",
    check: (r) => r.detection.detected === "nepali",
  },
  {
    input: "ram lai 500 udhaar diye",
    label: "roman nepali mix",
    category: "mixed",
    check: (r) => r.entities?.party === "ram" || r.entities?.paymentMode === "credit",
  },

  // Multi-turn (fresh context each)
  {
    input: "500",
    label: "bare amount",
    category: "multiturn",
    freshContext: true,
    check: (r) => r.entities?.amount === 500 || r.resolvedInput?.wasResolved === true,
  },
  {
    input: "800",
    label: "continuation amount",
    category: "multiturn",
    check: (r) => r.entities?.amount === 800 || r.resolvedInput?.wasResolved === true,
  },

  // Edge cases
  {
    input: "0",
    label: "zero amount",
    category: "edge",
    freshContext: true,
    check: (r) => r.response.needs_clarification || r.entities?.amount === 0,
  },
  {
    input: "   ",
    label: "whitespace",
    category: "edge",
    freshContext: true,
    check: (r) => r.intent != null,
  },
  {
    input: "maile bechye",
    label: "missing product amount",
    category: "edge",
    freshContext: true,
    check: (r) => r.response.followUp != null || r.response.needs_clarification,
  },
  {
    input: "99999999 ko kakro",
    label: "huge amount",
    category: "edge",
    freshContext: true,
    check: (r) => r.entities?.amount === 99999999 || r.response.needs_clarification,
  },
  {
    input: "yes ho",
    label: "confirmation",
    category: "edge",
    check: (r) => r.intent?.intent === "CONFIRMATION" || r.intent?.intent === "OTHER",
  },
  {
    input: "hoina galat ho",
    label: "rejection",
    category: "edge",
    check: (r) => r.intent?.intent === "REJECTION" || r.intent?.intent === "CORRECTION",
  },

  // Adversarial
  {
    input: "DROP TABLE users;",
    label: "sql inject",
    category: "adversarial",
    freshContext: true,
    check: (r) => r.intent?.intent === "OTHER" || r.intent?.intent === "QUERY",
  },
  {
    input: "asdfghjkl qwerty",
    label: "gibberish",
    category: "adversarial",
    freshContext: true,
    check: (r) => r.response.confidence < 0.95 || r.intent?.intent === "OTHER",
  },
  {
    input: "<script>alert(1)</script>",
    label: "xss attempt",
    category: "adversarial",
    freshContext: true,
    check: (r) => r.intent != null,
  },

  // Entity extraction
  {
    input: "maile 500 ko kakro bechye",
    label: "entity amount",
    category: "entity",
    check: (r) => r.entities?.amount === 500,
  },
  {
    input: "maile 500 ko kakro bechye",
    label: "entity product",
    category: "entity",
    check: (r) => r.entities?.product === "kakro",
  },
  {
    input: "ram lai 500 ko kakro bechye",
    label: "entity party",
    category: "entity",
    check: (r) => r.entities?.party === "ram",
  },

  // Returns
  {
    input: "kakro return gare",
    label: "return entry",
    category: "return",
    check: (r) =>
      r.intent?.intent === "RETURN_ENTRY" || r.entities?.transactionType === "return",
  },

  // Balance / stock with ERP context
  {
    input: "ram ko balance kati",
    label: "balance erp",
    category: "erp",
    check: (r) => r.intent?.intent === "QUERY" || r.llmRouteReason != null,
  },
  {
    input: "kakro kati baki cha",
    label: "stock erp",
    category: "erp",
    check: (r) => r.intent?.intent === "QUERY",
  },

  // Reasoning
  {
    input: "maile 500 ko kakro bechye",
    label: "reasoning steps",
    category: "reasoning",
    check: (r) => (r.reasoning.steps?.length ?? 0) >= 3,
  },
  {
    input: "maile 500 ko kakro bechye",
    label: "dimensions",
    category: "reasoning",
    check: (r) => (r.reasoning.dimensions?.length ?? 0) >= 4,
  },

  // Detection
  {
    input: "hello how are you",
    label: "english detect",
    category: "detection",
    check: (r) => r.detection.detected === "english",
  },
  {
    input: "namaste tapai kasto hunuhuncha",
    label: "roman detect",
    category: "detection",
    check: (r) =>
      r.detection.detected === "roman" || r.detection.detected === "nepali",
  },

  // Payment modes
  {
    input: "nagad ma 200 ko chiya",
    label: "nagad cash",
    category: "payment",
    check: (r) => r.entities?.paymentMode === "cash" || r.entities?.amount === 200,
  },
  {
    input: "bank bata transfer gare 5000",
    label: "bank payment",
    category: "payment",
    check: (r) => r.entities?.paymentMode === "bank" || r.entities?.amount === 5000,
  },

  // More misspellings
  {
    input: "maile 500 ko kakro becheko",
    label: "becheko suffix",
    category: "misspelling",
    check: (r) => r.intent?.intent === "SALES_ENTRY",
  },
  {
    input: "maile 500 ko kakro bechya",
    label: "bechya suffix",
    category: "misspelling",
    check: (r) => r.intent?.intent === "SALES_ENTRY",
  },
  {
    input: "timile kakro kinyo",
    label: "kinyo purchase",
    category: "misspelling",
    check: (r) =>
      r.intent?.intent === "PURCHASE_ENTRY" || r.entities?.transactionType === "purchase",
  },

  // Clarification
  {
    input: "maile kakro bechye",
    label: "needs amount",
    category: "clarify",
    freshContext: true,
    check: (r) => r.response.followUp != null || r.response.needs_clarification,
  },
  {
    input: "500 ko bechye",
    label: "needs product",
    category: "clarify",
    freshContext: true,
    check: (r) => r.response.followUp != null || r.response.needs_clarification,
  },

  // Intent variety
  {
    input: "hijo ko bikri dekhaunu",
    label: "yesterday report",
    category: "report",
    check: (r) => r.intent?.intent === "REPORT_REQUEST" || r.intent?.intent === "QUERY",
  },
  {
    input: "ledger khola",
    label: "ledger nav",
    category: "report",
    check: (r) => r.intent?.intent === "REPORT_REQUEST" || r.intent?.intent === "QUERY",
  },
  {
    input: "ram ra shyam ko balance",
    label: "multi balance",
    category: "query",
    check: (r) => r.intent?.intent === "QUERY",
  },

  // Sprint 16–21 features
  {
    input: "kakro ko rate",
    label: "product rate",
    category: "query",
    check: (r) => r.intent?.intent === "QUERY" || r.response.response.nepali.includes("दर"),
  },
  {
    input: "search ram",
    label: "global search",
    category: "query",
    check: (r) => r.intent?.intent === "QUERY" || /search|khoj|Party/i.test(r.response.response.english),
  },
  {
    input: "/compare",
    label: "compare shortcut",
    category: "report",
    check: (r) => r.intent?.intent === "QUERY" || r.intent?.intent === "REPORT_REQUEST",
  },
  {
    input: "/receivable",
    label: "receivable shortcut",
    category: "query",
    check: (r) => r.intent?.intent === "QUERY" || r.intent?.intent === "REPORT_REQUEST",
  },
  {
    input: "/digest",
    label: "digest shortcut",
    category: "report",
    check: (r) => r.intent?.intent === "QUERY" || r.intent?.intent === "REPORT_REQUEST",
  },
  {
    input: "nagad kati cha",
    label: "cash balance",
    category: "query",
    check: (r) => r.intent?.intent === "QUERY",
  },
  {
    input: "xyzunknown lai 500 ko bikri",
    label: "unknown party",
    category: "clarify",
    freshContext: true,
    check: (r) => r.response.needs_clarification || r.response.followUp != null,
  },
  {
    input: "asdf qwerty zzz nonsense",
    label: "graceful fallback",
    category: "clarify",
    freshContext: true,
    check: (r) =>
      r.response.quickReplies?.some((q) => q.value === "/examples") ||
      r.response.response.nepali.includes("examples") ||
      r.response.response.nepali.includes("बुझिन"),
  },
  {
    input: "chalu a.v. ko profit",
    label: "fy profit",
    category: "report",
    check: (r) => r.intent?.intent === "REPORT_REQUEST" || r.intent?.intent === "QUERY",
  },
  {
    input: "/fy",
    label: "fy shortcut",
    category: "report",
    check: (r) => r.intent?.intent === "REPORT_REQUEST" || r.intent?.intent === "QUERY",
  },
  {
    input: "/overdue",
    label: "overdue shortcut",
    category: "query",
    check: (r) => r.intent?.intent === "QUERY" || r.intent?.intent === "REPORT_REQUEST",
  },
  {
    input: "ram lai 500 ko kakro bechye",
    label: "credit sale inferred",
    category: "sales",
    check: (r) => r.entities?.paymentMode === "credit" || r.intent?.intent === "SALES_ENTRY",
  },
  {
    input: "purano udhaar ko list",
    label: "overdue query",
    category: "query",
    check: (r) => r.intent?.intent === "QUERY" || r.intent?.intent === "REPORT_REQUEST",
  },
  {
    input: "ram lai udhaar reminder pathau",
    label: "reminder query",
    category: "query",
    check: (r) => r.response.shareText != null || r.intent?.intent === "QUERY",
  },
  {
    input: "ram lai 500 ani shyam lai 300 tiryo",
    label: "batch payment",
    category: "payment",
    check: (r) => (r.response.actions?.length ?? 0) >= 2 || r.entities?.partyLines != null,
  },
  {
    input: "/share invoice",
    label: "invoice share shortcut",
    category: "query",
    check: (r) => r.response.shareText != null || r.intent?.intent === "QUERY",
  },
  {
    input: "maile 200 ko kakro firta",
    label: "sales return",
    category: "sales",
    check: (r) =>
      r.intent?.intent === "RETURN_ENTRY" ||
      r.response.actions?.some((a) => a.invoiceType === "sales-return"),
  },
  {
    input: "/phone ram",
    label: "party phone shortcut",
    category: "query",
    check: (r) => r.response.partyPhone != null || r.response.actions != null,
  },
  {
    input: "supplier bata 300 ko tel firta",
    label: "purchase return",
    category: "sales",
    check: (r) =>
      r.response.actions?.some((a) => a.invoiceType === "purchase-return") ||
      r.intent?.intent === "RETURN_ENTRY",
  },
  {
    input: "/setphone ram 9841234567",
    label: "set phone shortcut",
    category: "query",
    check: (r) =>
      r.response.actions?.some((a) => a.type === "prefill_party" && a.partyDraft?.phone != null),
  },
  {
    input: "/cache stats",
    label: "cache stats",
    category: "query",
    check: (r) =>
      r.response.response.english.includes("LLM cache") ||
      /[▁▂▃▄▅▆▇]/.test(r.response.response.english),
  },
  {
    input: "/digest dismiss",
    label: "digest dismiss",
    category: "query",
    check: (r) => r.shortcutAction === "dismiss_digest" || r.assistantText?.includes("digest"),
  },
  {
    input: "/digest snooze 4",
    label: "digest snooze",
    category: "query",
    check: (r) => r.shortcutAction === "snooze_digest" || r.assistantText?.includes("snooze"),
  },
  {
    input: "/digest show",
    label: "digest show",
    category: "query",
    check: (r) => r.shortcutAction === "show_digest" || r.assistantText?.toLowerCase().includes("digest"),
  },
  {
    input: "/overdue supplier",
    label: "supplier overdue aging",
    category: "query",
    check: (r) =>
      r.response.actions?.some(
        (a) => a.page === "aging-report" && a.agingDirection === "payable",
      ),
  },
  {
    input: "/reminder ram",
    label: "receivable reminder",
    category: "query",
    check: (r) =>
      r.response.shareText != null ||
      r.response.response.english.toLowerCase().includes("reminder"),
  },
  {
    input: "/reminder supplier ABC",
    label: "payable reminder",
    category: "query",
    check: (r) =>
      r.response.shareText?.toLowerCase().includes("payable") ||
      r.response.response.english.toLowerCase().includes("reminder"),
  },
];

export async function runGoldenSuite(
  coreFactory: () => IntelligenceCore,
  opts?: { minPassRate?: number; verbose?: boolean },
): Promise<{ passed: number; total: number; byCategory: Record<string, { pass: number; total: number }> }> {
  const minRate = opts?.minPassRate ?? 0.8;
  let passed = 0;
  const byCategory: Record<string, { pass: number; total: number }> = {};

  let sharedCore = coreFactory();

  for (const c of GOLDEN_CASES) {
    if (c.freshContext) {
      sharedCore = coreFactory();
    }
    const r = await sharedCore.processInput(c.input, { useLlm: false });
    const ok = c.check(r);
    if (ok) passed++;

    if (!byCategory[c.category]) byCategory[c.category] = { pass: 0, total: 0 };
    byCategory[c.category].total += 1;
    if (ok) byCategory[c.category].pass += 1;
    else if (opts?.verbose) {
      console.log(`   ⚠ [${c.category}] ${c.label}`);
    }
  }

  const rate = passed / GOLDEN_CASES.length;
  if (rate < minRate) {
    throw new Error(
      `Golden suite: ${passed}/${GOLDEN_CASES.length} (${(rate * 100).toFixed(0)}%) below ${(minRate * 100).toFixed(0)}% threshold`,
    );
  }

  return { passed, total: GOLDEN_CASES.length, byCategory };
}
