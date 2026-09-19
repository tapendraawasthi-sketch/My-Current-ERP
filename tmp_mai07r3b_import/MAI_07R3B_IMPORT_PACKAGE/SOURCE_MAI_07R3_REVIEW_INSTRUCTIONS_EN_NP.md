# MAI-07R3 Language Policy Review Instructions / समीक्षा निर्देश

## Purpose / उद्देश्य
Help MokXya decide when Latin text should stay Latin-first versus when Devanagari transliteration should rank first.

यो समीक्षाको उद्देश्य: कहिले ल्याटिन पहिले राख्ने र कहिले देवनागरी अनुवादलाई पहिलो स्थान दिने भन्ने नीति तय गर्नु हो।

## Roles / भूमिका
- **Product owner**: preferred product ranking behavior
- **Nepali-fluent reviewer**: language judgment (not automatic linguist approval)
- **Professional linguist**: required only for `LINGUIST_APPROVED=true`

## Important / महत्वपूर्ण
- Do **not** try to make any evaluation score improve.
- Do **not** assume current system ranking is correct.
- Cases are synthetic or licensed evaluation content (`prohibited_for_training=true`).
- Human adjudication is allowed; model training on these cases is prohibited.
- Answer each case independently.

## Round A
Classify the highlighted span and choose preferred MokXya ranking.

## Round B (after Round A locked)
Mark each candidate’s acceptability without seeing ranks/scores/provenance.
