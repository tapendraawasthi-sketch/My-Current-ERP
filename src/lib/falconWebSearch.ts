/** Backward-compatible re-exports — use src/lib/falcon/searchService.ts directly. */

export {
  searchWeb,
  searchWikipedia,
  formatSearchResultsForLLM as formatSearchResults,
  searchViaErpBotEndpoint,
  type SearchResult,
  type SearchResponse,
} from "./falcon/searchService";

export function isCurrentEventQuery(query: string): boolean {
  return /today|now|current|latest|news|weather|price of|score|who won|election/i.test(query);
}

export function extractEntitiesForSearch(query: string): string[] {
  let cleaned = query.replace(
    /^(what is|who is|where is|when is|how to|search for|tell me about)\s+/i,
    "",
  );
  cleaned = cleaned.replace(/\?$/, "").trim();

  if (cleaned.length < 15) return [cleaned];

  const words = cleaned.split(/\s+/).filter((w) => w.length > 3);
  return words.length > 0 ? words : [cleaned];
}
