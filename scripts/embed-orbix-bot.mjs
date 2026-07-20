/**
 * Start in-process Python OIP (erp_bot) when the dedicated Railway bot
 * service is misconfigured (SPA on :8080). Same container as sutra-erp.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMBED_PORT = String(process.env.ORBIX_EMBED_PORT || "8765");
let child = null;
let starting = null;

function findPython() {
  for (const bin of ["python3", "python"]) {
    const r = spawnSync(bin, ["--version"], { stdio: "ignore" });
    if (r.status === 0) return bin;
  }
  return null;
}

function waitPort(port, host = "127.0.0.1", ms = 120000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.connect({ port: Number(port), host }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started > ms) reject(new Error("embed bot port timeout"));
        else setTimeout(tryOnce, 500);
      });
    };
    tryOnce();
  });
}

export async function ensureEmbeddedOrbixBot() {
  if (process.env.ORBIX_EMBED_BOT === "0" || process.env.ORBIX_EMBED_BOT === "false") {
    return null;
  }
  const already = `http://127.0.0.1:${EMBED_PORT}`;
  try {
    const resp = await fetch(`${already}/livez`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2000),
    });
    if (resp.ok) {
      const text = await resp.text();
      if (text.trim().startsWith("{") && !text.includes("<html")) {
        return already;
      }
    }
  } catch {
    /* start fresh */
  }

  if (starting) return starting;
  starting = (async () => {
    const botDir = existsSync(join(root, "erp_bot", "scripts", "start_render.py"))
      ? join(root, "erp_bot")
      : null;
    if (!botDir) {
      console.warn("[embed-orbix] erp_bot missing — cannot embed");
      return null;
    }
    const py = findPython();
    if (!py) {
      console.warn("[embed-orbix] python3/python not in PATH");
      return null;
    }
    console.log(`[embed-orbix] starting Python OIP on 127.0.0.1:${EMBED_PORT}`);
    child = spawn(py, ["scripts/start_render.py"], {
      cwd: botDir,
      env: {
        ...process.env,
        PORT: EMBED_PORT,
        HOST: "127.0.0.1",
        ORBIX_LEAN_START: "true",
      },
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.on("exit", (code, signal) => {
      console.warn(`[embed-orbix] exited code=${code} signal=${signal}`);
      child = null;
      starting = null;
    });
    try {
      await waitPort(EMBED_PORT);
    } catch (err) {
      console.warn("[embed-orbix]", err instanceof Error ? err.message : String(err));
      return null;
    }
    for (let i = 0; i < 60; i++) {
      try {
        const resp = await fetch(`${already}/livez`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(2000),
        });
        if (resp.ok) {
          const text = await resp.text();
          if (text.trim().startsWith("{") && text.includes("ok")) {
            console.log(`[embed-orbix] ready → ${already}`);
            return already;
          }
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    console.warn("[embed-orbix] livez never became JSON ok");
    return null;
  })();
  return starting;
}
