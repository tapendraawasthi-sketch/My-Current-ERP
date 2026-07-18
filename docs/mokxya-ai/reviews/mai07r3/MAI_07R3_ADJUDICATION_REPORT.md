# MAI-07R3B Review Import and Adjudication Report

**Status:** READY_FOR_CURSOR_IMPORT  
**MAI-07 quality gate:** NOT PASSED  
**Professional linguist approved:** false  
**Production approved:** false

## Authoritative mapping

The product owner explicitly authorized this bulk schema conversion:

| Locked Round B label | Official schema label | Count |
|---|---|---:|
| ACCEPTABLE | ACCEPTABLE_PREFERRED | 223 |
| UNACCEPTABLE | UNNATURAL_BUT_POSSIBLE | 36 |
| CANNOT_DECIDE | CANNOT_DECIDE | 4 |

This is a **mechanical, user-authorized bulk mapping**. It is not represented as a candidate-by-candidate five-label review or professional-linguist adjudication.

## Validated inputs

- Round A: 149 locked items; SHA-256 `f01270e3017162259d2d305e158e86e386eb86841e4928b99546cd613d037f49`
- Round B: 263 locked candidate judgments across 149 review IDs
- Blind mapping: 149 entries; 49 conflicts
- All packet hashes and candidate cardinalities verified

## Adjudication consequences

- Round A remains the product-ranking authority and records approval of Option A (conservative identity policy).
- Round B remains candidate-quality evidence only.
- 93 review items have more than one bulk-mapped preferred candidate.
- 21 review items contain a CANNOT_DECIDE signal.
- 120 items have one policy-compatible preferred candidate that can be proposed as unique top-1 gold; Cursor must validate this under repository contracts before creating any derived V2 dataset.
- Multiple preferred candidates must **not** be silently converted into one top-1 gold answer.

## Gate decision

The review artifacts are valid and ready to import into the repository. This does **not** pass MAI-07 quality, authorize a frozen quality run, approve production, claim professional-linguist approval, or start MAI-08.

The detailed implementation and validation instructions are in `MAI_07R3_CURSOR_PROMPT.txt`.
