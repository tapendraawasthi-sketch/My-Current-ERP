/**
 * Validate artifacts/prod-ready-pr-c1/OWNER_SIGNOFF.md for PR-C1-ARM.
 * Exit 0 only when Status is SIGNED with a real name and date (not pending).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "artifacts/prod-ready-pr-c1/OWNER_SIGNOFF.md");

export function readOwnerSignoff() {
  if (!existsSync(path)) {
    return { ok: false, reason: "OWNER_SIGNOFF.md missing" };
  }
  const text = readFileSync(path, "utf8");
  const statusMatch = text.match(/\*\*Status:\*\*\s*(\w+)/i);
  const status = (statusMatch?.[1] || "").toUpperCase();
  const nameRow = text.match(/Product owner name\s*\|\s*([^|\n]+)/i);
  const dateRow = text.match(/^\| Date\s*\|\s*([^|\n]+)/im);
  const name = (nameRow?.[1] || "").trim();
  const date = (dateRow?.[1] || "").trim();
  const pending =
    status !== "SIGNED" ||
    !name ||
    /^_?pending_?$/i.test(name) ||
    !date ||
    /^_?pending_?$/i.test(date);
  if (pending) {
    return {
      ok: false,
      reason: "OWNER_SIGNOFF still PENDING (need Status SIGNED + name + date)",
      status,
      name,
      date,
    };
  }
  // Reject known invented tokens from voided false arm.
  const voidTokens = ["sign OWNER", "b5pass", "approved b3"];
  for (const t of voidTokens) {
    if (text.toLowerCase().includes(t.toLowerCase()) && name.toLowerCase().includes("sign")) {
      return { ok: false, reason: `void token pattern: ${t}` };
    }
  }
  return { ok: true, status, name, date, text };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("check-owner-signoff.mjs")) {
  const r = readOwnerSignoff();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}
