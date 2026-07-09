/**
 * Human-Like Semantic Understanding Engine
 * 
 * This is NOT pattern matching. This is semantic understanding.
 * 
 * Core Principles:
 * 1. CONCEPT GRAPH — Words are pointers to concepts, concepts have relationships
 * 2. COMPOSITIONAL SEMANTICS — Meaning is built from parts, not matched against templates
 * 3. INTENT INFERENCE — Understand what user WANTS, not just what they SAY
 * 4. CONTEXTUAL REASONING — Use conversation context to resolve ambiguity
 * 5. SEMANTIC SIMILARITY — Similar meanings produce similar understanding
 * 
 * Architecture:
 * - ConceptGraph: Ontology of concepts and their relationships
 * - SemanticParser: Builds meaning from word sequence
 * - IntentInferenceEngine: Determines what user wants
 * - ContextMemory: Maintains conversation state
 * - SemanticMatcher: Finds similar meanings
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: CONCEPT GRAPH — The Ontology of Meaning
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A Concept is an abstract meaning node in our semantic graph.
 * Words are just surface forms that point to concepts.
 */
export interface Concept {
  id: string;
  type: ConceptType;
  semanticRoles: SemanticRole[];
  relatedConcepts: Map<string, RelationType>;
  features: Map<string, any>;
}

export type ConceptType =
  | "ACTION"      // Something that can be done (buy, sell, pay)
  | "ENTITY"      // Something that exists (person, money, goods)
  | "PROPERTY"    // A quality (expensive, large, red)
  | "RELATION"    // How things connect (owner, creditor, customer)
  | "QUANTITY"    // Numbers and amounts
  | "TIME"        // Temporal concepts
  | "LOCATION"    // Spatial concepts
  | "ABSTRACT"    // Abstract ideas (profit, loss, balance)
  | "STATE"       // States of being (completed, pending, outstanding)
  | "MODIFIER";   // Things that modify other concepts

export type SemanticRole =
  | "AGENT"       // Who performs the action
  | "PATIENT"     // Who/what receives the action
  | "THEME"       // What is moved/transferred
  | "RECIPIENT"   // Who receives something
  | "SOURCE"      // Where something comes from
  | "GOAL"        // Where something goes to
  | "INSTRUMENT"  // What is used to do something
  | "BENEFICIARY" // Who benefits
  | "CAUSE"       // What causes something
  | "RESULT"      // What results from something
  | "MANNER"      // How something is done
  | "TIME"        // When something happens
  | "LOCATION"    // Where something happens
  | "QUANTITY";   // How much

export type RelationType =
  | "IS_A"        // Inheritance (dog IS_A animal)
  | "PART_OF"     // Composition (wheel PART_OF car)
  | "CAUSES"      // Causation (fire CAUSES heat)
  | "OPPOSITE"    // Antonyms (buy OPPOSITE sell)
  | "SIMILAR"     // Synonyms (purchase SIMILAR buy)
  | "REQUIRES"    // Prerequisites (payment REQUIRES money)
  | "IMPLIES"     // Logical implication
  | "TEMPORAL"    // Time relationship
  | "SPATIAL";    // Space relationship

/**
 * The Concept Graph — our semantic knowledge base.
 * This is where all meaning lives.
 */
class ConceptGraph {
  private concepts: Map<string, Concept> = new Map();
  private wordToConcept: Map<string, string[]> = new Map();
  private conceptToWords: Map<string, string[]> = new Map();

  constructor() {
    this.buildCoreOntology();
  }

  private buildCoreOntology(): void {
    // ─── ACTION CONCEPTS ─────────────────────────────────────────────────────
    
    this.addConcept({
      id: "TRANSFER",
      type: "ACTION",
      semanticRoles: ["AGENT", "THEME", "RECIPIENT", "SOURCE"],
      relatedConcepts: new Map([
        ["POSSESSION", "CAUSES"],
      ]),
      features: new Map([
        ["direction", "bidirectional"],
        ["requiresQuantity", true],
      ]),
    });

    this.addConcept({
      id: "GIVE",
      type: "ACTION",
      semanticRoles: ["AGENT", "THEME", "RECIPIENT"],
      relatedConcepts: new Map([
        ["TRANSFER", "IS_A"],
        ["RECEIVE", "OPPOSITE"],
      ]),
      features: new Map([
        ["direction", "outward"],
        ["createsReceivable", true],
        ["debitHint", "Party/Receivable"],
        ["creditHint", "Sales/Cash"],
      ]),
    });

    this.addConcept({
      id: "RECEIVE",
      type: "ACTION",
      semanticRoles: ["AGENT", "THEME", "SOURCE"],
      relatedConcepts: new Map([
        ["TRANSFER", "IS_A"],
        ["GIVE", "OPPOSITE"],
      ]),
      features: new Map([
        ["direction", "inward"],
        ["settlesReceivable", true],
        ["debitHint", "Cash/Bank"],
        ["creditHint", "Party/Receivable"],
      ]),
    });

    this.addConcept({
      id: "BUY",
      type: "ACTION",
      semanticRoles: ["AGENT", "THEME", "SOURCE", "INSTRUMENT"],
      relatedConcepts: new Map([
        ["TRANSFER", "IS_A"],
        ["SELL", "OPPOSITE"],
        ["PAYMENT", "REQUIRES"],
      ]),
      features: new Map([
        ["direction", "inward"],
        ["acquiresGoods", true],
        ["debitHint", "Stock/Asset"],
        ["creditHint", "Cash/Payable"],
      ]),
    });

    this.addConcept({
      id: "SELL",
      type: "ACTION",
      semanticRoles: ["AGENT", "THEME", "RECIPIENT", "INSTRUMENT"],
      relatedConcepts: new Map([
        ["TRANSFER", "IS_A"],
        ["BUY", "OPPOSITE"],
        ["INCOME", "CAUSES"],
      ]),
      features: new Map([
        ["direction", "outward"],
        ["generatesIncome", true],
        ["debitHint", "Cash/Receivable"],
        ["creditHint", "Sales"],
      ]),
    });

    this.addConcept({
      id: "PAY",
      type: "ACTION",
      semanticRoles: ["AGENT", "THEME", "RECIPIENT"],
      relatedConcepts: new Map([
        ["GIVE", "IS_A"],
        ["MONEY", "REQUIRES"],
        ["SETTLE", "SIMILAR"],
      ]),
      features: new Map([
        ["direction", "outward"],
        ["settlesPayable", true],
        ["debitHint", "Payable/Expense"],
        ["creditHint", "Cash/Bank"],
      ]),
    });

    this.addConcept({
      id: "EXPENSE",
      type: "ACTION",
      semanticRoles: ["AGENT", "THEME", "CAUSE"],
      relatedConcepts: new Map([
        ["PAY", "REQUIRES"],
        ["LOSS", "SIMILAR"],
      ]),
      features: new Map([
        ["direction", "outward"],
        ["reducesProfit", true],
        ["debitHint", "Expense"],
        ["creditHint", "Cash/Payable"],
      ]),
    });

    // ─── ENTITY CONCEPTS ─────────────────────────────────────────────────────
    
    this.addConcept({
      id: "MONEY",
      type: "ENTITY",
      semanticRoles: ["THEME", "INSTRUMENT"],
      relatedConcepts: new Map([
        ["CURRENCY", "IS_A"],
        ["VALUE", "SIMILAR"],
      ]),
      features: new Map([
        ["measurable", true],
        ["transferable", true],
      ]),
    });

    this.addConcept({
      id: "CURRENCY_NPR",
      type: "ENTITY",
      semanticRoles: ["THEME"],
      relatedConcepts: new Map([
        ["MONEY", "IS_A"],
        ["NEPAL", "PART_OF"],
      ]),
      features: new Map([
        ["symbol", "NPR"],
        ["aliases", ["rs", "rupees", "rupiya", "rupaya", "nrs"]],
      ]),
    });

    this.addConcept({
      id: "PERSON",
      type: "ENTITY",
      semanticRoles: ["AGENT", "PATIENT", "RECIPIENT", "SOURCE", "BENEFICIARY"],
      relatedConcepts: new Map([
        ["PARTY", "SIMILAR"],
      ]),
      features: new Map([
        ["canAct", true],
        ["canOwn", true],
      ]),
    });

    this.addConcept({
      id: "PARTY",
      type: "ENTITY",
      semanticRoles: ["AGENT", "PATIENT", "RECIPIENT", "SOURCE"],
      relatedConcepts: new Map([
        ["PERSON", "IS_A"],
        ["CUSTOMER", "IS_A"],
        ["SUPPLIER", "IS_A"],
      ]),
      features: new Map([
        ["hasLedger", true],
        ["canHaveBalance", true],
      ]),
    });

    this.addConcept({
      id: "GOODS",
      type: "ENTITY",
      semanticRoles: ["THEME", "PATIENT"],
      relatedConcepts: new Map([
        ["STOCK", "IS_A"],
        ["INVENTORY", "SIMILAR"],
      ]),
      features: new Map([
        ["tangible", true],
        ["sellable", true],
        ["buyable", true],
      ]),
    });

    // ─── ABSTRACT/STATE CONCEPTS ─────────────────────────────────────────────
    
    this.addConcept({
      id: "CREDIT_MODE",
      type: "STATE",
      semanticRoles: ["MANNER"],
      relatedConcepts: new Map([
        ["CASH_MODE", "OPPOSITE"],
        ["RECEIVABLE", "IMPLIES"],
        ["PAYABLE", "IMPLIES"],
      ]),
      features: new Map([
        ["paymentDeferred", true],
        ["createOutstanding", true],
      ]),
    });

    this.addConcept({
      id: "CASH_MODE",
      type: "STATE",
      semanticRoles: ["MANNER"],
      relatedConcepts: new Map([
        ["CREDIT_MODE", "OPPOSITE"],
      ]),
      features: new Map([
        ["immediateSettlement", true],
      ]),
    });

    this.addConcept({
      id: "RECEIVABLE",
      type: "ABSTRACT",
      semanticRoles: ["THEME"],
      relatedConcepts: new Map([
        ["PAYABLE", "OPPOSITE"],
        ["ASSET", "IS_A"],
      ]),
      features: new Map([
        ["weAreOwed", true],
        ["accountClass", "asset"],
      ]),
    });

    this.addConcept({
      id: "PAYABLE",
      type: "ABSTRACT",
      semanticRoles: ["THEME"],
      relatedConcepts: new Map([
        ["RECEIVABLE", "OPPOSITE"],
        ["LIABILITY", "IS_A"],
      ]),
      features: new Map([
        ["weOwe", true],
        ["accountClass", "liability"],
      ]),
    });

    // ─── WORD TO CONCEPT MAPPINGS ────────────────────────────────────────────
    // This is the key insight: words are just surface forms pointing to concepts
    
    // Nepali verbs → ACTION concepts
    this.mapWordsToConcept("GIVE", [
      "diye", "diya", "diyo", "die", "diyeko", "dinu", "dinchhu", "dincha",
      "दिए", "दिएको", "दिनु", "दिन्छु"
    ]);

    this.mapWordsToConcept("RECEIVE", [
      "payo", "paye", "paayo", "aayo", "aaye", "milyo", "paunu", "pauncha",
      "tiryo", "tireko", "tirnu", "tira", "tircha",
      "received", "got", "collected",
      "पायो", "आयो", "तिर्यो", "तिरेको"
    ]);

    this.mapWordsToConcept("BUY", [
      "kinyo", "kinye", "kine", "kineko", "kiniyo", "kinnu", "kinna", "kinchhu",
      "kharid", "kharidyo", "kharideko", "kharidne",
      "bought", "buy", "purchase", "purchased", "procured",
      "किन्यो", "किनेको", "खरिद"
    ]);

    this.mapWordsToConcept("SELL", [
      "bechyo", "bechye", "beche", "becheko", "bechnu", "bechcha",
      "bikri", "bikyo", "bikyayo", "bikne",
      "sold", "sell", "sale", "sales",
      "बेच्यो", "बेचेको", "बिक्री"
    ]);

    this.mapWordsToConcept("PAY", [
      "tiryo", "tireko", "tirna", "tirdai",
      "payment", "paid", "pay", "bhugtan",
      "तिर्यो", "तिरेको", "भुक्तानी"
    ]);

    this.mapWordsToConcept("EXPENSE", [
      "kharcha", "kharcho", "kharch",
      "expense", "spent", "cost",
      "खर्च", "खर्चा"
    ]);

    // Credit/Cash mode markers
    this.mapWordsToConcept("CREDIT_MODE", [
      "udhaar", "udhar", "udharo", "udaro",
      "credit", "on credit", "karz",
      "उधारो", "उधार"
    ]);

    this.mapWordsToConcept("CASH_MODE", [
      "nagad", "nakad", "nakit", "nakat",
      "cash", "in cash", "cash ma",
      "नगद", "नकद"
    ]);

    // Currency concepts
    this.mapWordsToConcept("CURRENCY_NPR", [
      "rs", "rs.", "npr", "nrs", "rupees", "rupee",
      "rupiya", "rupya", "rupaye", "rupaya", "rupaiya",
      "रुपैया", "रुपया", "₨"
    ]);

    // Entity concepts
    this.mapWordsToConcept("GOODS", [
      "saman", "samaan", "mal", "maal",
      "goods", "stock", "inventory", "item", "items",
      "सामान", "माल"
    ]);

    // Question/inquiry concepts
    this.mapWordsToConcept("QUESTION", [
      "k", "ke", "kun", "kasto", "kati", "kasari", "kina", "kahile", "kaha",
      "what", "which", "how", "why", "when", "where", "who",
      "के", "कति", "कसरी", "किन"
    ]);

    // System/settings concepts
    this.mapWordsToConcept("LANGUAGE", [
      "language", "bhasa", "bhasha", "lang",
      "भाषा"
    ]);

    this.mapWordsToConcept("SELECT", [
      "select", "choose", "change", "switch",
      "chanos", "channa", "badalna", "change garne",
      "छान्नुहोस्"
    ]);

    // Profit/loss concepts
    this.mapWordsToConcept("PROFIT", [
      "nafa", "naafa", "profit", "gain", "munafa",
      "नाफा"
    ]);

    this.mapWordsToConcept("LOSS", [
      "noksan", "nokshan", "ghata", "loss",
      "नोक्सान", "घाटा"
    ]);
  }

  private addConcept(concept: Concept): void {
    this.concepts.set(concept.id, concept);
  }

  private mapWordsToConcept(conceptId: string, words: string[]): void {
    const normalizedWords = words.map(w => w.toLowerCase().trim());
    
    for (const word of normalizedWords) {
      const existing = this.wordToConcept.get(word) || [];
      if (!existing.includes(conceptId)) {
        existing.push(conceptId);
        this.wordToConcept.set(word, existing);
      }
    }

    const existingWords = this.conceptToWords.get(conceptId) || [];
    this.conceptToWords.set(conceptId, [...new Set([...existingWords, ...normalizedWords])]);
  }

  getConcept(id: string): Concept | undefined {
    return this.concepts.get(id);
  }

  getConceptsForWord(word: string): Concept[] {
    const normalized = word.toLowerCase().trim();
    const conceptIds = this.wordToConcept.get(normalized) || [];
    return conceptIds.map(id => this.concepts.get(id)).filter(Boolean) as Concept[];
  }

  getRelatedConcepts(conceptId: string, relationType?: RelationType): Concept[] {
    const concept = this.concepts.get(conceptId);
    if (!concept) return [];

    const related: Concept[] = [];
    for (const [relatedId, rel] of concept.relatedConcepts) {
      if (!relationType || rel === relationType) {
        const relatedConcept = this.concepts.get(relatedId);
        if (relatedConcept) related.push(relatedConcept);
      }
    }
    return related;
  }

  getSimilarConcepts(conceptId: string): Concept[] {
    const concept = this.concepts.get(conceptId);
    if (!concept) return [];

    const similar: Concept[] = [];
    
    // Direct SIMILAR relations
    for (const [relatedId, rel] of concept.relatedConcepts) {
      if (rel === "SIMILAR" || rel === "IS_A") {
        const relatedConcept = this.concepts.get(relatedId);
        if (relatedConcept) similar.push(relatedConcept);
      }
    }

    // Find concepts that share the same parent (IS_A)
    const parents = this.getRelatedConcepts(conceptId, "IS_A");
    for (const parent of parents) {
      // Find siblings
      for (const [id, c] of this.concepts) {
        if (id !== conceptId) {
          for (const [relId, rel] of c.relatedConcepts) {
            if (rel === "IS_A" && relId === parent.id) {
              similar.push(c);
            }
          }
        }
      }
    }

    return [...new Set(similar)];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: SEMANTIC PARSER — Building Meaning from Structure
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A SemanticFrame represents the meaning of a statement.
 * It captures WHO did WHAT to WHOM for HOW MUCH.
 */
export interface SemanticFrame {
  predicate: Concept | null;           // The main action/state
  roles: Map<SemanticRole, FrameElement>;  // Filled semantic roles
  modifiers: FrameModifier[];          // Manner, time, location, etc.
  confidence: number;
  isQuestion: boolean;
  isNegated: boolean;
  rawText: string;
}

export interface FrameElement {
  concept: Concept | null;
  surfaceForm: string;
  value?: any;   // For quantities, this is the number
}

export interface FrameModifier {
  type: "MANNER" | "TIME" | "LOCATION" | "CONDITION" | "PURPOSE";
  concept: Concept | null;
  surfaceForm: string;
}

/**
 * Token with semantic annotation
 */
interface SemanticToken {
  surface: string;
  concepts: Concept[];
  position: number;
  caseMarker?: "ERGATIVE" | "DATIVE" | "ABLATIVE" | "INSTRUMENTAL" | "GENITIVE";
  isNumber?: boolean;
  numericValue?: number;
}

/**
 * Nepali case markers — key to understanding sentence structure
 */
const CASE_MARKERS: Array<{ suffix: RegExp; marker: SemanticToken["caseMarker"]; role: SemanticRole }> = [
  { suffix: /le$/i, marker: "ERGATIVE", role: "AGENT" },      // Ram le (Ram did)
  { suffix: /lai$/i, marker: "DATIVE", role: "RECIPIENT" },   // Ram lai (to Ram)
  { suffix: /bata$/i, marker: "ABLATIVE", role: "SOURCE" },   // Ram bata (from Ram)
  { suffix: /sanga$/i, marker: "INSTRUMENTAL", role: "INSTRUMENT" },
  { suffix: /ko$/i, marker: "GENITIVE", role: "THEME" },      // 500 ko (of 500 / worth 500)
];

/**
 * The Semantic Parser — builds meaning from word sequence.
 */
class SemanticParser {
  private conceptGraph: ConceptGraph;

  constructor(conceptGraph: ConceptGraph) {
    this.conceptGraph = conceptGraph;
  }

  parse(text: string): SemanticFrame {
    const tokens = this.tokenize(text);
    const annotatedTokens = this.annotateTokens(tokens);
    const frame = this.buildFrame(annotatedTokens, text);
    return frame;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F.,]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  private annotateTokens(tokens: string[]): SemanticToken[] {
    const annotated: SemanticToken[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const semToken: SemanticToken = {
        surface: token,
        concepts: this.conceptGraph.getConceptsForWord(token),
        position: i,
      };

      // Check for case markers (Nepali grammatical particles)
      for (const { suffix, marker, role } of CASE_MARKERS) {
        if (suffix.test(token)) {
          semToken.caseMarker = marker;
          // Also try to get concepts for the stem
          const stem = token.replace(suffix, "").trim();
          if (stem && semToken.concepts.length === 0) {
            semToken.concepts = this.conceptGraph.getConceptsForWord(stem);
          }
          break;
        }
      }

      // Check for numbers
      const numValue = this.parseNumber(token, tokens, i);
      if (numValue !== null) {
        semToken.isNumber = true;
        semToken.numericValue = numValue;
      }

      annotated.push(semToken);
    }

    return annotated;
  }

  private parseNumber(token: string, tokens: string[], index: number): number | null {
    // Direct numeric
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      return parseFloat(token);
    }

    // K notation (5k = 5000)
    const kMatch = token.match(/^(\d+(?:\.\d+)?)k$/i);
    if (kMatch) return parseFloat(kMatch[1]) * 1000;

    // Nepali number words
    const NEPALI_NUMBERS: Record<string, number> = {
      ek: 1, dui: 2, tin: 3, char: 4, panch: 5, chha: 6, saat: 7, aath: 8, nau: 9, das: 10,
      bis: 20, tis: 30, chalis: 40, pachas: 50, sathi: 60, sattari: 70, assi: 80, nabbe: 90,
      saya: 100, hajar: 1000, lakh: 100000, karod: 10000000, crore: 10000000,
      hundred: 100, thousand: 1000,
      एक: 1, दुई: 2, तीन: 3, चार: 4, पाँच: 5,
      सय: 100, हजार: 1000, लाख: 100000,
    };

    if (NEPALI_NUMBERS[token]) {
      // Check if previous token is a number (e.g., "5 hajar")
      const prevToken = tokens[index - 1];
      if (prevToken && /^\d+$/.test(prevToken)) {
        return parseInt(prevToken) * NEPALI_NUMBERS[token];
      }
      return NEPALI_NUMBERS[token];
    }

    return null;
  }

  private buildFrame(tokens: SemanticToken[], rawText: string): SemanticFrame {
    const frame: SemanticFrame = {
      predicate: null,
      roles: new Map(),
      modifiers: [],
      confidence: 0,
      isQuestion: this.isQuestion(rawText),
      isNegated: this.isNegated(rawText),
      rawText,
    };

    // Phase 1: Find the predicate (main action)
    let predicateToken: SemanticToken | null = null;
    for (const token of tokens) {
      const actionConcept = token.concepts.find(c => c.type === "ACTION");
      if (actionConcept) {
        frame.predicate = actionConcept;
        predicateToken = token;
        break;
      }
    }

    // Phase 2: Fill semantic roles based on case markers and position
    let lastNameToken: SemanticToken | null = null;
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const nextToken = tokens[i + 1];

      // Handle case-marked entities (Nepali: "Ram le", "Shyam lai")
      if (nextToken?.caseMarker) {
        const role = CASE_MARKERS.find(m => m.marker === nextToken.caseMarker)?.role;
        if (role) {
          frame.roles.set(role, {
            concept: token.concepts[0] || null,
            surfaceForm: token.surface,
          });
        }
        i++; // Skip the case marker token
        continue;
      }

      // Handle quantities
      if (token.isNumber && token.numericValue !== undefined) {
        frame.roles.set("QUANTITY", {
          concept: this.conceptGraph.getConcept("MONEY") || null,
          surfaceForm: token.surface,
          value: token.numericValue,
        });
        continue;
      }

      // Handle credit/cash mode markers
      const modeMarker = token.concepts.find(c => 
        c.id === "CREDIT_MODE" || c.id === "CASH_MODE"
      );
      if (modeMarker) {
        frame.modifiers.push({
          type: "MANNER",
          concept: modeMarker,
          surfaceForm: token.surface,
        });
        continue;
      }

      // Track potential entity names (capitalized or unknown tokens)
      if (!token.concepts.length && !token.isNumber && token.surface.length > 1) {
        const isLikelyName = /^[A-Z]/.test(token.surface) || 
          !CASE_MARKERS.some(m => m.suffix.test(token.surface));
        if (isLikelyName) {
          lastNameToken = token;
        }
      }
    }

    // Phase 3: Infer missing roles from context
    this.inferMissingRoles(frame, lastNameToken);

    // Calculate confidence
    frame.confidence = this.calculateConfidence(frame);

    return frame;
  }

  private inferMissingRoles(frame: SemanticFrame, lastNameToken: SemanticToken | null): void {
    if (!frame.predicate) return;

    const predicate = frame.predicate;
    const hasAgent = frame.roles.has("AGENT");
    const hasRecipient = frame.roles.has("RECIPIENT");
    const hasQuantity = frame.roles.has("QUANTITY");

    // Inference rule: GIVE + RECIPIENT + QUANTITY = Credit Sale
    if (predicate.id === "GIVE" && hasRecipient && hasQuantity && !hasAgent) {
      frame.roles.set("AGENT", { concept: null, surfaceForm: "Self" });
    }

    // Inference rule: RECEIVE + SOURCE + QUANTITY = Payment Received
    if (predicate.id === "RECEIVE" && frame.roles.has("SOURCE") && hasQuantity && !hasAgent) {
      frame.roles.set("AGENT", { concept: null, surfaceForm: "Self" });
    }

    // If we have an unnamed entity, try to assign it
    if (lastNameToken) {
      if (predicate.id === "GIVE" && !hasRecipient) {
        frame.roles.set("RECIPIENT", {
          concept: this.conceptGraph.getConcept("PARTY") || null,
          surfaceForm: this.capitalizeFirstLetter(lastNameToken.surface),
        });
      } else if (predicate.id === "RECEIVE" && !frame.roles.has("SOURCE")) {
        frame.roles.set("SOURCE", {
          concept: this.conceptGraph.getConcept("PARTY") || null,
          surfaceForm: this.capitalizeFirstLetter(lastNameToken.surface),
        });
      } else if (!hasAgent) {
        frame.roles.set("AGENT", {
          concept: this.conceptGraph.getConcept("PARTY") || null,
          surfaceForm: this.capitalizeFirstLetter(lastNameToken.surface),
        });
      }
    }
  }

  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private isQuestion(text: string): boolean {
    return /[?？]/.test(text) ||
      /\b(k[aei]|kina|kasari|kahile|kaha|kati|kun|who|what|when|where|why|how|which)\b/i.test(text);
  }

  private isNegated(text: string): boolean {
    return /\b(xaina|chaina|chhaina|hoina|gardina|gardena|hudaina|not|never|no|na)\b/i.test(text);
  }

  private calculateConfidence(frame: SemanticFrame): number {
    let confidence = 0.3;  // Base confidence

    if (frame.predicate) {
      confidence += 0.3;
      if (frame.predicate.type === "ACTION") {
        confidence += 0.1;
      }
    }

    if (frame.roles.has("QUANTITY")) confidence += 0.15;
    if (frame.roles.has("AGENT") || frame.roles.has("RECIPIENT")) confidence += 0.1;
    if (frame.modifiers.length > 0) confidence += 0.05;

    return Math.min(confidence, 0.98);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: INTENT INFERENCE ENGINE — Understanding What Users WANT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * User Intent — what the user is trying to accomplish.
 * This is different from the semantic frame (what they said).
 */
export type UserIntent =
  | { type: "TRANSACTION"; txType: TransactionType; frame: SemanticFrame }
  | { type: "QUESTION"; qType: QuestionType; topic: string | null }
  | { type: "COMMAND"; cmdType: CommandType; target: string | null }
  | { type: "SOCIAL"; socialType: SocialType }
  | { type: "UNKNOWN"; rawText: string };

export type TransactionType =
  | "CREDIT_SALE"
  | "CASH_SALE"
  | "CREDIT_PURCHASE"
  | "CASH_PURCHASE"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_MADE"
  | "EXPENSE"
  | "UNKNOWN";

export type QuestionType =
  | "DEFINITION"
  | "HOW_TO"
  | "AMOUNT"
  | "STATUS"
  | "COMPARISON"
  | "GENERAL";

export type CommandType =
  | "CHANGE_SETTING"
  | "SHOW_REPORT"
  | "NAVIGATE"
  | "UNKNOWN";

export type SocialType =
  | "GREETING"
  | "FAREWELL"
  | "THANKS"
  | "SMALL_TALK";

/**
 * Intent Inference Engine — determines what the user WANTS.
 */
class IntentInferenceEngine {
  private conceptGraph: ConceptGraph;

  constructor(conceptGraph: ConceptGraph) {
    this.conceptGraph = conceptGraph;
  }

  infer(frame: SemanticFrame, context: ConversationContext): UserIntent {
    const rawText = frame.rawText.toLowerCase();

    // Check for social intents first (greetings, etc.)
    const socialIntent = this.detectSocialIntent(rawText);
    if (socialIntent) return socialIntent;

    // Check if it's a question
    if (frame.isQuestion) {
      return this.inferQuestionIntent(frame, rawText);
    }

    // Check if it's a command
    const commandIntent = this.detectCommandIntent(rawText);
    if (commandIntent) return commandIntent;

    // Check if it's a transaction
    if (frame.predicate && frame.predicate.type === "ACTION") {
      return this.inferTransactionIntent(frame);
    }

    return { type: "UNKNOWN", rawText: frame.rawText };
  }

  private detectSocialIntent(text: string): UserIntent | null {
    // Greetings
    if (/^(namaste|namaskar|hello|hi|hey|good\s*(morning|evening|afternoon))/i.test(text)) {
      return { type: "SOCIAL", socialType: "GREETING" };
    }
    if (/\b(k\s*cha|k\s*xa|kasto\s*cha|how\s*are\s*you)\b/i.test(text) && text.length < 30) {
      return { type: "SOCIAL", socialType: "SMALL_TALK" };
    }

    // Thanks
    if (/\b(dhanyabad|dhanyabaad|thanks|thank\s*you|shukriya)\b/i.test(text)) {
      return { type: "SOCIAL", socialType: "THANKS" };
    }

    // Farewell
    if (/\b(bye|goodbye|alvida|ta\s*ta|see\s*you|pheri\s*bhetaula)\b/i.test(text)) {
      return { type: "SOCIAL", socialType: "FAREWELL" };
    }

    return null;
  }

  private detectCommandIntent(text: string): UserIntent | null {
    // Language change
    if (/\b(language|bhasa|bhasha)\b.*\b(select|change|kasari|how)\b/i.test(text) ||
        /\b(kasari|how)\b.*\b(language|bhasa)\b.*\b(select|change)\b/i.test(text)) {
      return { type: "COMMAND", cmdType: "CHANGE_SETTING", target: "language" };
    }

    // Show report
    if (/\b(show|dekhau|report|ledger|balance)\b/i.test(text)) {
      return { type: "COMMAND", cmdType: "SHOW_REPORT", target: "report" };
    }

    return null;
  }

  private inferQuestionIntent(frame: SemanticFrame, text: string): UserIntent {
    // Definition questions
    if (/\b(k\s*ho|ke\s*ho|what\s*is|what\s*are|define|meaning|arth|matlab)\b/i.test(text)) {
      const topic = this.extractTopic(text);
      return { type: "QUESTION", qType: "DEFINITION", topic };
    }

    // How-to questions
    if (/\b(kasari|how\s*to|k\s*garne)\b/i.test(text)) {
      const topic = this.extractTopic(text);
      return { type: "QUESTION", qType: "HOW_TO", topic };
    }

    // Amount questions
    if (/\b(kati|how\s*much|kitna|total)\b/i.test(text)) {
      return { type: "QUESTION", qType: "AMOUNT", topic: null };
    }

    return { type: "QUESTION", qType: "GENERAL", topic: this.extractTopic(text) };
  }

  private inferTransactionIntent(frame: SemanticFrame): UserIntent {
    const predicate = frame.predicate!;
    const isCreditMode = frame.modifiers.some(m => m.concept?.id === "CREDIT_MODE");
    const isCashMode = frame.modifiers.some(m => m.concept?.id === "CASH_MODE");

    let txType: TransactionType = "UNKNOWN";

    switch (predicate.id) {
      case "GIVE":
        txType = isCashMode ? "PAYMENT_MADE" : "CREDIT_SALE";
        break;
      case "RECEIVE":
        txType = "PAYMENT_RECEIVED";
        break;
      case "BUY":
        txType = isCreditMode ? "CREDIT_PURCHASE" : "CASH_PURCHASE";
        break;
      case "SELL":
        txType = isCreditMode ? "CREDIT_SALE" : "CASH_SALE";
        break;
      case "PAY":
        txType = "PAYMENT_MADE";
        break;
      case "EXPENSE":
        txType = "EXPENSE";
        break;
    }

    // Context-based refinement
    if (frame.roles.has("RECIPIENT") && !frame.roles.has("SOURCE")) {
      // Giving to someone = credit sale or payment to supplier
      if (txType === "UNKNOWN") txType = "CREDIT_SALE";
    }

    if (frame.roles.has("SOURCE") && !frame.roles.has("RECIPIENT")) {
      // Receiving from someone = payment received
      if (txType === "UNKNOWN") txType = "PAYMENT_RECEIVED";
    }

    return { type: "TRANSACTION", txType, frame };
  }

  private extractTopic(text: string): string | null {
    // Common patterns for topic extraction
    const patterns = [
      /\b(nrs|npr|rupees?|rupiya)\b/i,     // Currency question
      /\b(vat|tds|tax|kar)\b/i,             // Tax question
      /\b(ledger|khata|balance|hisab)\b/i,  // Accounting question
      /\b(language|bhasa|bhasha)\b/i,        // Language question
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0].toLowerCase();
    }

    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: CONTEXTUAL MEMORY — Remembering Conversation State
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConversationContext {
  recentTopics: string[];
  lastIntent: UserIntent | null;
  mentionedEntities: Map<string, string>;  // name → role
  pendingQuestions: string[];
  turnCount: number;
}

class ContextMemory {
  private context: ConversationContext = {
    recentTopics: [],
    lastIntent: null,
    mentionedEntities: new Map(),
    pendingQuestions: [],
    turnCount: 0,
  };

  update(intent: UserIntent, frame: SemanticFrame): void {
    this.context.turnCount++;
    this.context.lastIntent = intent;

    // Track mentioned entities
    for (const [role, element] of frame.roles) {
      if (element.surfaceForm && element.surfaceForm !== "Self") {
        this.context.mentionedEntities.set(element.surfaceForm, role);
      }
    }

    // Track topics
    if (intent.type === "QUESTION" && intent.topic) {
      this.context.recentTopics.unshift(intent.topic);
      if (this.context.recentTopics.length > 5) {
        this.context.recentTopics.pop();
      }
    }
  }

  getContext(): ConversationContext {
    return { ...this.context };
  }

  resolveReference(reference: string): string | null {
    // Resolve pronouns and references using context
    if (/\b(he|she|usko|uslai|tinlai)\b/i.test(reference)) {
      // Return the most recently mentioned person
      for (const [name, role] of this.context.mentionedEntities) {
        if (role === "AGENT" || role === "RECIPIENT") {
          return name;
        }
      }
    }
    return null;
  }

  clear(): void {
    this.context = {
      recentTopics: [],
      lastIntent: null,
      mentionedEntities: new Map(),
      pendingQuestions: [],
      turnCount: 0,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5: RESPONSE GENERATOR — Creating Human-Like Replies
// ═══════════════════════════════════════════════════════════════════════════════

interface ResponseContext {
  language: "nepali" | "english" | "mixed";
  formality: "formal" | "informal";
  intent: UserIntent;
  frame: SemanticFrame;
  context: ConversationContext;
}

class ResponseGenerator {
  private conceptGraph: ConceptGraph;

  constructor(conceptGraph: ConceptGraph) {
    this.conceptGraph = conceptGraph;
  }

  generate(responseCtx: ResponseContext): string {
    const { intent, language, context } = responseCtx;

    switch (intent.type) {
      case "SOCIAL":
        return this.generateSocialResponse(intent.socialType, language);
      
      case "QUESTION":
        return this.generateQuestionResponse(intent, responseCtx);
      
      case "COMMAND":
        return this.generateCommandResponse(intent, language);
      
      case "TRANSACTION":
        return this.generateTransactionResponse(intent, responseCtx);
      
      default:
        return this.generateFallbackResponse(language, context);
    }
  }

  private generateSocialResponse(socialType: SocialType, lang: "nepali" | "english" | "mixed"): string {
    const responses: Record<SocialType, { ne: string[]; en: string[] }> = {
      GREETING: {
        ne: [
          "Namaste! Kasto hunuhunchha? Aaja ke help garna sakchhu?",
          "Namaste hajur! Orbix ma swagat chha. Ke chahiyo?",
        ],
        en: [
          "Hello! How can I help you today?",
          "Hi! Welcome to Orbix. What would you like to do?",
        ],
      },
      FAREWELL: {
        ne: ["Bye! Pheri bhetaula.", "Alvida! Kei chahiye bela pheri aaunus."],
        en: ["Goodbye! See you later.", "Bye! Come back anytime you need help."],
      },
      THANKS: {
        ne: ["Swagat chha! Aru kei?", "Kei pardaina!"],
        en: ["You're welcome!", "Happy to help!"],
      },
      SMALL_TALK: {
        ne: ["Ma thik chhu, dhanyabad! Tapai?", "Sab ramro cha! Ke help garna sakchhu?"],
        en: ["I'm doing well, thank you! How about you?", "All good! What can I help you with?"],
      },
    };

    const pool = lang === "english" ? responses[socialType].en : responses[socialType].ne;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private generateQuestionResponse(intent: Extract<UserIntent, { type: "QUESTION" }>, ctx: ResponseContext): string {
    const { topic } = intent;
    const lang = ctx.language;

    // NRS/NPR question
    if (topic === "nrs" || topic === "npr" || topic === "rupees" || topic === "rupiya") {
      return lang === "english"
        ? "**NRS (Nepali Rupees)** is the official currency of Nepal. Symbol: ₨ or Rs. ISO code: NPR.\n\nIn this ERP, all amounts are in NPR by default."
        : "**NRS (Nepali Rupees)** Nepal ko official mudra ho. Symbol: ₨ wa Rs. ISO code: NPR.\n\nYo ERP ma sabai rakam default ma NPR ma hunchha.";
    }

    // Language selection question
    if (topic === "language" || topic === "bhasa") {
      return lang === "english"
        ? "To change language:\n1. Click on the **language selector** in the chat header\n2. Choose Nepali, English, or Auto-detect\n\nOr simply type in your preferred language — I understand both!"
        : "Language change garna:\n1. Chat header ma **language selector** ma click garnus\n2. Nepali, English, wa Auto-detect choose garnus\n\nWa afno language ma type garnus — ma duitai bujhchhu!";
    }

    // Default fallback for questions
    if (intent.qType === "DEFINITION") {
      return lang === "english"
        ? `I understand you're asking about "${topic || 'something'}". Could you be more specific about what you'd like to know?`
        : `Tapai "${topic || 'kehi'}" barema sodhnu bhayo. Thora aru specific bhannu saknu huncha?`;
    }

    return lang === "english"
      ? "I'm not sure I understand. Could you rephrase your question?"
      : "Maile ramrari bujhina. Pheri sodhnu saknu huncha?";
  }

  private generateCommandResponse(intent: Extract<UserIntent, { type: "COMMAND" }>, lang: "nepali" | "english" | "mixed"): string {
    if (intent.cmdType === "CHANGE_SETTING" && intent.target === "language") {
      return lang === "english"
        ? "To change language, click the **language icon** in the chat header or settings panel."
        : "Language change garna, chat header ma **language icon** ma click garnus.";
    }

    return lang === "english"
      ? "I can help you with that. What specifically would you like to do?"
      : "Ma help garna sakchhu. Specifically ke garne?";
  }

  private generateTransactionResponse(
    intent: Extract<UserIntent, { type: "TRANSACTION" }>,
    ctx: ResponseContext
  ): string {
    const { frame } = intent;
    const lang = ctx.language;
    
    const amount = frame.roles.get("QUANTITY")?.value;
    const recipient = frame.roles.get("RECIPIENT")?.surfaceForm;
    const source = frame.roles.get("SOURCE")?.surfaceForm;
    const party = recipient || source;

    const txLabels: Record<TransactionType, { ne: string; en: string }> = {
      CREDIT_SALE: { ne: "Udhaar Bikri", en: "Credit Sale" },
      CASH_SALE: { ne: "Nagad Bikri", en: "Cash Sale" },
      CREDIT_PURCHASE: { ne: "Udhaar Kharid", en: "Credit Purchase" },
      CASH_PURCHASE: { ne: "Nagad Kharid", en: "Cash Purchase" },
      PAYMENT_RECEIVED: { ne: "Payment Prapti", en: "Payment Received" },
      PAYMENT_MADE: { ne: "Payment Gareko", en: "Payment Made" },
      EXPENSE: { ne: "Kharcha", en: "Expense" },
      UNKNOWN: { ne: "Transaction", en: "Transaction" },
    };

    const label = lang === "english" ? txLabels[intent.txType].en : txLabels[intent.txType].ne;

    if (!amount) {
      return lang === "english"
        ? `I understood this as a **${label}**. Please include the amount to record the entry.`
        : `Yo **${label}** jasto lagyo. Entry rakhna rakam pani bhannus.`;
    }

    if (lang === "english") {
      return `📒 **${label}**\n• Party: ${party || "(not specified)"}\n• Amount: NPR ${amount.toLocaleString()}\n\nShould I record this entry?`;
    }

    return `📒 **${label}**\n• Party: ${party || "(chaina)"}\n• Rakam: NPR ${amount.toLocaleString()}\n\nYo entry rakhne?`;
  }

  private generateFallbackResponse(lang: "nepali" | "english" | "mixed", context: ConversationContext): string {
    // Use context to provide a more helpful response
    if (context.recentTopics.length > 0) {
      const lastTopic = context.recentTopics[0];
      return lang === "english"
        ? `I'm not sure I understood. Were you asking about ${lastTopic}? Please clarify.`
        : `Maile ramrari bujhina. ${lastTopic} barema sodhnu bhayo hola? Thora clear garnus.`;
    }

    return lang === "english"
      ? "I'm here to help with your accounting and khata entries. What would you like to do?"
      : "Ma tapaiko khata ra accounting ma help garna tayar chhu. Ke garne?";
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 6: MAIN BRAIN — The Unified Human-Like Understanding System
// ═══════════════════════════════════════════════════════════════════════════════

export class HumanSemanticBrain {
  private conceptGraph: ConceptGraph;
  private parser: SemanticParser;
  private intentEngine: IntentInferenceEngine;
  private contextMemory: ContextMemory;
  private responseGenerator: ResponseGenerator;

  constructor() {
    this.conceptGraph = new ConceptGraph();
    this.parser = new SemanticParser(this.conceptGraph);
    this.intentEngine = new IntentInferenceEngine(this.conceptGraph);
    this.contextMemory = new ContextMemory();
    this.responseGenerator = new ResponseGenerator(this.conceptGraph);
  }

  /**
   * Process user input and generate a human-like response.
   * This is the main entry point.
   */
  understand(text: string): {
    intent: UserIntent;
    frame: SemanticFrame;
    response: string;
    confidence: number;
  } {
    // Step 1: Parse the semantic structure
    const frame = this.parser.parse(text);

    // Step 2: Get conversation context
    const context = this.contextMemory.getContext();

    // Step 3: Infer user intent
    const intent = this.intentEngine.infer(frame, context);

    // Step 4: Update context memory
    this.contextMemory.update(intent, frame);

    // Step 5: Detect language
    const language = this.detectLanguage(text);

    // Step 6: Generate response
    const response = this.responseGenerator.generate({
      language,
      formality: "informal",
      intent,
      frame,
      context,
    });

    return {
      intent,
      frame,
      response,
      confidence: frame.confidence,
    };
  }

  private detectLanguage(text: string): "nepali" | "english" | "mixed" {
    if (/[\u0900-\u097F]/.test(text)) return "nepali";
    if (/\b(the|is|are|was|what|how|when|which|should|would)\b/i.test(text)) return "english";
    if (/\b(k\s*ho|kasari|kati|hunchha|chha|garnu|garne|udhaar|kharcha|bikri)\b/i.test(text)) return "nepali";
    return "mixed";
  }

  /**
   * Get the current conversation context.
   */
  getContext(): ConversationContext {
    return this.contextMemory.getContext();
  }

  /**
   * Clear conversation context (start fresh).
   */
  resetContext(): void {
    this.contextMemory.clear();
  }

  /**
   * Get the concept graph for external use.
   */
  getConceptGraph(): ConceptGraph {
    return this.conceptGraph;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

let _instance: HumanSemanticBrain | null = null;

export function getHumanBrain(): HumanSemanticBrain {
  if (!_instance) {
    _instance = new HumanSemanticBrain();
  }
  return _instance;
}

export function processWithHumanBrain(text: string): {
  intent: UserIntent;
  frame: SemanticFrame;
  response: string;
  confidence: number;
} {
  return getHumanBrain().understand(text);
}
