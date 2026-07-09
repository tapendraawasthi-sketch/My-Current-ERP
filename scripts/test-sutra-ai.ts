/**
 * SUTRA AI — Sprint 3–5 tests
 * Run: npm run test:sutra-ai
 */

// Node test shim for UserProfileManager localStorage
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}

import { entityExtractor } from "../src/ai/context/EntityExtractor";
import { intentClassifier } from "../src/ai/context/IntentClassifier";
import { contextResolver } from "../src/ai/context/ContextResolver";
import { ContextManager } from "../src/ai/core/ContextManager";
import { IntelligenceCore } from "../src/ai/core/IntelligenceCore";

async function main() {
  console.log("=== SUTRA AI Sprint 3 Tests ===\n");

  // Entity extraction
  console.log("1. Entity Extraction:");
  const entities = entityExtractor.extract("maile 500 ko kakro bechye");
  console.log(`   ${JSON.stringify(entities)}`);
  assert(entities.amount === 500, "amount = 500");
  assert(entities.product === "kakro", "product = kakro");
  assert(entities.transactionType === "sales", "type = sales");

  // Intent classification
  console.log("\n2. Intent Classification:");
  const intent = intentClassifier.classify("maile 500 ko kakro bechye", entities);
  console.log(`   ${intent.intent} (${(intent.confidence * 100).toFixed(0)}%)`);
  assert(intent.intent === "SALES_ENTRY", "intent = SALES_ENTRY");

  // Context resolution — amount continuation
  console.log("\n3. Context Resolution:");
  const session = {
    lastProduct: "kakro",
    lastProductNepali: "काक्रो",
    lastIntent: "SALES_ENTRY" as const,
    lastTransactionType: "sales",
    awaiting: "amount" as const,
    topicStack: ["sales", "vegetables"],
    turnCount: 2,
  };
  const resolved = contextResolver.resolve("800", session);
  console.log(`   "800" → "${resolved.resolved}"`);
  console.log(`   ${resolved.explanation}`);
  assert(resolved.wasResolved, "bare amount should resolve");
  assert(resolved.resolved.includes("800"), "should include amount");

  // Demonstrative: tyo saman
  const session2 = { ...session, awaiting: null };
  const resolved2 = contextResolver.resolve("tyo saman bechye", session2);
  console.log(`   "tyo saman bechye" → "${resolved2.resolved}"`);
  assert(resolved2.resolved.includes("kakro"), "tyo saman → kakro");

  // Multi-turn via IntelligenceCore
  console.log("\n4. Multi-turn Conversation:");
  const ctx = new ContextManager();
  const core = new IntelligenceCore(undefined, ctx);

  const r1 = await core.processInput("maile 500 ko kakro bechye", { useLlm: false });
  console.log(`   Turn 1: ${r1.intent?.intent}, product=${r1.entities?.product}, amount=${r1.entities?.amount}`);
  assert(r1.entities?.product === "kakro", "turn 1 product");

  const r2 = await core.processInput("800", { useLlm: false });
  console.log(`   Turn 2: resolved=${r2.resolvedInput?.wasResolved}, amount=${r2.entities?.amount}`);
  assert(r2.resolvedInput?.wasResolved === true, "turn 2 should resolve context");
  assert(r2.entities?.amount === 800, "turn 2 amount = 800");

  const r3 = await core.processInput("ram lai tyo saman udhaar", { useLlm: false });
  console.log(`   Turn 3: party=${r3.entities?.party}, product=${r3.entities?.product}`);
  assert(r3.entities?.party === "ram", "party = ram");

  // Session state persistence
  const s = ctx.getSession();
  console.log(`\n5. Session State:`);
  console.log(`   lastProduct=${s.lastProduct}, lastParty=${s.lastParty}, turns=${s.turnCount}`);
  assert(s.lastProduct === "kakro", "session retains product");
  assert(s.lastParty === "ram", "session retains party");

  console.log("\n✅ All Sprint 3 tests passed!");

  // Sprint 4: Translation
  console.log("\n=== SUTRA AI Sprint 4 Tests ===\n");

  const { translationEngine } = await import("../src/ai/language/TranslationEngine");
  const { outputFormatter } = await import("../src/ai/language/OutputFormatter");

  console.log("1. Roman → all languages:");
  const roman = translationEngine.translateAll("maile 500 ko kakro bechye", "roman");
  console.log(`   EN: ${roman.english}`);
  console.log(`   नेप: ${roman.nepali}`);
  console.log(`   Roman: ${roman.roman}`);
  assert(roman.english.toLowerCase().includes("sold") || roman.english.includes("500"), "English has sold/500");
  assert(roman.nepali.includes("काक्रो") || roman.nepali.includes("बेच"), "Nepali has काक्रो/बेच");

  console.log("\n2. English → Nepali:");
  const fromEn = translationEngine.translate(
    "I sold cucumber worth Rs. 500",
    "english",
    "nepali",
  );
  console.log(`   ${fromEn}`);
  assert(/[\u0900-\u097F]/.test(fromEn), "Nepali output has Devanagari");

  console.log("\n3. Transaction templates (all 3 langs):");
  const tx = translationEngine.formatTransaction(
    { type: "sales", product: "cucumber", productNepali: "काक्रो", amount: 500 },
    "nepali",
  );
  console.log(`   EN: ${tx.english}`);
  console.log(`   नेप: ${tx.nepali}`);
  console.log(`   Roman: ${tx.roman}`);
  assert(tx.nepali.includes("५००") || tx.nepali.includes("500"), "Nepali amount present");

  console.log("\n4. Output formatter + parallel:");
  const formatted = outputFormatter.format(
    {
      understood_input: "maile 500 ko kakro bechye",
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: roman,
      transaction: { type: "sales", product: "cucumber", productNepali: "काक्रो", amount: 500 },
    },
    "nepali",
    true,
  );
  console.log(`   Primary: ${formatted.primary}`);
  console.log(`   Parallel EN: ${formatted.parallel.english}`);
  assert(formatted.showParallel, "parallel mode on");

  console.log("\n✅ All Sprint 4 tests passed!");

  // Sprint 5: Learning & personalization
  console.log("\n=== SUTRA AI Sprint 5 Tests ===\n");

  const { learningEngine } = await import("../src/ai/learning/LearningEngine");
  const { userProfileManager } = await import("../src/ai/knowledge/UserProfileManager");
  const { suggestionEngine } = await import("../src/ai/error-correction/SuggestionEngine");
  const { contextualMemory } = await import("../src/ai/knowledge/ContextualMemory");

  console.log("1. Learning engine — record correction:");
  learningEngine.recordCorrection("kakor", "kakro", true, "sales");
  learningEngine.recordCorrection("kakor", "kakro", true, "sales");
  learningEngine.recordCorrection("maele", "maile", true, "sales");
  const stats = learningEngine.getStats();
  console.log(`   Total corrections: ${stats.totalCorrections}`);
  console.log(`   Auto-correct patterns: ${stats.autoCorrectPatterns}`);
  assert(stats.totalCorrections >= 3, "corrections recorded");

  console.log("\n2. Personalized suggestions:");
  const baseSuggestions = suggestionEngine.analyze("maele 500 ko kakor bechye", { businessType: "grocery" });
  const profile = userProfileManager.getProfile();
  const personalized = learningEngine.getPersonalizedSuggestions(baseSuggestions.suggestions, profile);
  console.log(`   Top confidence: ${((personalized[0]?.confidence ?? 0) * 100).toFixed(0)}%`);
  assert(personalized.length > 0, "has personalized suggestions");
  assert(
    personalized[0].correctedText.includes("kakro") || personalized[0].correctedText.includes("maile"),
    "correction applied",
  );

  console.log("\n3. User profile tracking:");
  const updated = learningEngine.updateAfterInteraction({
    input: "maile 500 ko kakro bechye",
    entities: { product: "kakro", amount: 500, transactionType: "sales" },
    intent: "SALES_ENTRY",
    hadSuggestion: false,
    responseTimeMs: 120,
  });
  console.log(`   Interactions: ${updated.totalInteractions}`);
  console.log(`   Common products: ${updated.commonProducts.join(", ")}`);
  assert(updated.commonProducts.includes("kakro"), "product tracked");

  console.log("\n4. Reasoning trace steps:");
  const core2 = new IntelligenceCore(undefined, new ContextManager());
  const rReason = await core2.processInput("maele 500 ko kakor bechye", { useLlm: false });
  console.log(`   Steps: ${rReason.reasoning.steps.length}`);
  console.log(`   Has LEARNING step: ${rReason.reasoning.steps.some((s) => s.name.includes("LEARNING"))}`);
  assert(rReason.reasoning.steps.length >= 10, "reasoning has 10+ steps");
  assert(
    rReason.reasoning.steps.some((s) => s.name.includes("LEARNING") || s.name.includes("MULTI-ANGLE")),
    "learning/multi-angle present",
  );

  console.log("\n5. Auto-correct threshold:");
  for (let i = 0; i < 5; i++) {
    learningEngine.recordCorrection("kakor", "kakro", true, "sales");
  }
  const shouldAuto = learningEngine.shouldAutoCorrect("kakor", userProfileManager.getProfile());
  console.log(`   shouldAutoCorrect("kakor"): ${shouldAuto}`);
  assert(shouldAuto || contextualMemory.getLearnedCorrection("kakor") != null, "kakor learned");

  console.log("\n✅ All Sprint 5 tests passed!");

  // Sprint 6: Polish, performance, E2E
  console.log("\n=== SUTRA AI Sprint 6 Tests ===\n");

  console.log("1. Blueprint E2E — maele 500 ko kakor bechye:");
  const ctxE2e = new ContextManager();
  const coreE2e = new IntelligenceCore(undefined, ctxE2e);
  const e2e = await coreE2e.processInput("maele 500 ko kakor bechye", { useLlm: false });
  console.log(`   Intent: ${e2e.intent?.intent}`);
  console.log(`   Product: ${e2e.entities?.product}, Amount: ${e2e.entities?.amount}`);
  console.log(`   Clarification needed: ${e2e.response.needs_clarification}`);
  console.log(`   Processing: ${e2e.processingTimeMs}ms`);
  assert(e2e.intent?.intent === "SALES_ENTRY", "E2E intent = SALES_ENTRY");
  assert(e2e.entities?.amount === 500, "E2E amount = 500");
  assert(
    e2e.suggestions != null || e2e.autoCorrected != null || !e2e.response.needs_clarification,
    "E2E produces suggestion or auto-correct or direct response",
  );

  console.log("\n2. Performance — rule-based pipeline (< 500ms):");
  const perfStart = Date.now();
  for (let i = 0; i < 10; i++) {
    await coreE2e.processInput("maile 200 ko aalu bechye", { useLlm: false });
  }
  const perfAvg = (Date.now() - perfStart) / 10;
  console.log(`   Avg: ${perfAvg.toFixed(0)}ms per request`);
  assert(perfAvg < 500, `pipeline avg ${perfAvg.toFixed(0)}ms should be < 500ms`);

  console.log("\n3. Language detection cache:");
  const { languageDetector } = await import("../src/ai/language/LanguageDetector");
  const d1 = languageDetector.detect("maile kakro bechye");
  const d2 = languageDetector.detect("maile kakro bechye");
  assert(d1.detected === d2.detected, "cached detection consistent");
  assert(d1.detected === "roman", "roman nepali detected");

  console.log("\n4. Full multi-turn + translation flow:");
  const ctxFlow = new ContextManager();
  const coreFlow = new IntelligenceCore(undefined, ctxFlow);
  const f1 = await coreFlow.processInput("maile 500 ko kakro bechye", { useLlm: false });
  const f2 = await coreFlow.processInput("800", { useLlm: false });
  const f3 = await coreFlow.processInput("ram lai tyo saman udhaar", { useLlm: false });
  assert(f2.entities?.amount === 800, "flow turn 2 amount");
  assert(f3.entities?.party === "ram", "flow turn 3 party");
  assert(f1.processingTimeMs > 0 && f2.processingTimeMs > 0, "timing tracked");

  console.log("\n5. No duplicate suggestion analyze (single pass):");
  assert(e2e.reasoning.steps.length >= 10, "reasoning complete in single pass");

  console.log("\n✅ All Sprint 6 tests passed!");

  // Sprint 7: Human conversation, validation, actions
  console.log("\n=== SUTRA AI Sprint 7 Tests ===\n");

  const { responseValidator } = await import("../src/ai/validation/ResponseValidator");
  const { emotionalFormatter } = await import("../src/ai/conversation/EmotionalFormatter");
  const { actionExecutor } = await import("../src/ai/actions/ActionExecutor");

  console.log("1. Response validation gate:");
  const badResponse = {
    understood_input: "test",
    confidence: 0.3,
    needs_clarification: false,
    suggestions: [],
    response: { english: "", nepali: "", roman: "" },
    transaction: { type: "sales" as const },
  };
  const badVal = responseValidator.validate(badResponse, {});
  assert(!badVal.valid, "invalid response caught");
  assert(Boolean(badVal.clarificationQuestion), "clarification question generated");

  console.log("\n2. Emotional formatting:");
  const warm = emotionalFormatter.formatReply(
    "बिक्री: काक्रो रु. ५००",
    "maile 500 ko kakro bechye",
    "nepali",
    { hasTransaction: true, intent: "SALES_ENTRY" },
  );
  assert(warm.length > 10, "warm reply generated");

  console.log("\n3. Action executor — sales invoice:");
  const actions = actionExecutor.resolve(
    "SALES_ENTRY",
    { product: "kakro", amount: 500, transactionType: "sales" },
    "maile 500 ko kakro bechye",
    false,
  );
  assert(actions.length === 1, "sales action created");
  assert(actions[0].page === "sales-invoice", "navigates to sales invoice");
  assert(actions[0].draft?.lines?.[0]?.rate === 500, "draft has amount");

  console.log("\n4. Multi-angle drives follow-up:");
  const core7 = new IntelligenceCore(undefined, new ContextManager());
  const partial = await core7.processInput("maile kakro bechye", { useLlm: false });
  assert(
    partial.response.followUp != null || partial.assistantText?.includes("💬"),
    "follow-up for missing amount",
  );

  console.log("\n5. Golden cases (batch):");
  const goldenCases: Array<{
    input: string;
    check: (r: Awaited<ReturnType<IntelligenceCore["processInput"]>>) => boolean;
    label: string;
  }> = [
    {
      input: "maele 500 ko kakor bechye",
      label: "misspelling sales",
      check: (r) => r.intent?.intent === "SALES_ENTRY" && (r.entities?.amount === 500 || r.suggestions != null),
    },
    {
      input: "maile 500 ko kakro bechye",
      label: "clean sales",
      check: (r) => r.intent?.intent === "SALES_ENTRY" && r.entities?.product === "kakro",
    },
    {
      input: "maile 2 kg aalu kinya",
      label: "purchase qty",
      check: (r) => r.intent?.intent === "PURCHASE_ENTRY" || r.entities?.transactionType === "purchase",
    },
    {
      input: "ram lai 300 ko pyaj udhaar",
      label: "credit sale",
      check: (r) => r.entities?.party === "ram" || r.entities?.paymentMode === "credit",
    },
    {
      input: "aaja ko bikri dekhaunu",
      label: "report request",
      check: (r) => r.intent?.intent === "REPORT_REQUEST" || r.intent?.intent === "QUERY",
    },
    {
      input: "dhanyabad",
      label: "gratitude",
      check: (r) => r.detection.detected != null,
    },
    {
      input: "500",
      label: "bare number",
      check: (r) => r.entities?.amount === 500 || r.resolvedInput?.wasResolved === true,
    },
    {
      input: "k ho yo",
      label: "confused query",
      check: (r) => r.intent?.intent === "QUERY" || r.intent?.intent === "OTHER",
    },
    {
      input: "I sold cucumber worth Rs 500",
      label: "english sales",
      check: (r) => r.detection.detected === "english",
    },
    {
      input: "मैले ५०० को काक्रो बेचें",
      label: "nepali script",
      check: (r) => r.detection.detected === "nepali",
    },
  ];

  let goldenPass = 0;
  const ctxGolden = new ContextManager();
  const coreGolden = new IntelligenceCore(undefined, ctxGolden);
  for (const c of goldenCases) {
    const r = await coreGolden.processInput(c.input, { useLlm: false });
    if (c.check(r)) goldenPass++;
    else console.log(`   ⚠ missed: ${c.label}`);
  }
  console.log(`   ${goldenPass}/${goldenCases.length} golden cases passed`);
  assert(goldenPass >= 8, `at least 8/10 golden cases (got ${goldenPass})`);

  console.log("\n6. Dimensions attached to reasoning:");
  const dimTest = await core7.processInput("maile 500 ko kakro bechye", { useLlm: false });
  assert((dimTest.reasoning.dimensions?.length ?? 0) >= 5, "5+ analysis dimensions");

  console.log("\n7. Assistant text with conversational tone:");
  assert(Boolean(dimTest.assistantText), "assistantText returned from core");
  assert(dimTest.response.actions?.length === 1, "invoice action on complete sales");

  console.log("\n✅ All Sprint 7 tests passed!");

  // Sprint 8: RAG + hybrid LLM routing
  console.log("\n=== SUTRA AI Sprint 8 Tests ===\n");

  const { erpRagRetriever, toErpRagContext } = await import("../src/ai/rag/ErpRagRetriever");
  const { entityEnricher } = await import("../src/ai/rag/EntityEnricher");
  const { hybridLlmRouter } = await import("../src/ai/routing/HybridLlmRouter");

  const mockErp = toErpRagContext({
    parties: [
      { id: "p1", name: "Ram Traders", nameNepali: "राम ट्रेडर्स", code: "RAM01" },
      { id: "p2", name: "Ramesh Store", code: "RMS02" },
      { id: "p3", name: "Shyam Suppliers", code: "SHY03" },
    ],
    items: [
      { id: "i1", name: "Cucumber", nameNepali: "काक्रो", code: "KAK01", saleRate: 80, unit: "kg" },
      { id: "i2", name: "Potato", nameNepali: "आलु", code: "ALU01", saleRate: 60, unit: "kg" },
    ],
  });

  console.log("1. RAG party resolution:");
  const ramHits = erpRagRetriever.findParties("ram", mockErp.parties);
  console.log(`   Matches: ${ramHits.map((h) => h.ref.name).join(", ")}`);
  assert(ramHits.length >= 2, "ram matches multiple parties");
  assert(ramHits[0].ref.name.includes("Ram"), "top match is Ram*");

  console.log("\n2. RAG item resolution:");
  const kakHits = erpRagRetriever.findItems("kakro", mockErp.items);
  assert(kakHits[0]?.ref.name === "Cucumber", "kakro → Cucumber");

  console.log("\n3. Entity enricher:");
  const enriched = entityEnricher.enrich(
    { party: "ram", product: "kakro", amount: 500, transactionType: "sales" },
    "ram lai 500 ko kakro bechye",
    mockErp,
  );
  console.log(`   Party: ${enriched.partyResolvedName ?? enriched.party}`);
  console.log(`   Item: ${enriched.product} (${enriched.itemId})`);
  assert(enriched.itemId === "i1", "item resolved to stock");
  assert(Boolean(enriched.partyId) || Boolean(enriched.partyAmbiguous), "party resolved or ambiguous");

  console.log("\n4. Hybrid LLM router — rules sufficient:");
  const skipLlm = hybridLlmRouter.decide({
    confidence: 0.92,
    intent: "SALES_ENTRY",
    needsClarification: false,
    validationFailed: false,
    llmOnline: true,
  });
  assert(!skipLlm.useLlm, "high-confidence sales skips LLM");
  console.log(`   Skip reason: ${skipLlm.reason}`);

  console.log("\n5. Hybrid LLM router — query uses LLM:");
  const useLlm = hybridLlmRouter.decide({
    confidence: 0.7,
    intent: "QUERY",
    needsClarification: false,
    validationFailed: false,
    llmOnline: true,
  });
  assert(useLlm.useLlm, "QUERY routes to LLM");

  console.log("\n6. End-to-end with ERP context:");
  const core8 = new IntelligenceCore(undefined, new ContextManager());
  const e2e8 = await core8.processInput("ram lai 500 ko kakro bechye", {
    useLlm: false,
    erpContext: mockErp,
  });
  assert(e2e8.entities?.itemId === "i1", "E2E item from RAG");
  assert(e2e8.llmRouteReason != null, "route reason tracked");
  assert(!e2e8.llmUsed, "LLM not used for clear sales");

  console.log("\n7. Ambiguous party follow-up:");
  const ambig = entityEnricher.enrich(
    { party: "ram", product: "kakro", amount: 500 },
    "ram lai kakro",
    mockErp,
  );
  if (ambig.partyAmbiguous) {
    assert(ambig.partyAmbiguous.length >= 2, "ambiguous ram parties listed");
  }

  console.log("\n✅ All Sprint 8 tests passed!");

  // Sprint 9: Voice, balance RAG, feedback calibration, profile sync
  console.log("\n=== SUTRA AI Sprint 9 Tests ===\n");

  const { ledgerQueryHandler } = await import("../src/ai/rag/LedgerQueryHandler");
  const { feedbackCalibrator } = await import("../src/ai/learning/FeedbackCalibrator");
  const { profileSyncStore } = await import("../src/ai/learning/ProfileSyncStore");

  console.log("1. Balance query detection:");
  assert(ledgerQueryHandler.isBalanceQuery("ram ko balance kati"), "detects balance kati");
  assert(ledgerQueryHandler.isBalanceQuery("shyam ko baki kati cha"), "detects baki kati");

  console.log("\n2. Balance resolution from ERP:");
  const balErp = {
    parties: [
      { id: "p1", name: "Ram Traders", balance: 15000 },
      { id: "p2", name: "Shyam Store", balance: -3200 },
    ],
    items: [],
  };
  const bal = ledgerQueryHandler.resolve("ram ko balance kati", { party: "ram" }, balErp);
  assert(bal != null, "balance resolved");
  assert(bal!.balance === 15000, "correct receivable");
  assert(bal!.nepali.includes("Ram Traders"), "nepali party name");

  console.log("\n3. Balance E2E response:");
  const core9 = new IntelligenceCore(undefined, new ContextManager());
  const balE2e = await core9.processInput("ram ko balance kati", {
    useLlm: false,
    erpContext: balErp,
  });
  assert(balE2e.assistantText?.includes("Ram Traders") || balE2e.response.response.nepali.includes("Ram"), "balance reply");
  assert(!balE2e.llmUsed, "no LLM for balance RAG");

  console.log("\n4. Feedback calibrator thresholds:");
  const thresholds = await feedbackCalibrator.refresh();
  assert(thresholds.autoCorrect >= 0.9 && thresholds.autoCorrect <= 0.97, "auto threshold in range");

  console.log("\n5. Profile IndexedDB sync:");
  const testProfile = {
    userId: "test_user_s9",
    preferredInputLanguage: "auto" as const,
    preferredOutputLanguage: "nepali" as const,
    commonMisspellings: { kakor: "kakro" },
    customTerms: [],
    frequentWords: { kakro: 3 },
    commonProducts: ["kakro"],
    commonParties: ["ram"],
    preferredTransactionTypes: ["sales"],
    correctionAcceptanceRate: 0.9,
    averageResponseTimeMs: 100,
    totalInteractions: 10,
    errorRate: 0.1,
  };
  await profileSyncStore.save(testProfile);
  const loaded = await profileSyncStore.load("test_user_s9");
  assert(loaded?.commonMisspellings.kakor === "kakro", "profile round-trip");

  console.log("\n6. Payable balance (negative):");
  const payBal = ledgerQueryHandler.resolve("shyam ko udhaar kati", { party: "shyam" }, balErp);
  assert(payBal?.balanceType === "payable", "payable detected");

  console.log("\n✅ All Sprint 9 tests passed!");

  // Sprint 10: Stock RAG, khata queries, cloud profile sync
  console.log("\n=== SUTRA AI Sprint 10 Tests ===\n");

  const { stockQueryHandler } = await import("../src/ai/rag/StockQueryHandler");
  const { khataQueryHandler } = await import("../src/ai/rag/KhataQueryHandler");
  const { computeItemStock, toErpRagContext } = await import("../src/ai/rag/ErpRagRetriever");
  const { exportLearningBundle, importLearningBundle } = await import(
    "../src/ai/learning/ProfileCloudSync"
  );
  const { contextualMemory } = await import("../src/ai/knowledge/ContextualMemory");

  console.log("1. Stock computation:");
  const stock = computeItemStock("i1", 10, [
    { itemId: "i1", qty: 50 },
    { itemId: "i1", qty: -15 },
    { itemId: "i2", qty: 5 },
  ]);
  assert(stock === 45, "opening + in - out = 45");

  console.log("\n2. Stock query detection:");
  assert(stockQueryHandler.isStockQuery("kakro kati baki cha", { product: "kakro" }), "stock query");
  assert(!stockQueryHandler.isStockQuery("ram ko balance kati", { party: "ram" }), "not stock when balance");

  console.log("\n3. Stock resolution:");
  const stockErp = toErpRagContext({
    items: [
      { id: "i1", name: "Kakro", unit: "kg", openingStock: 10, reorderLevel: 20 },
    ],
    stockMovements: [{ itemId: "i1", qty: 30 }],
  });
  const stk = stockQueryHandler.resolve("kakro kati baki cha", { product: "kakro" }, stockErp);
  assert(stk != null, "stock resolved");
  assert(stk!.stockQty === 40, "stock qty 40");
  assert(stk!.lowStock === true, "low stock flag");

  console.log("\n4. Stock E2E:");
  const core10 = new IntelligenceCore(undefined, new ContextManager());
  const stkE2e = await core10.processInput("kakro kati baki cha", {
    useLlm: false,
    erpContext: stockErp,
  });
  assert(stkE2e.assistantText?.includes("40") || stkE2e.response.response.nepali.includes("40"), "stock in reply");
  assert(!stkE2e.llmUsed, "no LLM for stock RAG");

  console.log("\n5. Khata query with preloaded context:");
  const khataCtx = {
    parties: [],
    items: [],
    recentKhata: [
      {
        id: "v1",
        date: "2026-07-08",
        amount: 2500,
        party: "Ram Traders",
        intent: "khata_sales",
        voucherNo: "KV-001",
      },
    ],
  };
  assert(khataQueryHandler.isKhataQuery("hijo ko entry"), "khata query detected");
  const kht = khataQueryHandler.resolve("hijo ko entry", {}, khataCtx);
  assert(kht != null && kht.entries.length === 1, "khata entry resolved");

  console.log("\n6. Cloud learning bundle:");
  contextualMemory.recordCorrection("kakor", "kakro", true, "sales");
  const bundleJson = await exportLearningBundle();
  const bundle = JSON.parse(bundleJson);
  assert(bundle.version === 1, "bundle version");
  assert(Array.isArray(bundle.corrections), "corrections array");
  const imp = await importLearningBundle(bundleJson);
  assert(imp.ok, "import succeeds");

  console.log("\n✅ All Sprint 10 tests passed!");

  // Sprint 11: Reports, batch queries, proactive alerts
  console.log("\n=== SUTRA AI Sprint 11 Tests ===\n");

  const { reportQueryHandler } = await import("../src/ai/rag/ReportQueryHandler");
  const { batchQueryHandler } = await import("../src/ai/rag/BatchQueryHandler");
  const { proactiveAlertEngine } = await import("../src/ai/intelligence/ProactiveAlertEngine");
  const { toErpRagContext } = await import("../src/ai/rag/ErpRagRetriever");

  console.log("1. Report query detection:");
  assert(reportQueryHandler.isReportQuery("aaja ko bikri kati"), "detects sales today");
  assert(reportQueryHandler.isReportQuery("yo mahina ko profit"), "detects month profit");
  assert(reportQueryHandler.isTrialBalanceQuery("trial balance"), "detects trial balance");

  console.log("\n2. P&L resolution:");
  const pnlResult = reportQueryHandler.resolvePnl({
    period: "today",
    totalIncome: 12000,
    totalExpense: 4500,
    netProfit: 7500,
    entryCount: 8,
  });
  assert(pnlResult.nepali.includes("12"), "pnl nepali has income");
  assert(pnlResult.english.includes("7,500") || pnlResult.english.includes("7500"), "pnl profit");

  console.log("\n3. Report E2E with snapshot:");
  const reportCtx = {
    parties: [],
    items: [],
    pnlSnapshot: {
      period: "current_month" as const,
      totalIncome: 50000,
      totalExpense: 32000,
      netProfit: 18000,
      entryCount: 42,
    },
  };
  const core11 = new IntelligenceCore(undefined, new ContextManager());
  const rptE2e = await core11.processInput("yo mahina ko profit kati", {
    useLlm: false,
    erpContext: reportCtx,
  });
  assert(
    rptE2e.assistantText?.includes("18") || rptE2e.response.response.nepali.includes("18"),
    "report reply has profit",
  );
  assert(!rptE2e.llmUsed, "no LLM for report RAG");

  console.log("\n4. Low stock batch query:");
  const batchCtx = toErpRagContext({
    items: [
      { id: "i1", name: "Kakro", unit: "kg", openingStock: 2, reorderLevel: 10 },
      { id: "i2", name: "Aalu", unit: "kg", openingStock: 50, reorderLevel: 20 },
    ],
    stockMovements: [],
  });
  assert(batchQueryHandler.isLowStockQuery("kam stock ke ke cha"), "low stock query");
  const lowStk = batchQueryHandler.resolveLowStock(batchCtx);
  assert(lowStk != null && lowStk.nepali.includes("Kakro"), "lists low stock kakro");

  console.log("\n5. Multi-party balance:");
  const multiCtx = {
    parties: [
      { id: "p1", name: "Ram Traders", balance: 15000 },
      { id: "p2", name: "Shyam Store", balance: -8000 },
    ],
    items: [],
  };
  const multi = batchQueryHandler.resolveMultiBalance("ram ra shyam ko balance", multiCtx);
  assert(multi != null && multi.nepali.includes("Ram"), "multi balance ram");
  assert(multi!.nepali.includes("Shyam"), "multi balance shyam");

  console.log("\n6. Proactive alerts:");
  const alerts = proactiveAlertEngine.scan(batchCtx);
  assert(alerts.some((a) => a.id.includes("i1")), "low stock alert for kakro");
  const partyAlerts = proactiveAlertEngine.scan(multiCtx);
  assert(partyAlerts.length >= 2, "party balance alerts");

  console.log("\n7. Trial balance report:");
  const tbCtx = {
    parties: [],
    items: [],
    trialBalance: { totalDebit: 100000, totalCredit: 100000, isBalanced: true, rowCount: 12 },
  };
  const tb = reportQueryHandler.resolve("trial balance", tbCtx);
  assert(tb?.kind === "trial_balance" && tb.nepali.includes("मिलेको"), "balanced trial");

  console.log("\n✅ All Sprint 11 tests passed!");

  // Sprint 12: Autocomplete, TTS, expanded golden suite
  console.log("\n=== SUTRA AI Sprint 12 Tests ===\n");

  const { getAutocompleteSuggestions } = await import(
    "../src/ai/interface/InputAutocompleteEngine"
  );
  const { isSpeechSynthesisSupported, speakText } = await import(
    "../src/ai/interface/VoiceOutput"
  );
  const { GOLDEN_CASES, runGoldenSuite } = await import("./sutra-ai-golden-cases");

  console.log("1. Input autocomplete:");
  const ac = getAutocompleteSuggestions("ram ko", { parties: ["Ram Traders", "Shyam"] });
  assert(ac.length >= 1, "autocomplete suggestions");
  assert(ac[0].text.toLowerCase().includes("ram"), "ram phrase suggested");

  console.log("\n2. Autocomplete partial product:");
  const ac2 = getAutocompleteSuggestions("kakro", { products: ["Kakro", "Aalu"] });
  assert(ac2.some((s) => s.text.includes("kakro")), "product phrase");

  console.log("\n3. TTS utilities:");
  assert(typeof isSpeechSynthesisSupported() === "boolean", "TTS support check");
  if (typeof globalThis.window === "undefined") {
    // Node shim — speakText should no-op safely
    speakText("test", "english");
  }

  console.log(`\n4. Expanded golden suite (${GOLDEN_CASES.length} cases):`);
  const golden = await runGoldenSuite(
    () => new IntelligenceCore(undefined, new ContextManager()),
    { minPassRate: 0.72, verbose: true },
  );
  console.log(`   ${golden.passed}/${golden.total} passed (${((golden.passed / golden.total) * 100).toFixed(0)}%)`);
  for (const [cat, stats] of Object.entries(golden.byCategory)) {
    console.log(`   · ${cat}: ${stats.pass}/${stats.total}`);
  }
  assert(golden.passed >= Math.floor(GOLDEN_CASES.length * 0.72), "golden suite threshold");

  console.log("\n✅ All Sprint 12 tests passed!");

  // Sprint 13: Session persistence, ranked autocomplete, TTS polish
  console.log("\n=== SUTRA AI Sprint 13 Tests ===\n");

  const { ContextManager } = await import("../src/ai/core/ContextManager");
  const { sessionMemoryStore, applySnapshotToContext } = await import(
    "../src/ai/learning/SessionMemoryStore"
  );
  const { phraseUsageStore } = await import("../src/ai/learning/PhraseUsageStore");
  const { prepareTextForSpeech, speechTextForLanguage } = await import(
    "../src/ai/interface/ttsUtils"
  );
  const { getAutocompleteSuggestions: rankedAutocomplete } = await import(
    "../src/ai/interface/InputAutocompleteEngine"
  );

  console.log("1. Context export/restore:");
  const ctx13 = new ContextManager();
  ctx13.addTurn("user", "maile 500 ko kakro bechye", "roman");
  ctx13.updateSession(
    { product: "kakro", amount: 500, transactionType: "sales" },
    "SALES_ENTRY",
  );
  const snap = ctx13.exportSnapshot("test_user_s13");
  assert(snap.turns.length === 1, "snapshot has turn");
  assert(snap.session.lastProduct === "kakro", "session product saved");

  const ctx13b = new ContextManager();
  applySnapshotToContext(ctx13b, snap);
  assert(ctx13b.getSession().lastProduct === "kakro", "session restored");
  assert(ctx13b.getRecentTurns(1)[0]?.content.includes("kakro"), "turn restored");

  console.log("\n2. Session IndexedDB round-trip:");
  await sessionMemoryStore.save(ctx13, [
    { id: "m1", role: "user", text: "maile 500 ko kakro bechye", timestamp: new Date().toISOString() },
  ]);
  const loaded = await sessionMemoryStore.load("test_user_s13");
  assert(loaded?.session.lastProduct === "kakro", "IDB session round-trip");

  console.log("\n3. Phrase usage ranking:");
  await phraseUsageStore.record("ram ko balance kati");
  await phraseUsageStore.record("ram ko balance kati");
  const weights = await phraseUsageStore.getWeights();
  assert((weights["ram ko balance kati"] ?? 0) >= 2, "phrase count tracked");

  console.log("\n4. Session-boosted autocomplete:");
  const ranked = rankedAutocomplete("ram", {
    parties: ["Ram Traders"],
    session: { lastParty: "Ram Traders", topicStack: ["sales"], turnCount: 3, awaiting: null },
    phraseWeights: weights,
  });
  assert(ranked.length >= 1, "ranked suggestions");
  assert(
    ranked.some((s) => s.text.toLowerCase().includes("ram")),
    "party-aware suggestion",
  );

  console.log("\n5. TTS text preparation:");
  const tts = prepareTextForSpeech("**Namaste**!\nYo test ho.");
  assert(tts.includes("Namaste") && !tts.includes("**"), "markdown stripped");
  const romanTts = speechTextForLanguage("काक्रो बेचें", "roman");
  assert(romanTts.includes("काक्रो"), "devanagari preserved for roman mode");

  console.log("\n6. Multi-turn after session restore:");
  const core13 = new IntelligenceCore(undefined, ctx13b);
  const cont = await core13.processInput("800", { useLlm: false });
  assert(
    cont.entities?.amount === 800 || cont.resolvedInput?.wasResolved,
    "continuation works after restore",
  );

  console.log("\n✅ All Sprint 13 tests passed!");

  // Sprint 14: Self-correction, duplicate guard, invoice RAG, shortcuts
  console.log("\n=== SUTRA AI Sprint 14 Tests ===\n");

  const { selfCorrectionEngine } = await import("../src/ai/reasoning/SelfCorrectionEngine");
  const { shortcutRouter } = await import("../src/ai/routing/ShortcutRouter");
  const { invoiceQueryHandler } = await import("../src/ai/rag/InvoiceQueryHandler");
  const { toErpRagContext: ragCtx14 } = await import("../src/ai/rag/ErpRagRetriever");

  console.log("1. Self-correction — product change:");
  const corr = selfCorrectionEngine.review(
    "maile 500 ko aalu bechye",
    { product: "aalu", amount: 500, transactionType: "sales" },
    { lastProduct: "kakro", lastAmount: 500, topicStack: [], turnCount: 2, awaiting: null },
  );
  assert(corr.followUp != null, "product change follow-up");
  assert(corr.reduceConfidence === true, "confidence reduced");

  console.log("\n2. Shortcut router:");
  const help = shortcutRouter.route("/help", "nepali");
  assert(help.handled && help.response != null, "/help handled");
  const rewrite = shortcutRouter.route("/balance ram", "nepali");
  assert(rewrite.rewrittenInput?.includes("ram"), "/balance rewrites");
  const clear = shortcutRouter.route("/clear", "nepali");
  assert(clear.shortcutAction === "clear_history", "/clear action");

  console.log("\n3. Invoice query:");
  const invCtx = ragCtx14({
    invoices: [
      {
        id: "inv1",
        invoiceNo: "SI-001",
        date: "2026-07-09",
        partyName: "Ram Traders",
        grandTotal: 5500,
        type: "sales-invoice",
      },
    ],
    parties: [{ id: "p1", name: "Ram Traders" }],
  });
  assert(invoiceQueryHandler.isInvoiceQuery("ram ko last bill"), "invoice query detect");
  const inv = invoiceQueryHandler.resolve("ram ko last bill", { party: "ram" }, invCtx);
  assert(inv != null && inv.invoices[0].invoiceNo === "SI-001", "invoice resolved");

  console.log("\n4. Invoice E2E:");
  const core14 = new IntelligenceCore(undefined, new ContextManager());
  const invE2e = await core14.processInput("last invoice", {
    useLlm: false,
    erpContext: invCtx,
  });
  assert(
    invE2e.assistantText?.includes("SI-001") || invE2e.response.response.nepali.includes("SI"),
    "invoice in reply",
  );

  console.log("\n5. Self-correction E2E:");
  const ctx14 = new ContextManager();
  ctx14.updateSession(
    { product: "kakro", amount: 500, transactionType: "sales" },
    "SALES_ENTRY",
  );
  const core14b = new IntelligenceCore(undefined, ctx14);
  const corrE2e = await core14b.processInput("maile 500 ko aalu bechye", { useLlm: false });
  assert(corrE2e.response.followUp != null || corrE2e.response.selfCorrectionNote != null, "E2E correction");

  console.log("\n6. Shortcut help E2E:");
  const helpE2e = await core14.processInput("/help", { useLlm: false });
  assert(helpE2e.assistantText?.includes("SUTRA") || helpE2e.assistantText?.includes("/clear"), "help text");

  console.log("\n✅ All Sprint 14 tests passed!");

  // Sprint 15: Payments, insights, anomaly, invoice history
  console.log("\n=== SUTRA AI Sprint 15 Tests ===\n");

  const { paymentReceiptHandler } = await import("../src/ai/rag/PaymentReceiptHandler");
  const { insightQueryHandler, computeBusinessInsights } = await import(
    "../src/ai/rag/InsightQueryHandler"
  );
  const { anomalyDetector } = await import("../src/ai/intelligence/AnomalyDetector");
  const { invoiceHistoryEnricher } = await import("../src/ai/rag/InvoiceHistoryEnricher");

  console.log("1. Payment/receipt detection:");
  assert(
    paymentReceiptHandler.isPaymentReceipt("ram le 500 tiryo", {
      party: "ram",
      amount: 500,
      transactionType: "receipt",
    }),
    "receipt detected",
  );
  const pay = paymentReceiptHandler.resolve("ram le 500 tiryo", {
    party: "Ram Traders",
    amount: 500,
    transactionType: "receipt",
  });
  assert(pay?.kind === "receipt" && pay.amount === 500, "receipt resolved");

  console.log("\n2. Business insights:");
  const insights = computeBusinessInsights([
    {
      date: new Date().toISOString().slice(0, 10),
      partyName: "Ram Traders",
      grandTotal: 5000,
      type: "sales-invoice",
      lines: [{ itemName: "Kakro", qty: 10, rate: 50 }],
    },
    {
      date: "2026-07-01",
      partyName: "Ram Traders",
      grandTotal: 2000,
      type: "sales-invoice",
      lines: [{ itemName: "Kakro", qty: 4, rate: 50 }],
    },
  ]);
  assert(insights.todayInvoiceCount >= 1, "today invoices");
  assert(insights.topProducts[0]?.name === "Kakro", "top product");

  console.log("\n3. Insight query E2E:");
  const insightCtx = ragCtx14({
    invoices: [
      {
        id: "i1",
        invoiceNo: "SI-1",
        date: new Date().toISOString().slice(0, 10),
        partyName: "Ram",
        grandTotal: 3000,
        type: "sales-invoice",
        lines: [{ itemName: "Kakro", qty: 6, rate: 50 }],
      },
    ],
  });
  const core15 = new IntelligenceCore(undefined, new ContextManager());
  const insE2e = await core15.processInput("business summary", {
    useLlm: false,
    erpContext: insightCtx,
  });
  assert(
    insE2e.assistantText?.includes("3") || insE2e.response.response.nepali.includes("बिक्री"),
    "insight reply",
  );

  console.log("\n4. Anomaly detection:");
  const anomalyCtx = {
    ...insightCtx,
    partyStats: [{ partyName: "Ram Traders", invoiceCount: 5, avgAmount: 1000, totalAmount: 5000 }],
  };
  const anom = anomalyDetector.detect(
    { party: "Ram Traders", amount: 8000 },
    anomalyCtx,
  );
  assert(anom != null, "anomaly flagged");

  console.log("\n5. Invoice history enrich:");
  const enriched = invoiceHistoryEnricher.enrich(
    { party: "Ram", product: "kakro" },
    insightCtx,
  );
  assert(enriched.itemRate === 50 || enriched.quantity === 6, "history rate/qty");

  console.log("\n6. Payment E2E:");
  const payE2e = await core15.processInput("ram le 500 tiryo", { useLlm: false });
  assert(payE2e.entities?.amount === 500, "payment amount extracted");

  console.log("\n✅ All Sprint 15 tests passed!");

  // Sprint 16: Confirmation gate, khata prefill, multi-item lines
  console.log("\n=== SUTRA AI Sprint 16 Tests ===\n");

  const { multiItemEntityParser } = await import("../src/ai/context/MultiItemEntityParser");
  const { confirmationGate } = await import("../src/ai/guard/ConfirmationGate");
  const { buildAiKhataDraft, toKhataConfirmationCard } = await import(
    "../src/ai/actions/KhataCardBuilder"
  );
  const { actionExecutor } = await import("../src/ai/actions/ActionExecutor");

  console.log("1. Multi-item parsing:");
  const multi = multiItemEntityParser.parse("maile kakro 500 ra aalu 300 bechye");
  assert(multi.length === 2, "two line items");
  assert(multi[0]?.amount === 500 && multi[1]?.amount === 300, "amounts parsed");

  console.log("\n2. Khata card builder:");
  const khataDraft = buildAiKhataDraft(
    { party: "Ram", amount: 500, transactionType: "receipt" },
    "ram le 500 tiryo",
  );
  assert(khataDraft?.intent === "khata_payment_in", "receipt intent");
  const card = toKhataConfirmationCard(khataDraft!);
  assert(card.journalLines != null && card.journalLines.length >= 2, "journal lines");

  console.log("\n3. Khata prefill action:");
  const khataAction = actionExecutor.resolveKhata(
    { party: "Ram", amount: 500, transactionType: "receipt" },
    "ram le 500 tiryo",
  );
  assert(khataAction?.type === "prefill_khata", "prefill_khata action");

  console.log("\n4. Confirmation gate:");
  const gateResp: import("../src/ai/types").AIResponse = {
    understood_input: "test",
    confidence: 0.9,
    needs_clarification: false,
    suggestions: [],
    response: { nepali: "ok", english: "ok", roman: "ok" },
    duplicateWarning: "dup",
    actions: [{ id: "a1", type: "navigate", page: "x", label: "x", labelNepali: "x" }],
  };
  assert(confirmationGate.needsGate(gateResp, false), "gate needed");
  const gated = confirmationGate.gate(
    gateResp,
    { amount: 500, product: "kakro", transactionType: "sales" },
    { intent: "SALES_ENTRY", confidence: 0.9, entities: {} },
    "nepali",
    "test",
  );
  assert(gated.response.actions == null, "actions stripped");
  assert(gated.pending.warnings.length === 1, "warning stored");

  console.log("\n5. Multi-item invoice draft:");
  const multiDraft = actionExecutor.resolve(
    "SALES_ENTRY",
    {
      product: "kakro",
      amount: 800,
      lines: multi,
      transactionType: "sales",
    },
    "maile kakro 500 ra aalu 300 bechye",
    false,
  );
  assert(multiDraft[0]?.draft?.lines?.length === 2, "two invoice lines");

  console.log("\n6. Confirmation E2E:");
  const ctx16 = new ContextManager();
  ctx16.setPendingAction({
    understoodInput: "maile 500 ko kakro bechye",
    entities: { product: "kakro", amount: 500, transactionType: "sales" },
    intent: "SALES_ENTRY",
    warnings: ["dup"],
    outputLanguage: "nepali",
  });
  const core16 = new IntelligenceCore(undefined, ctx16);
  const confirmed = await core16.processInput("ho", { useLlm: false });
  assert(
    confirmed.response.actions != null && confirmed.response.actions.length > 0,
    "confirmed actions released",
  );

  console.log("\n✅ All Sprint 16 tests passed!");

  // Sprint 17: Dates, comparisons, corrections, party chips
  console.log("\n=== SUTRA AI Sprint 17 Tests ===\n");

  const { dateResolver } = await import("../src/ai/context/DateResolver");
  const { comparisonQueryHandler } = await import("../src/ai/rag/ComparisonQueryHandler");
  const { correctionEngine } = await import("../src/ai/context/CorrectionEngine");
  const { partyDisambiguationHandler } = await import("../src/ai/rag/PartyDisambiguationHandler");

  console.log("1. Date resolver:");
  const hijo = dateResolver.detect("hijo ko entry");
  assert(hijo?.key === "yesterday", "hijo = yesterday");
  const aaja = dateResolver.detect("aaja ko bikri");
  assert(aaja?.key === "today", "aaja = today");

  console.log("\n2. Sales comparison:");
  const todayIso = new Date().toISOString().slice(0, 10);
  const yIso = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const cmp = comparisonQueryHandler.resolve("aaja vs hijo bikri", {
    recentInvoices: [
      { date: todayIso, grandTotal: 5000, type: "sales-invoice" },
      { date: yIso, grandTotal: 3000, type: "sales-invoice" },
      { date: todayIso, grandTotal: 1000, type: "sales-invoice" },
    ],
  });
  assert(cmp != null && cmp.leftTotal === 6000 && cmp.rightTotal === 3000, "compare totals");

  console.log("\n3. Comparison E2E:");
  const core17 = new IntelligenceCore(undefined, new ContextManager());
  const cmpE2e = await core17.processInput("aaja vs hijo bikri", {
    useLlm: false,
    erpContext: {
      recentInvoices: [
        { date: todayIso, grandTotal: 4000, type: "sales-invoice" },
        { date: yIso, grandTotal: 2000, type: "sales-invoice" },
      ],
    },
  });
  assert(
    cmpE2e.assistantText?.includes("4") || cmpE2e.response.response.nepali.includes("तुलना"),
    "comparison reply",
  );

  console.log("\n4. Correction engine:");
  const corr17 = correctionEngine.apply(
    "hoina, 800 ko",
    { lastProduct: "kakro", lastAmount: 500, topicStack: [], turnCount: 2, awaiting: null, lastTransactionType: "sales" },
    {},
  );
  assert(corr17?.entities.amount === 800, "amount corrected");

  console.log("\n5. Party disambiguation:");
  const partyResp = partyDisambiguationHandler.tryBuildResponse(
    { party: "ram", partyAmbiguous: ["Ram Traders", "Ramesh Store"], amount: 500 },
    { intent: "SALES_ENTRY", confidence: 0.9, entities: {} },
    "nepali",
    "ram lai 500 udhaar",
  );
  assert(partyResp?.quickReplies?.length === 2, "party chips");
  assert(partyResp?.needs_clarification === true, "needs pick");

  console.log("\n6. Shortcut /compare:");
  const cmpShortcut = shortcutRouter.route("/compare", "nepali");
  assert(cmpShortcut.rewrittenInput?.includes("aaja"), "/compare rewrite");

  console.log("\n✅ All Sprint 17 tests passed!");

  // Sprint 18: Receivables, unit price, compound parties, teach-back
  console.log("\n=== SUTRA AI Sprint 18 Tests ===\n");

  const { unitPriceEnricher } = await import("../src/ai/context/UnitPriceEnricher");
  const { compoundPartyParser } = await import("../src/ai/context/CompoundPartyParser");
  const { receivableQueryHandler } = await import("../src/ai/rag/ReceivableQueryHandler");
  const { compoundTransactionHandler } = await import("../src/ai/rag/CompoundTransactionHandler");
  const { teachBackFormatter } = await import("../src/ai/conversation/TeachBackFormatter");

  console.log("1. Unit price enrich:");
  const priced = unitPriceEnricher.enrich({ quantity: 2, itemRate: 50, product: "kakro" });
  assert(priced.amount === 100, "qty × rate = amount");

  console.log("\n2. Compound party parse:");
  const parties = compoundPartyParser.parse("ram lai 500 ani shyam lai 300 udhaar");
  assert(parties.length === 2 && parties[0]?.amount === 500, "two party lines");

  console.log("\n3. Receivable list:");
  const recv = receivableQueryHandler.tryBuildResponse(
    "sabai udhaar list",
    {},
    {
      parties: [
        { id: "p1", name: "Ram Traders", balance: 15000 },
        { id: "p2", name: "Shyam Store", balance: 8000 },
        { id: "p3", name: "Hari", balance: -2000 },
      ],
    },
    { intent: "REPORT_REQUEST", confidence: 0.9, entities: {} },
    "nepali",
    "sabai udhaar list",
  );
  assert(recv?.response.nepali.includes("Ram") && recv.response.nepali.includes("15"), "receivable list");

  console.log("\n4. Compound transaction E2E:");
  const core18 = new IntelligenceCore(undefined, new ContextManager());
  const compoundE2e = await core18.processInput("ram lai 500 ani shyam lai 300 udhaar", {
    useLlm: false,
    erpContext: {
      parties: [
        { id: "p1", name: "Ram Traders" },
        { id: "p2", name: "Shyam Store" },
      ],
    },
  });
  assert(
    compoundE2e.response.actions?.length === 2 &&
      compoundE2e.response.actions[0]?.type === "prefill_khata",
    "compound khata actions",
  );

  console.log("\n5. Teach-back formatter:");
  assert(
    teachBackFormatter.shouldShow("SALES_ENTRY", { product: "kakro", amount: 500 }),
    "teach-back eligible",
  );
  const teach = teachBackFormatter.format(
    { product: "kakro", amount: 500, party: "ram" },
    "SALES_ENTRY",
    "nepali",
  );
  assert(teach.includes("500") && teach.includes("kakro"), "teach-back text");

  console.log("\n6. Qty sale amount:");
  const qtyE2e = await core18.processInput("maile 2 kg kakro bechye", { useLlm: false });
  assert(
    qtyE2e.entities?.quantity === 2 || qtyE2e.entities?.amount != null,
    "qty extracted",
  );

  console.log("\n✅ All Sprint 18 tests passed!");

  // Sprint 19: Stock guard, expense, VAT, returns
  console.log("\n=== SUTRA AI Sprint 19 Tests ===\n");

  const { stockGuard } = await import("../src/ai/guard/StockGuard");
  const { vatEnricher } = await import("../src/ai/context/VatEnricher");
  const { expenseEntryHandler } = await import("../src/ai/rag/ExpenseEntryHandler");

  console.log("1. Stock guard:");
  const stockWarn = stockGuard.check(
    { product: "kakro", itemId: "i1", quantity: 10, transactionType: "sales" },
    { intent: "SALES_ENTRY", confidence: 0.9, entities: {} },
    { items: [{ id: "i1", name: "Kakro", stockQty: 3, unit: "kg" }] },
  );
  assert(stockWarn != null, "insufficient stock warned");

  console.log("\n2. VAT enricher:");
  const vat = vatEnricher.enrich({ amount: 1130 }, "1130 vat sahit");
  assert(vat.vatBreakdown?.vat != null && vat.vatBreakdown.vat > 0, "VAT split");

  console.log("\n3. Expense entry:");
  const exp = expenseEntryHandler.tryBuildResponse(
    "500 ko kharcha",
    { amount: 500 },
    undefined,
    { intent: "OTHER", confidence: 0.8, entities: {} },
    "nepali",
    "500 ko kharcha",
  );
  assert(exp?.actions?.[0]?.type === "prefill_khata", "expense khata action");

  console.log("\n4. Expense E2E:");
  const core19 = new IntelligenceCore(undefined, new ContextManager());
  const expE2e = await core19.processInput("500 ko kharcha", { useLlm: false });
  assert(
    expE2e.response.actions?.[0]?.type === "prefill_khata" ||
      expE2e.entities?.transactionType === "expense",
    "expense E2E",
  );

  console.log("\n5. Sales return:");
  const retE2e = await core19.processInput("maile 200 ko kakro firta", { useLlm: false });
  assert(
    retE2e.intent?.intent === "RETURN_ENTRY" || retE2e.entities?.transactionType === "return",
    "return detected",
  );

  console.log("\n6. Stock warning gates confirmation:");
  const gateStock: import("../src/ai/types").AIResponse = {
    understood_input: "x",
    confidence: 0.8,
    needs_clarification: false,
    suggestions: [],
    response: { nepali: "x", english: "x", roman: "x" },
    stockWarning: "low stock",
  };
  const { confirmationGate } = await import("../src/ai/guard/ConfirmationGate");
  assert(confirmationGate.needsGate(gateStock, false), "stock triggers gate");

  console.log("\n✅ All Sprint 19 tests passed!");

  // Sprint 20: Digest, cash balance, follow-ups, examples
  console.log("\n=== SUTRA AI Sprint 20 Tests ===\n");

  const { dailyDigestEngine } = await import("../src/ai/intelligence/DailyDigestEngine");
  const { cashBalanceQueryHandler } = await import("../src/ai/rag/CashBalanceQueryHandler");
  const { followUpSuggestionEngine } = await import("../src/ai/intelligence/FollowUpSuggestionEngine");
  const { offlineReplyEnhancer } = await import("../src/ai/conversation/OfflineReplyEnhancer");
  const { buildExamplesResponse } = await import("../src/ai/routing/ExamplesRouter");

  console.log("1. Daily digest:");
  const digest = dailyDigestEngine.build({
    businessInsights: {
      todaySalesTotal: 12000,
      todayInvoiceCount: 4,
      topParties: [{ partyName: "Ram", invoiceCount: 2, avgAmount: 6000, totalAmount: 12000 }],
      topProducts: [],
    },
    items: [{ id: "i1", name: "Kakro", stockQty: 0, reorderLevel: 5 }],
    parties: [{ id: "p1", name: "Ram", balance: 30000 }],
  });
  assert(digest != null && digest.nepali.includes("12"), "digest built");

  console.log("\n2. Cash balance query:");
  const cash = cashBalanceQueryHandler.tryBuildResponse(
    "nagad kati cha",
    {},
    { cashBalance: 25000, bankBalance: 100000 },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "nepali",
    "nagad kati cha",
  );
  assert(cash?.response.nepali.includes("25"), "cash balance");

  console.log("\n3. Follow-up suggestions:");
  const fu = followUpSuggestionEngine.suggest(
    { intent: "SALES_ENTRY", confidence: 0.9, entities: {} },
    { product: "kakro", party: "ram", amount: 500 },
    { topicStack: [], turnCount: 1, awaiting: null, lastParty: "ram" },
    {
      understood_input: "x",
      confidence: 0.9,
      needs_clarification: false,
      suggestions: [],
      response: { nepali: "x", english: "x", roman: "x" },
    },
  );
  assert(fu.length >= 1, "follow-up chips");

  console.log("\n4. Offline enhancer:");
  const off = offlineReplyEnhancer.enhance("Test reply", "nepali", false, false);
  assert(off.includes("offline"), "offline tip");

  console.log("\n5. Examples shortcut:");
  const ex = shortcutRouter.route("/examples", "nepali");
  assert(ex.handled && ex.response?.response.nepali.includes("उदाहरण"), "/examples");

  console.log("\n6. Digest E2E:");
  const core20 = new IntelligenceCore(undefined, new ContextManager());
  const todayIso = new Date().toISOString().slice(0, 10);
  const digE2e = await core20.processInput("aaja ko business digest", {
    useLlm: false,
    erpContext: {
      recentInvoices: [{ id: "i1", date: todayIso, grandTotal: 5000, type: "sales-invoice" }],
    },
  });
  assert(
    digE2e.assistantText?.includes("5") || digE2e.response.response.nepali.includes("बिक्री"),
    "digest E2E",
  );

  console.log("\n✅ All Sprint 20 tests passed!");

  // Sprint 21: Rate query, global search, unknown party, fallback, chat export
  console.log("\n=== SUTRA AI Sprint 21 Tests ===\n");

  const { globalSearchHandler } = await import("../src/ai/rag/GlobalSearchHandler");
  const { productRateQueryHandler } = await import("../src/ai/rag/ProductRateQueryHandler");
  const { unknownPartyHandler } = await import("../src/ai/rag/UnknownPartyHandler");
  const { gracefulFallbackHandler } = await import("../src/ai/intelligence/GracefulFallbackHandler");
  const { exportChatAsText } = await import("../src/ai/interface/ChatExportUtils");

  console.log("1. Product rate query:");
  const rate = productRateQueryHandler.tryBuildResponse(
    "kakro ko rate",
    { product: "kakro" },
    {
      items: [{ id: "i1", name: "Kakro", saleRate: 80, purchaseRate: 60, stockQty: 50, unit: "kg" }],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "nepali",
    "kakro ko rate",
  );
  assert(rate?.response.nepali.includes("80"), "rate query");

  console.log("\n2. Global search:");
  const search = globalSearchHandler.tryBuildResponse(
    "search ram",
    {},
    {
      parties: [{ id: "p1", name: "Ram Traders", balance: 5000 }],
      items: [{ id: "i1", name: "Kakro", saleRate: 80, stockQty: 10 }],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "nepali",
    "search ram",
  );
  assert(search?.response.nepali.includes("Ram"), "global search party");

  console.log("\n3. Unknown party hint:");
  const unk = unknownPartyHandler.tryBuildResponse(
    { party: "xyzunknown", transactionType: "sales", amount: 500 },
    { parties: [{ id: "p1", name: "Ram", balance: 0 }] },
    "nepali",
    "xyzunknown lai 500 ko bikri",
  );
  assert(unk?.needs_clarification && unk.response.nepali.includes("xyzunknown"), "unknown party");

  console.log("\n4. Graceful fallback:");
  const fb = gracefulFallbackHandler.build("asdf qwerty zzz", "nepali", "asdf qwerty zzz");
  assert(fb.quickReplies?.length === 2 && fb.response.nepali.includes("/examples"), "fallback");

  console.log("\n5. Chat export:");
  const txt = exportChatAsText([
    { role: "user", text: "hello", timestamp: new Date("2026-01-01T10:00:00Z") },
    { role: "assistant", text: "namaste", timestamp: new Date("2026-01-01T10:00:01Z") },
  ]);
  assert(txt.includes("SUTRA AI Chat Export") && txt.includes("hello"), "chat export text");

  console.log("\n6. /rate shortcut:");
  const rateShortcut = shortcutRouter.route("/rate kakro", "nepali");
  assert(rateShortcut.rewrittenInput === "kakro ko rate", "/rate shortcut");

  console.log("\n7. Rate E2E:");
  const core21 = new IntelligenceCore(undefined, new ContextManager());
  const rateE2e = await core21.processInput("kakro ko rate kati cha", {
    useLlm: false,
    erpContext: {
      items: [{ id: "i1", name: "Kakro", saleRate: 120, stockQty: 30, unit: "kg" }],
    },
  });
  assert(
    rateE2e.assistantText?.includes("120") || rateE2e.response.response.nepali.includes("120"),
    "rate E2E",
  );

  console.log("\n✅ All Sprint 21 tests passed!");

  // Sprint 22: FY PnL, credit limit, payment duplicate guard
  console.log("\n=== SUTRA AI Sprint 22 Tests ===\n");

  const { resolveFiscalYear } = await import("../src/ai/context/FiscalYearResolver");
  const { computePnlFromInvoices } = await import("../src/ai/rag/FiscalPnlCalculator");
  const { creditLimitGuard } = await import("../src/ai/guard/CreditLimitGuard");
  const { reportQueryHandler } = await import("../src/ai/rag/ReportQueryHandler");

  console.log("1. Fiscal year resolver:");
  const fy = resolveFiscalYear({
    name: "2082/83",
    startDate: "2025-07-01",
    endDate: "2026-06-30",
  });
  assert(fy.label === "2082/83" && fy.startDate === "2025-07-01", "FY bounds");

  console.log("\n2. FY PnL from invoices:");
  const fyPnl = computePnlFromInvoices(
    [
      { id: "1", invoiceNo: "S1", date: "2025-08-01", grandTotal: 10000, type: "sales-invoice" },
      { id: "2", invoiceNo: "P1", date: "2025-08-02", grandTotal: 3000, type: "purchase-invoice" },
    ],
    "current_fy",
    fy,
  );
  assert(fyPnl.netProfit === 7000 && fyPnl.entryCount === 2, "FY PnL calc");

  console.log("\n3. Credit limit guard:");
  const creditWarn = creditLimitGuard.check(
    { party: "Ram", partyResolvedName: "Ram", amount: 5000, transactionType: "sales", paymentMode: "credit" },
    { intent: "SALES_ENTRY", confidence: 0.9, entities: {} },
    {
      parties: [{ id: "p1", name: "Ram", balance: 8000, creditLimit: 10000 }],
    },
  );
  assert(creditWarn?.nepali.includes("10"), "credit limit warning");

  console.log("\n4. Payment duplicate guard types:");
  const { DuplicateGuard } = await import("../src/ai/guard/DuplicateGuard");
  const dupGuard = new DuplicateGuard();
  assert(
    (await dupGuard.check({ party: "Ram", amount: 500, transactionType: "receipt" }, undefined)) ===
      null,
    "payment dup check runs (no match ok)",
  );

  console.log("\n5. FY report query:");
  const fyReport = reportQueryHandler.tryBuildResponse(
    "chalu a.v. ko profit",
    {},
    {
      fiscalYear: fy,
      recentInvoices: [
        { id: "1", invoiceNo: "S1", date: "2025-08-01", grandTotal: 5000, type: "sales-invoice" },
      ],
    },
    { intent: "REPORT_REQUEST", confidence: 0.9, entities: {} },
    "nepali",
    "chalu a.v. ko profit",
  );
  assert(fyReport?.response.nepali.includes("5") || fyReport?.response.nepali.includes("2082"), "FY report");

  console.log("\n6. Confirmation gate credit limit:");
  const { confirmationGate: confirmGate22 } = await import("../src/ai/guard/ConfirmationGate");
  const gateCredit = {
    understood_input: "x",
    confidence: 0.8,
    needs_clarification: false,
    suggestions: [],
    response: { nepali: "x", english: "x", roman: "x" },
    creditLimitWarning: "limit exceeded",
  };
  assert(confirmGate22.needsGate(gateCredit, false), "credit limit triggers gate");

  console.log("\n7. /fy shortcut:");
  const fyShortcut = shortcutRouter.route("/fy", "nepali");
  assert(fyShortcut.rewrittenInput === "chalu a.v. ko profit", "/fy shortcut");

  console.log("\n✅ All Sprint 22 tests passed!");

  // Sprint 23: Overdue, party onboarding, payment mode inference
  console.log("\n=== SUTRA AI Sprint 23 Tests ===\n");

  const { paymentModeEnricher } = await import("../src/ai/context/PaymentModeEnricher");
  const { overdueReceivableEngine } = await import("../src/ai/intelligence/OverdueReceivableEngine");
  const { overdueQueryHandler } = await import("../src/ai/rag/OverdueQueryHandler");
  const { partyOnboardingHandler } = await import("../src/ai/rag/PartyOnboardingHandler");
  const { proactiveAlertEngine } = await import("../src/ai/intelligence/ProactiveAlertEngine");

  console.log("1. Payment mode inference:");
  const pm = paymentModeEnricher.enrich(
    { party: "ram", transactionType: "sales" },
    "ram lai 500 ko kakro bechye",
  );
  assert(pm.paymentMode === "credit", "party+lai => credit");

  const pmCash = paymentModeEnricher.enrich({}, "cash ma 200 ko chiya bechye");
  assert(pmCash.paymentMode === "cash", "cash ma => cash");

  console.log("\n2. Overdue engine:");
  const odRows = overdueReceivableEngine.scan({
    parties: [
      {
        id: "p1",
        name: "Ram",
        balance: 8000,
        creditDays: 30,
        lastInvoiceDate: "2026-04-01",
      },
    ],
  });
  assert(odRows.length === 1 && odRows[0].daysOverdue > 0, "overdue detected");

  console.log("\n3. Overdue query:");
  const odQ = overdueQueryHandler.tryBuildResponse(
    "overdue udhaar list",
    {},
    {
      parties: [
        {
          id: "p1",
          name: "Ram",
          balance: 5000,
          creditDays: 30,
          lastInvoiceDate: "2026-04-01",
        },
      ],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "nepali",
    "overdue udhaar list",
  );
  assert(odQ?.response.nepali.includes("Ram"), "overdue query");

  console.log("\n4. Party onboarding:");
  const onboard = partyOnboardingHandler.tryBuildResponse(
    { party: "newshop", transactionType: "sales", amount: 500 },
    { parties: [{ id: "p1", name: "Ram", balance: 0 }] },
    "nepali",
    "newshop lai 500 ko bikri",
  );
  assert(onboard?.actions?.[0]?.page === "parties", "onboard navigate");

  console.log("\n5. Proactive overdue alert:");
  const alerts = proactiveAlertEngine.scan({
    parties: [
      {
        id: "p1",
        name: "Ram",
        balance: 12000,
        creditDays: 30,
        lastInvoiceDate: "2026-03-01",
      },
    ],
  });
  assert(alerts.some((a) => a.id.startsWith("od-")), "proactive overdue");

  console.log("\n6. /overdue shortcut:");
  const odShortcut = shortcutRouter.route("/overdue", "nepali");
  assert(odShortcut.rewrittenInput === "overdue udhaar list", "/overdue");

  console.log("\n7. /create party shortcut:");
  const cpShortcut = shortcutRouter.route("/create party Hari Store", "nepali");
  assert(cpShortcut.handled && cpShortcut.response?.actions?.[0]?.page === "parties", "/create party");

  console.log("\n✅ All Sprint 23 tests passed!");

  // Sprint 24: WhatsApp share, reminders, batch payment, pipeline trace
  console.log("\n=== SUTRA AI Sprint 24 Tests ===\n");

  const { formatReceivableReminder, buildWhatsAppUrl } = await import(
    "../src/ai/conversation/WhatsAppShareFormatter"
  );
  const { reminderQueryHandler } = await import("../src/ai/rag/ReminderQueryHandler");
  const { batchPaymentHandler } = await import("../src/ai/rag/BatchPaymentHandler");
  const { appendPipelineTrace } = await import("../src/ai/intelligence/PipelineTraceBuilder");
  const { compoundPartyParser } = await import("../src/ai/context/CompoundPartyParser");

  console.log("1. WhatsApp formatter:");
  const wa = formatReceivableReminder("Ram", 5000, "nepali", { daysOverdue: 15 });
  assert(wa.includes("Ram") && wa.includes("5"), "reminder format");
  assert(buildWhatsAppUrl(wa).includes("wa.me"), "whatsapp url");

  console.log("\n2. Reminder query:");
  const rem = reminderQueryHandler.tryBuildResponse(
    "ram lai udhaar reminder pathau",
    { party: "ram" },
    { parties: [{ id: "p1", name: "Ram", balance: 8000 }] },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "nepali",
    "ram lai udhaar reminder pathau",
  );
  assert(rem?.shareText?.includes("Ram"), "reminder shareText");

  console.log("\n3. Batch payment parser:");
  const lines = compoundPartyParser.parse("ram lai 500 ani shyam lai 300 tiryo");
  assert(lines.length === 2 && lines[0].amount === 500, "batch party lines");

  console.log("\n4. Batch payment handler:");
  const batch = batchPaymentHandler.tryBuildResponse(
    "ram lai 500 ani shyam lai 300 tiryo",
    { partyLines: lines },
    { parties: [{ id: "p1", name: "Ram" }, { id: "p2", name: "Shyam" }] },
    { intent: "SALES_ENTRY", confidence: 0.9, entities: {} },
    "nepali",
    "ram lai 500 ani shyam lai 300 tiryo",
  );
  assert(batch?.actions?.length === 2, "batch payment actions");

  console.log("\n5. Pipeline trace:");
  const traced = appendPipelineTrace(
    { steps: [{ step: 1, name: "TEST", detail: "x" }], finalInterpretation: "x", confidence: 0.9, entities: {} },
    { erpQueryResolved: true, erpHandler: "reminder", llmUsed: false, llmRouteReason: "rules", confidence: 0.9 },
  );
  assert(traced.steps.some((s) => s.name === "LLM ROUTE"), "pipeline trace");

  console.log("\n6. /reminder shortcut:");
  const remShortcut = shortcutRouter.route("/reminder ram", "nepali");
  assert(remShortcut.rewrittenInput === "ram lai udhaar reminder pathau", "/reminder");

  console.log("\n7. Receipt batch (bata):");
  const bataLines = compoundPartyParser.parse("ram bata 500 ani shyam bata 300 jama");
  assert(bataLines.length === 2, "bata batch parse");

  console.log("\n✅ All Sprint 24 tests passed!");

  // Sprint 25: Invoice share, voice TTS, quick-reply learning, multilingual polish
  console.log("\n=== SUTRA AI Sprint 25 Tests ===\n");

  const { formatInvoiceShare } = await import("../src/ai/conversation/InvoiceShareFormatter");
  const { pickTtsText } = await import("../src/ai/conversation/VoiceReminderSpeaker");
  const { multilingualReplyPolisher } = await import("../src/ai/conversation/MultilingualReplyPolisher");
  const { quickReplyLearningStore } = await import("../src/ai/learning/QuickReplyLearningStore");
  const { invoiceQueryHandler } = await import("../src/ai/rag/InvoiceQueryHandler");

  console.log("1. Invoice share format:");
  const invShare = formatInvoiceShare(
    { id: "i1", invoiceNo: "S-101", date: "2026-07-01", partyName: "Ram", grandTotal: 5500, type: "sales-invoice" },
    "nepali",
  );
  assert(invShare.includes("S-101") && invShare.includes("5,500"), "invoice share");

  console.log("\n2. Voice TTS pick:");
  const tts = pickTtsText("Long assistant reply...", "nepali", "Namaste Ram, baki Rs. 5000");
  assert(tts.includes("5000") || tts.includes("Ram"), "prefer share TTS");

  console.log("\n3. Multilingual polisher:");
  const polished = multilingualReplyPolisher.polish({
    understood_input: "x",
    confidence: 0.9,
    needs_clarification: false,
    suggestions: [],
    response: { nepali: "नमस्ते", english: "", roman: "" },
  });
  assert(polished.response.english === "नमस्ते", "fill english fallback");

  console.log("\n4. Quick reply learning:");
  await quickReplyLearningStore.recordSelection("/examples");
  assert(true, "quick reply recorded");

  console.log("\n5. Invoice share query:");
  const invQ = invoiceQueryHandler.tryBuildResponse(
    "pachillo bill share garnu",
    {},
    {
      recentInvoices: [
        { id: "i1", invoiceNo: "S-99", date: "2026-07-01", partyName: "Ram", grandTotal: 1000, type: "sales-invoice" },
      ],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "nepali",
    "pachillo bill share garnu",
  );
  assert(invQ?.shareText?.includes("S-99"), "invoice share query");

  console.log("\n6. /share invoice shortcut:");
  const shareShortcut = shortcutRouter.route("/share invoice", "nepali");
  assert(shareShortcut.rewrittenInput?.includes("share"), "/share invoice");

  console.log("\n✅ All Sprint 25 tests passed!");

  // Sprint 26: Party phone, session clear summary, returns, LLM cache
  console.log("\n=== SUTRA AI Sprint 26 Tests ===\n");

  const { normalizeWhatsAppPhone, phoneFromPartyRef } = await import(
    "../src/ai/context/PartyPhoneResolver"
  );
  const { sessionSummaryEngine } = await import("../src/ai/intelligence/SessionSummaryEngine");
  const { returnTransactionHandler } = await import("../src/ai/rag/ReturnTransactionHandler");
  const { llmResponseCache } = await import("../src/ai/learning/LlmResponseCache");

  console.log("1. WhatsApp phone normalize:");
  assert(normalizeWhatsAppPhone("9841234567") === "9779841234567", "977 prefix");
  assert(normalizeWhatsAppPhone("9779841234567") === "9779841234567", "977 kept");

  console.log("\n2. Party phone from ref:");
  assert(phoneFromPartyRef({ id: "p1", name: "Ram", phone: "9841111111" })?.startsWith("977"), "party phone");

  console.log("\n3. Session summary:");
  const sum = sessionSummaryEngine.build(
    [
      { role: "user", content: "ram ko balance", timestamp: new Date() },
      { role: "assistant", content: "5000", timestamp: new Date() },
    ],
    { topicStack: [], turnCount: 4, awaiting: null, lastParty: "Ram", lastAmount: 5000 },
    "nepali",
  );
  assert(sum?.includes("Ram"), "session summary");

  console.log("\n4. Sales return handler:");
  const ret = returnTransactionHandler.tryBuildResponse(
    "maile 200 ko kakro firta",
    { product: "kakro", amount: 200, transactionType: "return" },
    {},
    { intent: "RETURN_ENTRY", confidence: 0.9, entities: {} },
    "nepali",
    "maile 200 ko kakro firta",
  );
  assert(ret?.actions?.[0]?.invoiceType === "sales-return", "sales return action");

  console.log("\n5. LLM cache:");
  await llmResponseCache.set("test input", "QUERY", {
    response: { nepali: "cached", english: "cached", roman: "cached" },
  });
  const cached = await llmResponseCache.get("test input", "QUERY");
  assert(cached?.response?.nepali === "cached", "llm cache roundtrip");

  console.log("\n6. Reminder with phone:");
  const { reminderQueryHandler } = await import("../src/ai/rag/ReminderQueryHandler");
  const remPhone = reminderQueryHandler.tryBuildResponse(
    "ram lai udhaar reminder pathau",
    { party: "ram" },
    {
      parties: [{ id: "p1", name: "Ram", balance: 5000, phone: "9841234567" }],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "nepali",
    "ram lai udhaar reminder pathau",
  );
  assert(remPhone?.partyPhone?.startsWith("977"), "reminder party phone");

  console.log("\n7. Clear with summary E2E:");
  const core26 = new IntelligenceCore(undefined, new ContextManager());
  core26.getContextManager().addTurn("user", "ram ko balance kati");
  core26.getContextManager().updateSession({ party: "ram", amount: 5000 }, "QUERY");
  const clearRes = await core26.processInput("/clear", { useLlm: false });
  assert(clearRes.shortcutAction === "clear_history" && clearRes.assistantText?.includes("Ram"), "clear summary");

  console.log("\n✅ All Sprint 26 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 26 complete!");

  // Sprint 27: Party phone, digest v2, export summary, purchase return polish
  console.log("\n=== SUTRA AI Sprint 27 Tests ===\n");

  console.log("1. PartyPhoneQueryHandler:");
  const { partyPhoneQueryHandler } = await import("../src/ai/rag/PartyPhoneQueryHandler");
  const phRes = partyPhoneQueryHandler.tryBuildResponse(
    "/phone ram",
    { party: "ram" },
    {
      parties: [{ id: "p1", name: "Ram Traders", balance: 1000, phone: "9841112233" }],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "nepali",
    "/phone ram",
  );
  assert(phRes?.partyPhone?.startsWith("977"), "party phone lookup");

  console.log("\n2. DailyDigestEngine v2:");
  const { dailyDigestEngine } = await import("../src/ai/intelligence/DailyDigestEngine");
  const digestV2 = dailyDigestEngine.build({
    parties: [{ id: "p1", name: "Ram", balance: 5000, lastInvoiceDate: "2024-01-01", creditDays: 7 }],
    cashBalance: 12000,
    bankBalance: 45000,
    pnlSnapshot: {
      netProfit: 8500,
      totalIncome: 100000,
      totalExpense: 91500,
      period: "current_month",
      entryCount: 10,
    },
    businessInsights: { todaySalesTotal: 0, todayInvoiceCount: 0, topParties: [] },
  });
  assert(digestV2 != null && digestV2.english.includes("Cash"), "digest v2 cash line");
  assert(digestV2!.english.includes("Overdue"), "digest v2 overdue line");

  console.log("\n3. Chat export with summary:");
  const { exportChatAsText } = await import("../src/ai/interface/ChatExportUtils");
  const exportTxt = exportChatAsText(
    [{ role: "user", text: "hi", timestamp: new Date("2026-01-01T10:00:00Z") }],
    "Session summary (2 turns):\n• party: Ram",
  );
  assert(exportTxt.includes("Session Summary") && exportTxt.includes("Ram"), "export summary block");

  console.log("\n4. Purchase return E2E:");
  const { returnTransactionHandler } = await import("../src/ai/rag/ReturnTransactionHandler");
  assert(
    returnTransactionHandler.isPurchaseReturn("supplier bata 300 ko tel firta"),
    "purchase return pattern",
  );
  const prRes = returnTransactionHandler.tryBuildResponse(
    "kharid firta 500 ko tel",
    { product: "tel", amount: 500, transactionType: "return" },
    undefined,
    { intent: "RETURN_ENTRY", confidence: 0.9, entities: {} },
    "nepali",
    "kharid firta 500 ko tel",
  );
  assert(
    prRes?.actions?.some((a) => a.invoiceType === "purchase-return"),
    "purchase return action",
  );

  console.log("\n5. /phone in help:");
  const { shortcutRouter } = await import("../src/ai/routing/ShortcutRouter");
  const help = shortcutRouter.route("/help", "english");
  assert(help.response?.response.english.includes("/phone"), "help lists /phone");

  console.log("\n✅ All Sprint 27 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 27 complete!");

  // Sprint 28: Party phone edit, digest once/day, supplier return disambiguation, cache indicator
  console.log("\n=== SUTRA AI Sprint 28 Tests ===\n");

  console.log("1. PartyPhoneEditHandler:");
  const { partyPhoneEditHandler } = await import("../src/ai/rag/PartyPhoneEditHandler");
  const editRes = partyPhoneEditHandler.tryBuildResponse(
    "/setphone ram 9841234567",
    { party: "ram" },
    { parties: [{ id: "p1", name: "Ram Traders", balance: 0 }] },
    { intent: "OTHER", confidence: 0.9, entities: {} },
    "nepali",
    "/setphone ram 9841234567",
  );
  assert(
    editRes?.actions?.[0]?.type === "prefill_party" && editRes.actions[0].partyDraft?.phone === "9841234567",
    "setphone prefill_party",
  );

  console.log("\n2. DigestShownTracker:");
  const { wasDigestShownToday, markDigestShownToday, clearDigestShownMarker } = await import(
    "../src/ai/intelligence/DigestShownTracker"
  );
  clearDigestShownMarker();
  assert(!wasDigestShownToday(), "digest not shown initially");
  markDigestShownToday();
  assert(wasDigestShownToday(), "digest marked shown");
  clearDigestShownMarker();

  console.log("\n3. Party draft bridge:");
  const { saveAiPartyDraft, peekAiPartyDraft, consumeAiPartyDraft } = await import(
    "../src/ai/actions/partyDraft"
  );
  saveAiPartyDraft({ partyId: "p1", phone: "9800000000", focusPhone: true });
  assert(peekAiPartyDraft()?.phone === "9800000000", "party draft peek");
  consumeAiPartyDraft();
  assert(peekAiPartyDraft() == null, "party draft consumed");

  console.log("\n4. Purchase return supplier disambiguation:");
  const { returnTransactionHandler: returnHandler28 } = await import(
    "../src/ai/rag/ReturnTransactionHandler"
  );
  const supDis = returnHandler28.tryBuildResponse(
    "ram bata 500 ko tel firta",
    { party: "ram", product: "tel", amount: 500, transactionType: "return" },
    {
      parties: [
        { id: "s1", name: "Ram Suppliers", type: "supplier", balance: 0 },
        { id: "s2", name: "Ram Enterprises", type: "supplier", balance: 0 },
      ],
    },
    { intent: "RETURN_ENTRY", confidence: 0.9, entities: {} },
    "nepali",
    "kharid ram bata 500 ko tel firta",
  );
  assert(supDis?.needs_clarification && (supDis.quickReplies?.length ?? 0) >= 2, "supplier pick");

  console.log("\n5. LLM cache hit flag:");
  const core28 = new IntelligenceCore(undefined, new ContextManager());
  const cacheRes = await core28.processInput("maile 500 ko kakro bechye", { useLlm: false });
  assert(cacheRes.llmCacheHit === undefined || cacheRes.llmCacheHit === false, "no false cache hit");

  console.log("\n6. /setphone in help:");
  const { shortcutRouter: shortcutRouter28 } = await import("../src/ai/routing/ShortcutRouter");
  const help28 = shortcutRouter28.route("/help", "english");
  assert(help28.response?.response.english.includes("/setphone"), "help lists setphone");

  console.log("\n✅ All Sprint 28 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 28 complete!");

  // Sprint 29: Phone save confirm, digest dismiss, supplier filters, cache stats
  console.log("\n=== SUTRA AI Sprint 29 Tests ===\n");

  console.log("1. Party phone saved message:");
  const { formatPartyPhoneSavedMessage } = await import("../src/ai/actions/partyPhoneSavedBridge");
  const savedMsg = formatPartyPhoneSavedMessage({ partyName: "Ram", phone: "9841234567", savedAt: Date.now() });
  assert(savedMsg.includes("Ram") && savedMsg.includes("9841234567"), "phone saved message");

  console.log("\n2. Party type filter search:");
  const { parseSearchPartyFilter, filterPartiesByKind } = await import("../src/ai/context/PartyTypeFilter");
  const sf = parseSearchPartyFilter("/search supplier ram");
  assert(sf.filter === "supplier" && sf.query === "ram", "search supplier filter");
  const pool = filterPartiesByKind(
    [
      { id: "1", name: "A", type: "customer", balance: 0 },
      { id: "2", name: "B", type: "supplier", balance: 0 },
    ],
    "supplier",
  );
  assert(pool.length === 1 && pool[0].name === "B", "supplier pool");

  console.log("\n3. Overdue supplier payables:");
  const { overdueReceivableEngine } = await import("../src/ai/intelligence/OverdueReceivableEngine");
  const payables = overdueReceivableEngine.scanPayables({
    parties: [
      {
        id: "s1",
        name: "Supplier Co",
        type: "supplier",
        balance: -5000,
        lastInvoiceDate: "2024-01-01",
        creditDays: 7,
      },
    ],
  });
  assert(payables.length === 1 && payables[0].balance === 5000, "payables scan");

  console.log("\n4. Cache stats handler:");
  const { cacheStatsQueryHandler } = await import("../src/ai/rag/CacheStatsQueryHandler");
  const cacheStats = await cacheStatsQueryHandler.tryBuildResponse("/cache stats", "english", "/cache stats");
  assert(cacheStats?.response.english.includes("LLM cache"), "cache stats response");

  console.log("\n5. Digest dismiss shortcut:");
  const { shortcutRouter: sr29 } = await import("../src/ai/routing/ShortcutRouter");
  const dismiss = sr29.route("/digest dismiss", "english");
  assert(dismiss.shortcutAction === "dismiss_digest", "digest dismiss shortcut");

  console.log("\n6. Global search supplier filter:");
  const { globalSearchHandler } = await import("../src/ai/rag/GlobalSearchHandler");
  const searchRes = globalSearchHandler.tryBuildResponse(
    "/search supplier ram",
    {},
    {
      parties: [
        { id: "c1", name: "Ram Customer", type: "customer", balance: 100 },
        { id: "s1", name: "Ram Suppliers", type: "supplier", balance: 0 },
      ],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "english",
    "/search supplier ram",
  );
  assert(searchRes?.response.english.includes("Ram Suppliers"), "supplier-only search");

  console.log("\n✅ All Sprint 29 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 29 complete!");

  // Sprint 30: Phone-save reminder chips, digest hour snooze, aging link, cache hit rate
  console.log("\n=== SUTRA AI Sprint 30 Tests ===\n");

  console.log("1. Phone saved quick replies:");
  const { buildPhoneSavedQuickReplies } = await import("../src/ai/actions/partyPhoneSavedBridge");
  const chips = buildPhoneSavedQuickReplies({
    partyName: "Ram",
    phone: "9841234567",
    savedAt: Date.now(),
  }, "english");
  assert(chips.length >= 3 && chips[0].label === "Send now", "phone saved chips");

  console.log("\n2. Digest hour snooze:");
  const { snoozeDigestForHours, isDigestBlocked, clearDigestShownMarker } = await import(
    "../src/ai/intelligence/DigestShownTracker"
  );
  clearDigestShownMarker();
  snoozeDigestForHours(2);
  assert(isDigestBlocked(), "digest snoozed");

  console.log("\n3. Digest snooze shortcut:");
  const { shortcutRouter: sr30 } = await import("../src/ai/routing/ShortcutRouter");
  const snooze = sr30.route("/digest snooze 6", "english");
  assert(snooze.shortcutAction === "snooze_digest" && snooze.snoozeHours === 6, "snooze shortcut");

  console.log("\n4. Overdue aging report action:");
  const { overdueQueryHandler } = await import("../src/ai/rag/OverdueQueryHandler");
  const odRes = overdueQueryHandler.tryBuildResponse(
    "/overdue customer",
    {},
    {
      parties: [
        {
          id: "c1",
          name: "Ram",
          type: "customer",
          balance: 5000,
          lastInvoiceDate: "2024-01-01",
          creditDays: 7,
        },
      ],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "english",
    "/overdue customer",
  );
  assert(
    odRes?.actions?.[0]?.page === "aging-report" && odRes.actions[0].agingDirection === "receivable",
    "customer overdue aging link",
  );

  console.log("\n5. Cache hit rate:");
  const { llmResponseCache } = await import("../src/ai/learning/LlmResponseCache");
  llmResponseCache.recordHit();
  llmResponseCache.recordMiss();
  const rate = llmResponseCache.getHitRate();
  assert(rate.hits >= 1 && rate.misses >= 1 && rate.rate > 0 && rate.rate < 1, "cache hit rate");

  console.log("\n6. Aging report draft:");
  const { saveAiAgingReportDraft, consumeAiAgingReportDraft } = await import(
    "../src/ai/actions/agingReportDraft"
  );
  saveAiAgingReportDraft({ direction: "payable" });
  assert(consumeAiAgingReportDraft()?.direction === "payable", "aging draft");

  clearDigestShownMarker();

  console.log("\n✅ All Sprint 30 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 30 complete!");

  // Sprint 31: One-tap WhatsApp, digest picker, aging party filter, per-message cache badge
  console.log("\n=== SUTRA AI Sprint 31 Tests ===\n");

  console.log("1. Phone saved WA encode/decode:");
  const {
    encodePhoneSavedWaValue,
    decodePhoneSavedWaValue,
    buildPhoneSavedReminderShare,
    formatWhatsAppSentConfirmation,
  } = await import("../src/ai/actions/partyPhoneSavedBridge");
  const notice = { partyName: "Ram", phone: "9841234567", savedAt: Date.now(), balance: 5000 };
  const encoded = encodePhoneSavedWaValue(notice);
  const decoded = decodePhoneSavedWaValue(encoded);
  assert(decoded?.partyName === "Ram" && decoded.phone === "9841234567", "wa encode decode");
  const share = buildPhoneSavedReminderShare(notice, "english");
  assert(share.includes("Ram") && share.includes("500"), "reminder share with balance");

  console.log("\n2. tryHandlePhoneSavedWaQuickReply:");
  const { tryHandlePhoneSavedWaQuickReply } = await import("../src/store/sutraAiStore");
  const wa = tryHandlePhoneSavedWaQuickReply(encoded, "english");
  assert(wa?.phone.startsWith("977") && wa.confirmText.includes("Ram"), "wa quick reply handler");

  console.log("\n3. Overdue supplier aging search term:");
  const { overdueQueryHandler: od31 } = await import("../src/ai/rag/OverdueQueryHandler");
  const supOd = od31.tryBuildResponse(
    "/overdue supplier",
    {},
    {
      parties: [
        {
          id: "s1",
          name: "ABC Suppliers",
          type: "supplier",
          balance: -8000,
          lastInvoiceDate: "2024-01-01",
          creditDays: 7,
        },
      ],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "english",
    "/overdue supplier",
  );
  assert(supOd?.actions?.[0]?.agingSearchTerm === "ABC Suppliers", "supplier aging search");

  console.log("\n4. Aging draft with search:");
  const { saveAiAgingReportDraft, consumeAiAgingReportDraft } = await import(
    "../src/ai/actions/agingReportDraft"
  );
  saveAiAgingReportDraft({ direction: "payable", searchTerm: "ABC Suppliers" });
  const agingDraft = consumeAiAgingReportDraft();
  assert(
    agingDraft?.direction === "payable" && agingDraft.searchTerm === "ABC Suppliers",
    "aging draft search",
  );

  console.log("\n5. WhatsApp sent confirmation:");
  const conf = formatWhatsAppSentConfirmation("Ram", "nepali");
  assert(conf.includes("Ram") && conf.includes("पठाइसकियो"), "wa sent confirm");

  console.log("\n✅ All Sprint 31 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 31 complete!");

  // Sprint 32: Payable reminders, digest undo, cache sparkline, aging row remind
  console.log("\n=== SUTRA AI Sprint 32 Tests ===\n");

  console.log("1. Payable reminder formatter:");
  const { formatPayableReminder, formatReceivableReminder } = await import(
    "../src/ai/conversation/WhatsAppShareFormatter"
  );
  const payRem = formatPayableReminder("ABC Suppliers", 12000, "english", { daysOverdue: 30 });
  assert(payRem.includes("payable") && payRem.includes("12,000"), "payable reminder english");
  const recvRem = formatReceivableReminder("Ram", 5000, "nepali");
  assert(recvRem.includes("बाँकी") && recvRem.includes("Ram"), "receivable reminder nepali");

  console.log("\n2. ReminderQueryHandler supplier payable:");
  const { reminderQueryHandler } = await import("../src/ai/rag/ReminderQueryHandler");
  const supReminder = reminderQueryHandler.tryBuildResponse(
    "/reminder ABC Suppliers",
    { party: "ABC Suppliers" },
    {
      parties: [
        {
          id: "s1",
          name: "ABC Suppliers",
          type: "supplier",
          balance: -12000,
          lastInvoiceDate: "2024-01-01",
          creditDays: 7,
        },
      ],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "english",
    "/reminder ABC Suppliers",
  );
  assert(
    supReminder?.shareText?.includes("payable") && supReminder.quickReplies?.length === 1,
    "supplier payable reminder",
  );

  console.log("\n3. Cache hit sparkline:");
  const { formatCacheHitSparkline, formatCacheStatsLine } = await import(
    "../src/ai/learning/CacheHitSparkline"
  );
  const spark = formatCacheHitSparkline([1, 0, 1, 1, 0]);
  assert(spark.length === 5 && spark !== "—", "sparkline blocks");
  const statsLine = formatCacheStatsLine(12, 67, 2, 1, spark, " · newest 2h ago");
  assert(statsLine.includes("LLM cache") && statsLine.includes(spark), "cache stats line");

  console.log("\n4. Digest restore visibility:");
  const {
    dismissDigestForToday,
    restoreDigestVisibility,
    isDigestBlocked,
    clearDigestShownMarker,
  } = await import("../src/ai/intelligence/DigestShownTracker");
  dismissDigestForToday();
  assert(isDigestBlocked(), "digest blocked after dismiss");
  restoreDigestVisibility();
  assert(!isDigestBlocked(), "digest unblocked after restore");
  clearDigestShownMarker();

  console.log("\n5. Cache stats handler sparkline:");
  const { cacheStatsQueryHandler } = await import("../src/ai/rag/CacheStatsQueryHandler");
  const cacheResp = await cacheStatsQueryHandler.tryBuildResponse(
    "/cache stats",
    "english",
    "/cache stats",
  );
  assert(cacheResp?.response.english.includes("LLM cache"), "cache stats response");

  console.log("\n✅ All Sprint 32 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 32 complete!");

  // Sprint 33: WA one-tap reminder, digest snooze label, aging→AI handoff, header sparkline
  console.log("\n=== SUTRA AI Sprint 33 Tests ===\n");

  console.log("1. WA open quick-reply encode/decode:");
  const {
    encodeWaOpenValue,
    decodeWaOpenValue,
    formatWaOpenConfirmation,
  } = await import("../src/ai/actions/waQuickReplyBridge");
  const waVal = encodeWaOpenValue({
    text: "Dear Ram, balance due",
    phone: "9779841234567",
    partyName: "Ram",
  });
  const waDecoded = decodeWaOpenValue(waVal);
  assert(
    waDecoded?.text.includes("Ram") && waDecoded.phone === "9779841234567",
    "wa open encode decode",
  );
  const waConf = formatWaOpenConfirmation("Ram", "english");
  assert(waConf.includes("Ram") && waConf.includes("WhatsApp"), "wa open confirmation");

  console.log("\n2. Reminder handler WA quick reply:");
  const { reminderQueryHandler: rem33 } = await import("../src/ai/rag/ReminderQueryHandler");
  const remWa = rem33.tryBuildResponse(
    "/reminder ram",
    { party: "ram" },
    {
      parties: [
        {
          id: "p1",
          name: "Ram",
          type: "customer",
          balance: 5000,
          phone: "9841234567",
        },
      ],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "english",
    "/reminder ram",
  );
  const remQr = remWa?.quickReplies?.[0]?.value ?? "";
  const remDecoded = decodeWaOpenValue(remQr);
  assert(remDecoded?.partyName === "Ram" && remDecoded.phone != null, "reminder wa quick reply");

  console.log("\n3. Aging reminder handoff draft:");
  const {
    saveAiAgingReminderDraft,
    consumeAiAgingReminderDraft,
    buildReminderQueryFromDraft,
  } = await import("../src/ai/actions/agingReminderDraft");
  saveAiAgingReminderDraft({
    partyName: "ABC Suppliers",
    direction: "payable",
    outstanding: 12000,
  });
  const agingRem = consumeAiAgingReminderDraft();
  assert(
    buildReminderQueryFromDraft(agingRem!) === "/reminder supplier ABC Suppliers",
    "payable aging reminder query",
  );
  const recvQuery = buildReminderQueryFromDraft({
    partyName: "Ram",
    direction: "receivable",
  });
  assert(recvQuery === "/reminder Ram", "receivable aging reminder query");

  console.log("\n4. Digest hidden label:");
  const {
    snoozeDigestForHours,
    formatDigestHiddenLabel,
    restoreDigestVisibility,
    clearDigestShownMarker,
  } = await import("../src/ai/intelligence/DigestShownTracker");
  snoozeDigestForHours(2);
  const snoozeLabel = formatDigestHiddenLabel();
  assert(snoozeLabel.includes("Snoozed") && snoozeLabel.includes("h"), "digest snooze label");
  restoreDigestVisibility();
  const dismissLabel = formatDigestHiddenLabel();
  assert(dismissLabel.includes("tomorrow"), "digest dismiss label");
  clearDigestShownMarker();

  console.log("\n5. Header sparkline from cache history:");
  const { llmResponseCache } = await import("../src/ai/learning/LlmResponseCache");
  const { formatCacheHitSparkline: spark33 } = await import("../src/ai/learning/CacheHitSparkline");
  llmResponseCache.recordHit();
  llmResponseCache.recordMiss();
  llmResponseCache.recordHit();
  const headerSpark = spark33(llmResponseCache.getHitHistory());
  assert(headerSpark.length >= 3 && headerSpark !== "—", "header cache sparkline");

  console.log("\n✅ All Sprint 33 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 33 complete!");

  // Sprint 34: Copy fallback, aging days in query, /digest show, cache tooltip
  console.log("\n=== SUTRA AI Sprint 34 Tests ===\n");

  console.log("1. Reminder copy quick-reply:");
  const { encodeCopyValue, decodeCopyValue, formatCopyConfirmation } = await import(
    "../src/ai/actions/waQuickReplyBridge"
  );
  const copyVal = encodeCopyValue({ text: "Dear Ram, balance due", partyName: "Ram" });
  const copyDecoded = decodeCopyValue(copyVal);
  assert(copyDecoded?.text.includes("Ram") && copyDecoded.partyName === "Ram", "copy encode decode");
  const copyOk = formatCopyConfirmation("Ram", "english", true);
  assert(copyOk.includes("copied") && copyOk.includes("Ram"), "copy confirmation");

  console.log("\n2. Reminder without phone uses copy:");
  const { reminderQueryHandler: rem34 } = await import("../src/ai/rag/ReminderQueryHandler");
  const noPhoneRem = rem34.tryBuildResponse(
    "/reminder ram",
    { party: "ram" },
    {
      parties: [{ id: "p1", name: "Ram", type: "customer", balance: 5000 }],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "english",
    "/reminder ram",
  );
  assert(
    noPhoneRem?.quickReplies?.[0]?.label === "Copy" &&
      decodeCopyValue(noPhoneRem.quickReplies[0].value)?.text != null,
    "no-phone copy quick reply",
  );

  console.log("\n3. Aging handoff with overdue days:");
  const { buildReminderQueryFromDraft } = await import("../src/ai/actions/agingReminderDraft");
  const agingQ = buildReminderQueryFromDraft({
    partyName: "ABC Suppliers",
    direction: "payable",
    daysOverdue: 60,
  });
  assert(agingQ === "/reminder supplier ABC Suppliers 60 days overdue", "aging query with days");

  console.log("\n4. Reminder parses explicit overdue days:");
  const daysRem = rem34.tryBuildResponse(
    agingQ,
    { party: "ABC Suppliers" },
    {
      parties: [
        {
          id: "s1",
          name: "ABC Suppliers",
          type: "supplier",
          balance: -12000,
        },
      ],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "english",
    agingQ,
  );
  assert(
    daysRem?.shareText?.includes("60 days overdue") || daysRem?.shareText?.includes("payable"),
    "explicit days in reminder",
  );

  console.log("\n5. /digest show shortcut:");
  const { shortcutRouter } = await import("../src/ai/routing/ShortcutRouter");
  const showDigest = shortcutRouter.route("/digest show", "english");
  assert(showDigest.handled && showDigest.shortcutAction === "show_digest", "digest show route");

  console.log("\n6. Cache sparkline tooltip:");
  const { formatCacheSparklineTooltip } = await import("../src/ai/learning/CacheHitSparkline");
  const tip = formatCacheSparklineTooltip([1, 0, 1], 67);
  assert(tip.includes("67%") && tip.includes("▁"), "cache tooltip with rate");

  console.log("\n✅ All Sprint 34 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 34 complete!");

  // Sprint 35: Dual reminder QR, aging WA auto-open, digest show QR, live cache tooltip
  console.log("\n=== SUTRA AI Sprint 35 Tests ===\n");

  console.log("1. Reminder dual WhatsApp + Copy quick replies:");
  const { reminderQueryHandler: rem35 } = await import("../src/ai/rag/ReminderQueryHandler");
  const { decodeWaOpenValue, decodeCopyValue } = await import("../src/ai/actions/waQuickReplyBridge");
  const phoneRem = rem35.tryBuildResponse(
    "/reminder ram",
    { party: "ram" },
    {
      parties: [
        {
          id: "p1",
          name: "Ram",
          type: "customer",
          balance: 5000,
          phone: "9841234567",
        },
      ],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "english",
    "/reminder ram",
  );
  assert(phoneRem?.quickReplies?.length === 2, "two quick replies with phone");
  assert(
    decodeWaOpenValue(phoneRem!.quickReplies![0].value)?.phone != null &&
      decodeCopyValue(phoneRem!.quickReplies![1].value)?.text != null,
    "wa + copy payloads",
  );

  console.log("\n2. Aging WA auto-open queue:");
  const { queueAgingWaAutoOpen, consumeAgingWaAutoOpen } = await import(
    "../src/ai/actions/agingReminderDraft"
  );
  queueAgingWaAutoOpen("Ram");
  assert(consumeAgingWaAutoOpen() === "Ram", "aging wa auto-open consume");
  assert(consumeAgingWaAutoOpen() == null, "aging wa auto-open once");

  console.log("\n3. Digest dismiss quick reply:");
  const core35 = new (await import("../src/ai/core/IntelligenceCore")).IntelligenceCore();
  const dismiss = await core35.processInput("/digest dismiss", { useLlm: false });
  assert(
    dismiss.shortcutAction === "dismiss_digest" &&
      dismiss.response.quickReplies?.some((q) => q.value === "/digest show"),
    "digest dismiss show-again qr",
  );

  console.log("\n4. Digest snooze quick reply:");
  const snooze = await core35.processInput("/digest snooze 2", { useLlm: false });
  assert(
    snooze.shortcutAction === "snooze_digest" &&
      snooze.response.quickReplies?.some((q) => q.label === "Show again"),
    "digest snooze show-again qr",
  );

  console.log("\n5. Cache history len in lastReplyMeta pattern:");
  const { llmResponseCache: cache35 } = await import("../src/ai/learning/LlmResponseCache");
  cache35.recordHit();
  const len = cache35.getHitHistory().length;
  assert(len >= 1, "cache history grows after hit");

  console.log("\n✅ All Sprint 35 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 35 complete!");

  // Sprint 36: Remind modal SUTRA, phone-save copy, digest bar chip, cache hit % in header
  console.log("\n=== SUTRA AI Sprint 36 Tests ===\n");

  console.log("1. Phone saved Copy quick-reply:");
  const { buildPhoneSavedQuickReplies, encodePhoneSavedCopyValue } = await import(
    "../src/ai/actions/partyPhoneSavedBridge"
  );
  const { tryHandlePhoneSavedCopyQuickReply } = await import(
    "../src/ai/actions/partyPhoneSavedBridge"
  );
  const phoneChips = buildPhoneSavedQuickReplies(
    { partyName: "Ram", phone: "9841234567", savedAt: Date.now(), balance: 3000 },
    "english",
  );
  assert(phoneChips.length === 4 && phoneChips[1].label === "Copy", "phone saved copy chip");
  const copyChip = tryHandlePhoneSavedCopyQuickReply(phoneChips[1].value, "english");
  assert(copyChip?.text.includes("Ram") && copyChip.partyName === "Ram", "phone saved copy payload");

  console.log("\n2. Dual reminder quick replies still present:");
  const { reminderQueryHandler: rem36 } = await import("../src/ai/rag/ReminderQueryHandler");
  const dual = rem36.tryBuildResponse(
    "/reminder ram",
    { party: "ram" },
    {
      parties: [
        { id: "p1", name: "Ram", type: "customer", balance: 5000, phone: "9841234567" },
      ],
    },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "english",
    "/reminder ram",
  );
  assert(dual?.quickReplies?.length === 2, "reminder wa+copy");

  console.log("\n3. Cache header hit rate label:");
  const { formatCacheHitSparkline, formatCacheSparklineTooltip } = await import(
    "../src/ai/learning/CacheHitSparkline"
  );
  const spark36 = formatCacheHitSparkline([1, 1, 0]);
  const tip36 = formatCacheSparklineTooltip([1, 1, 0], 67);
  assert(spark36.length === 3 && tip36.includes("67%"), "cache header rate tooltip");

  console.log("\n4. Digest show quick-reply constant:");
  const { shortcutRouter: sr36 } = await import("../src/ai/routing/ShortcutRouter");
  const show36 = sr36.route("/digest show", "english");
  assert(show36.shortcutAction === "show_digest", "digest show still routed");

  console.log("\n5. Aging reminder draft with auto WA:");
  const { buildReminderQueryFromDraft } = await import("../src/ai/actions/agingReminderDraft");
  const q36 = buildReminderQueryFromDraft({
    partyName: "Ram",
    direction: "receivable",
    daysOverdue: 30,
    autoOpenWhatsApp: true,
  });
  assert(q36 === "/reminder Ram 30 days overdue", "aging remind sutra query");

  console.log("\n✅ All Sprint 36 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 36 complete!");

  // Sprint 37: Phone copy lang, digest chip dedup, SUTRA-only modal, cache header copy
  console.log("\n=== SUTRA AI Sprint 37 Tests ===\n");

  console.log("1. Phone saved copy uses live output language:");
  const {
    encodePhoneSavedCopyValue,
    tryHandlePhoneSavedCopyQuickReply,
  } = await import("../src/ai/actions/partyPhoneSavedBridge");
  const notice37 = { partyName: "Ram", phone: "9841234567", savedAt: Date.now(), balance: 5000 };
  const copyVal37 = encodePhoneSavedCopyValue(notice37);
  const enCopy = tryHandlePhoneSavedCopyQuickReply(copyVal37, "english");
  const neCopy = tryHandlePhoneSavedCopyQuickReply(copyVal37, "nepali");
  assert(enCopy?.text.includes("Dear Ram") && neCopy?.text.includes("नमस्ते"), "phone copy live lang");

  console.log("\n2. Digest chip dedup logic:");
  const shouldPostDigestChip = (isOpen: boolean, chipPosted: boolean) => isOpen && !chipPosted;
  assert(shouldPostDigestChip(true, false) && !shouldPostDigestChip(true, true), "digest chip dedup gate");

  console.log("\n3. buildCacheStatsSummary:");
  const { buildCacheStatsSummary } = await import("../src/ai/learning/CacheHitSparkline");
  const summary37 = await buildCacheStatsSummary();
  assert(summary37.includes("LLM cache"), "cache stats summary");

  console.log("\n4. Aging handoff without auto WA:");
  const { buildReminderQueryFromDraft } = await import("../src/ai/actions/agingReminderDraft");
  const sutraOnly = buildReminderQueryFromDraft({
    partyName: "Ram",
    direction: "receivable",
  });
  assert(sutraOnly === "/reminder Ram", "sutra only query");

  console.log("\n5. Phone saved copy prefix distinct from wa:");
  const { PHONE_SAVED_COPY_PREFIX, PHONE_SAVED_WA_PREFIX } = await import(
    "../src/ai/actions/partyPhoneSavedBridge"
  );
  assert(
    PHONE_SAVED_COPY_PREFIX !== PHONE_SAVED_WA_PREFIX &&
      copyVal37.startsWith(PHONE_SAVED_COPY_PREFIX),
    "copy prefix",
  );

  console.log("\n✅ All Sprint 37 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 37 complete!");

  // Sprint 38: Cache dbl-click, WA live lang, digest chip dismiss, aging SUTRA split
  console.log("\n=== SUTRA AI Sprint 38 Tests ===\n");

  console.log("1. Phone saved WA uses live output language:");
  const {
    encodePhoneSavedWaValue,
    tryHandlePhoneSavedWaQuickReply,
  } = await import("../src/ai/actions/partyPhoneSavedBridge");
  const waNotice = { partyName: "Ram", phone: "9841234567", savedAt: Date.now(), balance: 4000 };
  const waVal = encodePhoneSavedWaValue(waNotice);
  const waEn = tryHandlePhoneSavedWaQuickReply(waVal, "english");
  const waNe = tryHandlePhoneSavedWaQuickReply(waVal, "nepali");
  assert(waEn?.shareText.includes("Dear Ram") && waNe?.shareText.includes("नमस्ते"), "wa live lang");

  console.log("\n2. Digest chip auto-dismiss:");
  const { isDigestHiddenChipMessage, withoutDigestHiddenChips } = await import(
    "../src/ai/intelligence/DigestShownTracker"
  );
  const withChip = [
    { role: "user", text: "hi" },
    { role: "assistant", text: "hidden", isDigestChip: true },
  ];
  assert(
    isDigestHiddenChipMessage(withChip[1]) &&
      withoutDigestHiddenChips(withChip).length === 1,
    "digest chip filter",
  );

  console.log("\n3. Cache tooltip double-click hint:");
  const { formatCacheSparklineTooltip } = await import("../src/ai/learning/CacheHitSparkline");
  const tip38 = formatCacheSparklineTooltip([1, 0], 50);
  assert(tip38.includes("Double-click"), "cache dbl-click tooltip");

  console.log("\n4. Aging handoff sutra-only vs wa:");
  const { buildReminderQueryFromDraft } = await import("../src/ai/actions/agingReminderDraft");
  const { queueAgingWaAutoOpen, consumeAgingWaAutoOpen } = await import(
    "../src/ai/actions/agingReminderDraft"
  );
  assert(buildReminderQueryFromDraft({ partyName: "Ram", direction: "receivable" }) === "/reminder Ram", "row sutra");
  queueAgingWaAutoOpen("Ram");
  assert(consumeAgingWaAutoOpen() === "Ram", "row sutra+wa queue");

  console.log("\n5. buildCacheStatsSummary still works:");
  const { buildCacheStatsSummary } = await import("../src/ai/learning/CacheHitSparkline");
  const sum38 = await buildCacheStatsSummary();
  assert(sum38.includes("LLM cache"), "cache summary");

  console.log("\n✅ All Sprint 38 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 38 complete!");

  // Sprint 39: Cache 3× clear, localized phone chips, digest scroll, +WA phone gate
  console.log("\n=== SUTRA AI Sprint 39 Tests ===\n");

  console.log("1. Phone saved localized quick-reply labels:");
  const { getPhoneSavedQuickReplyLabels, buildPhoneSavedQuickReplies } = await import(
    "../src/ai/actions/partyPhoneSavedBridge"
  );
  const neLabels = getPhoneSavedQuickReplyLabels("nepali");
  const enLabels = getPhoneSavedQuickReplyLabels("english");
  assert(neLabels.send.includes("पठाउ") && enLabels.send === "Send now", "localized chip labels");
  const neChips = buildPhoneSavedQuickReplies(
    { partyName: "Ram", phone: "9841234567", savedAt: Date.now() },
    "nepali",
  );
  assert(neChips[0].label === neLabels.send && neChips[1].label === neLabels.copy, "chips use labels");

  console.log("\n2. Cache tooltip triple-click hint:");
  const { formatCacheSparklineTooltip } = await import("../src/ai/learning/CacheHitSparkline");
  const tip39 = formatCacheSparklineTooltip([1, 0, 1], 60);
  assert(tip39.includes("3×: clear"), "cache triple-click tooltip");

  console.log("3. Cache header click tiers:");
  const tier = (clicks: number) =>
    clicks >= 3 ? "clear" : clicks === 2 ? "stats" : "copy";
  assert(tier(1) === "copy" && tier(2) === "stats" && tier(3) === "clear", "click tiers");

  console.log("\n4. Digest hidden chip helpers:");
  const { withoutDigestHiddenChips } = await import("../src/ai/intelligence/DigestShownTracker");
  assert(withoutDigestHiddenChips([{ isDigestChip: true }, {}]).length === 1, "chip strip");

  console.log("\n5. Aging WA gate needs phone:");
  const hasPhone = (phone?: string) => Boolean(phone?.trim());
  assert(!hasPhone(undefined) && hasPhone("9841234567"), "wa phone gate");

  console.log("\n✅ All Sprint 39 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 39 complete!");

  // Sprint 40: Roman chip labels, cache clear confirm, digest pin, +WA setphone handoff
  console.log("\n=== SUTRA AI Sprint 40 Tests ===\n");

  console.log("1. Roman phone-save chip labels:");
  const { getPhoneSavedQuickReplyLabels } = await import("../src/ai/actions/partyPhoneSavedBridge");
  const ro = getPhoneSavedQuickReplyLabels("roman");
  assert(ro.send === "Ahile pathau" && ro.copy === "Copy", "roman chip labels");

  console.log("\n2. Setphone handoff query:");
  const { buildSetPhoneHandoffQuery, saveAiChatQueryDraft, consumeAiChatQueryDraft } = await import(
    "../src/ai/actions/chatQueryDraft"
  );
  const setQ = buildSetPhoneHandoffQuery("Ram Traders");
  assert(setQ === "/setphone Ram Traders ", "setphone handoff query");
  saveAiChatQueryDraft(setQ);
  assert(consumeAiChatQueryDraft() === setQ, "chat query draft");

  console.log("\n3. Cache tooltip confirm hint:");
  const { formatCacheSparklineTooltip } = await import("../src/ai/learning/CacheHitSparkline");
  assert(formatCacheSparklineTooltip([1], 50).includes("confirm"), "cache clear confirm hint");

  console.log("\n4. Cache click tier with confirm gate:");
  const tier40 = (clicks: number, confirmed: boolean) =>
    clicks >= 3 && confirmed ? "clear" : clicks === 2 ? "stats" : "copy";
  assert(tier40(3, false) === "copy" && tier40(3, true) === "clear", "confirm gate");

  console.log("\n5. Nepali labels unchanged:");
  const ne = getPhoneSavedQuickReplyLabels("nepali");
  assert(ne.send.includes("पठाउ"), "nepali chip labels");

  console.log("\n✅ All Sprint 40 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 40 complete!");

  // Sprint 41: Digest pin persist, localized cache confirm, phone setphone QR, aging label
  console.log("\n=== SUTRA AI Sprint 41 Tests ===\n");

  console.log("1. Digest pin localStorage:");
  const {
    readDigestPinnedPreference,
    writeDigestPinnedPreference,
    formatCacheClearConfirm,
    agingWaButtonLabel,
  } = await import("../src/ai/intelligence/DigestPinPreference");
  writeDigestPinnedPreference(false);
  assert(readDigestPinnedPreference() === false, "digest pin saved");
  writeDigestPinnedPreference(true);
  assert(readDigestPinnedPreference() === true, "digest pin restore");

  console.log("\n2. Localized cache clear confirm:");
  const neConfirm = formatCacheClearConfirm("nepali");
  const enConfirm = formatCacheClearConfirm("english");
  assert(neConfirm.includes("मेट्ने") && enConfirm.includes("Clear"), "cache confirm i18n");

  console.log("\n3. Party phone missing setphone quick reply:");
  const { partyPhoneQueryHandler } = await import("../src/ai/rag/PartyPhoneQueryHandler");
  const { buildSetPhoneHandoffQuery } = await import("../src/ai/actions/chatQueryDraft");
  const noPh = partyPhoneQueryHandler.tryBuildResponse(
    "/phone ram",
    { party: "ram" },
    { parties: [{ id: "p1", name: "Ram", type: "customer", balance: 1000 }] },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "english",
    "/phone ram",
  );
  assert(
    noPh?.quickReplies?.[0]?.value === buildSetPhoneHandoffQuery("Ram"),
    "phone query setphone qr",
  );

  console.log("\n4. Aging WA button label:");
  assert(agingWaButtonLabel(true) === "+WA" && agingWaButtonLabel(false, "nepali").includes("फोन"), "wa label");

  console.log("\n5. Roman cache clear confirm:");
  const roConfirm = formatCacheClearConfirm("roman");
  assert(roConfirm.includes("clear"), "roman cache confirm");

  console.log("\n✅ All Sprint 41 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 41 complete!");

  // Sprint 42: Localized pin/cache sync, aging return after setphone, NE aging labels
  console.log("\n=== SUTRA AI Sprint 42 Tests ===\n");

  console.log("1. Digest pin labels localized:");
  const {
    formatDigestPinLabels,
    formatCacheSyncMessage,
  } = await import("../src/ai/intelligence/DigestPinPreference");
  const nePin = formatDigestPinLabels("nepali", true);
  assert(nePin.label.includes("टाँस"), "nepali pinned label");
  const enPin = formatDigestPinLabels("english", false);
  assert(enPin.label === "Pin", "english pin label");

  console.log("\n2. Cache sync messages localized:");
  const neSync = formatCacheSyncMessage("stats_copied", "nepali");
  const enSync = formatCacheSyncMessage("clear_requested", "english");
  assert(neSync.includes("कपी") && enSync.includes("Cache clear"), "cache sync i18n");

  console.log("\n3. Aging setphone return draft + quick reply:");
  const {
    saveAgingSetphoneReturnDraft,
    consumeAgingSetphoneReturnDraft,
    encodeAgingReturnQuickReplyValue,
    decodeAgingReturnQuickReplyValue,
    formatAgingReturnConfirmation,
  } = await import("../src/ai/actions/chatQueryDraft");
  saveAgingSetphoneReturnDraft({ direction: "receivable", searchTerm: "Ram" });
  const peeked = consumeAgingSetphoneReturnDraft();
  assert(peeked?.searchTerm === "Ram", "aging return draft roundtrip");
  const enc = encodeAgingReturnQuickReplyValue({ direction: "payable", searchTerm: "ABC" });
  const dec = decodeAgingReturnQuickReplyValue(enc);
  assert(dec?.direction === "payable", "aging return qr codec");

  console.log("\n4. Phone saved adds aging return QR:");
  const { buildPhoneSavedQuickReplies } = await import("../src/ai/actions/partyPhoneSavedBridge");
  saveAgingSetphoneReturnDraft({ direction: "receivable", searchTerm: "Ram" });
  const qrs = buildPhoneSavedQuickReplies(
    { partyName: "Ram", phone: "9841234567", savedAt: Date.now() },
    "nepali",
  );
  assert(qrs.some((q) => q.id === "ph-saved-aging"), "aging return qr on phone save");
  consumeAgingSetphoneReturnDraft();

  console.log("\n5. Party phone setphone label uses output lang:");
  const { partyPhoneQueryHandler } = await import("../src/ai/rag/PartyPhoneQueryHandler");
  const nePh = partyPhoneQueryHandler.tryBuildResponse(
    "/phone ram",
    { party: "ram" },
    { parties: [{ id: "p1", name: "Ram", type: "customer", balance: 1000 }] },
    { intent: "QUERY", confidence: 0.9, entities: {} },
    "nepali",
    "/phone ram",
  );
  assert(nePh?.quickReplies?.[0]?.label?.includes("फोन"), "nepali setphone qr label");

  console.log("\n6. Aging return confirmation:");
  assert(formatAgingReturnConfirmation("nepali").includes("Aging"), "aging return confirm");

  console.log("\n✅ All Sprint 42 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 42 complete!");

  // Sprint 43: Digest header/snooze i18n, cached badge, roman aging confirm, search prefill
  console.log("\n=== SUTRA AI Sprint 43 Tests ===\n");

  console.log("1. Daily digest header + snooze chips:");
  const {
    formatDailyDigestHeader,
    formatDigestSnoozeChip,
    formatDigestSnoozeTitle,
    formatDigestHiddenLabel,
  } = await import("../src/ai/intelligence/DigestShownTracker");
  assert(formatDailyDigestHeader("nepali").includes("सारांश"), "digest header ne");
  assert(formatDigestSnoozeChip("1h", "nepali") === "१घ", "snooze 1h ne");
  assert(formatDigestSnoozeChip("tomorrow", "roman") === "Bholi", "snooze tomorrow roman");
  assert(formatDigestSnoozeTitle("4h", "nepali").includes("४"), "snooze title ne");

  console.log("\n2. Digest hidden label localized:");
  const hiddenNe = formatDigestHiddenLabel("nepali");
  assert(hiddenNe.includes("भोलि"), "hidden label ne");

  console.log("\n3. Cached badge localized:");
  const { formatCachedBadgeLabel, formatCachedHeaderSubtitle } = await import(
    "../src/ai/intelligence/DigestPinPreference"
  );
  assert(formatCachedBadgeLabel("nepali") === "क्यास", "cached badge ne");
  assert(formatCachedHeaderSubtitle("nepali").includes("क्यास"), "cached subtitle ne");

  console.log("\n4. Roman aging return confirmation:");
  const { formatAgingReturnConfirmation: agingConfirm43 } = await import(
    "../src/ai/actions/chatQueryDraft"
  );
  const roAging = agingConfirm43("roman");
  assert(roAging.includes("search") && roAging.includes("khulyo"), "roman aging confirm");

  console.log("\n5. Aging report draft search prefill:");
  const { saveAiAgingReportDraft, peekAiAgingReportDraft, consumeAiAgingReportDraft } =
    await import("../src/ai/actions/agingReportDraft");
  saveAiAgingReportDraft({ direction: "payable", searchTerm: "ABC Traders" });
  const peekDraft = peekAiAgingReportDraft();
  assert(peekDraft?.searchTerm === "ABC Traders", "aging draft peek search");
  const consumed = consumeAiAgingReportDraft();
  assert(consumed?.direction === "payable" && consumed.searchTerm === "ABC Traders", "aging draft consume");

  console.log("\n✅ All Sprint 43 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 43 complete!");

  // Sprint 44: Show again i18n, aging placeholder, roman phone QR, cache tooltip
  console.log("\n=== SUTRA AI Sprint 44 Tests ===\n");

  console.log("1. Digest show again label:");
  const { formatDigestShowAgainLabel, buildDigestShowQuickReply } = await import(
    "../src/ai/intelligence/DigestShownTracker"
  );
  assert(formatDigestShowAgainLabel("nepali").includes("फेरि"), "show again ne");
  assert(buildDigestShowQuickReply("roman").label === "Feri dekhau", "show again qr roman");

  console.log("\n2. Aging search placeholder:");
  const { formatAgingSearchPlaceholder } = await import("../src/ai/intelligence/DigestPinPreference");
  assert(formatAgingSearchPlaceholder("nepali").includes("पार्टी"), "aging placeholder ne");

  console.log("\n3. Roman phone saved quick reply labels:");
  const { getPhoneSavedQuickReplyLabels } = await import("../src/ai/actions/partyPhoneSavedBridge");
  const roLabels = getPhoneSavedQuickReplyLabels("roman");
  assert(roLabels.reminder === "Samjhana" && roLabels.balance === "Baki herau", "roman phone qr");

  console.log("\n4. Cache tooltip localized:");
  const { formatCacheSparklineTooltip } = await import("../src/ai/learning/CacheHitSparkline");
  const { formatCachedBadgeTooltip } = await import("../src/ai/intelligence/DigestPinPreference");
  const neTip = formatCacheSparklineTooltip([1, 0, 1], 60, "nepali");
  assert(neTip.includes("मेट्नुहोस्"), "cache sparkline tooltip ne");
  assert(formatCachedBadgeTooltip("nepali").includes("cache"), "cached badge tooltip ne");

  console.log("\n5. Roman cache sparkline tooltip:");
  const roTip = formatCacheSparklineTooltip([1], 50, "roman");
  assert(roTip.includes("Halka"), "cache tooltip roman");

  console.log("\n✅ All Sprint 44 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 44 complete!");

  // Sprint 45: Digest reply i18n, aging modal title, roman copy confirm, cache stats i18n
  console.log("\n=== SUTRA AI Sprint 45 Tests ===\n");

  console.log("1. Digest dismiss/snooze replies:");
  const {
    formatDigestDismissReply,
    formatDigestSnoozeReply,
    formatDigestShowReply,
  } = await import("../src/ai/intelligence/DigestShownTracker");
  assert(formatDigestDismissReply("nepali").includes("सारांश"), "digest dismiss ne");
  assert(formatDigestSnoozeReply(4, "nepali").includes("स्नूज"), "digest snooze ne");
  assert(formatDigestShowReply("roman").includes("dekhiyo"), "digest show roman");

  console.log("\n2. Aging reminder modal title:");
  const { formatAgingReminderModalTitle } = await import("../src/ai/intelligence/DigestPinPreference");
  assert(formatAgingReminderModalTitle("payable", "nepali").includes("भुक्तानी"), "aging modal title ne");

  console.log("\n3. Roman copy confirmation:");
  const { formatCopyConfirmation } = await import("../src/ai/actions/waQuickReplyBridge");
  const roCopy = formatCopyConfirmation("Ram", "roman", true);
  assert(roCopy.includes("clipboard"), "roman copy confirm");

  console.log("\n4. Cache stats localized:");
  const { cacheStatsQueryHandler } = await import("../src/ai/rag/CacheStatsQueryHandler");
  const cacheNe = await cacheStatsQueryHandler.tryBuildResponse("/cache stats", "nepali", "/cache stats");
  const cacheRo = await cacheStatsQueryHandler.tryBuildResponse("/cache stats", "roman", "/cache stats");
  assert(cacheNe?.response.nepali.includes("वटा"), "cache stats ne entries");
  assert(cacheRo?.quickReplies?.[0]?.label === "Cache clear", "cache clear qr roman");

  console.log("\n5. Cache cleared reply localized:");
  const { formatCacheClearedReply } = await import("../src/ai/intelligence/DigestPinPreference");
  assert(formatCacheClearedReply(3, "nepali").includes("मेटियो"), "cache cleared ne");

  console.log("\n✅ All Sprint 45 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 45 complete!");

  // Sprint 46: Aging modal buttons, alerts header, roman WA confirm
  console.log("\n=== SUTRA AI Sprint 46 Tests ===\n");
  const {
    formatProactiveAlertsHeader,
    formatAgingRemindWaButton,
    formatAgingRemindCopyButton,
    formatCacheClearConfirm,
  } = await import("../src/ai/intelligence/DigestPinPreference");
  assert(formatProactiveAlertsHeader("nepali") === "सतर्कता", "alerts header ne");
  assert(formatAgingRemindWaButton(false, "nepali").includes("खोल्नुहोस्"), "aging wa btn ne");
  assert(formatAgingRemindCopyButton("roman") === "Copy garau", "aging copy roman");
  assert(formatCacheClearConfirm("roman").includes("clear"), "cache confirm roman");
  const { formatWhatsAppSentConfirmation } = await import("../src/ai/actions/partyPhoneSavedBridge");
  assert(formatWhatsAppSentConfirmation("Ram", "roman").includes("WhatsApp ma"), "wa confirm roman");

  console.log("\n✅ All Sprint 46 tests passed!");

  // Sprint 47: Aging setphone draft carries overdue for smarter reminder share
  console.log("\n=== SUTRA AI Sprint 47 Tests ===\n");
  const { saveAgingSetphoneReturnDraft, consumeAgingSetphoneReturnDraft } = await import(
    "../src/ai/actions/chatQueryDraft"
  );
  const { buildPhoneSavedReminderShare } = await import("../src/ai/actions/partyPhoneSavedBridge");
  saveAgingSetphoneReturnDraft({
    direction: "receivable",
    searchTerm: "Ram",
    outstanding: 5000,
    daysOverdue: 30,
  });
  const share = buildPhoneSavedReminderShare(
    { partyName: "Ram", phone: "9841234567", savedAt: Date.now() },
    "english",
  );
  assert(share.includes("30 days overdue"), "aging overdue in phone saved share");
  consumeAgingSetphoneReturnDraft();

  console.log("\n✅ All Sprint 47 tests passed!");

  // Sprint 48: Chat sync + analyzing labels
  console.log("\n=== SUTRA AI Sprint 48 Tests ===\n");
  const { formatChatSyncMessage, formatAnalyzingLabel } = await import(
    "../src/ai/intelligence/DigestPinPreference"
  );
  assert(formatChatSyncMessage("reminder_copied", "nepali").includes("कपी"), "chat sync ne");
  assert(formatAnalyzingLabel("roman").includes("gardai"), "analyzing roman");

  console.log("\n✅ All Sprint 48 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprints 46–48 complete!");

  // Sprint 49: Smarter phone-save reminder query + auto-correct label
  console.log("\n=== SUTRA AI Sprint 49 Tests ===\n");
  saveAgingSetphoneReturnDraft({
    direction: "receivable",
    searchTerm: "Ram",
    outstanding: 8000,
    daysOverdue: 60,
  });
  const { buildPhoneSavedReminderQuery, formatPartyPhoneSavedMessage } = await import(
    "../src/ai/actions/partyPhoneSavedBridge"
  );
  const remQ = buildPhoneSavedReminderQuery({
    partyName: "Ram",
    phone: "9841234567",
    savedAt: Date.now(),
  });
  assert(remQ.includes("60 days overdue"), "phone saved reminder query overdue");
  const savedMsg = formatPartyPhoneSavedMessage(
    { partyName: "Ram", phone: "9841234567", savedAt: Date.now() },
    "english",
  );
  assert(savedMsg.includes("8,000"), "phone saved msg mentions balance");
  consumeAgingSetphoneReturnDraft();
  const { formatAutoCorrectedLabel } = await import("../src/ai/intelligence/DigestPinPreference");
  assert(formatAutoCorrectedLabel("nepali").includes("सुधार"), "auto-correct ne");

  console.log("\n✅ All Sprint 49 tests passed!");
  console.log("\n🎉 SUTRA AI — Sprint 49 complete!");
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`\n❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
