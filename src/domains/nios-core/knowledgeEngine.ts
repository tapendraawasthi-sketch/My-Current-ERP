export interface KnowledgeEntry {
  id: string;
  domain: string;
  statement: string;
  source: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

const knowledgeBase: KnowledgeEntry[] = [];

export function addKnowledge(entry: Omit<KnowledgeEntry, "id">): KnowledgeEntry {
  const record: KnowledgeEntry = { ...entry, id: crypto.randomUUID() };
  knowledgeBase.push(record);
  return record;
}

export function searchKnowledge(query: string, limit = 5): KnowledgeEntry[] {
  const q = query.toLowerCase();
  return knowledgeBase
    .filter((e) => e.statement.toLowerCase().includes(q) || e.domain.toLowerCase().includes(q))
    .slice(0, limit);
}

export function listKnowledge(): KnowledgeEntry[] {
  return [...knowledgeBase];
}

export function clearKnowledge(): void {
  knowledgeBase.length = 0;
}
