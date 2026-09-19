from pathlib import Path

p = Path("src/domains/treasury/uiAdapters.ts")
t = p.read_text(encoding="utf-8")
t = t.replace(
    "export async function unmatchViaTreasury(opts: {\n  linkId: string;\n  expectedLinkVersion: number;\n  idempotencyKey?: string;\n})",
    "export async function unmatchViaTreasury(opts: {\n  linkId: string;\n  expectedLinkVersion: number;\n  expectedStatementLineVersion: number;\n  idempotencyKey?: string;\n})",
)
t = t.replace(
    "    linkId: opts.linkId,\n    expectedLinkVersion: opts.expectedLinkVersion,\n  });\n}",
    "    linkId: opts.linkId,\n    expectedLinkVersion: opts.expectedLinkVersion,\n    expectedStatementLineVersion: opts.expectedStatementLineVersion,\n  });\n}",
)
p.write_text(t, encoding="utf-8", newline="\n")
print("unmatch ok", "expectedStatementLineVersion: opts.expectedStatementLineVersion" in t)

idx = Path("src/domains/treasury/index.ts")
b = idx.read_bytes()
print("index bytes", list(b[:8]))
if len(b) > 3 and b[1] == 0:
    idx.write_text(b.decode("utf-16"), encoding="utf-8", newline="\n")
    print("converted index")
print(idx.read_text(encoding="utf-8"))