/**
 * Classifies a normalized user query into one of the Falcon intent categories.
 *
 * Rules are evaluated in strict priority order — the FIRST matching rule wins.
 * The function is pure: no side effects.
 *
 * PRIORITY ORDER (matches Python bot intent_classifier.py):
 *   1. code         → developer/source questions
 *   2. troubleshoot → errors, not working, why isn't
 *   3. effect       → accounting debit/credit entry
 *   4. steps        → explicit step-by-step procedure
 *   5. action_path  → how to make/create/do (path only)
 *   6. navigate     → where is, how to open, shortcut
 *   7. definition   → what is, explain, describe
 *   8. general      → catch-all
 *
 * @param normalizedQuery  Lowercased, punctuation-cleaned query string.
 * @param tokens           Stop-word-filtered token array derived from the query.
 * @returns                The best-matching intent label string.
 */
export function detectIntent(normalizedQuery: string, tokens: string[]): string {
  // ── RULE 1 — code (developer questions) ──────────────────────────────────
  const codePhrases = [
    "code",
    "function",
    "component",
    "hook",
    "api route",
    "api endpoint",
    "schema",
    "database",
    "implementation",
    "source file",
    "source code",
    "where in code",
    "where in the code",
    "developer",
    "backend",
    "frontend",
    "typescript",
    ".tsx",
    ".ts",
    "sql query",
    "table schema",
    "table structure",
    "supabase",
    "rpc",
    "which file",
    "which module",
    "renders",
  ] as const;

  for (const phrase of codePhrases) {
    if (normalizedQuery.includes(phrase)) return "code";
  }

  // ── RULE 2 — troubleshoot (errors, failures) ─────────────────────────────
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
    "not balanced",
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
    "why isn't",
    "why isnt",
    "why can't",
    "why cant",
    "why won't",
    "why wont",
    "doesn't work",
    "doesnt work",
    "crash",
    "bug",
  ] as const;

  for (const phrase of troubleshootPhrases) {
    if (normalizedQuery.includes(phrase)) return "troubleshoot";
  }

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
    "crash",
    "bug",
  ]);

  for (const t of tokens) {
    if (troubleshootTokens.has(t)) return "troubleshoot";
  }

  // ── RULE 3 — effect (accounting debit/credit entry) ──────────────────────
  const effectPhrases = [
    "what gets debited",
    "what gets credited",
    "what is debited",
    "what is credited",
    "what will be debited",
    "what will be credited",
    "accounting entry",
    "accounting effect",
    "accounting treatment",
    "journal entry for",
    "double entry for",
    "double entry of",
    "which account gets",
    "which account is",
    "which account will be",
    "ledger effect",
    "gl entry",
    "dr/cr",
    "dr cr",
    "debit credit",
    "what is the entry for",
  ] as const;

  for (const phrase of effectPhrases) {
    if (normalizedQuery.includes(phrase)) return "effect";
  }

  // ── RULE 4 — steps (explicit step-by-step request) ───────────────────────
  const stepsPhrases = [
    "steps for",
    "steps to",
    "step by step",
    "step-by-step",
    "procedure for",
    "procedure to",
    "process for",
    "process of",
    "guide me through",
    "guide me on",
    "walk me through",
    "how exactly do i",
    "how exactly to",
    "how specifically do",
    "how specifically to",
    "detailed steps",
    "detailed procedure",
    "detailed process",
    "detailed instructions",
  ] as const;

  for (const phrase of stepsPhrases) {
    if (normalizedQuery.includes(phrase)) return "steps";
  }

  // ── RULE 5 — action_path ("how to make/create X" — path only) ────────────
  // CRITICAL: This must be tested BEFORE definition/what_is.
  // "How to make a journal entry" → action_path (NOT definition)
  const actionPathPhrases = [
    "how do i make",
    "how do i create",
    "how do i post",
    "how do i record",
    "how do i enter",
    "how do i add",
    "how do i pass",
    "how do i generate",
    "how do i cut",
    "how do i raise",
    "how do i prepare",
    "how do i issue",
    "how do i file",
    "how do i submit",
    "how do i save",
    "how do i write",
    "how do i book",
    "how do i lodge",
    "how to make",
    "how to create",
    "how to post",
    "how to record",
    "how to enter",
    "how to add",
    "how to pass",
    "how to generate",
    "how to cut",
    "how to raise",
    "how to prepare",
    "how to issue",
    "how to file",
    "how to submit",
    "how to save",
    "how to write",
    "how to book",
    "how to lodge",
    "how can i make",
    "how can i create",
    "how can i post",
    "how can i record",
    "how can i enter",
    "how can i add",
    "how can i pass",
    "how can i generate",
  ] as const;

  for (const phrase of actionPathPhrases) {
    if (normalizedQuery.includes(phrase)) return "action_path";
  }

  // ── RULE 6 — navigate (where is / how to open / shortcut) ────────────────
  const navigatePhrases = [
    "where is",
    "where do i",
    "where can i",
    "where to find",
    "where do i go",
    "how to find",
    "how do i find",
    "how do i open",
    "how to open",
    "how to access",
    "how do i access",
    "how to go to",
    "how do i go to",
    "how to get to",
    "how do i get to",
    "how to navigate",
    "how do i navigate",
    "how to reach",
    "how do i reach",
    "how to see",
    "how do i see",
    "menu for",
    "go to",
    "shortcut for",
    "shortcut to",
    "keyboard shortcut",
    "hotkey",
    "press which",
    "which key",
    "what key",
    "path to",
    "path for",
    "location of",
  ] as const;

  for (const phrase of navigatePhrases) {
    if (normalizedQuery.includes(phrase)) return "navigate";
  }

  // ── RULE 7 — definition (what is / explain / describe) ───────────────────
  // IMPORTANT: This is tested AFTER action_path.
  if (
    normalizedQuery.startsWith("what is") ||
    normalizedQuery.startsWith("what are") ||
    normalizedQuery.startsWith("explain") ||
    normalizedQuery.startsWith("define") ||
    normalizedQuery.includes("tell me about") ||
    normalizedQuery.includes("meaning of") ||
    normalizedQuery.includes("definition of")
  ) {
    return "definition";
  }

  const definitionTokens = new Set([
    "meaning",
    "means",
    "definition",
    "define",
    "explain",
    "describe",
    "overview",
  ]);

  for (const t of tokens) {
    if (definitionTokens.has(t)) return "definition";
  }

  // ── RULE 8 — calculate (formula questions) ───────────────────────────────
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

  // ── RULE 9 — compare ─────────────────────────────────────────────────────
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

  // ── RULE 10 — list ───────────────────────────────────────────────────────
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

  // ── RULE 11 — confirm ────────────────────────────────────────────────────
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

  // ── RULE 12 — how_to (generic how questions) ─────────────────────────────
  if (normalizedQuery.startsWith("how")) return "how_to";

  const howToPhrases = [
    "how do i",
    "how to",
    "tell me how",
  ] as const;

  for (const phrase of howToPhrases) {
    if (normalizedQuery.includes(phrase)) return "how_to";
  }

  // ── RULE 13 — why ────────────────────────────────────────────────────────
  if (normalizedQuery.startsWith("why")) return "why";

  const whyPhrases = [
    "why is",
    "why does",
    "reason for",
    "cause of",
  ] as const;

  for (const phrase of whyPhrases) {
    if (normalizedQuery.includes(phrase)) return "why";
  }

  // ── RULE 14 — action fallback (action words without "how to") ────────────
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

  // ── RULE 15 — default (general) ──────────────────────────────────────────
  return "general";
}
