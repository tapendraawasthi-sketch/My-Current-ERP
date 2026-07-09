/**
 * Nepal Universal AI — party-name extraction from case-marker patterns
 * (lai/le/bata/sanga/ko … + compound frames like "lai udhar diyo").
 */

import {
  PARTY_HONORIFICS,
  PARTY_LABEL_ROLES,
  PARTY_MARKER_MAP,
  PARTY_RELATIONSHIPS,
  PARTY_SHOP_TOKENS,
  PARTY_TITLES,
  type PartyMarkerEntry,
} from "./generated/runtimeMaps";

const NEPALI_DIGIT_MAP: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

/** Tokens that must not start / dominate a party phrase. */
const PARTY_STOP = new Set([
  "aaja",
  "aja",
  "hijo",
  "bholi",
  "parsi",
  "aasti",
  "cash",
  "nagad",
  "nakad",
  "udhaar",
  "udhar",
  "udharo",
  "credit",
  "the",
  "a",
  "an",
  "for",
  "of",
  "at",
  "to",
  "from",
  "with",
  "by",
  "and",
  "ra",
  "ani",
  "yo",
  "tyo",
  "tyahi",
  "amount",
  "paisa",
  "rupaiya",
  "rupees",
  "rs",
  "npr",
  "kg",
  "litre",
  "liter",
  "packet",
  "piece",
  "bill",
  "invoice",
  "receipt",
  "voucher",
  "cheque",
  "draft",
  "maal",
  "saman",
  "stock",
  "order",
  "phone",
  "deal",
  "settle",
  "hisab",
  "account",
  "esewa",
  "khalti",
  "baki",
  "pathayo",
  "pathaunu",
  "aayo",
  "diyo",
  "diye",
  "liyo",
  "kineko",
  "kinyo",
  "bechyo",
  "becheko",
  "tiryo",
  "tireko",
  "mageko",
  "gare",
  "gareko",
  "milayo",
  "kateko",
  "bhayo",
  "ma",
  "ko",
  "le",
  "lai",
  "bata",
  "sanga",
  "tira",
  "dwara",
  "lagi",
  "naam",
]);

const HONORIFIC = new Set(PARTY_HONORIFICS.map((h) => h.toLowerCase()));
const RELATIONSHIP = new Set(PARTY_RELATIONSHIPS.map((r) => r.toLowerCase()));
const TITLE = new Set(PARTY_TITLES.map((t) => t.toLowerCase()));
const SHOP = new Set(PARTY_SHOP_TOKENS.map((s) => s.toLowerCase()));

export function normalizePartyText(text: string): string {
  return text
    .replace(/[०-९]/g, (ch) => NEPALI_DIGIT_MAP[ch] ?? ch)
    .toLowerCase()
    .replace(/:/g, " : ")
    .replace(/[^\w\u0900-\u097F\s./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type MarkerForm = { form: string; entry: PartyMarkerEntry };

const MARKER_FORMS: MarkerForm[] = (() => {
  const out: MarkerForm[] = [];
  for (const [formRaw, entry] of Object.entries(PARTY_MARKER_MAP)) {
    const form = normalizePartyText(formRaw);
    if (!form) continue;
    out.push({ form, entry });
  }
  // Longest marker first; then higher priority
  out.sort((a, b) => b.form.length - a.form.length || b.entry.priority - a.entry.priority);
  return out;
})();

function titleCaseParty(tokens: string[]): string {
  return tokens
    .map((w) => {
      if (/^[\u0900-\u097F]+$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function looksNumeric(tok: string): boolean {
  return /^\d/.test(tok) || /^[\d.,]+$/.test(tok);
}

/**
 * Take words immediately preceding a marker; keep a plausible name span.
 */
function extractNameSpan(before: string, nameKind: string): string[] | null {
  const raw = before.trim().split(/\s+/).filter(Boolean);
  if (!raw.length) return null;

  // Drop leading junk / amounts
  while (raw.length && (looksNumeric(raw[0]!) || PARTY_STOP.has(raw[0]!))) {
    raw.shift();
  }
  if (!raw.length) return null;

  // Cap length by kind
  const maxWords =
    nameKind === "shop_name" || nameKind === "full_name"
      ? 4
      : nameKind === "honorific"
        ? 3
        : 3;

  // Take trailing window (closest to the marker)
  let window = raw.slice(-maxWords);

  // Trim trailing stopwords that aren't titles/honorifics/shop/relationship
  while (
    window.length > 1 &&
    PARTY_STOP.has(window[window.length - 1]!) &&
    !HONORIFIC.has(window[window.length - 1]!) &&
    !TITLE.has(window[window.length - 1]!) &&
    !SHOP.has(window[window.length - 1]!) &&
    !RELATIONSHIP.has(window[window.length - 1]!)
  ) {
    window = window.slice(0, -1);
  }

  // Trim leading stopwords except relationship/title starters
  while (
    window.length > 1 &&
    PARTY_STOP.has(window[0]!) &&
    !RELATIONSHIP.has(window[0]!) &&
    !TITLE.has(window[0]!)
  ) {
    window = window.slice(1);
  }

  if (!window.length) return null;
  if (window.every((w) => PARTY_STOP.has(w) && !RELATIONSHIP.has(w) && !TITLE.has(w))) {
    return null;
  }

  // Bare "ko"/"ma" alone after amount is common — reject single pure stop token
  if (window.length === 1 && PARTY_STOP.has(window[0]!) && !RELATIONSHIP.has(window[0]!) && !TITLE.has(window[0]!)) {
    return null;
  }

  // Prefer including honorific with name: "Ram ji"
  // Prefer shop tokens: allow "Ram Store"
  return window;
}

export type PartyRoleBucket =
  | "recipient"
  | "agent"
  | "source"
  | "counterparty"
  | "owner"
  | "location"
  | "label"
  | "party";

export type PartyMatch = {
  name: string;
  roleBucket: PartyRoleBucket;
  transactionRole: string;
  nameKind: string;
  patternId: string;
  pattern: string;
  matchedMarker: string;
  honorific?: string;
};

function matchLabelPattern(text: string): PartyMatch | null {
  // Match on raw text — normalizePartyText strips ":"
  const m = text.match(
    /\b(party|customer|vendor|supplier|client|buyer|seller)\s*:\s*([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s.]{0,40})/i,
  );
  if (!m) return null;
  const label = m[1]!.toLowerCase();
  const nameTokens = m[2]!
    .trim()
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => !looksNumeric(w) && !PARTY_STOP.has(w));
  if (!nameTokens.length) return null;
  const roleRaw = PARTY_LABEL_ROLES[label] || "party";
  const roleBucket =
    roleRaw === "recipient" || roleRaw === "source" || roleRaw === "agent"
      ? (roleRaw as PartyRoleBucket)
      : ("party" as PartyRoleBucket);
  return {
    name: titleCaseParty(nameTokens.slice(0, 4)),
    roleBucket,
    transactionRole: `label:${label}`,
    nameKind: "party_label",
    patternId: "pp-label",
    pattern: "party_label: name",
    matchedMarker: `${label}:`,
  };
}

/**
 * Longest marker-first party extraction.
 */
export function matchPartyPattern(text: string): PartyMatch | null {
  const labelHit = matchLabelPattern(text);
  if (labelHit) return labelHit;

  const t = normalizePartyText(text);
  if (!t) return null;

  let best: PartyMatch | null = null;
  let bestScore = -1;

  for (const { form, entry } of MARKER_FORMS) {
    // Skip ultra-ambiguous bare "ma" / short markers unless multi-word shop context handled by longer forms first
    if (form === "ma" || form === "ko") {
      // Only accept if preceded by shop token or multi-word name-like span
    }

    const idx = t.indexOf(` ${form}`);
    const atStart = t.startsWith(`${form} `) || t === form;
    let pos = -1;
    if (idx >= 0) pos = idx + 1;
    else if (atStart) pos = 0;
    else {
      // also try form at word boundary without leading space (already start)
      const re = new RegExp(`(?:^|[\\s])${form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[\\s])`);
      const m = ` ${t} `.match(re);
      if (!m || m.index == null) continue;
      pos = m.index; // in padded string — adjust
      // Use search in original via indexOf of form with boundaries
      const bare = t.indexOf(form);
      if (bare < 0) continue;
      const beforeOk = bare === 0 || /\s/.test(t[bare - 1]!);
      const afterOk = bare + form.length === t.length || /\s/.test(t[bare + form.length]!);
      if (!beforeOk || !afterOk) continue;
      pos = bare;
    }

    if (pos < 0) continue;
    // Prefer later occurrences for trailing verbs? Prefer first strong match near start for party
    const before = t.slice(0, pos).trim();
    if (!before) continue;

    const afterOk =
      pos + form.length === t.length || /\s/.test(t[pos + form.length] ?? " ");
    if (!afterOk && pos + form.length < t.length) continue;

    const span = extractNameSpan(before, entry.nameKind);
    if (!span) continue;

    // Extra guard for bare ko/ma: require shop token OR 2+ tokens OR known relationship/title
    if (form === "ko" || form === "ma") {
      const hasShop = span.some((w) => SHOP.has(w));
      const hasRel = span.some((w) => RELATIONSHIP.has(w) || TITLE.has(w));
      if (!(hasShop || hasRel || span.length >= 2)) continue;
    }

    // Pronoun composites already handled elsewhere (maile…) — skip if span is only pronoun particle stub
    if (span.length === 1 && /^(mai|timi|hami|tapa|mal|tapaai)$/i.test(span[0]!)) continue;

    const honorific = span.find((w) => HONORIFIC.has(w));
    const score =
      form.length * 10 +
      entry.priority +
      (entry.nameKind === "shop_name" || entry.nameKind === "full_name" ? 5 : 0) +
      span.length;

    if (score > bestScore) {
      bestScore = score;
      best = {
        name: titleCaseParty(span),
        roleBucket: entry.roleBucket as PartyRoleBucket,
        transactionRole: entry.transactionRole,
        nameKind: entry.nameKind,
        patternId: entry.patternId,
        pattern: entry.pattern,
        matchedMarker: form,
        honorific,
      };
    }
  }

  return best;
}

/** Primary party display name for journal entities. */
export function extractPartyName(text: string): string | null {
  return matchPartyPattern(text)?.name ?? null;
}

/** Role-aware extraction used by semantic brain. */
export function extractPartyRoles(text: string): {
  agent: string | null;
  recipient: string | null;
  source: string | null;
  counterparty: string | null;
  owner: string | null;
  party: string | null;
  match: PartyMatch | null;
} {
  // Pronoun agents first
  const soft = normalizePartyText(text);
  if (/\bmaile\b/.test(soft)) {
    return {
      agent: "Self",
      recipient: null,
      source: null,
      counterparty: null,
      owner: null,
      party: "Self",
      match: null,
    };
  }
  if (/\btimile\b/.test(soft)) {
    return {
      agent: "Timi",
      recipient: null,
      source: null,
      counterparty: null,
      owner: null,
      party: "Timi",
      match: null,
    };
  }
  if (/\bhamile\b/.test(soft)) {
    return {
      agent: "Hami",
      recipient: null,
      source: null,
      counterparty: null,
      owner: null,
      party: "Hami",
      match: null,
    };
  }

  const match = matchPartyPattern(text);
  if (!match) {
    return {
      agent: null,
      recipient: null,
      source: null,
      counterparty: null,
      owner: null,
      party: null,
      match: null,
    };
  }

  const out = {
    agent: null as string | null,
    recipient: null as string | null,
    source: null as string | null,
    counterparty: null as string | null,
    owner: null as string | null,
    party: match.name,
    match,
  };

  switch (match.roleBucket) {
    case "agent":
      out.agent = match.name;
      break;
    case "recipient":
      out.recipient = match.name;
      break;
    case "source":
      out.source = match.name;
      break;
    case "counterparty":
      out.counterparty = match.name;
      break;
    case "owner":
      out.owner = match.name;
      break;
    case "location":
      out.source = match.name; // venue often treated as counterparty shop
      break;
    default:
      out.party = match.name;
  }

  return out;
}
