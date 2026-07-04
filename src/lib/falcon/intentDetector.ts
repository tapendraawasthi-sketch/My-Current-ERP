/**
 * Classifies a normalized user query into one of the Falcon intent categories.
 *
 * Rules are evaluated in strict priority order — the FIRST matching rule wins.
 * The function is pure: no side effects.
 *
 * @param normalizedQuery  Lowercased, punctuation-cleaned query string.
 * @param tokens           Stop-word-filtered token array derived from the query.
 * @returns                The best-matching intent label string.
 */
export function detectIntent(normalizedQuery: string, tokens: string[]): string {
  // ── RULE 1 — troubleshoot (phrase-based) ─────────────────────────────────
  const troubleshootPhrases = [
    "not working",
    "not calculating",
    "not showing",
    "error",
    "failed",
    "failing",
    "cant post",
    "cannot post",
    "can't post",
    "wont save",
    "won't save",
    "not saving",
    "not posting",
    "negative stock",
    "unbalanced",
    "mismatch",
    "wrong amount",
    "incorrect amount",
    "duplicate",
    "stuck",
    "frozen",
    "not loading",
    "blank screen",
    "permission denied",
    "not authorized",
    "access denied",
  ] as const;

  for (const phrase of troubleshootPhrases) {
    if (normalizedQuery.includes(phrase)) return "troubleshoot";
  }

  // ── RULE 2 — troubleshoot (token-based) ──────────────────────────────────
  const troubleshootTokens = new Set([
    "error",
    "issue",
    "problem",
    "fix",
    "broken",
    "fail",
    "wrong",
    "incorrect",
    "negative",
    "unbalanced",
    "denied",
    "stuck",
    "frozen",
  ]);

  for (const t of tokens) {
    if (troubleshootTokens.has(t)) return "troubleshoot";
  }

  // ── RULE 3 — calculate ───────────────────────────────────────────────────
  const calculatePhrases = [
    "how is",
    "formula",
    "calculated",
    "computation",
    "how does vat",
    "how vat",
    "percentage",
    "formula for",
    "calculate",
    "computation of",
    "how much",
  ] as const;

  for (const phrase of calculatePhrases) {
    if (normalizedQuery.includes(phrase)) return "calculate";
  }

  // ── RULE 4 — compare ─────────────────────────────────────────────────────
  const comparePhrases = [
    "difference between",
    "vs ",
    "versus",
    "compared to",
    "what is the difference",
    "which is better",
    "when to use",
    "instead of",
  ] as const;

  for (const phrase of comparePhrases) {
    if (normalizedQuery.includes(phrase)) return "compare";
  }

  // ── RULE 5 — navigate (where / how-to-find) ──────────────────────────────
  const navigatePhrases = [
    "where is",
    "where do",
    "where can",
    "how to find",
    "how do i find",
    "how do i open",
    "where to find",
    "where do i go",
    "menu for",
    "go to",
  ] as const;

  for (const phrase of navigatePhrases) {
    if (normalizedQuery.includes(phrase)) return "navigate";
  }

  // ── RULE 6 — list ────────────────────────────────────────────────────────
  const listPhrases = [
    "list all",
    "list of",
    "show all",
    "show me all",
    "what are all",
    "what are the",
    "types of",
    "kinds of",
    "available options",
    "all the",
  ] as const;

  for (const phrase of listPhrases) {
    if (normalizedQuery.includes(phrase)) return "list";
  }

  // ── RULE 7 — confirm ─────────────────────────────────────────────────────
  const confirmPhrases = [
    "can i ",
    "is it possible",
    "does sutra",
    "does it support",
    "is there a way",
    "is there an option",
    "do you support",
    "can sutra",
  ] as const;

  for (const phrase of confirmPhrases) {
    if (normalizedQuery.includes(phrase)) return "confirm";
  }

  // ── RULE 8 — how_to (phrase-based) ───────────────────────────────────────
  if (normalizedQuery.startsWith("how")) return "how_to";

  const howToPhrases = [
    "how do i",
    "how to",
    "steps to",
    "step by step",
    "procedure for",
    "process to",
    "guide me",
    "walk me through",
    "tell me how",
  ] as const;

  for (const phrase of howToPhrases) {
    if (normalizedQuery.includes(phrase)) return "how_to";
  }

  // ── RULE 9 — why ─────────────────────────────────────────────────────────
  if (normalizedQuery.startsWith("why")) return "why";

  const whyPhrases = [
    "why is",
    "why does",
    "why can't",
    "why cant",
    "why won't",
    "why wont",
    "reason for",
    "cause of",
  ] as const;

  for (const phrase of whyPhrases) {
    if (normalizedQuery.includes(phrase)) return "why";
  }

  // ── RULE 10 — what_is ────────────────────────────────────────────────────
  if (
    normalizedQuery.startsWith("what is") ||
    normalizedQuery.startsWith("what are") ||
    normalizedQuery.startsWith("explain") ||
    normalizedQuery.startsWith("define") ||
    normalizedQuery.includes("tell me about")
  ) {
    return "what_is";
  }

  // ── RULE 11 — definition (token-based) ───────────────────────────────────
  const definitionTokens = new Set([
    "meaning",
    "means",
    "definition",
    "define",
    "explain",
    "describe",
    "overview",
    "about",
  ]);

  for (const t of tokens) {
    if (definitionTokens.has(t)) return "definition";
  }

  // ── RULE 12 — how_to (action-word fallback) ───────────────────────────────
  const actionTokens = new Set([
    "create",
    "add",
    "make",
    "post",
    "save",
    "record",
    "enter",
    "generate",
    "set",
    "configure",
    "enable",
    "disable",
    "delete",
    "cancel",
    "print",
    "export",
    "import",
    "transfer",
    "allocate",
    "close",
    "open",
  ]);

  for (const t of tokens) {
    if (actionTokens.has(t)) return "how_to";
  }

  // ── RULE 13 — default ────────────────────────────────────────────────────
  return "unknown";
}
