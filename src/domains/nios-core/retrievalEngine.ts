import { searchKnowledge } from "./knowledgeEngine";

export interface RetrievalResult {
  source: string;
  content: string;
  score: number;
}

export async function retrieveContext(query: string, sessionId: string): Promise<RetrievalResult[]> {
  const knowledge = searchKnowledge(query).map((k) => ({
    source: `knowledge:${k.domain}`,
    content: k.statement,
    score: k.confidence,
  }));

  return [
    ...knowledge,
    {
      source: `session:${sessionId}`,
      content: query,
      score: 0.5,
    },
  ];
}

export async function retrieveForCapability(
  capabilityId: string,
  query: string,
): Promise<RetrievalResult[]> {
  const results = await retrieveContext(query, "global");
  return results.filter((r) => r.source.includes(capabilityId) || r.score >= 0.5);
}
