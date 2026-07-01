export interface KBEntry {
  id: string;
  category: string;
  q: string;
  keywords: string[];
  a: string;
}

export interface FalconAnswer {
  answer: string;
  suggestions: string[];
  matchedId?: string;
  confidence: number;
}
