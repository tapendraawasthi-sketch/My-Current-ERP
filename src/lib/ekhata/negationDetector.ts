/**
 * Negation & uncertainty detection — prevents wrong journal entries from negated phrases.
 */

export interface NegationResult {
  hasNegation: boolean;
  hasUncertainty: boolean;
  /** Do not post an entry when true */
  blockEntry: boolean;
  clarification?: string;
}

const NEGATION_PATTERNS: RegExp[] = [
  /\b(nai\s*hoina|hoina|chaina|chhaina|garena|gareko\s*chaina|tiryena|tireko\s*chaina|liyenin|liyenan|didn'?t|did\s+not|don'?t|doesn'?t|never|no\s+payment|not\s+paid|not\s+received|napaye|napaayo|bhayena|vayena|bhayeko\s*chaina)\b/i,
  /\b(write\s*off\s*garna\s*parcha\s*tara\s*garena)\b/i,
];

const UNCERTAINTY_PATTERNS: RegExp[] = [
  /\b(lagchha|lagcha|maybe|perhaps|probably|approximately|around|lagbhag|jasto\s*lag|think|soch|uncertain|confirm\s*gar|pakka\s*chaina|sure\s*chaina|lagdaina)\b/i,
];

const FUTURE_ONLY =
  /\b(parsi|tomorrow|aaucha|aune\s*cha|dincha\s*bhan|will\s+pay|will\s+give|paisa\s*aaudai\s*cha|future|pachi\s*dincha)\b/i;

export function detectNegation(text: string): NegationResult {
  const t = text.trim();
  const hasNegation = NEGATION_PATTERNS.some((p) => p.test(t));
  const hasUncertainty = UNCERTAINTY_PATTERNS.some((p) => p.test(t));
  const futureOnly = FUTURE_ONLY.test(t) && !/\b(tiryo|tireko|diyo|diye|paid|received|aayo|gareko)\b/i.test(t);

  if (hasNegation) {
    return {
      hasNegation: true,
      hasUncertainty,
      blockEntry: true,
      clarification:
        "Yo vakya ma nakaratmak (negative) artha cha — ma entry banaudina. Sahi transaction feri positive form ma lekhnu hola. Udaharan: 'Ram le 500 tiryo' (Ram le tiryo).",
    };
  }

  if (futureOnly) {
    return {
      hasNegation: false,
      hasUncertainty: true,
      blockEntry: true,
      clarification:
        "Yo bhavishya ko kura lagchha (future payment). Aile ledger ma entry garna amount ra party confirm garera lekhnu hola jaba payment bhayeko ho.",
    };
  }

  if (hasUncertainty) {
    return {
      hasNegation: false,
      hasUncertainty: true,
      blockEntry: false,
    };
  }

  return { hasNegation: false, hasUncertainty: false, blockEntry: false };
}
