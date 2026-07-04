export interface SearchResult {
  title: string;
  snippet: string;
  url?: string;
  source: "duckduckgo" | "wikipedia" | "fallback";
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  abstractText?: string;
  answer?: string;
  relatedTopics?: string[];
  error?: string;
  searchedAt: Date;
}

export async function searchWeb(
  query: string,
  options?: { timeout?: number },
): Promise<SearchResponse> {
  const timeoutMs = options?.timeout || 8000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const response: SearchResponse = {
    query,
    results: [],
    searchedAt: new Date(),
  };

  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    // Try primary proxy
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(ddgUrl)}`;

    const res = await fetch(proxyUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`DDG Proxy HTTP error! status: ${res.status}`);

    const data = await res.json();

    if (data.AbstractText) {
      response.abstractText = data.AbstractText;
      response.results.push({
        title: data.Heading || query,
        snippet: data.AbstractText,
        url: data.AbstractURL,
        source: "duckduckgo",
      });
    }

    if (data.Answer) {
      response.answer = data.Answer;
    }

    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      response.relatedTopics = data.RelatedTopics.filter((t: any) => t.Text)
        .map((t: any) => t.Text as string)
        .slice(0, 3);
    }

    // If DDG returned empty abstract, fallback to wikipedia
    if (!response.abstractText && !response.answer) {
      const wikiResult = await searchWikipedia(query, controller.signal);
      if (wikiResult) {
        response.results.push(wikiResult);
        response.abstractText = wikiResult.snippet;
      }
    }
  } catch (error: any) {
    console.error("Web search error:", error);
    // If DDG fails completely, try Wikipedia as a fallback before giving up
    try {
      const wikiResult = await searchWikipedia(query, controller.signal);
      if (wikiResult) {
        response.results.push(wikiResult);
        response.abstractText = wikiResult.snippet;
      } else {
        response.error = error.message || "Search failed";
      }
    } catch (wikiError: any) {
      response.error = "All search methods failed.";
    }
  } finally {
    clearTimeout(timeoutId);
  }

  // If we still have nothing, add a fallback result so it's not totally empty if we didn't error
  if (response.results.length === 0 && !response.error) {
    response.error = "No relevant results found.";
  }

  return response;
}

export async function searchWikipedia(
  topic: string,
  signal?: AbortSignal,
): Promise<SearchResult | null> {
  try {
    // Basic entity extraction for Wikipedia (grab the first few words or nouns)
    const searchTerms = extractEntitiesForSearch(topic);
    const query = searchTerms.length > 0 ? searchTerms.join("_") : topic.replace(/\s+/g, "_");

    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.type === "standard" && data.extract) {
      return {
        title: data.title,
        snippet: data.extract.substring(0, 300) + (data.extract.length > 300 ? "..." : ""),
        url: data.content_urls?.desktop?.page,
        source: "wikipedia",
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export function formatSearchResults(response: SearchResponse): string {
  if (response.error) {
    return `Web search failed or found no results: ${response.error}`;
  }

  let formatted = `Web search results for '${response.query}':\n`;

  if (response.answer) {
    formatted += `Instant Answer: ${response.answer}\n`;
  }

  if (response.abstractText) {
    formatted += `${response.abstractText}\n`;
  }

  if (response.results.length > 0 && response.results[0].url) {
    formatted += `Source: ${response.results[0].url}\n`;
  }

  if (response.relatedTopics && response.relatedTopics.length > 0) {
    formatted += `Related: ${response.relatedTopics.join(", ")}\n`;
  }

  // Trim to 500 characters
  if (formatted.length > 500) {
    formatted = formatted.substring(0, 497) + "...";
  }

  return formatted.trim();
}

export function isCurrentEventQuery(query: string): boolean {
  return /today|now|current|latest|news|weather|price of|score|who won|election/i.test(query);
}

export function extractEntitiesForSearch(query: string): string[] {
  // A simple heuristic to extract main nouns/entities.
  // Remove common question words.
  let cleaned = query.replace(
    /^(what is|who is|where is|when is|how to|search for|tell me about)\s+/i,
    "",
  );
  cleaned = cleaned.replace(/\?$/, "").trim();

  // Just return words longer than 3 characters, or the whole cleaned string if short.
  if (cleaned.length < 15) return [cleaned];

  const words = cleaned.split(/\s+/).filter((w) => w.length > 3);
  return words.length > 0 ? words : [cleaned];
}
