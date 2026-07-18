# MAI-07R3F English Identity Policy (engineering)

**Status:** Engineering-activated in runtime `mai-07.1.2-r3f`  
**Linguist:** not approved · **Production:** not approved

## Option A (ADR_0009) — retained

1. English / acronyms / identifiers → Latin identity first  
2. Proper names → Latin identity first; optional Devanagari review-only  
3. Clear Romanized Nepali → reviewed Devanagari may rank first; identity retained  
4. Shared / ambiguous Latin → identity first (conservative)  
5. Unknown → identity first or abstain (fail closed)

## R3F multi-signal rule

High-confidence English requires a deterministic combination from the versioned guard config `r3f_english_identity_guard.json` (not form alone):

- language form and/or `english_identity` lexicon membership  
- sentence-level English neighbor ratio  
- neighboring English function words  
- absence of strong Nepali particles when claiming English  
- domain-borrow handling only with strong English context  
- positive Romanized lexicon/morph evidence required for Romanized disposition  

## Guard placement

After candidate generation + contextual ranking; before bundle serialization. Reorder only.
