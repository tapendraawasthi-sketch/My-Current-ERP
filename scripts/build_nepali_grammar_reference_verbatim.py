#!/usr/bin/env python3
"""Build nepali-grammar-reference-verbatim.txt — full expanded training document."""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONDENSED = REPO / "data" / "ekhata" / "source" / "nepali-grammar-reference.txt"
OUT = REPO / "data" / "ekhata" / "source" / "nepali-grammar-reference-verbatim.txt"

DELIM = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


def hdr(n: int, title_ne: str, title_en: str) -> str:
    return f"\n{DELIM}\nखण्ड {n}: {title_ne}\nSECTION {n}: {title_en}\n\n"


def var_lines(*variants: str) -> str:
    return "\n".join(f"→ {v.strip()}" for v in variants if v.strip()) + "\n"


def header_block() -> str:
    return """===========================================================================
   सम्पूर्ण नेपाली व्याकरण ज्ञान — AI प्रशिक्षणका लागि
   COMPLETE NEPALI GRAMMAR KNOWLEDGE — FOR AI TRAINING
   (Standard Nepali + Romanized + Halkhabar/Informal Variations)
===========================================================================
   DOCUMENT PURPOSE:
   यो दस्तावेजले नेपाली भाषाका हरेक व्याकरणिक अवधारणा
   (grammatical concept) लाई Devanagari, Romanized, र
   हलखबर (WhatsApp/chat) शैलीमा सबै सम्भावित रूपहरू सहित
   प्रस्तुत गर्दछ। यसले AI लाई वास्तविक नेपाली भाषा प्रयोगको
   सम्पूर्ण विविधता बुझ्न मद्दत गर्दछ।
===========================================================================
   VERBATIM EDITION — every Standard / Roman / Halkhabar variation on its own line.
===========================================================================

"""


def section_1() -> str:
    consonants = [
        ("क", "ka", ["ka", "k"]),
        ("ख", "kha", ["kha", "kh"]),
        ("ग", "ga", ["ga", "g"]),
        ("घ", "gha", ["gha", "gh"]),
        ("ङ", "nga", ["nga", "ng"]),
        ("च", "cha", ["cha", "ch", "ca"]),
        ("छ", "chha", ["chha", "chh", "chha", "x"]),
        ("ज", "ja", ["ja", "j"]),
        ("झ", "jha", ["jha", "jh"]),
        ("ञ", "nya", ["nya", "n"]),
        ("ट", "ta", ["ta", "t"]),
        ("ठ", "tha", ["tha", "th"]),
        ("ड", "da", ["da", "d"]),
        ("ढ", "dha", ["dha", "dh"]),
        ("ण", "na", ["na", "n"]),
        ("त", "ta", ["ta", "t"]),
        ("थ", "tha", ["tha", "th"]),
        ("द", "da", ["da", "d"]),
        ("ध", "dha", ["dha", "dh"]),
        ("न", "na", ["na", "n"]),
        ("प", "pa", ["pa", "p"]),
        ("फ", "pha", ["pha", "ph", "fa", "f"]),
        ("ब", "ba", ["ba", "b"]),
        ("भ", "bha", ["bha", "bh"]),
        ("म", "ma", ["ma", "m"]),
        ("य", "ya", ["ya", "y"]),
        ("र", "ra", ["ra", "r"]),
        ("ल", "la", ["la", "l"]),
        ("व", "wa", ["wa", "va", "w", "v"]),
        ("श", "sha", ["sha", "sh", "s"]),
        ("ष", "sha", ["sha", "sh"]),
        ("स", "sa", ["sa", "s"]),
        ("ह", "ha", ["ha", "h"]),
        ("क्ष", "ksha", ["ksha", "ksh"]),
        ("त्र", "tra", ["tra", "tr"]),
        ("ज्ञ", "gya", ["gya", "gy"]),
    ]
    lines = [
        hdr(1, "देवनागरी लिपि र वर्णमाला", "Devanagari Script and Alphabet"),
        "OVERVIEW:\n",
        "Nepali is written in Devanagari script (देवनागरी). AI must accept both Devanagari input\n",
        "and Roman transliteration. Vowel signs (matra) attach to consonants; halant (्) removes\n",
        "inherent 'a' sound.\n\n",
        "SWAR (VOWELS) — स्वर:\n",
    ]
    vowels = [
        ("अ", "a"), ("आ", "aa"), ("इ", "i"), ("ई", "ee"), ("उ", "u"), ("ऊ", "oo"),
        ("ऋ", "ri"), ("ए", "e"), ("ऐ", "ai"), ("ओ", "o"), ("औ", "au"),
    ]
    for dev, roman in vowels:
        lines.append(f"{dev} = {roman}\n")
        lines.append(var_lines(roman, roman * 2 if len(roman) == 1 else roman))
    lines.append("\nVYANJAN (CONSONANTS) — व्यञ्जन (complete):\n")
    for dev, roman, variants in consonants:
        lines.append(f"{dev} = {roman}\n")
        lines.append(var_lines(*variants))
    lines.append("\nMATRA (VOWEL SIGNS):\n")
    matras = [
        ("ा", "aa"), ("ि", "i"), ("ी", "ee"), ("ु", "u"), ("ू", "oo"),
        ("े", "e"), ("ै", "ai"), ("ो", "o"), ("ौ", "au"), ("ृ", "ri"),
    ]
    for dev, roman in matras:
        lines.append(f"{dev} = {roman}\n")
        lines.append(var_lines(roman))
    lines.append("\nDEVANAGARI DIGITS → Arabic:\n")
    for i, d in enumerate("०१२३४५६७८९"):
        lines.append(f"{d} = {i}\n")
        lines.append(var_lines(str(i)))
    lines.append("\nEXAMPLES (Devanagari → Roman):\n")
    examples = [
        ("राम le 500 diyo", "Ram le 500 diyo", "ram le 500 diyo", "Ramle 500 diyo", "ram 500 diyo"),
        ("उधार ma becheko", "udhaar ma becheko", "udhar ma becheko", "udhaar becheko", "udharo becheko"),
        ("आज ५००० ko bikri", "aaja 5000 ko bikri", "aja 5000 ko bikri", "ajha 5000 ko bikri", "aaj 5000 ko bikri"),
        ("श्याम lai 200 tiryo", "Shyam lai 200 tiryo", "shyam lai 200 tiryo", "Shyamlai 200 tiryo", "shyam 200 tiryo"),
    ]
    for std, *vars_ in examples:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nROMANIZATION RULES FOR AI:\n")
    rules = [
        "ch/chh/chha all map to छ-family sounds; accept cha/chha interchangeably",
        "v/w interchangeable: vayo/wayo, vannu/wannu",
        "double vowels optional: aa/a, ee/i, oo/u",
        'halant words may omit schwa: "Ramle" = "Ram le", "malai" = "ma lai"',
        "x used for छ/च in chat: xa/chha/cha all equivalent copula",
        "sh/s interchangeable: shubha/subha, pasal/pasaal",
    ]
    for r in rules:
        lines.append(f"→ {r}\n")
    return "".join(lines)


def section_2() -> str:
    lines = [hdr(2, "सर्वनाम", "Pronouns — All Levels of Formality")]
    formal = [
        ("म/tapai (you formal)", ["tapai", "tapain", "tapainle", "tapainlai", "tapainko", "tapainle"]),
        ("हामी (we)", ["hami", "hamile", "hamilai", "hamro", "hamile"]),
        ("उहाँ (he/she formal)", ["uha", "uhale", "uhalai", "uhako", "unle"]),
        ("यो/त्यो (this/that)", ["yo", "tyo", "yaha", "tyaha"]),
    ]
    informal = [
        ("म/timi (you informal)", ["timi", "timile", "timilai", "timro", "timile"]),
        ("त (very informal)", ["ta", "tale", "talai", "tero", "taile"]),
        ("म (I)", ["ma", "maile", "malai", "mero", "maile"]),
        ("उ (he/she informal)", ["u", "ule", "ulai", "usko", "ule"]),
        ("हामी", ["hami", "hamile", "hamilai"]),
    ]
    possessive = [
        ("मेरो", ["mero", "merro", "mero", "mera"]),
        ("तिम्रो", ["timro", "timro", "timi ko"]),
        ("तपाईंको", ["tapainko", "tapainko", "tapai ko", "tapain ko"]),
        ("हाम्रो", ["hamro", "hamro", "hami ko"]),
        ("उसको/उनको", ["usko", "unko", "u ko", "usko"]),
    ]
    lines.append("FORMAL (आदरार्थी):\n")
    for label, vars_ in formal:
        lines.append(f"{label}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nINFORMAL (अनौपचारिक):\n")
    for label, vars_ in informal:
        lines.append(f"{label}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nPOSSESSIVE (सम्बन्धवाचक):\n")
    for label, vars_ in possessive:
        lines.append(f"{label}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nEXAMPLES:\n")
    examples = [
        ("Standard:    मैले रामलाई ५०० दिएँ", ["maile Ram lai 500 diye", "maile ram lai 500 diye", "Maile Ramlai 500 diye"]),
        ("Roman:", ["maile ram lai 500 diye", "ma le ram lai 500 diye", "maile ram lai 500 die"]),
        ("Halkhabar:", ["ma le ram lai 500 diye", "ma 500 diye ram lai", "500 diye ram lai", "ma 500 diye"]),
        ("Formal:      तपाईंले कति तिर्नुभयो?", ["tapainle kati tirnubhayo?", "tapain le kati tirnubhayo", "tapai le kati tiryo"]),
        ("Question:    तपाईंको नाम के हो?", ["tapai ko naam ke ho?", "tapainko naam ke ho?", "tapain ko naam k ho?", "tapai ko name ke ho?"]),
    ]
    for label, vars_ in examples:
        lines.append(f"{label}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def section_3() -> str:
    posts = [
        ("ले (le)", "ERGATIVE/AGENT", "Ram le 500 diyo", ["Ram le 500 diyo", "Ramle 500 diyo", "Ram 500 diyo", "500 diyo Ram le", "ram le 500 diyo"]),
        ("लाई (lai)", "DATIVE/RECIPIENT", "Ram lai 500 diyo", ["Ram lai 500 diyo", "Ramlai 500 diyo", "Ram la 500 diyo", "Ram lay 500 diyo", "Ram ly 500 diyo"]),
        ("को (ko)", "GENITIVE", "Ram ko udhaar", ["Ram ko udhaar", "Ramko udhaar", "Ram ka udhaar", "Ram ki udhaar", "Ram ke udhaar", "Ram gko udhaar"]),
        ("मा (ma)", "LOCATIVE", "pasal ma", ["pasal ma", "pasalma", "nagad ma", "nagadma", "bank ma", "bankma"]),
        ("बाट (bata)", "ABLATIVE", "Ram bata 500 aayo", ["Ram bata 500 aayo", "Shyambata 500 aayo", "Ram bata aayo 500", "supplier bata saman aayo"]),
        ("सँग (sanga)", "COMITATIVE", "sathi sanga", ["sathi sanga", "sathisanga", "Ram sanga", "Ramsanga"]),
        ("का लागि (lagi)", "PURPOSE", "kharcha ko lagi", ["kharcha ko lagi", "kharcha lagi", "ka lagi", "lagi"]),
    ]
    lines = [hdr(3, "विभक्ति / कारक", "Postpositions / Case Markers"), "KEY POSTPOSITIONS (often written joined in chat):\n\n"]
    for dev, func, example, vars_ in posts:
        lines.append(f"{dev} — {func}\n")
        lines.append(f"  Example: {example}\n")
        lines.append("  Variations:\n")
        lines.append(var_lines(*vars_))
        lines.append("\n")
    lines.append("TABLE:\n")
    table = [
        ("le", "agent/doer", "Ram le kinyo", ["Ram kinyo", "Ramle kinyo", "kinyo Ram le"]),
        ("lai", "recipient", "Ram lai diyo", ["Ram lai diyo", "Ramlai diyo", "Ram 500"]),
        ("ko", "possessive", "Ram ko udhaar", ["Ramko udhaar", "Ram ko udhaar"]),
        ("ma", "location/mode", "nagad ma", ["nagadma", "nagad ma"]),
        ("bata", "source", "Shyam bata aayo", ["Shyambata aayo", "Shyam bata aayo"]),
    ]
    lines.append("Postposition | Function | Example | Halkhabar variations\n")
    for post, func, ex, vars_ in table:
        lines.append(f"{post} | {func} | {ex}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def section_4() -> str:
    lines = [hdr(4, "क्रिया", "Verbs — Tense, Aspect, Honorific Conjugation")]
    lines.append("COMMON VERB ROOTS (धातु):\n")
    roots = [
        ("garnu", "to do", ["garnu", "garne", "garna", "gar"]),
        ("kinnu", "to buy", ["kinnu", "kinne", "kina", "kin"]),
        ("bechnu", "to sell", ["bechnu", "beche", "bechne", "bech"]),
        ("tirnu", "to pay", ["tirnu", "tirne", "tira", "tir"]),
        ("dinu", "to give", ["dinu", "dine", "dina", "di"]),
        ("linu", "to take", ["linu", "line", "lina", "li"]),
        ("aunu", "to come", ["aunu", "aune", "auna", "aaunu", "aaunus", "aunus", "aau"]),
        ("jannu", "to go", ["jannu", "janus", "jaanus", "ja"]),
        ("hunu", "to be", ["hunu", "hune", "huna", "ho"]),
        ("kharcha garnu", "to spend", ["kharcha garnu", "kharcha garne", "kharcha garyo"]),
        ("paunu", "to get/receive", ["paunu", "paune", "paaunu", "paau"]),
    ]
    for root, meaning, vars_ in roots:
        lines.append(f"{root} = {meaning}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nPRESENT HABITUAL (ma/timi/tapai):\n")
    present = [
        ("ma garchu", ["ma garchu", "garchu", "ma garxu", "ma garchu ni"]),
        ("timi garchau", ["timi garchau", "timi garxau", "timile garchau"]),
        ("tapai garnuhuncha", ["tapai garnuhuncha", "tapain garnuhuncha", "tapainle garnuhuncha"]),
        ("u garcha", ["u garcha", "ule garcha", "u garxa", "u garcha ni"]),
    ]
    for std, vars_ in present:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nPAST (simple completed):\n")
    past = [
        ("maile gare / garyo / gareko", ["maile gare", "maile garyo", "maile gareko", "ma le garyo", "male garyo"]),
        ("timile garyau", ["timile garyau", "timi le garyau", "timle garyau"]),
        ("Ram le garyo / gyo / vayo", ["Ram le garyo", "Ramle garyo", "Ram le gyo", "Ram le vayo", "Ram le bhayo", "Ram le gayo", "Ram le gya"]),
    ]
    for std, vars_ in past:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nVariants: garyo\n")
    lines.append(var_lines("gyo", "gayo", "gya", "vayo", "bhayo", "garyoo", "gare"))
    lines.append("\nNEGATIVE:\n")
    neg = [
        ("chha/cha/xa (is/exists)", ["chha", "cha", "xa", "xha", "chhaa", "ho"]),
        ("xaina/chhaina/chaina (is not)", ["xaina", "chhaina", "chaina", "xain", "chhain", "chain"]),
        ("garchu → gardina", ["gardina", "gardina ma", "garchu xaina"]),
        ("garyo → garyena", ["garyena", "gareko xaina", "gareko chaina"]),
    ]
    for std, vars_ in neg:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nHONORIFIC (formal):\n")
    honor = [
        ("garnuhos / garnus / garnuhuncha", ["garnuhos", "garnus", "garnuhuncha", "garnus ta", "garnuhos hai"]),
        ("khanuhos", ["khanuhos", "khanus", "khanuhuncha"]),
        ("aunu → aaunus / aunus", ["aaunus", "aunus", "aaunu", "aunu", "aunus hai", "pheri aaunus"]),
        ("janus / jaanus", ["janus", "jaanus", "jaunus", "jannus"]),
        ("tirnubhayo", ["tirnubhayo", "tirnubhayo tapainle", "tirnu bhayo"]),
    ]
    for std, vars_ in honor:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nKEY FINANCIAL VERBS (past forms AI must recognize):\n")
    fin = [
        ("kinnu", ["kinyo", "kineko", "kiniyo", "kine", "kinna", "kharid garyo", "kharid gareko"]),
        ("bechnu", ["bechyo", "becheko", "beche", "bikyo", "bikri garyo", "sell garyo"]),
        ("tirnu", ["tiryo", "tireko", "tire", "jamayo", "jama garyo", "settle garyo"]),
        ("dinu", ["diyo", "diye", "diyeko", "diya", "die", "dia"]),
        ("linu", ["liyo", "lineko", "liyo", "liya", "liye"]),
        ("kharcha garnu", ["kharcha garyo", "kharcha gareko", "kharcha vayo", "expense garyo"]),
    ]
    for verb, vars_ in fin:
        lines.append(f"{verb}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nEXAMPLES:\n")
    ex = [
        ("Standard:  रामले ५०० तिर्यो", ["Ram le 500 tiryo", "Ramle 500 tiryo"]),
        ("Roman:", ["ram le 500 tiryo", "ram 500 tiryo", "ram le paach saya tiryo"]),
        ("Halkhabar:", ["ram 500 tiryo ta", "500 tiryo ram le", "500 tiryo ram", "ram 500 tiryo ni"]),
    ]
    for label, vars_ in ex:
        lines.append(f"{label}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def deep_expand_condensed_sections() -> str:
    """Load sections 5-25 from condensed file and deeply expand all variant lists."""
    text = CONDENSED.read_text(encoding="utf-8")
    parts = text.split(DELIM)
    out: list[str] = []
    for part in parts:
        m = re.search(r"खण्ड\s+(\d+):", part)
        if not m:
            continue
        n = int(m.group(1))
        if n < 5 or n > 25:
            continue
        expanded = deep_expand_section(part.strip(), n)
        out.append(f"\n{DELIM}\n{expanded}\n")
    return "".join(out)


def deep_expand_section(section: str, section_num: int) -> str:
    """Aggressively expand slash/comma variant lists to individual → lines."""
    lines_out: list[str] = []
    for line in section.splitlines():
        stripped = line.strip()
        # Halkhabar slash lists: "a / b / c"
        if " / " in line and not line.strip().startswith("→"):
            left, _, right = line.partition(":")
            if " / " in right and "=" not in right and "|" not in right:
                variants = [v.strip() for v in right.split(" / ")]
                if len(variants) >= 2 and all(len(v) < 80 for v in variants):
                    lines_out.append(left + ":" if left.strip() else line.split(" / ")[0])
                    for v in variants:
                        lines_out.append(f"→ {v}")
                    continue
        # Slash without spaces: word/word/word
        if re.search(r"\b[a-zA-Z]{2,}/[a-zA-Z]{2,}", line) and "→" not in line and "|" not in line and "=" in line:
            m = re.match(r"^(\s*)(.+?)=(.+)$", line)
            if m:
                indent, left, right = m.groups()
                if "/" in right:
                    lines_out.append(f"{indent}{left.strip()}=")
                    for v in right.split("/"):
                        lines_out.append(f"{indent}→ {v.strip()}")
                    continue
        # Comma-separated on descriptive lines: "a, b, c = meaning"
        if "/" in stripped or ("," in stripped and "=" in stripped):
            m = re.match(r"^(.+?)\s*=\s*(.+)$", stripped)
            if m and ("/" in m.group(1) or ("," in m.group(1) and len(m.group(1)) < 100)):
                left = m.group(1)
                meaning = m.group(2)
                sep = "/" if "/" in left else ","
                variants = [v.strip() for v in left.split(sep)]
                if len(variants) >= 2:
                    lines_out.append(f"{variants[0]} = {meaning}")
                    for v in variants:
                        lines_out.append(f"→ {v}")
                    continue
        # Arrow with comma list: "x → a, b, c"
        if "→" in line and "," in line:
            before, _, after = line.partition("→")
            if "," in after and len(after) < 120:
                lines_out.append(before.rstrip())
                for item in after.split(","):
                    lines_out.append(f"→ {item.strip()}")
                continue
        # Pipe table rows — expand variant column
        if "|" in line and not line.strip().startswith("-") and "Canonical" not in line:
            cols = [c.strip() for c in line.split("|")]
            if len(cols) >= 3 and "," in cols[1]:
                lines_out.append(f"{cols[0]} | {cols[2]}")
                for v in cols[1].split(","):
                    lines_out.append(f"→ {v.strip()}")
                continue
        lines_out.append(line)
    body = "\n".join(lines_out)
    # Append section-specific expansion blocks
    extra = SECTION_EXTRAS.get(section_num, "")
    return body + extra


# Additional verbatim-only expansion blocks appended to condensed sections
SECTION_EXTRAS: dict[int, str] = {}


def _init_section_extras() -> None:
    """Populate SECTION_EXTRAS with exhaustive variation blocks."""
    SECTION_EXTRAS[5] = _section_5_extra()
    SECTION_EXTRAS[6] = _section_6_extra()
    SECTION_EXTRAS[7] = _section_7_extra()
    SECTION_EXTRAS[8] = _section_8_extra()
    SECTION_EXTRAS[9] = _section_9_extra()
    SECTION_EXTRAS[11] = _section_11_extra()
    SECTION_EXTRAS[12] = _section_12_extra()
    SECTION_EXTRAS[14] = _section_14_extra()
    SECTION_EXTRAS[15] = _section_15_extra()
    SECTION_EXTRAS[16] = _section_16_extra()
    SECTION_EXTRAS[17] = _section_17_extra()
    SECTION_EXTRAS[18] = _section_18_extra()
    SECTION_EXTRAS[19] = _section_19_extra()
    SECTION_EXTRAS[20] = _section_20_extra()
    SECTION_EXTRAS[21] = _section_21_extra()
    SECTION_EXTRAS[22] = _section_22_extra()
    SECTION_EXTRAS[23] = _section_23_extra()
    SECTION_EXTRAS[24] = _section_24_extra()
    SECTION_EXTRAS[25] = _section_25_extra()


def _section_24_extra() -> str:
    ambiguous = [
        ("diyo/diye (gave)", [
            "Ram le Shyam lai 500 diyo = Ram gave 500 to Shyam (payment OUT or credit given)",
            "500 diyo = gave 500 (direction needs party name)",
            "Ram lai 500 diyo = gave 500 to Ram",
            "Shyam le 500 diyo = Shyam gave 500",
        ]),
        ("liyo/lineko (took/received)", [
            "Ram le 500 liyo = Ram took/received 500",
            "Shyam bata 500 liyo = received 500 from Shyam",
            "Ram le udhaar liyo = Ram took on credit",
            "500 liyo Ram le = Ram received 500",
        ]),
        ("pathayo/pathyo (sent)", [
            "Ram le 500 pathayo = Ram sent 500 (payment out)",
            "Ram le saman pathayo = Ram sent goods",
            "500 pathayo = sent 500",
        ]),
        ("500 paisa AMBIGUITY", [
            '"500 paisa" = Rs 500 (NOT 500 paisa coins) in Nepal business speech',
            '"500 ko saman" = goods worth 500',
            '"500 tiryo" = paid 500 (need who/from whom from context)',
            '"500 diyo" = gave 500 (need recipient from context)',
        ]),
    ]
    lines = ["\n\nAMBIGUITY RESOLUTION — EXPANDED EXAMPLES:\n"]
    for label, examples in ambiguous:
        lines.append(f"{label}:\n")
        lines.append(var_lines(*examples))
    rules = [
        "Party name + amount + verb → extract party, amount, verb",
        "udhaar + becheko/diye = credit sale",
        "udhaar + tiryo = payment received",
        "kinyo/kineko without udhaar = likely cash purchase",
        "kharcha/expense keyword → expense intent",
        "talab/salary keyword → salary intent",
        "nagad/cash keyword → cash transaction",
        "credit/udhaar keyword + diye → credit sale or credit given",
    ]
    lines.append("\nRESOLUTION RULES FOR AI:\n")
    for i, rule in enumerate(rules, 1):
        lines.append(f"{i}. {rule}\n")
        lines.append(f"→ {rule}\n")
    return "".join(lines)


def _section_25_extra() -> str:
    regions = [
        ("EASTERN NEPAL — dukaan", ["dukaan", "dukan", "shop", "pasal"]),
        ("EASTERN — kitna/jama", ["kitna", "jama", "jama garyo", "kitna paisa"]),
        ("WESTERN — ho instead of cha", ["ramro ho", "thik ho", "kasto ho", "ramro cha"]),
        ("TERAI — kiya/pata", ["kiya", "pata", "kiya tha", "pata xaina", "lagta hai"]),
        ("TERAI — dukaan/accha", ["dukaan", "accha", "accha thik", "bahut ramro"]),
        ("KATHMANDU — code-switch", ["payment garyo", "cash sale", "balance kati", "entry garyo"]),
    ]
    lines = ["\n\nREGIONAL VARIANT EXAMPLES:\n"]
    for label, vars_ in regions:
        lines.append(f"{label}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nAI RULE: Accept all regional variants; normalize to standard lemma before intent classification.\n")
    lines.append("Do not reject Hindi-mixed input as invalid Nepali.\n")
    return "".join(lines)


def _section_5_extra() -> str:
    times = [
        ("आज", ["aaja", "aja", "ajha", "ajj", "aaj", "today"]),
        ("हिजो", ["hijo", "kal", "kaliko", "yesterday"]),
        ("भोलि", ["bholi", "parsi", "tomorrow"]),
        ("अहिले", ["ahile", "ahilei", "ahilai", "now"]),
        ("बिहान", ["bihana", "bihan", "morning"]),
        ("बेलुका", ["beluka", "beluka", "saaj", "sanjh", "evening"]),
    ]
    lines = ["\n\nEXPANDED TIME WORD VARIATIONS:\n"]
    for dev, vars_ in times:
        lines.append(f"{dev}\n")
        lines.append(var_lines(*vars_))
    tx = [
        ("aaja ko bikri 5000", ["aja ko bikri 5000", "aaj ko bikri 5000", "ajha ko bikri 5000"]),
        ("hijo Ram le tiryo", ["hijo ram le tiryo", "kal Ram le tiryo", "hijo ram tiryo"]),
        ("bholi tirna parcha", ["parsi tirna parcha", "bholi tirnu parcha", "volti tirna parcha"]),
        ("ahile 500 diyo", ["ahile 500 diye", "ahile 500 diyo", "aile 500 diyo"]),
    ]
    lines.append("\nTRANSACTION TIME EXAMPLES:\n")
    for std, vars_ in tx:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_8_extra() -> str:
    adj = [
        ("ramro", ["ramro", "ramro cha", "ramro xa", "ramro ho"]),
        ("naramro", ["naramro", "naramro cha", "kharab"]),
        ("thulo", ["thulo", "thulo amount", "thulo paisa", "dherai thulo"]),
        ("sano", ["sano", "sano paisa", "sanai"]),
        ("dherai", ["dherai", "dherai dherai", "dammi dherai", "ekdam dherai"]),
        ("thorai", ["thorai", "thore", "ali thorai", "thorai matra"]),
        ("sasto", ["sasto", "sasta", "sasto cha"]),
        ("mahango", ["mahango", "mahangi", "mahango cha"]),
        ("sanchai", ["sanchai", "sanchai cha", "sanchai xa", "sanchai nai"]),
        ("thik", ["thik", "thik cha", "thik xa", "thik nai"]),
    ]
    lines = ["\n\nADJECTIVE VARIANTS:\n"]
    for word, vars_ in adj:
        lines.append(f"{word}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_9_extra() -> str:
    adv = [
        ("yaha", ["yaha", "yeta", "here", "yahi"]),
        ("tyaha", ["tyaha", "tyata", "there", "tya"]),
        ("chhito", ["chhito", "chito", "chhito chhito", "xito"]),
        ("bistarai", ["bistarai", "bistari", "slowly", "bistarai gara"]),
        ("ekdam", ["ekdam", "dammi", "ekdum", "dherai"]),
        ("sadhai", ["sadhai", "sadai", "hamesha", "always"]),
        ("dailai", ["dailai", "daily", "har din", "prati din"]),
        ("kahile pani", ["kahile pani", "sometimes", "kahi kahi"]),
    ]
    lines = ["\n\nADVERB VARIANTS:\n"]
    for word, vars_ in adv:
        lines.append(f"{word}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_7_extra() -> str:
    nouns = [
        ("pasal", ["pasal", "dukaan", "shop", "pasalharu"]),
        ("saman", ["saman", "mal", "goods", "stock", "maal"]),
        ("grahak", ["grahak", "customer", "customerharu", "client"]),
        ("khata", ["khata", "hisab", "ledger", "account"]),
        ("paisa", ["paisa", "rupiya", "money", "rs"]),
    ]
    lines = ["\n\nNOUN VARIANTS:\n"]
    for word, vars_ in nouns:
        lines.append(f"{word}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_11_extra() -> str:
    orders = [
        ("SOV Standard: maile Ram lai 500 diye", ["maile Ram lai 500 diye", "Maile Ramlai 500 diye"]),
        ("Amount-first: 500 diyo Ram lai", ["500 diyo Ram lai", "500 diye ram lai", "500 tiryo ram le"]),
        ("Subject-verb-amount: Ram 500 tiryo", ["Ram 500 tiryo", "ram 500 tiryo", "Ram tiryo 500"]),
        ("Verb-first: tiryo 500 Ram le", ["tiryo 500 Ram le", "tiryo 500 ram le", "kinyo 500 ko saman"]),
        ("Minimal: 500 tiryo", ["500 tiryo", "500 kinyo", "500 diyo", "500 kharcha"]),
    ]
    lines = ["\n\nFLEXIBLE WORD ORDER EXAMPLES:\n"]
    for label, vars_ in orders:
        lines.append(f"{label}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_6_extra() -> str:
    questions = [
        ("के हो?", ["ke ho?", "ke ho ta?", "k ho?", "k ho ta?"]),
        ("तपाईंको नाम के हो?", ["tapai ko naam ke ho?", "tapainko naam ke ho?", "tapain ko naam k ho?", "tapai ko name ke ho?", "timro naam ke ho?", "timi ko naam ke ho?"]),
        ("कति हो?", ["kati ho?", "kati ho ta?", "kitna ho?", "kati cha?", "kati xa?"]),
        ("कहाँ हो?", ["kaha ho?", "kahan ho?", "kaha cha?", "kaha xa?"]),
        ("किन?", ["kina?", "kyun?", "kina ho?", "kina ta?"]),
        ("Ram ko udhaar kati cha?", ["Ram ko udhaar kati xa?", "Ram ko udhar kati cha?", "Ram ko udhaar kitna cha?", "ram ko udhaar kati ho?"]),
    ]
    lines = ["\n\nEXPANDED QUESTION VARIATIONS:\n"]
    for std, vars_ in questions:
        lines.append(f"Standard: {std}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_12_extra() -> str:
    nums = []
    for i, (word, alts) in enumerate([
        ("ek", ["ek", "one", "1"]), ("dui", ["dui", "do", "two", "2"]),
        ("tin", ["tin", "teen", "three", "3"]), ("char", ["char", "chaar", "four", "4"]),
        ("panch", ["panch", "paanch", "five", "5"]), ("chha", ["chha", "cha", "six", "6"]),
        ("saat", ["saat", "sat", "seven", "7"]), ("aath", ["aath", "aat", "eight", "8"]),
        ("nau", ["nau", "no", "nine", "9"]), ("das", ["das", "dus", "ten", "10"]),
        ("saya", ["saya", "sau", "hundred", "100"]), ("hajar", ["hajar", "hazar", "thousand", "1000"]),
        ("lakh", ["lakh", "lac", "100000"]),
    ], 1):
        nums.append(f"{word}\n")
        nums.append(var_lines(*alts))
    teens = [
        ("ekchali", ["11"]), ("barha", ["12"]), ("terha", ["13"]), ("chaudha", ["14"]),
        ("panchdha", ["15"]), ("sorha", ["16"]), ("satra", ["17"]), ("athara", ["18"]),
        ("unnais", ["19"]), ("bis", ["20"]), ("pachchis", ["25"]), ("tis", ["30"]),
        ("pachas", ["50"]), ("sathi", ["60"]), ("sattari", ["70"]), ("assi", ["80"]),
        ("nabbe", ["90"]),
    ]
    nums.append("\nTENS AND TEENS:\n")
    for word, alts in teens:
        nums.append(f"{word}\n")
        nums.append(var_lines(*alts))
    return "\n\nCARDINAL NUMBER VARIANTS:\n" + "".join(nums)


def _section_14_extra() -> str:
    examples = [
        ("Standard:  रामले पाँच सय किनyo", ["ram le 500 kinyo ta", "ram 500 kinyo", "500 kinyo ram le", "Ramle 500 kinyo", "ram 500 kinyo ni"]),
        ("Standard:  के छ?", ["k xa", "k cha ta", "k cha hai", "ke cha", "k xa ta", "k ho"]),
        ("Standard:  मलाई थाहा छैन", ["thaha xaina", "thaha chaina", "pata xaina", "pata chaina", "malai thaha xaina", "thaha xain"]),
        ("Standard:  रामले तिर्यो", ["ram le tiryo ta", "ram 500 tiryo", "500 tiryo ram", "tiryo ni ram le"]),
        ("Standard:  आउनुहोस्", ["aaunus", "aunus", "aau", "aaunu", "aunu", "pheri aaunus"]),
    ]
    lines = ["\n\nHALKHABAR TRANSFORMATION EXAMPLES:\n"]
    for std, vars_ in examples:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_16_extra() -> str:
    mixes = [
        ("payment garyo", ["payment gareko", "payment garyo ta", "500 payment garyo", "Ram le payment garyo"]),
        ("payment received", ["payment aayo", "payment received garyo", "payment milayo", "payment aayeko xa"]),
        ("cash sale garyo", ["cash sale gareko", "cash sale vayo", "cash sale 5000 garyo"]),
        ("credit diye", ["credit diye", "credit sale garyo", "credit ma diye", "credit 500 diye"]),
        ("busy xu", ["busy chu", "busy cha", "busy xu ta", "busy chu ni"]),
        ("stock kinyo", ["inventory kineko", "stock kineko", "stock kinyo", "stock purchase garyo"]),
        ("expense record garyo", ["expense garyo", "expense record gareko", "expense entry garyo"]),
        ("balance kati cha?", ["balance kati xa?", "balance kitna?", "kati balance cha?", "balance kati ho?"]),
        ("entry garne", ["entry gareko", "entry garyo", "entry garnu", "ledger entry garyo"]),
        ("VAT tiryo IRD lai", ["VAT payment garyo", "VAT tiryo", "IRD lai VAT diyo", "VAT settle garyo"]),
        ("supplier lai payment gareko", ["supplier lai payment garyo", "supplier payment gareko", "supplier lai 500 diye"]),
        ("aaja ko cash sale 5000 vayo", ["aja ko cash sale 5000 vayo", "aaja cash sale 5000", "cash sale aaja 5000 vayo"]),
    ]
    lines = ["\n\nCODE-SWITCH EXAMPLE VARIANTS:\n"]
    for std, vars_ in mixes:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_17_extra() -> str:
    hindi = [
        ("kitna paisa tiryo?", ["kitna tiryo?", "kitna paisa diye?", "kitna payment garyo?", "kati paisa tiryo?"]),
        ("pata xaina", ["pata chaina", "pata xain", "pata nai xaina", "malai pata xaina"]),
        ("Ram ne 500 diya", ["Ram ne 500 diye", "Ram ne 500 diyo", "Ram le 500 diya", "Ram ne paisa diya"]),
        ("dukaan ma saman aayo", ["dukaan ma maal aayo", "dukaan ma stock aayo", "pasal ma saman aayo"]),
        ("kiya tha?", ["ke thiyo?", "kiya tha ta?", "k tha?", "ke thiyo ta?"]),
        ("accha thik", ["accha", "thik accha", "accha hai", "thik hai"]),
        ("bahut dherai", ["bahut", "dherai bahut", "bahut kharcha", "dherai paisa"]),
        ("jama garyo", ["jama bhayo", "jama vayo", "jama entry garyo", "jama tiryo"]),
        ("aaya paisa", ["aaye paisa", "paisa aaya", "paisa aaye", "500 aaya"]),
        ("karna cha", ["garne cha", "karna ho", "karne ho", "garnu cha"]),
    ]
    lines = ["\n\nHINDI-Nepali MIX VARIANTS:\n"]
    for std, vars_ in hindi:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_15_extra() -> str:
    """All romanization spelling aliases from e-Khata normalization layer."""
    alias_groups = [
        ("chha/cha/xa/xha", ["chha", "cha", "xa", "xha", "chhaa", "xu", "ho"]),
        ("xaina/chhaina/chaina", ["xaina", "chhaina", "chaina", "xain", "chhain"]),
        ("vayo/bhayo/gyo/gayo/gya", ["vayo", "bhayo", "gyo", "gayo", "gya", "vayeko", "bhayeko"]),
        ("kinyo/kineko/kiniyo/kine", ["kinyo", "kineko", "kiniyo", "kine", "kinna", "kharid garyo"]),
        ("becheko/bechyo/beche/bikyo", ["becheko", "bechyo", "beche", "bikyo", "bikri garyo"]),
        ("tiryo/tireko/tire/jamayo", ["tiryo", "tireko", "tire", "tiryoo", "jamayo", "jama garyo", "aayo"]),
        ("udhaar/udhar/udharo/udaar", ["udhaar", "udhar", "udharo", "udaar", "udhhar", "udhaaro", "credit"]),
        ("nagad/nakad/nagat/nakit", ["nagad", "nakad", "nagat", "nakit", "cash", "kesh"]),
        ("aaja/aja/ajha/ajj", ["aaja", "aja", "ajha", "ajj", "aaj"]),
        ("tapai/tapain", ["tapai", "tapain", "tapainle", "tapainko"]),
        ("aaunus/aunus/aunu", ["aaunus", "aunus", "aunu", "aaunu", "pheri aaunus"]),
    ]
    lines = ["\n\nCOMPLETE ROMANIZATION ALIAS GROUPS:\n"]
    for label, vars_ in alias_groups:
        lines.append(f"{label}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_18_extra() -> str:
    vocab = [
        ("paisa", ["paisa", "rupiya", "rs", "npr", "rupees", "rupya", "rupiye", "रु"]),
        ("udhaar", ["udhaar", "udhar", "udharo", "udaar", "credit", "karz", "karja"]),
        ("nagad", ["nagad", "nakad", "nakit", "cash", "kesh", "nagat"]),
        ("hisab", ["hisab", "hisaab", "kitab", "khata", "ledger", "account"]),
        ("kharcha", ["kharcha", "kharcho", "karcha", "expense", "kharch"]),
        ("talab", ["talab", "salary", "salary payment", "staff payment"]),
        ("kharid", ["kharid", "kineko", "kinyo", "purchase", "kiniyo"]),
        ("bikri", ["bikri", "becheko", "bechyo", "sale", "sold"]),
        ("tirnu", ["tirnu", "tiryo", "jama", "jamayo", "bhugtan", "payment"]),
        ("baaki", ["baaki", "baki", "remaining", "outstanding", "balance"]),
        ("naafa", ["naafa", "profit", "naafaa"]),
        ("ghaata", ["ghaata", "loss", "noksan", "ghataa"]),
        ("rasid", ["rasid", "rasi", "bill", "invoice", "receipt"]),
        ("jamma", ["jamma", "total", "jammaa"]),
    ]
    lines = ["\n\nFINANCIAL VOCABULARY — ALL VARIANTS:\n"]
    for word, vars_ in vocab:
        lines.append(f"{word}\n")
        lines.append(var_lines(*vars_))
    distinctions = [
        ("udhaar deko/becheko/diye = CREDIT SALE", ["udhaar deko", "udhaar becheko", "udhaar diye", "udhar ma becheko", "credit diye"]),
        ("udhaar tiryo/jamayo = PAYMENT RECEIVED", ["udhaar tiryo", "udhaar jamayo", "udhaar bujhayo", "udhar tiryo"]),
        ("udhaar liyo/kinyo = CREDIT PURCHASE", ["udhaar liyo", "udhaar kinyo", "udhaar ma kinyo", "credit ma kinyo"]),
        ("bad debt / nasakne / write off", ["nasakne udhaar", "bad debt", "write off", "udhaar nasakne"]),
    ]
    lines.append("\nCRITICAL SEMANTIC DISTINCTIONS:\n")
    for label, vars_ in distinctions:
        lines.append(f"{label}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_19_extra() -> str:
    phrases = [
        ("namaste", ["namaste", "namaskar", "namaskaar", "hello", "hi", "hey"]),
        ("ke cha / k xa", ["ke cha", "k xa", "k cha", "ke cha ta", "k xa ta"]),
        ("thik xa", ["thik xa", "thik cha", "thik chha", "sab thik", "ramro xa"]),
        ("dhanyabad", ["dhanyabad", "dhanybaad", "thanks", "thank you", "shukriya"]),
        ("thaha xaina", ["thaha xaina", "thaha chaina", "pata xaina", "pata chaina", "malai thaha xaina"]),
        ("hunchha", ["hunchha", "hunxa", "ho", "huncha", "hune"]),
        ("garchu", ["garchu", "garchu ni", "garxu", "garchu ta"]),
        ("parkhanus", ["parkhanus", "parkha", "parkhanus hai", "ekchhin parkhanus"]),
        ("Alvida! Kei chahiye bela pheri aaunus.", ["Alvida! Kei chahiye bela pheri aaunus.", "pheri aaunus", "aaunus", "aunus"]),
    ]
    lines = ["\n\nDAILY EXPRESSION VARIANTS:\n"]
    for std, vars_ in phrases:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_20_extra() -> str:
    compounds = [
        ("phone garnu", ["phone garyo", "phone garne", "call garnu", "call garyo"]),
        ("hisab garnu", ["hisab garyo", "hisaab garnu", "account garnu", "ledger check garnu"]),
        ("entry garnu", ["entry garyo", "entry garne", "entry gareko", "record garnu"]),
        ("check garnu", ["check garyo", "check garne", "verify garnu", "hernu"]),
        ("nagad bikri", ["nagad bikri", "cash bikri", "nakit bikri", "cash sale"]),
        ("udhaar bikri", ["udhaar bikri", "credit bikri", "udhar bikri", "credit sale"]),
        ("hisaab kitab", ["hisaab kitab", "hisab kitab", "account books", "ledger"]),
        ("paisa jamma", ["paisa jamma", "jamma paisa", "total paisa", "total amount"]),
    ]
    idioms = [
        ("pet bharyo", ["pet bharyo", "pet bhariyo", "dherai khaye"]),
        ("man lagyo", ["man lagyo", "ramro lagyo", "maja aayo"]),
        ("bhok lagyo", ["bhok lagyo", "bhok lageko", "bhok lage"]),
        ("thakyo", ["thakyo", "thakiyeko", "thakna lageko"]),
        ("samjhana aayo", ["samjhana aayo", "yaad aayo", "samjhiyo"]),
    ]
    lines = ["\n\nCOMPOUND VERB VARIANTS:\n"]
    for std, vars_ in compounds:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    lines.append("\nIDIOM VARIANTS:\n")
    for std, vars_ in idioms:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def _section_21_extra() -> str:
    """Full sentence transformation triples — every Halkhabar variant on its own line."""
    patterns = [
        ("CREDIT SALE (udhaar bikri)", "रामलाई पाँच सय उधारमा बेचेको", "Ram lai 500 udhaar ma becheko",
         ["ram lai 500 udhaar diye", "500 udhaar ma becheko ram lai", "Ram lai udhaar ma 500 ko saman diye",
          "ram lai 500 udhaar diye ta", "500 udhaar ram lai", "Ram lai credit ma 500 diyo", "ram lai credit 500"]),
        ("PAYMENT RECEIVED (tiryo/jama)", "रामले पाँच सय तिर्यो", "Ram le 500 tiryo",
         ["ram 500 tiryo", "500 tiryo ram bata", "ram bata 500 aayo", "Ramle 500 tiryo", "500 tiryo ram le",
          "ram ko udhaar tiryo", "Ram le 500 jamayo", "500 Ram le diye", "ram 500 tiryo ta"]),
        ("CASH PURCHASE", "पाँच सयको सामान किनेको", "500 ko saman kineko",
         ["500 ko saman kinyo", "saman kinyo 500 ko", "Ram le 500 ko saman kinyo", "500 kinyo", "Ramle saman kinyo 500 ko"]),
        ("PAYMENT OUT", "रामलाई पाँच सय तिरे", "Ram lai 500 tire",
         ["ram lai 500 diyo", "500 payment garyo", "payment gareko Ram lai", "Ram lai 500 diye", "500 diyo ram lai"]),
        ("EXPENSE", "बिजुली खर्च पाँच सय", "bijuli kharcha 500",
         ["500 kharcha bijuli ko", "bijuli ko 500 kharcha garyo", "bijuli kharcha 500 vayo", "500 bijuli kharcha", "light bill 500"]),
        ("SALARY", "तलब पाँच हजार दिए", "talab 5000 diye",
         ["5000 talab diyo", "talab diyo 5000", "staff lai 5000 salary diye", "5000 salary payment garein", "25 hajar talab diye"]),
        ("CASH SALE", "नगदमा पाँच सय बेचे", "nagad ma 500 becheko",
         ["cash ma 500 becheko", "500 nakit ma bechein", "500 ko chai cash ma bechyo", "nagad 500 ma bechein"]),
        ("LOAN RECEIVED", "रामबाट सापो लिए", "Ram bata saapo liye",
         ["Ram bata 10000 saapo liye", "10k loan liye Ram bata", "loan liye Ram le diyeko", "bank bata loan liye"]),
    ]
    lines = ["\n\nFULL SENTENCE TRANSFORMATION TRIPLES (Standard / Roman / Halkhabar):\n\n"]
    for title, dev, roman, halkhabar in patterns:
        lines.append(f"--- {title} ---\n")
        lines.append(f"Standard (Devanagari): {dev}\n")
        lines.append(f"Roman: {roman}\n")
        lines.append("Halkhabar:\n")
        lines.append(var_lines(*halkhabar))
        lines.append("\n")
    return "".join(lines)


def _section_22_extra() -> str:
    typos = [
        ("tiryo", ["tiro", "tirya", "tiry", "tiryo"]),
        ("kinyo", ["kino", "kiny", "kinjo", "kinyo"]),
        ("udhaar", ["udar", "udhr", "udhar", "udhaar", "udaro"]),
        ("becheko", ["bechko", "becheko", "bechyo", "becheko"]),
        ("garyo", ["garyoo", "gareo", "garyo", "garo"]),
        ("diye", ["diyee", "die", "diye", "dia"]),
        ("paisa", ["pais", "paisa", "paise", "pyasa"]),
        ("rupiya", ["rupya", "rupiye", "rupiya", "rupiah"]),
        ("kharcha", ["kharch", "karcha", "kharcha", "kharcho"]),
        ("chha", ["cha", "xa", "xha", "chha"]),
    ]
    lines = ["\n\nTYPO → CORRECT FORM PAIRS:\n"]
    for correct, variants in typos:
        lines.append(f"Correct: {correct}\n")
        lines.append(var_lines(*variants))
    lines.append("\nAI RULE: Use fuzzy matching — if 80% similar to known financial verb + amount, treat as transaction.\n")
    return "".join(lines)


def _section_23_extra() -> str:
    idioms = [
        ("paisa aayo", ["paisa aayo", "paisa aayeko", "money aayo", "500 aayo"]),
        ("paisa gayo", ["paisa gayo", "paisa gako", "money gayo", "kharcha bhayo"]),
        ("paisa fasyo", ["paisa fasyo", "paisa faseko", "money stuck", "udhaar ma fasyo"]),
        ("hisaab milnu", ["hisaab milnu", "hisab milaunu", "accounts reconcile", "hisab milayo"]),
        ("udhaar badhyo", ["udhaar badhyo", "udhar badhyo", "credit badhyo", "baaki badhyo"]),
        ("udhaar ghatayo", ["udhaar ghatayo", "udhar ghatyo", "credit ghatayo", "baaki ghatayo"]),
    ]
    lines = ["\n\nMONEY FLOW IDIOM VARIANTS:\n"]
    for std, vars_ in idioms:
        lines.append(f"{std}\n")
        lines.append(var_lines(*vars_))
    return "".join(lines)


def section_26() -> str:
    """All 15 NLU rules verbatim (Rules 1-10 core + 11-15 extended)."""
    rules_text = CONDENSED.read_text(encoding="utf-8")
    m = re.search(
        r"(खण्ड 26:.*?)(?=\n" + re.escape(DELIM) + r")",
        rules_text,
        re.DOTALL,
    )
    base = m.group(1).strip() if m else ""
    # Expand rule equivalence lines
    expanded_lines: list[str] = []
    for line in base.splitlines():
        if " = " in line and "→" not in line and "RULE" not in line:
            parts = line.split(" = ", 1)
            if len(parts) == 2 and "/" not in parts[0]:
                expanded_lines.append(line)
                continue
        if " = " in line and any(c in line for c in "= ") and "→" not in line:
            left, right = line.split(" = ", 1)
            if "→" in right:
                expanded_lines.append(f"{left} =")
                for item in right.split("→"):
                    item = item.strip()
                    if item:
                        expanded_lines.append(f"→ {item}")
                continue
        if "→" in line and "," in line.split("→", 1)[1]:
            before, after = line.split("→", 1)
            expanded_lines.append(before.rstrip())
            for item in after.split(","):
                expanded_lines.append(f"→ {item.strip()}")
            continue
        expanded_lines.append(line)
    body = "\n".join(expanded_lines)
    extra = """

RULE EXPANSION — ACCEPTED FORM LISTS (verbatim):

RULE 1 — COPULA EQUIVALENCE:
→ chha
→ cha
→ xa
→ xha
→ chhaa
→ ho
→ xu

RULE 2 — NEGATION EQUIVALENCE:
→ xaina
→ chhaina
→ chaina
→ xain
→ chhain

RULE 3 — POSTPOSITION OPTIONAL:
→ Ram le 500 kinyo
→ Ram 500 kinyo
→ 500 kinyo Ram le
→ Ramle 500 kinyo

RULE 4 — WORD ORDER FLEXIBLE:
→ 500 tiryo Ram le
→ Ram 500 tiryo
→ tiryo 500
→ 500 kinyo

RULE 5 — PAISA = RUPEES:
→ 500 paisa
→ paanch saya paisa
→ 5 hajar
→ 2 lakh

RULE 6 — UDHAAR SEMANTICS:
→ udhaar deko
→ udhaar becheko
→ udhaar diye
→ udhaar tiryo
→ udhaar liyo
→ udhaar kinyo

RULE 7 — AGENT vs RECIPIENT:
→ Ram le tiryo
→ Ram lai 500 diyo
→ Ram bata 500 aayo

RULE 8 — FINANCIAL VERB → INTENT:
→ kinyo / kineko / kharid → purchase
→ becheko / bechyo / bikyo → sale
→ udhaar + becheko/diye → credit sale
→ tiryo / jamayo / aayo → payment received
→ diyo / diye / payment garyo → payment out
→ kharcha / expense → expense
→ talab / salary → salary

RULE 9 — CODE-SWITCH ACCEPTANCE:
→ payment garyo
→ cash sale
→ expense record garyo
→ balance kati
→ stock kinyo

RULE 10 — HINDI MIX ACCEPTANCE:
→ kitna
→ pata
→ kiya
→ dukaan
→ jama
→ accha
→ bahut

RULE 11 — NORMALIZE BEFORE PARSE:
→ lowercase
→ fold spelling aliases
→ transliterate Devanagari
→ extract numbers

RULE 12 — AMOUNT EXTRACTION:
→ 500
→ 5 hajar
→ saya
→ 2 lakh
→ Rs 500
→ रु ५००
→ ५००

RULE 13 — PARTICLE STRIPPING:
→ ni
→ ta
→ hai
→ yaar
→ re
→ nai
→ bhane
→ hola

RULE 14 — CONTEXT OVER GRAMMAR:
→ 500 tiryo
→ Ram ko udhaar
→ aaja ko bikri

RULE 15 — NEGATION & MULTI-TRANSACTION:
→ 500 tiryo xaina
→ Ram le 500 tiryo ra Shyam le 300 tiryo
"""
    return f"\n{DELIM}\n{body}{extra}\n"


def section_27() -> str:
    categories = [
        ("A", "PURCHASE / KHARID", "purchase", [
            "Ram le 500 ko saman kinyo", "Ramle paach saya ko maal kine", "500 ko stuff Ram le kinyo",
            "Ram 500 ko saman kineko", "Ramle kharid garyo 500 ko", "Ram le dal chawal kinyo hajar ko",
            "Ramle 2000 ko tarkari kine", "Ram 2k ko groceries kine", "hajar ko daal Ramle kinyo",
            "Ram le 1000 rupaiyama daal kine", "Ram bata 500 ko maal kinyo", "Ramle 5 hajar ko maal aako xa",
            "Ramle 500 ko kharid gareko xa", "Ram ne 500 ka saman kharida kiya", "Ram ko 500 ko kharid",
        ]),
        ("B", "CREDIT SALE / UDHAAR BIKRI", "credit_sale", [
            "Ram lai udhaar ma 500 ko saman diye", "Ram lai 500 udhaar diye", "Ram udhaar 500 liyo",
            "Ram lai credit ma 500 diyo", "500 ko udhaar Ram lai diye", "Ram lai 500 ko maal credit ma diye",
            "Ram khasai 500 ko maal liyo", "Ramko account ma 500 dhalne", "Ram lai 500 bujhaaidiyou",
            "Ram lai saman diye paisa pachhi tirncha vanera", "Ram lai paisa nabujhai maal diye",
            "Ram lai 500 ko maal udhaarma", "Ram le 500 ko udhaar liye", "Ram lai 500 credit diye",
            "Ram lai 500 ko account ma rakhne",
        ]),
        ("C", "PAYMENT RECEIVED / JAMA", "payment_in", [
            "Ram le 500 tiryo", "Ramle 500 paisa diye", "Ram ko paisa aayo 500", "Ram le payment garyo 500",
            "Ram le 500 bujhayo", "Ram le paisa tireko xa", "Ram ko udhaar tiryo", "Ram le 500 settle garyo",
            "500 Ram le diye", "Ram le paisa pathaayo 500", "Ram bata 500 aayo", "Ram ko 500 paayo maile",
            "Ram le finally tiryo paisa", "Ram le 1k tiryo 500 baki xa", "Ram ko udhaar tiryo",
        ]),
        ("D", "CASH SALE / NAGAD BIKRI", "cash_sale", [
            "cash ma 500 ko chai bechein", "500 ma chai becheko", "500 ko tea sell garein",
            "chai nakit ma bechein 500", "500 ko chiiya cash ma bechyo", "cash ma bechyo 500 ko saman",
            "nagad 500 ma bechein", "500 nakit liera chai diye", "chai 500 ma bechyo nakit",
            "500 chai nagi paisa liera",
        ]),
        ("E", "EXPENSE / KHARCHA", "expense", [
            "bijuli kharcha 300", "300 bijuli kharcha", "bijuli ko lagi 300 tiryo", "light bill 300 aayo",
            "300 electricity ko kharcha", "bijuli 300 ko bill tiryo", "300 bijuli kharcha vayo",
            "bijuli kharcha 300 diyo", "NEA bill 300 tiryo", "bijuli 300 paisa kharcha vayo",
            "petrol 500 ko kharcha garein", "500 ko petrol kharcha", "pasal bhada tiryo 5000",
            "bhada kharcha 5000", "rent tiryo 5000",
        ]),
        ("F", "SALARY / TALAB", "salary", [
            "staff lai salary diye 25000", "25k talab diye karmachari lai", "staff ko salary 25 hajar tiryo",
            "talab diye sab lai 25 hajar", "25000 salary payment garein", "karmachari lai 25k pay garein",
            "staff payment 25000 ko", "talab tirein sabailai 25 hajar", "salary 25 hajar diye aaja",
            "karmachari talab 25000 settle garein",
        ]),
        ("G", "LOAN / SAAPO", "loan", [
            "Ram bata 10000 saapo liye", "10k loan liye Ram bata", "Ram le loan diye 10000",
            "10 hajar saapo liye", "loan liye Ram le diyeko", "bank bata 50000 loan liye",
            "50k loan bhayo bank bata", "Ram lai 10 hajar udhar diye", "Ram ko 10k tiryo saapo",
            "saapo tiryo Ram lai 5000",
        ]),
        ("H", "STOCK / MAAL", "stock", [
            "maal aayo 5000 ko", "5k ko stock aayo", "new stock aayo 50k ko", "maal saakiyo",
            "stock out vayo", "maal baraabar sakiyo", "inventory 5000 ko kinyo",
            "store ma maal bharna 5000 ko", "godam bhari maal aayo", "maal pharkayo",
        ]),
        ("I", "VAT / TDS / TAX", "vat", [
            "13% VAT sanga 500 ko maal", "VAT sametako 500 thiyo", "500 ma VAT jodda kati huncha?",
            "VAT nikaal 500 bata", "ex-VAT price 443 VAT 57 total 500", "TDS 15% kaatyo 1000 bata",
            "150 TDS kaatyo 1000 ko payment ma", "withholding tax 15% katyo",
            "TDS katyo pheri tirnu parcha IRD ma", "VAT return file garnu parcha",
        ]),
        ("J", "BALANCE / REPORT QUERIES", "balance_query", [
            "Ram ko kati baaki xa?", "Ram lai kati diyeko thiyo?", "Ram bata kati receivable xa?",
            "Ram ko udhaar kati xa?", "kati paisa baaki xa Ramko?", "aaj ko sales kati vayo?",
            "total kharcha kati xa?", "naafa kati vayo?", "ghaata xa ki naafa xa?",
            "balance sheet ma kati asset xa?",
        ]),
        ("K", "INFORMATION REQUESTS", "info_request", [
            "Ram ko account hera", "Ram ko hisab dekhaunus", "Ram ko ledger check garnus",
            "Ram sanga kati lenden xa?", "Ram bata kati receivable xa?", "kati kasle diyeka xan?",
            "kati kasle tireka xan?", "aajko sales report dekhaunus", "monthly kharcha kati xa?",
            "profit loss dekhaunu",
        ]),
        ("L", "COMPLEX / MULTI-TRANSACTION", "multi_transaction", [
            "Ram lai 500 udhaar diye aaja ani tiryo 200 voli",
            "Ram le 500 ko maal kinyo aani 200 le return garyo",
            "Ram le ek hajar diye tin saya baaki xa",
            "Ram ko total 2000 baaki thiyo 500 tiryo 1500 xu",
            "pasal ma 5000 ko maal kinyo 3000 cash 2000 udhaar",
            "saman 10000 ko ayo 5000 nakit 5000 udhaar ma",
            "Ram lai 1000 diye 500 chai 500 momo ko",
            "Ram 1000 le kinyo 500 sell garyo baaki 500 ko maal xa",
            "aaj 5 jana customer aaye sabailai 2000 ko kharid garyo",
            "total 10000 ko bikri aaj cash 7000 udhaar 3000",
        ]),
        ("M", "INFORMAL GREETINGS + BUSINESS", "informal", [
            "dai ke xa halkhaabar? paisa tirnu paryo hai",
            "bhai 500 ko kaam gareko thiyo tyo tiryo?",
            "yaar Ram ko 1000 baaki xa bhanideu",
            "sathi payment garyo ki xaina?",
            "yaar 5k ugauna parcha Ram bata",
            "dai Ram lai bhanunu 500 tirnu parcha",
            "sathi Ram bata kati aaucha jasto lagcha?",
            "bhai aaj kaam kasto vayo kasai paisa aayo?",
            "dai aaj dherei bikri vayo 10k ko",
            "yaar naafa dherei bhayo aaj",
        ]),
    ]
    lines = [hdr(27, "५०० वटा वास्तविक-संसारका वाक्य", "500 Real-World Sentence Patterns")]
    lines.append("150 REAL-WORLD TRAINING EXAMPLES (categories A–M):\n\n")
    idx = 1
    for cat, title, intent, sentences in categories:
        lines.append(f"--- CATEGORY [{cat}] {title} (intent: {intent}) ---\n\n")
        for sent in sentences:
            lines.append(f"[{idx:03d}] {sent}\n")
            lines.append(f"→ intent: {intent}\n")
            variants = halkhabar_variants(sent)
            if variants:
                lines.append(var_lines(*variants))
            # Standard/Roman/Halkhabar annotation block
            lines.append(f"→ Standard pattern: {sent}\n")
            if "Ram" in sent:
                lines.append(f"→ Halkhabar: {sent.replace('Ram', 'ram')}\n")
            if " le " in sent:
                lines.append(f"→ Joined agent: {sent.replace(' le ', 'le ')}\n")
            if " xa" in sent or " xa?" in sent:
                lines.append(f"→ Copula variant: {sent.replace(' xa', ' cha')}\n")
            lines.append("\n")
            idx += 1
    return "".join(lines)


def halkhabar_variants(sentence: str) -> list[str]:
    """Generate common Halkhabar spelling variants for a sentence."""
    variants: list[str] = []
    base = sentence
    if base not in variants:
        variants.append(base)
    subs = [
        ("Ram le", "Ramle"), ("Ram le", "ram le"), ("Ram", "ram"),
        (" xa", " cha"), (" xa", " xha"), (" xa?", " cha?"),
        (" tiryo", " tireko"), (" kinyo", " kineko"), (" becheko", " bechyo"),
        (" diye", " diyo"), (" udhaar", " udhar"), (" nagad", " nakad"),
        (" kharcha", " kharcho"), (" vayo", " bhayo"), (" le ", " "),
    ]
    for old, new in subs:
        if old in base:
            v = base.replace(old, new, 1)
            if v not in variants:
                variants.append(v)
    if "Ram" in sentence and "ram" not in sentence.lower()[:3]:
        v = sentence.replace("Ram", "ram")
        if v not in variants:
            variants.append(v)
    return variants[1:6]  # skip duplicate base, return up to 5 variants


def section_28() -> str:
    lines = [hdr(28, "क्रिया संयुग्मन तालिका", "Complete Verb Conjugation Tables")]
    verbs = {
        "garnu (to do)": {
            "PRESENT": [
                ("ma garchu", ["ma garxu", "garchu", "ma garchu ni"]),
                ("timi garchau", ["timi garxau", "timile garchau"]),
                ("u garcha", ["ule garcha", "u garxa"]),
                ("tapai garnuhuncha", ["tapain garnuhuncha", "tapainle garnuhuncha"]),
                ("hami garchau", ["hamile garchau", "hami garxau"]),
            ],
            "PAST": [
                ("maile gare", ["maile garyo", "maile gareko", "ma le garyo"]),
                ("timile garyau", ["timi le garyau", "timle garyau"]),
                ("ule garyo", ["Ram le garyo", "u le garyo", "ule gyo"]),
                ("tapainle garnubhayo", ["tapain le garnubhayo", "tapainle garyo"]),
            ],
            "FUTURE": [
                ("ma garnechu", ["ma garne", "ma garxu hola"]),
                ("timi garnechau", ["timi garne"]),
                ("u garnecha", ["u garne"]),
                ("tapai garnuhunechau", ["tapain garnuhunechau"]),
            ],
            "NEGATIVE": [
                ("gardina", ["gardina ma", "garchu xaina"]),
                ("garyena", ["gareko chaina", "garyena ta"]),
                ("garne chaina", ["garne xaina", "gardina"]),
            ],
            "IMPERATIVE": [
                ("gara", ["gara ta", "gara hai"]),
                ("garnus", ["garnuhos", "garnus ta", "garnus hai"]),
            ],
        },
        "kinnu (to buy)": {
            "PRESENT": [("kinchhu", ["kinxu", "kinchhu ni"]), ("kinchau", ["kinxau"]), ("kinchha", ["kinxa"])],
            "PAST": [("kinyo", ["kineko", "kine", "kiniyo", "kharid garyo", "Ram le saman kinyo"])],
            "NEGATIVE": [("kindina", ["kineko chaina", "kindina ma"])],
        },
        "bechnu (to sell)": {
            "PRESENT": [("bechchhu", ["bechxu"]), ("bechchau", ["bechxau"]), ("bechchha", ["bechxa"])],
            "PAST": [("bechyo", ["becheko", "beche", "bikyo", "500 ma becheko", "bikri garyo"])],
        },
        "tirnu (to pay)": {
            "PRESENT": [("tirchhu", ["tirxu"]), ("tirchau", ["tirxau"]), ("tirchha", ["tirxa"])],
            "PAST": [("tiryo", ["tireko", "tire", "jamayo", "Ram le 500 tiryo", "jama garyo"])],
        },
        "dinu (to give)": {
            "PRESENT": [("dinchhu", ["dinxu"]), ("dinchau", ["dinxau"]), ("dinchha", ["dinxa"])],
            "PAST": [("diyo", ["diye", "diyeko", "diya", "Ram lai 500 diyo"])],
        },
        "linu (to take/receive)": {
            "PRESENT": [("linchhu", ["linxu"]), ("linchau", ["linxau"]), ("linchha", ["linxa"])],
            "PAST": [("liyo", ["lineko", "liye", "Ram bata 500 liyo"])],
        },
        "aunu (to come)": {
            "PRESENT": [("auchhu", ["auxu", "auchhu ni"]), ("auchau", ["auxau"]), ("auchha", ["aucha"])],
            "PAST": [("aayo", ["aayeko", "aaye", "aayo ta"])],
            "IMPERATIVE": [
                ("aau", ["aaunus", "aunus", "aunu", "aaunu", "pheri aaunus", "aau ta", "aaunus hai"]),
            ],
        },
        "jannu (to go)": {
            "PRESENT": [("janchhu", ["janxu"]), ("janchau", ["janxau"]), ("janchha", ["janxa"])],
            "PAST": [("gayo", ["gaye", "gayo ta"])],
            "IMPERATIVE": [("ja", ["janus", "jaanus", "ja ta", "janus hai"])],
        },
        "hunu (to be)": {
            "PRESENT": [
                ("chhu", ["xu", "xa", "cha", "chhu ni"]),
                ("chhau", ["xau", "chau"]),
                ("chha", ["xa", "cha", "xha", "ho"]),
                ("hunuhuncha", ["hunuhuncha tapai", "hunu huncha"]),
            ],
            "PAST": [("thiye", ["hunu bhayo", "bhayo", "thiye ta"])],
            "NEGATIVE": [("xaina", ["chaina", "chhaina", "xain", "hudaina"])],
        },
    }
    for verb, tenses in verbs.items():
        lines.append(f"VERB: {verb}\n\n")
        for tense, forms in tenses.items():
            lines.append(f"{tense}:\n")
            for item in forms:
                if isinstance(item, tuple):
                    std, vars_ = item
                    lines.append(f"  {std}\n")
                    lines.append(var_lines(*vars_))
                else:
                    lines.append(f"  {item}\n")
                    lines.append(var_lines(item))
        lines.append("\n---\n\n")
    return "".join(lines)


def section_29() -> str:
    lines = [hdr(29, "के छ? को जवाफहरू", "How Are You Exchange")]
    q_variants = [
        "ke cha", "ke chha", "k cha", "k xa", "k ho", "k xa ta", "ke cha ta", "ke cha hai",
        "kasto cha", "kasto xa", "kasto ho", "sanchai cha?", "sanchai xa?",
        "tapai ko naam ke ho?", "tapainko naam ke ho?", "tapai ko name ke ho?", "timro naam ke ho?",
    ]
    a_variants = [
        "thik xa", "thik cha", "thik chha", "sab thik", "ramro xa", "sanchai xa",
        "thik nai xa", "khai thik xa", "hajur thik", "thik xa hai", "ramro cha ta",
    ]
    lines.append("QUESTION VARIANTS:\n")
    lines.append(var_lines(*q_variants))
    lines.append("\nANSWER VARIANTS:\n")
    lines.append(var_lines(*a_variants))
    exchanges = [
        ("Q: k xa?", ["thik xa, tapai?", "thik xa timi?", "ramro xa"]),
        ("Q: kasto cha?", ["ramro, dhanyabad", "thik xa", "sanchai"]),
        ("Q: sanchai?", ["sanchai nai, timi?", "thik xa", "ramro xa"]),
        ("Q: ke cha hola?", ["yahi hisab gardai, thik xa", "kaam gardai chu", "thik xa"]),
        ("Q: tapai ko naam ke ho?", ["mero naam Ram ho", "Ram", "Ram ho"]),
    ]
    lines.append("\nEXCHANGE EXAMPLES:\n")
    for q, answers in exchanges:
        lines.append(f"{q}\n")
        lines.append(var_lines(*answers))
    lines.append('\nAI: Greeting exchanges are NOT transactions. Do not extract amounts from "k xa" type messages.\n')
    return "".join(lines)


def section_30() -> str:
    joins = [
        ("Ram + le", "Ramle", ["Ramle", "ramle", "Ram le", "ram le"]),
        ("ma + lai", "malai", ["malai", "ma lai", "malai"]),
        ("timi + lai", "timilai", ["timilai", "timi lai"]),
        ("pasal + ma", "pasalma", ["pasalma", "pasal ma"]),
        ("Ram + ko", "Ramko", ["Ramko", "Ram ko", "ramko"]),
        ("aaja + ko", "aajako", ["aajako", "aaja ko", "ajako"]),
        ("Shyam + bata", "Shyambata", ["Shyambata", "Shyam bata"]),
        ("sathi + sanga", "sathisanga", ["sathisanga", "sathi sanga"]),
    ]
    lines = [hdr(30, "संधि र शब्द-संयोजन", "Word Joining and Sandhi Rules")]
    lines.append("SPOKEN/CHAT JOINING (postposition merges with noun):\n\n")
    for rule, joined, vars_ in joins:
        lines.append(f"{rule} → {joined}\n")
        lines.append(var_lines(*vars_))
    splits = [
        ("Ramle 500 kinyo", "Ram le 500 kinyo"),
        ("pasalma saman cha", "pasal ma saman cha"),
        ("Ramko udhaar", "Ram ko udhaar"),
        ("malai 500 diyo", "ma lai 500 diyo"),
        ("Ramle 500 tiryo", "Ram le 500 tiryo"),
        ("aajako bikri", "aaja ko bikri"),
    ]
    lines.append("\nSPLIT FOR NLU:\n")
    for joined, split in splits:
        lines.append(f"{joined}\n")
        lines.append(f"→ {split}\n")
    lines.append("\nAI RULE: Before parsing, attempt to split joined postposition forms:\n")
    lines.append(var_lines("-le", "-lai", "-ko", "-ma", "-bata", "-sanga", "-lagi"))
    return "".join(lines)


def section_31() -> str:
    aliases = [
        ("chha", ["cha", "xa", "xha", "chhaa", "ho", "xu", "huncha", "hunxa"], "copula 'is'"),
        ("xaina", ["chhaina", "chaina", "xain", "chhain", "chain", "hudaina"], "negation 'is not'"),
        ("vayo", ["bhayo", "gyo", "gayo", "gya", "bhayeko", "vayeko", "hune", "hunxa", "huncha"], "past 'happened/did'"),
        ("garyo", ["gareko", "gare", "garyoo", "gar", "garne", "gareko"], "past 'did'"),
        ("kinyo", ["kineko", "kine", "kiniyo", "kinna", "kharid garyo", "kharid gareko", "kharido", "kharidyo"], "bought"),
        ("becheko", ["bechyo", "beche", "bikyo", "bikri garyo", "sell garyo", "bechiyeko", "bikyayo"], "sold"),
        ("tiryo", ["tireko", "tire", "jamayo", "jama garyo", "aayo", "milyo", "tira", "tiryoo", "payo", "paye"], "paid/received"),
        ("diyo", ["diye", "diyeko", "diya", "die", "dia", "dia", "diyee"], "gave"),
        ("liyo", ["lineko", "liye", "liya", "liyo"], "took/received"),
        ("udhaar", ["udhar", "udharo", "udaar", "udhhar", "udhaaro", "udaro", "credit", "karz", "karja", "udhhaar"], "credit"),
        ("nagad", ["nakad", "nagat", "nakit", "cash", "kesh", "kesh", "nakadma"], "cash"),
        ("kharcha", ["kharcho", "karcha", "expense", "kharch"], "expense"),
        ("aaja", ["aja", "ajha", "ajj", "aaj", "today"], "today"),
        ("hijo", ["kal", "kaliko", "yesterday"], "yesterday"),
        ("bholi", ["parsi", "tomorrow"], "tomorrow"),
        ("saya", ["sau", "hundred"], "hundred"),
        ("hajar", ["hazar", "thousand"], "thousand"),
        ("lakh", ["lac", "hundred thousand"], "hundred thousand"),
        ("thaha xaina", ["thaha chaina", "pata xaina", "pata chaina", "thaha xain"], "don't know"),
        ("namaste", ["namaskar", "namaskaar", "hello", "hi", "hey"], "greeting"),
        ("dhanyabad", ["dhanybaad", "thanks", "thank you", "thankyou", "shukriya"], "thanks"),
        ("tapai", ["tapain", "tapainle", "tapainko", "tapainlai"], "formal you"),
        ("timi", ["ta", "timile", "timro", "timilai"], "informal you"),
        ("paisa", ["rupiya", "rs", "npr", "rupees", "rupya", "rupiye", "rupiah"], "money"),
        ("pasal", ["dukaan", "shop", "pasaal"], "shop"),
        ("saman", ["mal", "goods", "stock", "inventory"], "goods"),
        ("bikri", ["becheko", "sale", "sold", "bechyo", "bikree", "bikry"], "sale"),
        ("kineko", ["kharid", "purchase", "kinyo", "kiniyo", "kharido"], "purchase"),
        ("jama", ["tiryo", "aayo", "payo", "milyo", "aayeko", "aaye"], "payment received"),
        ("payment garyo", ["bhugtan garyo", "payment gareko", "paid out", "paisa diye"], "paid out"),
        ("aaunus", ["aunus", "aunu", "aaunu", "pheri aaunus", "aau"], "please come (honorific)"),
        ("garnuhos", ["garnus", "garnuhuncha", "garnus ta", "garnuhos hai"], "please do (honorific)"),
        ("janus", ["jaanus", "jaunus", "jannus"], "please go (honorific)"),
        ("parkhanus", ["parkha", "parkhanus hai", "ekchhin parkhanus"], "please wait"),
        ("dekhaunus", ["dekhaunu", "dekhaunus hai", "dekhau"], "please show"),
        ("bhanideu", ["bhanideu", "bhanidin", "bhanideu hai"], "please tell"),
        ("ek", ["one", "1"]), ("dui", ["do", "two", "2"]), ("tin", ["teen", "three", "3"]),
        ("char", ["chaar", "four", "4"]), ("panch", ["paanch", "five", "5"]),
        ("bis", ["20"]), ("tis", ["30"]), ("chaalis", ["40"]), ("pachaas", ["50"]),
        ("dedh", ["1.5"]), ("sade", ["plus half"]),
        ("naafa", ["profit", "naafaa"]), ("ghaata", ["loss", "noksan"]),
        ("baaki", ["baki", "remaining", "outstanding"]),
        ("rasid", ["rasi", "bill", "invoice"]),
        ("chalan", ["delivery note"]),
        ("grahak", ["customer", "client"]),
        ("supplier", ["supplier bata"]),
        ("aamdani", ["income"]),
        ("busy xu", ["busy chu", "busy cha", "busy xu ta"]),
        ("entry gareko", ["entry garne", "entry garyo"]),
        ("balance kati", ["balance kati cha", "kitna balance", "kati balance"]),
        # Devanagari script forms (for transliteration training)
        ("udhaar", ["उधार", "udhaar", "udhar"]),
        ("kinyo", ["किनyo", "kinyo", "kiniyo"]),
        ("tiryo", ["तिरyo", "tiryo", "tire"]),
        ("becheko", ["बेचेको", "becheko", "bechyo"]),
        ("kharcha", ["खर्च", "kharcha", "kharcho"]),
        ("talab", ["तलब", "talab", "salary"]),
        ("nagad", ["नगद", "nagad", "nakad"]),
        ("paisa", ["पैसा", "paisa", "rupiya"]),
        ("namaste", ["नमस्ते", "namaste", "namaskar"]),
    ]
    lines = [hdr(31, "MASTER EQUIVALENCE TABLE", "Master Equivalence Table")]
    lines.append("CANONICAL → ACCEPTED VARIANTS (normalize to first column):\n\n")
    for entry in aliases:
        if len(entry) == 3:
            canonical, variants, meaning = entry
        else:
            canonical, variants = entry[0], entry[1]
            meaning = canonical
        lines.append(f"\n{canonical}  ({meaning})\n")
        lines.append(f"→ {canonical}  [CANONICAL]\n")
        for v in variants:
            lines.append(f"→ {v}\n")
    lines.append("\nAI: Always normalize to canonical form before intent classification.\n")
    return "".join(lines)


def section_32() -> str:
    particles = [
        ("ni", "softener/emphasis", ["tiryo ni", "garchu ni", "kinyo ni", "thik xa ni"]),
        ("ta", "emphasis/contrast", ["500 tiryo ta", "k xa ta", "garchu ta", "thik xa ta"]),
        ("hai", "confirmation/tag", ["thik xa hai", "tiryo hai", "k cha hai", "ramro hai"]),
        ("nai", "exactly/really", ["sanchai nai", "thik nai xa", "dherai nai"]),
        ("re", "hearsay/emphasis", ["Ram le tiryo re", "aayo re", "kinyo re"]),
        ("yaar/bhai/dai", "friendly address", ["500 tiryo yaar", "dai ke xa", "bhai tiryo?"]),
        ("bhane/hola", "uncertainty", ["tiryo hola", "aayo hola", "k hola"]),
        ("cha ta / xa ta", "tag question", ["thik xa ta", "ramro cha ta", "tiryo xa ta"]),
    ]
    lines = [hdr(32, "पार्टिकल नि, त, है, नै, रे", "Sentence Particles")]
    lines.append("PARTICLES (emphasis/modality — strip for parsing, use for sentiment):\n\n")
    for p, meaning, examples in particles:
        lines.append(f"{p} — {meaning}\n")
        lines.append(var_lines(*examples))
        lines.append("\n")
    lines.append('PARSING RULE:\n"tiryo ni ta hai" → core verb: tiryo; particles: ni, ta, hai (all stripped)\n')
    lines.append("Meaning unchanged: payment completed\n\nEXAMPLES:\n")
    ex = ["500 kinyo ni", "thik xa hai", "Ram le tiryo re", "garchu ni ma", "500 tiryo ta hai"]
    for e in ex:
        lines.append(f"{e}\n")
        lines.append(f"→ (core parse: {e.split()[0]} {e.split()[1] if len(e.split())>1 else ''})\n")
    return "".join(lines)


def section_33() -> str:
    return hdr(33, "AI प्रशिक्षण सिफारिस", "AI Training Recommendations") + """RECOMMENDATIONS FOR e-Khata Ollama / LLM TRAINING:

1. NORMALIZATION LAYER: Always run input through Devanagari transliteration + spelling
   alias folding (Section 31) before intent classification.

2. EMBEDDING RETRIEVAL: Index this document in ChromaDB (nepali_grammar collection);
   retrieve Sections 18, 21, 24, 26, 27, 31 for transaction messages.

3. FEW-SHOT EXAMPLES: Use Section 27 patterns as few-shot examples in system prompt.

4. FUZZY MATCHING: Accept 80%+ phonetic similarity for financial verbs (Section 22).

5. DO NOT OVER-NORMALIZE: Keep le/lai/ko when present; only strip particles (Section 32).

6. CONTEXT WINDOW: Include last 3 messages for party/amount disambiguation (Section 24).

7. MULTILINGUAL OUTPUT: Reply in user's language style (Devanagari/Roman/English mix).

8. FINANCIAL PRIORITY: Amount + financial verb overrides greeting/help classification.

9. EVALUATION: Test with Halkhabar variants, Hindi mix, typos, and code-switch (Sections 14-17, 22).

10. FINE-TUNE DATA: Generate JSONL from Section 27 patterns paired with structured intents.

VERBATIM EDITION NOTES:
→ This document preserves every Standard / Roman / Halkhabar variation on its own line.
→ Use nepali-grammar-reference.txt for condensed retrieval; use this file for full NLU training.
→ Section 31 equivalence table is authoritative for spelling normalization in e-Khata.
→ Section 26 NLU rules 1-15 must be applied before intent classification.
→ Section 27 categories A-M contain 150 real-world training sentences with variant expansions.

"""


def footer() -> str:
    return f"""
{DELIM}
दस्तावेज समाप्त — Document End
End of Complete Nepali Grammar Knowledge Reference (33 Sections)
e-Khata AI Training Document v1.0 — Verbatim Edition
{DELIM}
"""


def main() -> None:
    _init_section_extras()
    body = (
        section_1()
        + section_2()
        + section_3()
        + section_4()
        + deep_expand_condensed_sections()
        + section_26()
        + section_27()
        + section_28()
        + section_29()
        + section_30()
        + section_31()
        + section_32()
        + section_33()
        + footer()
    )
    OUT.write_text(header_block() + body, encoding="utf-8")

    text = OUT.read_text(encoding="utf-8")
    size = OUT.stat().st_size
    line_count = text.count("\n") + (0 if text.endswith("\n") else 1)
    sections = sum(1 for i in range(1, 34) if f"खण्ड {i}:" in text)
    footer_ok = "दस्तावेज समाप्त" in text

    print(f"Path: {OUT}")
    print(f"Size: {size} bytes")
    print(f"Lines: {line_count}")
    print(f"Sections: {sections}/33")
    print(f"Footer present: {footer_ok}")
    print(f"Variation lines (→): {text.count(chr(8594))}")  # →


if __name__ == "__main__":
    main()
