/**
 * package.json "start" entry for Railway monorepo.
 * Dashboard often hardcodes `npm start`; when the service is sutra-erp-bot,
 * run Python OIP instead of serve.mjs (fixes SPA-on-:8080 misdeploy).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svc = String(process.env.RAILWAY_SERVICE_NAME || "").toLowerCase();
const role = String(process.env.SUTRA_SERVICE_ROLE || "").toLowerCase();
const looksBot =
  role === "bot" ||
  role === "erp-bot" ||
  role === "sutra-erp-bot" ||
  /erp-bot|erp_bot/.test(svc) ||
  /(^|-)bot$|^bot-/.test(svc) ||
  (svc.includes("bot") && svc.includes("erp"));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: opts.cwd || root,
    env: { ...process.env, ...(opts.env || {}) },
    shell: false,
  });
  return r.status ?? 1;
}

function whichPython() {
  for (const bin of ["python", "python3"]) {
    const r = spawnSync(bin, ["--version"], { stdio: "ignore" });
    if (r.status === 0) return bin;
  }
  return null;
}

if (looksBot) {
  console.log(
    `[railway-npm-start] bot service detected (${process.env.RAILWAY_SERVICE_NAME || "role=" + role}) — starting Python OIP`,
  );
  const botDir = existsSync(join(root, "erp_bot", "scripts", "start_render.py"))
    ? join(root, "erp_bot")
    : existsSync(join(root, "scripts", "start_render.py"))
      ? root
      : null;
  if (!botDir) {
    console.error("[railway-npm-start] ERROR: erp_bot/scripts/start_render.py not found");
    process.exit(1);
  }
  const py = whichPython();
  if (!py) {
    console.error("[railway-npm-start] ERROR: python/python3 not in PATH");
    process.exit(1);
  }
  const req = join(botDir, "requirements.txt");
  if (existsSync(req)) {
    console.log("[railway-npm-start] ensuring Python deps (pip install -r requirements.txt)...");
    const pip = run(py, ["-m", "pip", "install", "-r", "requirements.txt"], {
      cwd: botDir,
    });
    if (pip !== 0) {
      console.error("[railway-npm-start] pip install failed");
      process.exit(pip);
    }
  }
  process.exit(
    run(py, ["scripts/start_render.py"], {
      cwd: botDir,
      env: { PORT: "8080" },
    }),
  );
}

console.log("[railway-npm-start] frontend — node serve.mjs");
process.exit(run(process.execPath, ["serve.mjs"], { cwd: root }));
