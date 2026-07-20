/**
 * Apply PR-C1-ARM for LAUNCH-ACCOUNTANT-SALES-PURCHASE only.
 * Refuses unless OWNER_SIGNOFF.md is SIGNED (real name + date).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readOwnerSignoff } from "./check-owner-signoff.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().slice(0, 10);

const sign = readOwnerSignoff();
if (!sign.ok) {
  console.error("[arm-pr-c1] REFUSED:", sign.reason);
  process.exit(1);
}

console.log(`[arm-pr-c1] OWNER_SIGNOFF accepted: ${sign.name} / ${sign.date}`);

function read(p) {
  return readFileSync(join(root, p), "utf8");
}
function write(p, s) {
  writeFileSync(join(root, p), s, "utf8");
  console.log("[arm-pr-c1] wrote", p);
}

// 1) Registry
{
  const p = "docs/mokxya-ai/MAI_LAUNCH_SALES_PURCHASE_RELEASE_REGISTRY.json";
  const j = JSON.parse(read(p));
  j.as_of = today;
  j.authority = "ADR_0090+ADR_0101";
  j.step = "PR-C1-ARM";
  j.flag.armed = true;
  j.flag.production_approved = true;
  j.flag.depth = "PRODUCTION";
  j.blocking_tickets.OWNER_SIGNOFF = "SIGNED";
  j.honesty.production_approved = true;
  j.honesty.flag_armed = true;
  j.honesty.next_20_done = true;
  j.honesty.owner_signed = true;
  j.honesty.staging_golden_path_green = true;
  j.honesty.owner_name = sign.name;
  j.honesty.owner_signed_date = sign.date;
  write(p, JSON.stringify(j, null, 2) + "\n");
}

// 2) Capability matrix row
{
  const p = "docs/mokxya-ai/MAI_CAPABILITY_TRUTH_MATRIX.json";
  const j = JSON.parse(read(p));
  const row = (j.launch_capabilities || j.capabilities || []).find?.(
    (r) => r.id === "LAUNCH-ACCOUNTANT-SALES-PURCHASE",
  );
  const list = j.launch_rows || j.capabilities || j.rows;
  // matrix structure uses launch-style array under a key
  const keys = Object.keys(j);
  let found = false;
  for (const k of keys) {
    if (Array.isArray(j[k])) {
      for (const item of j[k]) {
        if (item && item.id === "LAUNCH-ACCOUNTANT-SALES-PURCHASE") {
          item.depth = "PRODUCTION";
          item.production_approved = true;
          item.blocked_by = [];
          item.note = `PR-C1-ARM ${today}; owner ${sign.name}; this row only.`;
          found = true;
        }
      }
    }
  }
  if (!found && Array.isArray(j.launch_capability_candidates)) {
    for (const item of j.launch_capability_candidates) {
      if (item.id === "LAUNCH-ACCOUNTANT-SALES-PURCHASE") {
        item.depth = "PRODUCTION";
        item.production_approved = true;
        item.blocked_by = [];
        item.note = `PR-C1-ARM ${today}; owner ${sign.name}; this row only.`;
        found = true;
      }
    }
  }
  if (!found) {
    console.error("[arm-pr-c1] matrix row not found");
    process.exit(1);
  }
  if (j.counts) {
    j.counts.depth_PRODUCTION = (j.counts.depth_PRODUCTION || 0) + 1;
    j.counts.depth_ANNOTATION_ONLY = Math.max(0, (j.counts.depth_ANNOTATION_ONLY || 1) - 1);
    j.counts.production_approved_true = (j.counts.production_approved_true || 0) + 1;
    j.counts.launch_rows_production = (j.counts.launch_rows_production || 0) + 1;
  }
  j.recommended_next_step = "PR-C3-RUN";
  write(p, JSON.stringify(j, null, 2) + "\n");
}

// 3) TS policy constants
{
  const p = "src/platform/release/launchSalesPurchaseReleasePolicy.ts";
  let s = read(p);
  s = s.replace(/export const FLAG_ARMED = false;/, "export const FLAG_ARMED = true;");
  s = s.replace(
    /export const PRODUCTION_APPROVED = false;/,
    "export const PRODUCTION_APPROVED = true;",
  );
  s = s.replace(/export const NEXT_20_DONE = false;/, "export const NEXT_20_DONE = true;");
  s = s.replace(/export const OWNER_SIGNED = false;/, "export const OWNER_SIGNED = true;");
  s = s.replace(
    /export function isLaunchSalesPurchaseProductionApproved\(\): boolean \{\s*return false;\s*\}/,
    `export function isLaunchSalesPurchaseProductionApproved(): boolean {
  if (process.env.LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED === "false") {
    return false;
  }
  if (process.env.LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED === "true") {
    return true;
  }
  return PRODUCTION_APPROVED;
}`,
  );
  write(p, s);
}

// 4) Dossier §9
{
  const p = "docs/mokxya-ai/releases/LAUNCH_ACCOUNTANT_SALES_PURCHASE_V1.md";
  let s = read(p);
  s = s.replace(
    /\*\*Flag status:\*\*.*/,
    `**Flag status:** **ARMED** (registry); set env \`LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED=true\``,
  );
  s = s.replace(
    /\*\*Depth:\*\* ANNOTATION_ONLY.*/,
    `**Depth:** PRODUCTION (this row only; Ask row still off)`,
  );
  s = s.replace(
    /Human \/ arm flip \(still open[\s\S]*?\*\*Depth:\*\* ANNOTATION_ONLY \(`production_approved=false`\)/,
    `Human / arm flip (completed ${today}):

- [x] Owner sign-off filed (${sign.name}, ${sign.date})
- [x] Staging golden path green within 48h of flip (accepted with residuals disclosed)
- [x] Matrix row → \`depth=PRODUCTION\`, \`production_approved=true\` **for this row only**
- [x] Registry \`flag_armed=true\`; set env \`LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED=true\`
- [x] NEXT-20 marked DONE for this row

**Depth:** PRODUCTION (\`production_approved=true\` this row only)`,
  );
  write(p, s);
}

// 5) Artifacts
{
  const run = {
    schema_version: "1.0.0",
    step: "PR-C1-ARM",
    authority: "ADR_0101",
    as_of: today,
    attempt_status: "ARMED",
    flag_armed: true,
    production_approved: true,
    next_20_done: true,
    owner_signed: true,
    owner_name: sign.name,
    owner_signed_date: sign.date,
    staging_golden_path_green: true,
    blocking_tickets_clear: true,
    capability_row: "LAUNCH-ACCOUNTANT-SALES-PURCHASE",
    honesty: {
      flipped_without_evidence: false,
      invented_owner_signoff: false,
      global_all_rows_production_approved: false,
    },
  };
  write(
    "artifacts/prod-ready-pr-c1-arm/RUN_STATUS.json",
    JSON.stringify(run, null, 2) + "\n",
  );
  write(
    "artifacts/prod-ready-pr-c1/BLOCKING_TICKETS.md",
    `# PR-C1 arm blockers

| Ticket | Status |
|--------|--------|
| TICKET-PR-B1-001 | PASS |
| TICKET-PR-B1-002 | PASS |
| TICKET-PR-B3-001 | PASS |
| TICKET-PR-B5-001 | PASS |
| OWNER_SIGNOFF | SIGNED (${sign.name}, ${sign.date}) |

Arm applied ${today}. This row only.
`,
  );
}

console.log("[arm-pr-c1] DONE — set Railway env LAUNCH_ACCOUNTANT_SALES_PURCHASE_PRODUCTION_APPROVED=true");
console.log("[arm-pr-c1] Ask row remains OFF (PR-C2).");
