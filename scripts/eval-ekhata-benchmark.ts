/**
 * e-Khata benchmark — scores /v2/chat against curated accounting questions.
 * Run: npm run test:ekhata-benchmark
 *
 * Requires erp_bot running with Ollama online.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BOT_URL = (process.env.ERP_BOT_BACKEND_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

interface BenchCase {
  id: string;
  bucket: string;
  input: string;
  expectAction?: string;
  expectContains?: string[];
  blockWikipedia?: boolean;
}

const CASES: BenchCase[] = [
  { id: "fw-1", bucket: "framework", input: "sampatti ke ho?", expectContains: ["asset", "sampatti", "economic"], blockWikipedia: true },
  { id: "fw-2", bucket: "framework", input: "faithful representation k ho?", expectContains: ["faithful", "biswasilo", "representation"] },
  { id: "fw-3", bucket: "framework", input: "what is liability in accounting?", expectContains: ["liability", "obligation", "dayitwo"] },
  { id: "entry-1", bucket: "entry", input: "Ram lai 500 udhaar diye", expectAction: "confirm", expectContains: ["500", "Ram"] },
  { id: "entry-2", bucket: "entry", input: "Ram lai 11300 ko saman becheko VAT sahit", expectAction: "confirm", expectContains: ["11300", "1300", "10000"] },
  { id: "entry-3", bucket: "entry", input: "cash ma 2000 kharcha office", expectAction: "confirm" },
  { id: "report-1", bucket: "report", input: "trial balance dekhau", expectAction: "report", expectContains: ["Trial", "Dr", "Cr"] },
  { id: "edu-1", bucket: "education", input: "depreciation bhannale ke ho?", expectContains: ["depreciation", "asset", "purano"] },
  { id: "query-1", bucket: "query", input: "VAT rate Nepal ma kati ho?", expectContains: ["13", "vat"] },
  { id: "slot-1", bucket: "multiturn", input: "Ram le tiryo", expectAction: "clarify" },
];

interface V2Response {
  message: string;
  action: string;
  metadata?: Record<string, unknown>;
}

async function askV2(message: string, sessionId: string): Promise<V2Response> {
  const resp = await fetch(`${BOT_URL}/v2/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId, context: {} }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json() as Promise<V2Response>;
}

function scoreCase(c: BenchCase, res: V2Response): { pass: boolean; reason: string } {
  const text = (res.message || "").toLowerCase();
  if (c.expectAction && res.action !== c.expectAction) {
    return { pass: false, reason: `action=${res.action} expected ${c.expectAction}` };
  }
  if (c.expectContains) {
    const hit = c.expectContains.some((k) => text.includes(k.toLowerCase()));
    if (!hit) return { pass: false, reason: `missing keywords: ${c.expectContains.join(", ")}` };
  }
  if (c.blockWikipedia && /wikipedia|demigod|sampati bird/i.test(res.message)) {
    return { pass: false, reason: "Wikipedia/hallucination detected" };
  }
  return { pass: true, reason: "ok" };
}

async function main() {
  console.log(`e-Khata benchmark → ${BOT_URL}/v2/chat\n`);

  try {
    const status = await fetch(`${BOT_URL}/status`);
    if (!status.ok) throw new Error("erp_bot not reachable");
  } catch {
    console.error("FAIL: Start erp_bot first (cd erp_bot && python -m src.api.server)");
    process.exit(1);
  }

  let passed = 0;
  const results: Array<{ id: string; pass: boolean; reason: string }> = [];

  for (const c of CASES) {
    const sessionId = `bench-${c.id}-${Date.now()}`;
    try {
      const res = await askV2(c.input, sessionId);
      const { pass, reason } = scoreCase(c, res);
      results.push({ id: c.id, pass, reason });
      if (pass) passed += 1;
      console.log(`${pass ? "✓" : "✗"} [${c.bucket}] ${c.id}: ${reason}`);
      if (!pass) console.log(`   → ${res.message.slice(0, 120)}...`);
    } catch (e) {
      results.push({ id: c.id, pass: false, reason: String(e) });
      console.log(`✗ [${c.bucket}] ${c.id}: ${e}`);
    }
  }

  const pct = Math.round((passed / CASES.length) * 100);
  console.log(`\nScore: ${passed}/${CASES.length} (${pct}%)`);

  const outPath = join(process.cwd(), "data", "ekhata", "benchmark-last-run.json");
  if (existsSync(join(process.cwd(), "data", "ekhata"))) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), passed, total: CASES.length, results }, null, 2));
    console.log(`Wrote ${outPath}`);
  }

  process.exit(passed === CASES.length ? 0 : 1);
}

main();
