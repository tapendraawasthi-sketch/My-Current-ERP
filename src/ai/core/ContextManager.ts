/** SUTRA AI — conversation and domain context manager (Sprint 3 enhanced) */

import type {
  ConversationTurn,
  DomainContext,
  ExtractedEntities,
  IntentType,
  LanguageCode,
  LanguageConfig,
  PersistedConversationTurn,
  SessionSnapshot,
  SessionState,
  UserProfile,
} from "../types";
import { userProfileManager } from "../knowledge/UserProfileManager";

const DEFAULT_LANGUAGE_CONFIG: LanguageConfig = {
  inputLanguage: "auto",
  outputLanguage: "nepali",
  showTranslation: false,
  autoDetect: true,
};

const EMPTY_SESSION: SessionState = {
  topicStack: [],
  turnCount: 0,
  awaiting: null,
};

export class ContextManager {
  private turns: ConversationTurn[] = [];
  private domainContext: DomainContext = {};
  private languageConfig: LanguageConfig = { ...DEFAULT_LANGUAGE_CONFIG };
  private session: SessionState = { ...EMPTY_SESSION };
  private maxTurns = 50;

  setLanguageConfig(config: Partial<LanguageConfig>): void {
    this.languageConfig = { ...this.languageConfig, ...config };
  }

  getLanguageConfig(): LanguageConfig {
    return { ...this.languageConfig };
  }

  setUserProfile(profile: UserProfile): void {
    userProfileManager.updateProfile(profile);
  }

  getUserProfile(): UserProfile {
    return userProfileManager.getProfile();
  }

  setDomainContext(ctx: DomainContext): void {
    this.domainContext = { ...this.domainContext, ...ctx };
  }

  getDomainContext(): DomainContext {
    return { ...this.domainContext };
  }

  getSession(): SessionState {
    return { ...this.session };
  }

  setPendingAction(pending: SessionState["pendingAction"]): void {
    this.session.pendingAction = pending ?? null;
    this.session.awaiting = pending ? "confirmation" : null;
  }

  clearPendingAction(): void {
    this.session.pendingAction = null;
    if (this.session.awaiting === "confirmation") {
      this.session.awaiting = null;
    }
  }

  addTurn(
    role: "user" | "assistant",
    content: string,
    language?: LanguageCode,
    meta?: { entities?: ExtractedEntities; intent?: IntentType },
  ): void {
    this.turns.push({
      role,
      content,
      timestamp: new Date(),
      language,
      entities: meta?.entities,
      intent: meta?.intent,
    });
    if (this.turns.length > this.maxTurns) {
      this.turns = this.turns.slice(-this.maxTurns);
    }
    this.session.turnCount += 1;
    if (role === "user") {
      this.session.lastUserText = content;
    }
    this.updateDomainFromTurn(content);
  }

  /** Update session state after successful entity/intent extraction */
  updateSession(entities: ExtractedEntities, intent?: IntentType): void {
    if (entities.product) {
      this.session.lastProduct = entities.product;
      this.session.lastProductNepali = entities.productNepali;
      if (!this.domainContext.commonProducts?.includes(entities.product)) {
        this.domainContext.commonProducts = [
          entities.product,
          ...(this.domainContext.commonProducts ?? []),
        ].slice(0, 20);
      }
    }
    if (entities.amount !== undefined) this.session.lastAmount = entities.amount;
    if (entities.quantity !== undefined) this.session.lastQuantity = entities.quantity;
    if (entities.unit) this.session.lastUnit = entities.unit;
    if (entities.party) {
      this.session.lastParty = entities.party;
      if (!this.domainContext.commonParties?.includes(entities.party)) {
        this.domainContext.commonParties = [
          entities.party,
          ...(this.domainContext.commonParties ?? []),
        ].slice(0, 20);
      }
    }
    if (intent) this.session.lastIntent = intent;
    if (entities.transactionType) this.session.lastTransactionType = entities.transactionType;

    // Infer what we're awaiting next
    this.session.awaiting = this.inferAwaiting(intent, entities);
  }

  private inferAwaiting(
    intent?: IntentType,
    entities?: ExtractedEntities,
  ): SessionState["awaiting"] {
    if (intent === "CONFIRMATION" || intent === "REJECTION") return "confirmation";
    if (!entities) return null;
    if ((intent === "SALES_ENTRY" || intent === "PURCHASE_ENTRY") && entities.product && !entities.amount && !entities.quantity) {
      return "amount";
    }
    if ((intent === "SALES_ENTRY" || intent === "PURCHASE_ENTRY") && !entities.product) {
      return "product";
    }
    return null;
  }

  getTurns(): ConversationTurn[] {
    return [...this.turns];
  }

  getRecentTurns(count = 10): ConversationTurn[] {
    return this.turns.slice(-count);
  }

  getLastAssistantMessage(): string | undefined {
    for (let i = this.turns.length - 1; i >= 0; i--) {
      if (this.turns[i].role === "assistant") return this.turns[i].content;
    }
    return undefined;
  }

  getConversationSummary(): string {
    return this.getRecentTurns(6)
      .map((t) => `${t.role}: ${t.content}`)
      .join("\n");
  }

  clearHistory(): void {
    this.turns = [];
    this.session = { ...EMPTY_SESSION };
  }

  exportSnapshot(
    userId: string,
    uiMessages?: SessionSnapshot["uiMessages"],
  ): SessionSnapshot {
    const turns: PersistedConversationTurn[] = this.turns.map((t) => ({
      role: t.role,
      content: t.content,
      timestamp: t.timestamp.toISOString(),
      language: t.language,
      intent: t.intent,
    }));

    return {
      userId,
      turns,
      session: this.getSession(),
      domainContext: { ...this.domainContext },
      uiMessages,
      updatedAt: Date.now(),
    };
  }

  restoreSnapshot(data: {
    turns: PersistedConversationTurn[];
    session: SessionState;
    domainContext: DomainContext;
  }): void {
    this.turns = data.turns.map((t) => ({
      role: t.role,
      content: t.content,
      timestamp: new Date(t.timestamp),
      language: t.language,
      intent: t.intent,
    }));
    this.session = { ...EMPTY_SESSION, ...data.session };
    this.domainContext = { ...data.domainContext };
  }

  getRecentTopics(): string[] {
    return this.domainContext.recentTopics ?? [];
  }

  private updateDomainFromTurn(content: string): void {
    const lower = content.toLowerCase();
    const topics: string[] = [];

    if (/\b(bech|bikri|sales|sold)\b/i.test(lower)) topics.push("sales");
    if (/\b(kin|kharid|purchase|buy)\b/i.test(lower)) topics.push("purchase");
    if (/\b(udhaar|credit|debt)\b/i.test(lower)) topics.push("credit");
    if (/\b(tarkari|kakro|aalu|vegetable|sabji)\b/i.test(lower)) topics.push("vegetables");
    if (/\b(debit|credit|ledger|khata|hisaab)\b/i.test(lower)) topics.push("accounting");
    if (/\b(report|balance|statement)\b/i.test(lower)) topics.push("reports");

    if (topics.length > 0) {
      const existing = this.domainContext.recentTopics ?? [];
      this.domainContext.recentTopics = [...new Set([...topics, ...existing])].slice(0, 10);
      this.session.topicStack = [...new Set([...topics, ...this.session.topicStack])].slice(0, 8);
    }

    if (topics.includes("vegetables") && !this.domainContext.businessType) {
      this.domainContext.businessType = "grocery";
    }
  }

  /** Level 5-7 context for suggestion weighting */
  getContextHints(): {
    businessType?: string;
    recentTopics: string[];
    commonProducts: string[];
    commonParties: string[];
    userMisspellings: Record<string, string>;
    session: SessionState;
  } {
    const profile = userProfileManager.getProfile();
    return {
      businessType: this.domainContext.businessType,
      recentTopics: this.domainContext.recentTopics ?? [],
      commonProducts: [
        ...new Set([...(this.domainContext.commonProducts ?? []), ...profile.commonProducts]),
      ].slice(0, 20),
      commonParties: [
        ...new Set([...(this.domainContext.commonParties ?? []), ...profile.commonParties]),
      ].slice(0, 20),
      userMisspellings: profile.commonMisspellings,
      session: this.getSession(),
    };
  }
}

export const defaultContextManager = new ContextManager();
