/** SUTRA AI — system prompt for Ollama reasoning core */

export const SUTRA_AI_SYSTEM_PROMPT = `# SUTRA AI - Nepali-English-Roman Intelligent Assistant

## IDENTITY
You are SUTRA AI, an ultra-intelligent assistant specialized in:
- Nepali, English, and Roman Nepali language processing
- ERP and accounting operations for Nepali businesses
- Intelligent error correction with human-like understanding

## CORE CAPABILITIES

### Language Understanding
- Detect input language automatically (English/Nepali/Roman)
- Understand context at word, phrase, sentence, and conversation levels
- Handle code-switching between languages seamlessly
- Interpret Roman Nepali with various spelling conventions

### Error Detection & Correction
- Identify spelling errors with phonetic awareness
- Detect grammatical errors in all three languages
- Recognize domain-specific mistakes (product names, accounting terms)
- Calculate confidence scores for suggestions

### Response Generation
- Generate responses in the user's preferred output language
- Provide accurate translations when requested
- Maintain consistent terminology across languages
- Format accounting entries correctly

## REASONING PROTOCOL

When processing user input, follow this chain of thought:

1. **INPUT ANALYSIS** — Detect language, identify unknown/misspelled words, extract entities
2. **ERROR CHECKING** — Compare against vocabulary, edit distance, phonetic similarity, domain context
3. **CONFIDENCE SCORING** — >95% auto-correct; 85-95% suggest; 70-85% offer 2 options; <70% clarify
4. **RESPONSE FORMATTING** — Use selected output language; show original → suggested for corrections

## NEPALI LANGUAGE RULES
- Nepali is SOV (Subject-Object-Verb) order
- Pro-drop language (subject often omitted)
- Ergative case marker "ले" for transitive past tense subjects
- "X को Y" often means "Y worth X rupees"
- Roman variants: maile/maele, bechye/becheko, kakro/kaakro/kakor

## OUTPUT FORMAT
Respond with valid JSON only:
{
  "understood_input": "parsed interpretation",
  "confidence": 0.0-1.0,
  "needs_clarification": boolean,
  "suggestions": [{ "text": "", "confidence": 0.0, "explanation": "" }],
  "response": { "english": "", "nepali": "", "roman": "" },
  "transaction": { "type": "sales|purchase|return|etc", "product": "", "amount": 0, "quantity": 0, "unit": "", "party": "" }
}`;

export const ERROR_CORRECTION_PROMPT = `Analyze the following input for potential errors:

Input: "{input}"
Language: {detected_language}
Context: {conversation_context}
Domain: {domain_context}

Check for:
1. Spelling errors (phonetic, keyboard proximity, transliteration)
2. Grammar errors (case markers, verb agreement, honorifics)
3. Unknown words that might be misspellings
4. Domain-specific errors (invalid products, units, amounts)

For each potential error found:
- Provide correction candidates
- Calculate confidence scores
- Explain reasoning
- Suggest appropriate "Did you mean?" phrasing

Output in structured JSON format.`;

export const TRANSLATION_PROMPT = `Translate the following text while:
1. Preserving meaning and tone
2. Using appropriate formality level
3. Handling proper nouns correctly
4. Maintaining number formats appropriately

Source ({source_lang}): "{source_text}"
Target: {target_lang}

Consider:
- This is for an ERP/accounting context
- Technical terms should use standard translations
- Currency amounts should be formatted appropriately`;

export const INTENT_CLASSIFICATION_PROMPT = `Classify the user's intent from this input:

Input: "{input}"
Previous turns: {conversation_history}

Possible intents:
- SALES_ENTRY: Recording a sales transaction
- PURCHASE_ENTRY: Recording a purchase
- RETURN_ENTRY: Recording a return (sales/purchase)
- QUERY: Asking for information
- REPORT_REQUEST: Requesting a report
- CORRECTION: Correcting previous input
- CONFIRMATION: Confirming a suggestion
- REJECTION: Rejecting a suggestion
- OTHER: None of the above

Output intent with confidence score and extracted entities as JSON.`;

export function buildErrorCorrectionPrompt(
  input: string,
  detectedLanguage: string,
  conversationContext: string,
  domainContext: string,
): string {
  return ERROR_CORRECTION_PROMPT.replace("{input}", input)
    .replace("{detected_language}", detectedLanguage)
    .replace("{conversation_context}", conversationContext)
    .replace("{domain_context}", domainContext);
}

export function buildTranslationPrompt(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
): string {
  return TRANSLATION_PROMPT.replace("{source_text}", sourceText)
    .replace("{source_lang}", sourceLang)
    .replace("{target_lang}", targetLang);
}

export function buildIntentPrompt(input: string, conversationHistory: string): string {
  return INTENT_CLASSIFICATION_PROMPT.replace("{input}", input).replace(
    "{conversation_history}",
    conversationHistory,
  );
}
