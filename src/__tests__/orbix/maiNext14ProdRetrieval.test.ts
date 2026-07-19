import { describe, expect, it } from "vitest";
import {
  GAP_P2_001_REGISTER_STATUS,
  OLLAMA_REQUIRED_FOR_PROD,
  PROD_RETRIEVAL_ADR,
  PROD_RETRIEVAL_MODE,
  VECTOR_REQUIRED_FOR_PROD,
  prodRetrievalHonestySnapshot,
} from "@/platform/knowledge/prodRetrievalPolicy";

describe("NEXT-14 production retrieval honesty", () => {
  it("declares lexical-only prod path and REDUCED gap", () => {
    const snap = prodRetrievalHonestySnapshot();
    expect(snap.authority).toBe(PROD_RETRIEVAL_ADR);
    expect(snap.authority).toBe("ADR_0081");
    expect(snap.prodRetrievalMode).toBe(PROD_RETRIEVAL_MODE);
    expect(snap.prodRetrievalMode).toBe("LEXICAL_ONLY");
    expect(snap.ollamaRequiredForProd).toBe(false);
    expect(OLLAMA_REQUIRED_FOR_PROD).toBe(false);
    expect(snap.vectorRequiredForProd).toBe(false);
    expect(VECTOR_REQUIRED_FOR_PROD).toBe(false);
    expect(snap.semanticEnabledInProduction).toBe(false);
    expect(snap.gapP2001RegisterStatus).toBe("REDUCED");
    expect(GAP_P2_001_REGISTER_STATUS).toBe("REDUCED");
    expect(snap.gapP2001Closed).toBe(false);
    expect(snap.productionApproved).toBe(false);
  });
});
