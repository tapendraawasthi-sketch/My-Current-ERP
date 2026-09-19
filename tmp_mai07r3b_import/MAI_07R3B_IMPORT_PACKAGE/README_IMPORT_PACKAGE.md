# MokXya MAI-07R3B Import Package

This package contains the completed locked Round A review, the locked broad Round B review, the user-authorized official five-label Round B conversion, the completed import object, unblinded adjudication, policy/evaluation guidance, and a detailed Cursor prompt.

## What the user decided

- ACCEPTABLE → ACCEPTABLE_PREFERRED
- UNACCEPTABLE → UNNATURAL_BUT_POSSIBLE
- CANNOT_DECIDE → CANNOT_DECIDE

The conversion is mechanical and explicitly authorized by the product owner. It is not a new row-by-row professional-linguist review.

## Use order

1. Read MAI_07R3_CURSOR_PROMPT.txt.
2. Verify every file against MAI_07R3B_PACKAGE_MANIFEST.json.
3. Import MAI_07R3_REVIEW_IMPORT_COMPLETED.jsonl through the repository's governed R3B importer.
4. Preserve the locked source files and their manifests.
5. Do not change frozen V1, tune the ranker, run the frozen quality gate, or start MAI-08 in this phase.

## Current gate status

- Review artifacts: complete and valid for Cursor import
- Option A product policy: approved by product owner
- MAI-07 quality: not passed
- Professional linguist approved: false
- Production approved: false
- MAI-08 authorized: false
