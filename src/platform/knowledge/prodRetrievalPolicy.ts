/**
 * NEXT-14 / ADR_0081 — production retrieval honesty constants.
 * Does not call Ollama or Chroma.
 */

export const PROD_RETRIEVAL_ADR = "ADR_0081" as const;
export const PROD_RETRIEVAL_DECISION = "PROD_LEXICAL_ONLY_RETRIEVAL" as const;
export const PROD_RETRIEVAL_MODE = "LEXICAL_ONLY" as const;
export const OLLAMA_REQUIRED_FOR_PROD = false as const;
export const VECTOR_REQUIRED_FOR_PROD = false as const;
export const GAP_P2_001_REGISTER_STATUS = "REDUCED" as const;

export function prodRetrievalHonestySnapshot() {
  return {
    authority: PROD_RETRIEVAL_ADR,
    decision: PROD_RETRIEVAL_DECISION,
    prodRetrievalMode: PROD_RETRIEVAL_MODE,
    ollamaRequiredForProd: OLLAMA_REQUIRED_FOR_PROD,
    chromaRequiredForProd: false,
    vectorRequiredForProd: VECTOR_REQUIRED_FOR_PROD,
    semanticEnabledInProduction: false,
    gapP2001RegisterStatus: GAP_P2_001_REGISTER_STATUS,
    gapP2001Closed: false,
    productionApproved: false,
    isExecutionAuthority: false,
  };
}
