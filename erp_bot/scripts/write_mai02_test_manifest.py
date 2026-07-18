"""Generate MAI-02 orbix test manifest."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "docs" / "mokxya-ai" / "baselines"
orbix = json.loads((BASE / "mai02_orbix_vitest.json").read_text(encoding="utf-8"))
khata = json.loads((BASE / "mai02_khata_confirm_vitest.json").read_text(encoding="utf-8"))

lines: list[str] = []
lines.append("MAI-02 Orbix / MAI-01 security test manifest")
lines.append(f"generated_at_utc: {datetime.now(timezone.utc).isoformat()}")
lines.append("")
lines.append("COMMAND_A: npm run test:orbix-contract")
lines.append("  equivalent: npx vitest run src/__tests__/orbix/")
lines.append(f"  numTotalTests: {orbix['numTotalTests']}")
lines.append(f"  numPassedTests: {orbix['numPassedTests']}")
lines.append(f"  numFailedTests: {orbix['numFailedTests']}")
lines.append(f"  numPendingTests: {orbix['numPendingTests']}")
lines.append(f"  numTodoTests: {orbix['numTodoTests']}")
lines.append("")
lines.append("COMMAND_B: npx vitest run packages/backend/src/middleware/khataConfirmAuth.test.ts")
lines.append(f"  numTotalTests: {khata['numTotalTests']}")
lines.append(f"  numPassedTests: {khata['numPassedTests']}")
lines.append("")
lines.append("RECONCILIATION:")
lines.append('  MAI-01 reported "vitest orbix + khataConfirmAuth: 141 passed".')
lines.append("  That combined run was NOT identical to npm run test:orbix-contract alone.")
lines.append("  npm run test:orbix-contract only includes src/__tests__/orbix/.")
lines.append("  vitest.config.ts include also lists khataConfirmAuth.test.ts for bare vitest.")
lines.append(f"  Current orbix-only passed={orbix['numPassedTests']} (includes 7 mai02CanonicalContracts tests).")
lines.append(f"  Current khataConfirmAuth passed={khata['numPassedTests']}.")
lines.append(f"  Combined active equivalent={orbix['numPassedTests'] + khata['numPassedTests']}.")
lines.append("  Pre-MAI-02 orbix-only implied = 140 - 7 = 133; 133 + 8 khata = 141 (matches MAI-01 combined).")
lines.append("  No .skip/.only/.todo found under src/__tests__/orbix/ or khataConfirmAuth.")
lines.append("  No deleted orbix test files; include pattern for test:orbix-contract unchanged.")
lines.append("")
lines.append("=== ACTIVE ORBIX TESTS ===")
for f in sorted(orbix.get("testResults") or [], key=lambda x: x.get("name", "")):
    fname = f.get("name", "").replace("\\", "/")
    short = fname.split("src/__tests__/orbix/")[-1] if "orbix/" in fname else fname
    for a in f.get("assertionResults") or []:
        full = a.get("fullName") or a.get("title") or ""
        status = a.get("status")
        lines.append(f"ACTIVE\t{short}\t{full}\t{status}\tnpm run test:orbix-contract")
lines.append("")
lines.append("=== KHATA CONFIRM AUTH TESTS ===")
for f in sorted(khata.get("testResults") or [], key=lambda x: x.get("name", "")):
    fname = f.get("name", "").replace("\\", "/")
    short = fname.split("packages/backend/")[-1] if "packages/backend/" in fname else fname
    for a in f.get("assertionResults") or []:
        full = a.get("fullName") or a.get("title") or ""
        status = a.get("status")
        lines.append(
            "ACTIVE\t"
            f"{short}\t{full}\t{status}\t"
            "npx vitest run packages/backend/src/middleware/khataConfirmAuth.test.ts"
        )

out = BASE / "MAI_02_ORBIX_TEST_MANIFEST.txt"
out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
print(f"wrote {out} lines={len(lines)} orbix={orbix['numPassedTests']} khata={khata['numPassedTests']}")
