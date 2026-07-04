// Unified web search trigger rules — shared by Falcon Brain (TS) and documented for erp_bot.

import type { FalconIntent } from "./intentTaxonomy";
import type { SmartIntent } from "./smartIntentEngine";

const CODE_ONLY_INTENTS: FalconIntent[] = [
  "nav",
  "action_path",
  "steps",
  "code",
  "troubleshoot",
  "effect",
];

const EXTERNAL_KNOWLEDGE_PATTERN =
  /\b(nepal|ird|vat act|income tax|tds section|gaap|ifrs|fifo|lifo|depreciation method|accounting standard|compliance|regulation|tax law|cbms rule)\b/i;

const EXPLICIT_SEARCH_PATTERN =
  /\b(search|google|look up online|on the web|browse)\b/i;

const CURRENT_EVENTS_PATTERN =
  /\b(today|now|current|latest|news|weather|price of|who won|election)\b/i;

export function shouldUseWebSearchForIntent(
  intent: SmartIntent,
  composedConfidence?: number,
): boolean {
  const query = intent.parsed.original;

  if (intent.parsed.isGreeting) return false;

  if (CODE_ONLY_INTENTS.includes(intent.falconIntent)) return false;

  if (EXPLICIT_SEARCH_PATTERN.test(query)) return true;

  if (CURRENT_EVENTS_PATTERN.test(query)) return true;

  if (EXTERNAL_KNOWLEDGE_PATTERN.test(query)) {
    const lowConfidence = composedConfidence === undefined || composedConfidence < 0.55;
    const noErpEntity =
      !intent.primaryFocus &&
      intent.parsed.entities.length === 0 &&
      intent.falconIntent === "general";
    return lowConfidence || noErpEntity || intent.falconIntent === "definition";
  }

  return false;
}

export function formatWebSearchAnswer(searchText: string, query: string): string {
  return `According to recent search results:\n\n${searchText}\n\n_(Query: ${query})_`;
}
