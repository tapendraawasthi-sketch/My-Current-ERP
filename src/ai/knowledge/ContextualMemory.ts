/** SUTRA AI — learning from user corrections */

const STORAGE_KEY = "sutra_ai_learned_corrections";

export interface LearnedCorrection {
  original: string;
  corrected: string;
  occurrences: number;
  acceptanceRate: number;
  contexts: string[];
  autoCorrectThreshold: boolean;
}

export class ContextualMemory {
  private corrections: Map<string, LearnedCorrection> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Record<string, LearnedCorrection>;
      for (const [key, val] of Object.entries(data)) {
        this.corrections.set(key, val);
      }
    } catch {
      // ignore corrupt storage
    }
  }

  private save(): void {
    const obj: Record<string, LearnedCorrection> = {};
    for (const [key, val] of this.corrections) {
      obj[key] = val;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  }

  recordCorrection(
    original: string,
    corrected: string,
    accepted: boolean,
    context?: string,
  ): void {
    const key = `${original} → ${corrected}`;
    const existing = this.corrections.get(key);

    if (existing) {
      existing.occurrences += 1;
      const total = existing.occurrences;
      const acceptedCount = accepted
        ? existing.acceptanceRate * (total - 1) + 1
        : existing.acceptanceRate * (total - 1);
      existing.acceptanceRate = acceptedCount / total;
      if (context && !existing.contexts.includes(context)) {
        existing.contexts.push(context);
      }
      existing.autoCorrectThreshold =
        existing.occurrences >= 5 && existing.acceptanceRate >= 0.9;
    } else {
      this.corrections.set(key, {
        original,
        corrected,
        occurrences: 1,
        acceptanceRate: accepted ? 1 : 0,
        contexts: context ? [context] : [],
        autoCorrectThreshold: false,
      });
    }

    this.save();
  }

  getLearnedCorrection(original: string): string | null {
    for (const [, entry] of this.corrections) {
      if (
        entry.original.toLowerCase() === original.toLowerCase() &&
        entry.autoCorrectThreshold
      ) {
        return entry.corrected;
      }
    }
    return null;
  }

  getUserMisspellings(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const [, entry] of this.corrections) {
      if (entry.acceptanceRate >= 0.7) {
        map[entry.original] = entry.corrected;
      }
    }
    return map;
  }

  getAll(): LearnedCorrection[] {
    return [...this.corrections.values()];
  }

  importCorrections(entries: LearnedCorrection[]): void {
    for (const entry of entries) {
      const key = `${entry.original} → ${entry.corrected}`;
      const existing = this.corrections.get(key);
      if (!existing || entry.occurrences >= existing.occurrences) {
        this.corrections.set(key, { ...entry });
      }
    }
    this.save();
  }
}

export const contextualMemory = new ContextualMemory();
