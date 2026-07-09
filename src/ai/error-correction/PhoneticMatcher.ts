/** SUTRA AI — Nepali Roman phonetic similarity engine */

/** Vowel groups that sound alike in Roman Nepali typing */
const VOWEL_EQUIVALENCE: string[][] = [
  ["a", "aa", "ah"],
  ["i", "ee", "y"],
  ["u", "oo", "ou"],
  ["e", "ai", "ae"],
  ["o", "au", "aw"],
];

/** Consonant pairs often confused in transliteration */
const CONSONANT_EQUIVALENCE: string[][] = [
  ["k", "c", "q"],
  ["kh", "k"],
  ["ch", "c"],
  ["chh", "ch", "chha"],
  ["sh", "s", "shh"],
  ["v", "w", "b"],
  ["f", "ph"],
  ["z", "j"],
  ["t", "d"],
  ["r", "l"],
];

/** Nepali-specific suffix variants */
const SUFFIX_EQUIVALENCE: Record<string, string[]> = {
  ye: ["ya", "yo", "e", "eko", "eko"],
  yo: ["ye", "y"],
  nu: ["na", "ne"],
  ko: ["ka", "ke", "k"],
  le: ["li", "le"],
};

const KEYBOARD_NEIGHBORS: Record<string, string[]> = {
  a: ["s", "q", "w", "z"],
  e: ["w", "r", "d", "s"],
  i: ["u", "o", "k", "j"],
  o: ["i", "p", "l", "k"],
  r: ["e", "t", "f", "d"],
  k: ["j", "l", "i", "o"],
  n: ["b", "m", "h", "j"],
  m: ["n", "j", "k"],
};

export interface PhoneticMatch {
  word: string;
  candidate: string;
  score: number;
  method: "exact" | "vowel" | "consonant" | "suffix" | "keyboard" | "metaphone";
}

export class PhoneticMatcher {
  /** Primary similarity score 0.0–1.0 */
  similarity(a: string, b: string): number {
    const x = a.toLowerCase().trim();
    const y = b.toLowerCase().trim();
    if (!x || !y) return 0;
    if (x === y) return 1;

    const metaX = this.nepaliMetaphone(x);
    const metaY = this.nepaliMetaphone(y);
    if (metaX === metaY) return 0.95;

    const metaScore = this.stringSimilarity(metaX, metaY);

    const vowelScore = this.vowelFoldScore(x, y);
    const suffixScore = this.suffixScore(x, y);
    const keyboardScore = this.keyboardProximityScore(x, y);
    const transposition = this.isAdjacentTransposition(x, y) ? 0.92 : 0;

    return Math.min(
      1,
      Math.max(metaScore, vowelScore, suffixScore, keyboardScore, transposition),
    );
  }

  /** Find phonetically similar candidates from a corpus */
  findMatches(word: string, corpus: string[], minScore = 0.7): PhoneticMatch[] {
    const results: PhoneticMatch[] = [];
    const lower = word.toLowerCase();

    for (const candidate of corpus) {
      const c = candidate.toLowerCase();
      if (c === lower) continue;

      const score = this.similarity(lower, c);
      if (score < minScore) continue;

      let method: PhoneticMatch["method"] = "metaphone";
      if (this.isAdjacentTransposition(lower, c)) method = "metaphone";
      else if (this.vowelFoldScore(lower, c) >= 0.85) method = "vowel";
      else if (this.suffixScore(lower, c) >= 0.85) method = "suffix";
      else if (this.keyboardProximityScore(lower, c) >= 0.85) method = "keyboard";

      results.push({ word: lower, candidate: c, score, method });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /** Nepali-adapted metaphone: collapse vowel variants & common clusters */
  nepaliMetaphone(word: string): string {
    let w = word.toLowerCase();

    // Normalize common clusters
    w = w
      .replace(/chh/g, "CH")
      .replace(/ch/g, "C")
      .replace(/shh/g, "SH")
      .replace(/sh/g, "S")
      .replace(/kh/g, "K")
      .replace(/gh/g, "G")
      .replace(/th/g, "T")
      .replace(/dh/g, "D")
      .replace(/ph/g, "P")
      .replace(/bh/g, "B")
      .replace(/ksh/g, "X")
      .replace(/gya/g, "J")
      .replace(/aa/g, "A")
      .replace(/ee/g, "I")
      .replace(/oo/g, "U")
      .replace(/ai/g, "E")
      .replace(/au/g, "O");

    // Collapse repeated consonants
    w = w.replace(/(.)\1+/g, "$1");

    // Fold remaining vowels to single class
    w = w.replace(/[aeiou]/g, (v) => {
      if ("aA".includes(v)) return "A";
      if ("iIey".includes(v)) return "I";
      if ("uUoO".includes(v)) return "U";
      return "A";
    });

    return w;
  }

  private vowelFoldScore(a: string, b: string): number {
    const fold = (s: string) => {
      let out = s;
      for (const group of VOWEL_EQUIVALENCE) {
        const rep = group[0];
        for (const v of group) {
          out = out.replace(new RegExp(v, "g"), rep);
        }
      }
      return out;
    };
    const fa = fold(a);
    const fb = fold(b);
    if (fa === fb) return 0.9;
    return this.stringSimilarity(fa, fb);
  }

  private suffixScore(a: string, b: string): number {
    for (const [suffix, variants] of Object.entries(SUFFIX_EQUIVALENCE)) {
      const all = [suffix, ...variants];
      const aMatch = all.some((s) => a.endsWith(s));
      const bMatch = all.some((s) => b.endsWith(s));
      if (aMatch && bMatch && a.slice(0, -2) === b.slice(0, -2)) return 0.88;
    }
    return 0;
  }

  private keyboardProximityScore(a: string, b: string): number {
    if (a.length !== b.length) return 0;
    let matches = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[i]) {
        matches++;
        continue;
      }
      const neighbors = KEYBOARD_NEIGHBORS[a[i]] ?? [];
      if (neighbors.includes(b[i])) matches += 0.5;
    }
    return matches / a.length;
  }

  private isAdjacentTransposition(a: string, b: string): boolean {
    if (a.length !== b.length || a.length < 3) return false;
    for (let i = 0; i < a.length - 1; i++) {
      const swapped = a.slice(0, i) + a[i + 1] + a[i] + a.slice(i + 2);
      if (swapped === b) return true;
    }
    return false;
  }

  private stringSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    let matches = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      if (a[i] === b[i]) matches++;
    }
    return matches / maxLen;
  }

  /** Check if consonant confusion could explain the difference */
  consonantConfusionScore(a: string, b: string): number {
    const fold = (s: string) => {
      let out = s;
      for (const group of CONSONANT_EQUIVALENCE) {
        const rep = group[0];
        for (const c of group) {
          out = out.replace(new RegExp(c, "g"), rep);
        }
      }
      return out;
    };
    const fa = fold(a.toLowerCase());
    const fb = fold(b.toLowerCase());
    return fa === fb ? 0.85 : this.stringSimilarity(fa, fb);
  }
}

export const phoneticMatcher = new PhoneticMatcher();
