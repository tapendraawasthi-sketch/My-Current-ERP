/** SUTRA AI — example phrases for /examples shortcut */

import type { AIResponse, LanguageCode } from "../types";

const EXAMPLES = {
  nepali:
    "उदाहरण वाक्यहरू:\n" +
    "• `maile 500 ko kakro bechye` — बिक्री\n" +
    "• `ram lai 300 udhaar` — उधार बिक्री\n" +
    "• `ram le 500 tiryo` — भुक्तानी प्राप्त\n" +
    "• `500 ko kharcha` — खर्च\n" +
    "• `ram ko balance kati` — ब्यालेन्स\n" +
    "• `kakro kati baki cha` — स्टक\n" +
    "• `aaja ko bikri kati` — आजको बिक्री\n" +
    "• `aaja vs hijo bikri` — तुलना\n" +
    "• `sabai udhaar list` — receivable\n" +
    "• `nagad kati cha` — नगद ब्यालेन्स",
  english:
    "Example phrases:\n" +
    "• `maile 500 ko kakro bechye` — sales\n" +
    "• `ram le 500 tiryo` — payment received\n" +
    "• `500 ko kharcha` — expense\n" +
    "• `ram ko balance kati` — party balance\n" +
    "• `aaja vs hijo bikri` — compare sales\n" +
    "• `sabai udhaar list` — receivables\n" +
    "• `nagad kati cha` — cash balance",
  roman:
    "Example phrases:\n" +
    "• `maile 500 ko kakro bechye` — bikri\n" +
    "• `ram ko balance kati` — balance\n" +
    "• `aaja ko bikri kati` — aajako report\n" +
    "• `/compare` `/expense` `/help` — shortcuts",
};

export function buildExamplesResponse(
  understood: string,
  lang: LanguageCode,
): AIResponse {
  return {
    understood_input: understood,
    confidence: 1,
    needs_clarification: false,
    suggestions: [],
    response: EXAMPLES,
  };
}
