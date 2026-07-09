/**
 * Journal-entry condition rules (JE_001–JE_100).
 * Feature-match on verb/particle/party/cash/bank/amount → then_intent + Dr/Cr.
 */

import {
  JOURNAL_ENTRY_RULES,
  JOURNAL_ENTRY_RULE_EXAMPLES,
  type JournalEntryRule,
  type JournalRuleCondition,
} from "./generated/runtimeMaps";
import { detectVerbInText } from "./verbNormalize";
import { extractPartyName } from "./partyNames";
import { parseNepaliAmount } from "./numberWords";

export type JournalRuleFeatures = {
  text: string;
  verbLemma: string | null;
  particle: string;
  party: boolean;
  cashWordPresent: boolean;
  bankWordPresent: boolean;
  amount: number | null;
  asset: boolean;
  words: string;
};

export type JournalRuleMatch = {
  rule: JournalEntryRule;
  score: number;
  features: JournalRuleFeatures;
};

const CASH_RE = /\b(cash|nagad|nakad|nakit|nakat)\b/i;
const BANK_RE = /\b(bank|baink)\b/i;
const ASSET_RE = /\b(asset|saman|machinery|machine|vehicle|building|furniture|ppe|fixed\s*asset)\b/i;
const PARTICLE_RE = /\b(lai|le|bata|sanga|ko|ma|baaki|baki)\b/gi;

/** Surface forms for lemmas under-covered in VERB_ALIASES. */
const LEMMA_SURFACES: Record<string, RegExp> = {
  bechnu: /\b(bechnu|becheko|beche|becheko|bikri|bechyo|sold)\b/i,
  kinnu: /\b(kinnu|kineko|kine|kinyo|kharid|bought)\b/i,
  tirnu: /\b(tirnu|tiryo|tireko|tirna|payment)\b/i,
  paunu: /\b(paunu|paayo|payo|paayeko|pauna|received)\b/i,
  jama: /\b(jama|deposit|jamako|jamayo)\b/i,
  nikalnu: /\b(nikalnu|nikalyo|nikale|nikaal|withdraw)\b/i,
  jhiknu: /\b(jhiknu|jhikyo|jhikeko|drawings|nikas)\b/i,
  farkinu: /\b(farkinu|farkiyo|farkayo|firta|firtayo|return)\b/i,
};

function detectLemma(text: string): string | null {
  const hit = detectVerbInText(text);
  if (hit?.lemma) return hit.lemma.toLowerCase();
  for (const [lemma, re] of Object.entries(LEMMA_SURFACES)) {
    if (re.test(text)) return lemma;
  }
  // "jama" is often a noun action without verb map hit
  if (/\bjama\b/i.test(text)) return "jama";
  if (/\b(nikalyo|nikale|nikaal)\b/i.test(text)) return "nikalnu";
  if (/\b(farkiyo|firta)\b/i.test(text)) return "farkinu";
  return null;
}

function detectParticles(text: string): string {
  const found = new Set<string>();
  for (const m of text.toLowerCase().matchAll(PARTICLE_RE)) {
    found.add(m[1] ?? m[0]);
  }
  return [...found].join(" ");
}

export function extractJournalRuleFeatures(text: string): JournalRuleFeatures {
  const t = text.toLowerCase().trim();
  const amount = parseNepaliAmount(t);
  const partyHit = Boolean(extractPartyName(text) || extractPartyName(t));
  // Fallback: Capitalized Nepali/English name before lai|le|bata|ko
  const partyFallback =
    partyHit ||
    /\b([A-Z][a-z]{1,20}|[A-Za-z][a-z]{2,20})\s+(lai|le|bata|ko|sanga)\b/.test(text) ||
    /\b([a-z]{3,20})\s+(lai|le|bata|ko)\b/i.test(t);

  return {
    text: t,
    verbLemma: detectLemma(t),
    particle: detectParticles(t),
    party: partyFallback,
    cashWordPresent: CASH_RE.test(t),
    bankWordPresent: BANK_RE.test(t),
    amount: amount && amount > 0 ? amount : null,
    asset: ASSET_RE.test(t),
    words: t,
  };
}

function condValueEquals(feature: unknown, expected: unknown): boolean {
  if (typeof expected === "boolean") return Boolean(feature) === expected;
  if (typeof expected === "number") return Number(feature) === expected;
  return String(feature ?? "").toLowerCase() === String(expected).toLowerCase();
}

function evaluateCondition(cond: JournalRuleCondition, f: JournalRuleFeatures): boolean {
  const { field, operator, value } = cond;
  let actual: unknown;
  switch (field) {
    case "verb_lemma":
      actual = f.verbLemma;
      break;
    case "particle":
      actual = f.particle;
      break;
    case "party":
      actual = f.party;
      break;
    case "cash_word_present":
      actual = f.cashWordPresent;
      break;
    case "bank_word_present":
      actual = f.bankWordPresent;
      break;
    case "amount":
      actual = f.amount;
      break;
    case "asset":
      actual = f.asset;
      break;
    case "word":
      actual = f.words;
      break;
    default:
      actual = (f as Record<string, unknown>)[field];
  }

  if (operator === "equals") return condValueEquals(actual, value);
  if (operator === "exists") {
    const want = Boolean(value);
    const has =
      typeof actual === "boolean"
        ? actual
        : actual != null && String(actual).trim() !== "" && actual !== false;
    return has === want;
  }
  if (operator === "contains") {
    const needle = String(value).toLowerCase();
    return String(actual ?? "")
      .toLowerCase()
      .includes(needle);
  }
  if (operator === "greater_than") {
    const n = Number(actual);
    const thr = Number(value);
    return Number.isFinite(n) && n > thr;
  }
  return false;
}

function ruleMatches(rule: JournalEntryRule, f: JournalRuleFeatures): boolean {
  return rule.conditions.every((c) => evaluateCondition(c, f));
}

/** Prefer more specific (more conditions) then higher confidence. */
function scoreRule(rule: JournalEntryRule): number {
  return rule.conditions.length * 10 + rule.confidence * 5;
}

/**
 * Match the best JE rule for user text.
 * Exact example_input maps win first.
 */
export function matchJournalEntryRule(text: string): JournalRuleMatch | null {
  if (!text?.trim()) return null;
  const key = text.toLowerCase().replace(/\s+/g, " ").trim();
  const example = JOURNAL_ENTRY_RULE_EXAMPLES[key];
  if (example) {
    const rule = JOURNAL_ENTRY_RULES.find((r) => r.ruleId === example.ruleId);
    if (rule) {
      return { rule, score: 999, features: extractJournalRuleFeatures(text) };
    }
  }

  const features = extractJournalRuleFeatures(text);
  let best: JournalRuleMatch | null = null;
  for (const rule of JOURNAL_ENTRY_RULES) {
    if (!ruleMatches(rule, features)) continue;
    const score = scoreRule(rule);
    if (!best || score > best.score) best = { rule, score, features };
  }
  return best;
}

export function getJournalEntryRuleById(ruleId: string): JournalEntryRule | null {
  return JOURNAL_ENTRY_RULES.find((r) => r.ruleId === ruleId) ?? null;
}

/** Map JE account label → KH-* account code. */
export function resolveJeAccountCode(label: string): string {
  const raw = label.replace(/\/\s*\{party\}/gi, "").replace(/\{party\}/gi, "").trim().toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/^cash$/, "KH-CASH"],
    [/^bank$/, "KH-BANK"],
    [/sundry\s*debtors|receivable/, "KH-DEBT"],
    [/sundry\s*creditors|payable(?!)/, "KH-CRED"],
    [/^sales$/, "KH-SALE"],
    [/sales\s*returns?/, "KH-SALE"],
    [/^purchases?$/, "KH-PUR"],
    [/purchase\s*returns?/, "KH-PUR"],
    [/^expense$/, "KH-EXP"],
    [/^income$/, "KH-OTH-INC"],
    [/loan\s*payable/, "KH-LOAN"],
    [/^capital$/, "KH-CAP"],
    [/^drawings$/, "KH-DRAW"],
    [/discount\s*allowed/, "KH-DISC-ALL"],
    [/discount\s*received/, "KH-DISC-REC"],
    [/bad\s*debts?/, "KH-BD-EXP"],
    [/^depreciation$/, "KH-DEPR"],
    [/accumulated\s*depreciation/, "KH-ACC-DEP"],
    [/salary/, "KH-SAL"],
    [/rent/, "KH-EXP"],
    [/insurance|tax\s*expense|commission|advertising|travel|office|repair|telephone|utility|donation|fine/, "KH-EXP"],
    [/interest\s*expense/, "KH-INT-EXP"],
    [/interest\s*income/, "KH-OTH-INC"],
    [/prepaid/, "KH-PREPAID"],
    [/accrued\s*expense/, "KH-OUT-EXP"],
    [/accrued\s*income/, "KH-DEBT"],
    [/unearned|advance\s*received/, "KH-CUST-ADV"],
    [/advance\s*payment/, "KH-EMP-ADV"],
    [/fixed\s*asset/, "KH-PPE"],
    [/dividend\s*income/, "KH-OTH-INC"],
    [/retained\s*earnings/, "KH-RET-EARN"],
    [/tax\s*payable|commission\s*payable|dividend\s*payable/, "KH-CRED"],
  ];
  for (const [re, code] of map) {
    if (re.test(raw)) return code;
  }
  return "KH-EXP";
}
