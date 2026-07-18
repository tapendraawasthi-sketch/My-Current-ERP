# R3N4 Identity Anchor Policy

**Policy version:** `mai-07-r3n4.1.0.0`  
**Schema:** `IdentityAnchorV1.1.0`  
**Offset unit:** `UNICODE_CODE_POINT`

## Authority

The raw source text is the sole surface authority. An `IdentityAnchorV1` is immutable metadata derived from a raw code-point slice. It is not a replacement text authority and must not appear (surface or digest) in production traces.

## Required fields

- `schema_version`, `offset_unit`, `raw_start`, `raw_end_exclusive`
- `raw_surface`, `raw_surface_digest`, `source_text_digest`
- `anchor_kind`, `created_from`, `parent_anchor_ids`, `policy_version`, `anchor_id`

## Validation

- `raw_surface == raw_text[raw_start:raw_end_exclusive]`
- Bounds valid; digests SHA-256 of UTF-8 bytes
- No normalization, casefolding, whitespace collapse, punctuation or digit conversion
- No mutation after creation

## Lifecycle

1. Create anchors from raw offsets **before** normalization, refinement, generation, ranking.
2. Refined spans: new raw-derived child anchor contained in parent; preserve parent IDs.
3. Coalesced spans: one raw-derived anchor over the complete intervening slice; ordered non-overlapping parents.
4. Split spans: one raw-derived anchor per child; never reuse full parent identity on each child.

## Identity construction

Canonical identity candidates are constructed **only** from a validated `IdentityAnchorV1`. Never from normalized text, retrieval views, top-ranked candidates, language-form tokens, or serialized prior output.

## Non-promotion

Candidate runtime `mai-07.1.9-r3n4-identityanchor` remains `default_active=false`. Active R3F sealnew is unchanged.
