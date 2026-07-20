import http from "http";
import crypto from "node:crypto";
import dns from "node:dns";
import net from "node:net";
import { fileURLToPath } from "url";
import { join, extname, normalize } from "path";
import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import jwt from "jsonwebtoken";

// Belt-and-suspenders: bot Railway services must never run this SPA server.
// Prefer scripts/railway-dispatch-start.sh (or Root Directory = erp_bot).
{
  const svc = String(process.env.RAILWAY_SERVICE_NAME || "").toLowerCase();
  const role = String(process.env.SUTRA_SERVICE_ROLE || "").toLowerCase();
  const looksBot =
    role === "bot" ||
    role === "erp-bot" ||
    role === "sutra-erp-bot" ||
    /erp-bot|erp_bot/.test(svc) ||
    /(^|-)bot$|^bot-/.test(svc) ||
    (svc.includes("bot") && svc.includes("erp"));
  if (looksBot) {
    console.error(
      `\n❌ FATAL: Railway service "${process.env.RAILWAY_SERVICE_NAME}" looks like sutra-erp-bot,\n` +
        `   but Node serve.mjs started. Use scripts/railway-dispatch-start.sh or set\n` +
        `   Root Directory = erp_bot (erp_bot/railway.toml).\n`,
    );
    process.exit(1);
  }
}

// Railway private DNS often returns AAAA+A; healthchecks use IPv4 (100.64/10.x).
// Prefer IPv4 so Node fetch does not hang or mis-route on IPv6-first happy eyeballs.
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  /* older Node */
}
try {
  net.setDefaultAutoSelectFamilyAttemptTimeout(1000);
} catch {
  /* older Node */
}

async function proxyFetch(url, init = {}) {
  return fetch(url, init);
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = parseInt(process.env.PORT || "3000", 10);
const DIST_DIR = join(__dirname, "dist");

// CRITICAL: Verify dist folder exists at startup
if (!existsSync(DIST_DIR)) {
  console.error(
    `\n❌ FATAL: dist/ folder not found at ${DIST_DIR}\n` +
      `   Run "npm run build" before starting the server.\n` +
      `   On Railway/Render: ensure buildCommand runs before startCommand.\n`,
  );
  process.exit(1);
}

// Verify index.html exists
const INDEX_PATH = join(DIST_DIR, "index.html");
if (!existsSync(INDEX_PATH)) {
  console.error(
    `\n❌ FATAL: dist/index.html not found.\n` +
      `   The build may have failed silently. Check build logs.\n`,
  );
  process.exit(1);
}

console.log(`✅ dist/ folder verified at ${DIST_DIR}`);

// Frontend always calls /erp-bot (same-origin proxy) — no VITE_ERP_BOT_URL required.
// Primary deploy target: Railway. Set on sutra-erp (recommended):
//   ERP_BOT_BACKEND_URL=https://${{sutra-erp-bot.RAILWAY_PUBLIC_DOMAIN}}
// Private network (preferred when public edge rate-limits):
//   ERP_BOT_BACKEND_URL=http://${{sutra-erp-bot.RAILWAY_PRIVATE_DOMAIN}}:${{sutra-erp-bot.PORT}}
function onRailwayPlatform() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_NAME,
  );
}

function onRenderPlatform() {
  return Boolean(
    process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL,
  );
}

function railwayOipSecret() {
  const explicit = (
    process.env.OIP_JWT_SECRET ||
    process.env.API_SECRET_KEY ||
    process.env.JWT_SECRET ||
    ""
  ).trim();
  if (explicit.length >= 16) return explicit;
  const material = [
    process.env.RAILWAY_PROJECT_ID || "",
    process.env.RAILWAY_ENVIRONMENT_ID || "",
    "sutra-orbix-oip",
  ].join("|");
  return crypto.createHash("sha256").update(material).digest("hex");
}

function mintOrbixGatewayToken() {
  // Must match erp_bot JwtService Sutra shape (sub + tenantId + exp).
  return jwt.sign(
    {
      sub: "sutra-erp-gateway",
      tenantId: "sutra-production",
      companyId: "sutra-production",
      role: "accountant",
      sessionId: "gateway",
      username: "sutra-erp-gateway",
      type: "access",
    },
    railwayOipSecret(),
    { algorithm: "HS256", expiresIn: "30m" },
  );
}

function railwayBotCandidates() {
  const privatePort = (process.env.ERP_BOT_PORT || "8080").trim();
  const privateHost = (
    process.env.ERP_BOT_PRIVATE_HOST ||
    process.env.ERP_BOT_PRIVATE_DOMAIN ||
    ""
  )
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const publicHost = (process.env.ERP_BOT_PUBLIC_DOMAIN || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  const out = [];
  if (privateHost && privatePort) out.push(`http://${privateHost}:${privatePort}`);
  // Private DNS only — public *.up.railway.app edge returns 429 under load and
  // hairpins poorly from inside the project.
  out.push(`http://sutra-erp-bot.railway.internal:${privatePort || "8080"}`);
  out.push("http://sutra-erp-bot.railway.internal:8080");
  if (publicHost) out.push(`https://${publicHost}`);
  return [...new Set(out.map((u) => u.replace(/\/$/, "")))];
}

function resolveErpBotBackendSync() {
  const explicit = (process.env.ERP_BOT_BACKEND_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;

  if (!onRailwayPlatform() && !onRenderPlatform()) {
    return "http://127.0.0.1:8765";
  }

  const publicHost = (process.env.ERP_BOT_PUBLIC_DOMAIN || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (publicHost) return `https://${publicHost}`;

  const privateHost = (
    process.env.ERP_BOT_PRIVATE_HOST ||
    process.env.ERP_BOT_PRIVATE_DOMAIN ||
    ""
  )
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const privatePort = (process.env.ERP_BOT_PORT || "").trim();
  if (privateHost && privatePort) return `http://${privateHost}:${privatePort}`;
  if (privatePort) return `http://sutra-erp-bot.railway.internal:${privatePort}`;

  // Placeholder until async probe selects a live candidate on Railway.
  if (onRailwayPlatform()) return railwayBotCandidates()[0] || "";
  return "";
}

let ERP_BOT_BACKEND = resolveErpBotBackendSync();

async function probeErpBotBase(base) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    // Must be the Python bot JSON livez — SPA HTML 200s are false positives
    // (private DNS + wrong port can hit sutra-erp itself).
    const resp = await proxyFetch(`${base}/livez`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!resp.ok) return false;
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    const text = await resp.text();
    if (text.includes("<!doctype") || text.includes("<html")) return false;
    if (!ct.includes("json") && !text.trim().startsWith("{")) return false;
    const data = JSON.parse(text);
    return (
      data.status === "ok" ||
      data.status === "live" ||
      data.status === "alive" ||
      data.alive === true ||
      data.live === true
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureErpBotBackend() {
  const explicit = (process.env.ERP_BOT_BACKEND_URL || "").trim().replace(/\/$/, "");
  if (explicit) {
    ERP_BOT_BACKEND = explicit;
    console.log(`🧠 Orbix OIP proxy: /erp-bot → ${ERP_BOT_BACKEND} (ERP_BOT_BACKEND_URL)`);
    return;
  }

  if (!onRailwayPlatform()) {
    if (ERP_BOT_BACKEND) {
      console.log(`🧠 Orbix OIP proxy: /erp-bot → ${ERP_BOT_BACKEND}`);
    }
    return;
  }

  // Probe private host on several ports (bot PORT may not be 8080 if dashboard overrides).
  const host = (
    process.env.ERP_BOT_PRIVATE_DOMAIN ||
    process.env.ERP_BOT_PRIVATE_HOST ||
    "sutra-erp-bot"
  )
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\.railway\.internal$/i, "")
    .replace(/\/$/, "");
  const fqdn = `${host}.railway.internal`;
  const ports = [
    ...(process.env.ERP_BOT_PORT ? [process.env.ERP_BOT_PORT.trim()] : []),
    "8080",
    "8000",
    "8765",
    "3000",
  ];
  for (const p of [...new Set(ports.filter(Boolean))]) {
    const base = `http://${fqdn}:${p}`;
    const ok = await probeErpBotBase(base);
    console.log(`🧠 Orbix probe ${ok ? "OK" : "miss"} → ${base}`);
    if (ok) {
      ERP_BOT_BACKEND = base;
      console.log(`🧠 Orbix OIP proxy: /erp-bot → ${ERP_BOT_BACKEND}`);
      return;
    }
  }

  for (const base of railwayBotCandidates()) {
    const ok = await probeErpBotBase(base);
    console.log(`🧠 Orbix probe ${ok ? "OK" : "miss"} → ${base}`);
    if (ok) {
      ERP_BOT_BACKEND = base;
      console.log(`🧠 Orbix OIP proxy: /erp-bot → ${ERP_BOT_BACKEND}`);
      return;
    }
  }

  // Prefer private DNS even if probe raced the bot boot — request-time failover retries.
  ERP_BOT_BACKEND = "http://sutra-erp-bot.railway.internal:8080";
  console.warn(
    `⚠️  Orbix probe found no healthy bot yet; defaulting to ${ERP_BOT_BACKEND}.\n` +
      "    Prefer setting on sutra-erp:\n" +
      "    ERP_BOT_BACKEND_URL=http://${{sutra-erp-bot.RAILWAY_PRIVATE_DOMAIN}}:${{sutra-erp-bot.PORT}}",
  );
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function handleErpBotRequest(req, res, method, rawPath) {
  const subpath = rawPath.replace(/^\/erp-bot/, "") || "/";

  // No backend configured — serve the built-in offline status/response.
  // PHASE 1: This is now clearly labeled as OFFLINE FALLBACK ONLY.
  // The LLM path is PRIMARY for full conversational AI.
  if (!ERP_BOT_BACKEND) {
    if (method === "GET" && subpath === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "online",
          mode: "builtin",
          ollama: "unavailable",
          khata_llm: false,
          khata_brain: "builtin",
          indexed_files: 0,
          conversation_memory: false,
          streaming: false,
          message:
            "⚠️ OFFLINE MODE: Using built-in rule-based brain (limited). " +
            "Deploy sutra-erp-bot on Railway and set ERP_BOT_BACKEND_URL " +
            "(https://${{sutra-erp-bot.RAILWAY_PUBLIC_DOMAIN}}) to enable OIP chat via Groq.",
        }),
      );
      return;
    }

    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "LLM backend not configured — using offline fallback",
        mode: "builtin",
        hint:
          "Deploy sutra-erp-bot on Railway (Root Directory=erp_bot) and on sutra-erp set " +
          "ERP_BOT_BACKEND_URL=https://${{sutra-erp-bot.RAILWAY_PUBLIC_DOMAIN}}",
      }),
    );
    return;
  }

  // Backend configured — proxy through, with failover when public edge 429s.
  const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(req);
  const isStreamingEndpoint = subpath === "/chat/stream" || subpath.endsWith("/stream");
  const bases = [
    ERP_BOT_BACKEND,
    ...(onRailwayPlatform() ? railwayBotCandidates() : []),
  ].filter(Boolean);
  const uniqueBases = [...new Set(bases.map((u) => String(u).replace(/\/$/, "")))];

  const forwardHeaders = { ...req.headers };
  delete forwardHeaders.host;
  delete forwardHeaders["content-length"];
  if (isStreamingEndpoint) {
    forwardHeaders.accept = "text/event-stream";
  }
  // Railway: always attach gateway JWT so OIP_AUTH_REQUIRED accepts chat.
  // Client SPA tokens are for sync/API and usually do not share OIP_JWT_SECRET.
  if (onRailwayPlatform()) {
    try {
      forwardHeaders.authorization = `Bearer ${mintOrbixGatewayToken()}`;
    } catch (tokenErr) {
      console.warn(
        "[serve.mjs] gateway JWT mint failed:",
        tokenErr instanceof Error ? tokenErr.message : String(tokenErr),
      );
    }
  }

  let lastErr = null;
  const attempts = [];
  for (const base of uniqueBases) {
    const targetUrl = `${base}${subpath}`;
    try {
      const upstream = await proxyFetch(targetUrl, {
        method,
        headers: forwardHeaders,
        body,
        signal: AbortSignal.timeout(isStreamingEndpoint ? 120000 : 30000),
      });

      // Fail over on public-edge rate limit / gateway errors.
      if ([429, 502, 503, 504].includes(upstream.status) && uniqueBases.length > 1) {
        console.warn(
          `[serve.mjs] upstream ${upstream.status} from ${base}, trying next`,
        );
        attempts.push({ base, status: upstream.status });
        lastErr = new Error(`upstream ${upstream.status} from ${base}`);
        continue;
      }
      attempts.push({ base, status: upstream.status });

      const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
      // Always reject SPA HTML — wrong private DNS/port often hits sutra-erp itself.
      if (!isStreamingEndpoint) {
        const maybeHtml =
          contentType.includes("text/html") || !contentType.includes("json");
        if (maybeHtml) {
          const peek = await upstream.clone().text();
          if (peek.includes("<!doctype") || peek.includes("<html")) {
            console.warn(`[serve.mjs] upstream HTML from ${base} (not Python bot)`);
            attempts.push({ base, status: upstream.status, error: "html_spa_false_positive" });
            lastErr = new Error(`upstream HTML from ${base} (DNS likely not sutra-erp-bot)`);
            continue;
          }
        }
      }

      if (base !== ERP_BOT_BACKEND) {
        ERP_BOT_BACKEND = base;
        console.log(`[serve.mjs] Orbix failover selected → ${base}`);
      }

      if (isStreamingEndpoint && upstream.body) {
        res.writeHead(upstream.status, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value, { stream: true }));
          }
        } catch (streamErr) {
          console.error("[serve.mjs] SSE stream error:", streamErr);
        } finally {
          res.end();
        }
        return;
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, { "Content-Type": contentType });
      res.end(buf);
      return;
    } catch (err) {
      lastErr = err;
      const cause = err && typeof err === "object" ? err.cause : null;
      attempts.push({
        base,
        error: err instanceof Error ? err.message : String(err),
        code: cause && typeof cause === "object" ? cause.code : undefined,
        address: cause && typeof cause === "object" ? cause.address : undefined,
      });
      console.warn(
        `[serve.mjs] proxy error for ${targetUrl}:`,
        err instanceof Error ? err.message : String(err),
        cause && typeof cause === "object" ? cause.code : "",
      );
    }
  }

  res.writeHead(502, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "ERP bot backend unreachable",
      detail: lastErr instanceof Error ? lastErr.message : String(lastErr || "no candidates"),
      tried: uniqueBases,
      attempts,
      hint:
        "On sutra-erp set ERP_BOT_BACKEND_URL=http://${{sutra-erp-bot.RAILWAY_PRIVATE_DOMAIN}}:${{sutra-erp-bot.PORT}} and ensure sutra-erp-bot is Online on PORT=8080",
    }),
  );
}

const MIME_TYPES = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".map": "application/json",
};

const CACHE_CONTROL = {
  assets: "public, max-age=31536000, immutable", // 1 year for hashed assets
  html: "no-cache, no-store, must-revalidate", // Always fresh for SPA shell
  other: "public, max-age=3600", // 1 hour for other static files
};

async function serveRequest(req, res) {
  const method = req.method || "GET";
  const rawPath = (req.url || "/").split("?")[0];

  // ERP bot API — proxy to backend service or built-in offline status
  if (rawPath.startsWith("/erp-bot")) {
    await handleErpBotRequest(req, res, method, rawPath);
    return;
  }

  // Only handle GET and HEAD for static files
  if (method !== "GET" && method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed");
    return;
  }

  // Health check endpoints (Railway / Render / load balancers)
  if (rawPath === "/health" || rawPath === "/ping" || rawPath === "/_health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
        commit:
          process.env.RAILWAY_GIT_COMMIT_SHA ||
          process.env.RENDER_GIT_COMMIT ||
          process.env.GITHUB_SHA ||
          "unknown",
        service: "sutra-erp",
        erp_bot_proxy: ERP_BOT_BACKEND ? "configured" : "missing",
        erp_bot_target: ERP_BOT_BACKEND
          ? (() => {
              try {
                return new URL(ERP_BOT_BACKEND).host;
              } catch {
                return "invalid";
              }
            })()
          : null,
      }),
    );
    return;
  }

  // Diagnose Railway private DNS / Orbix reachability (no secrets).
  if (rawPath === "/health/orbix") {
    const dnsPromises = await import("node:dns/promises");
    const botHost = "sutra-erp-bot.railway.internal";
    const selfHost = process.env.RAILWAY_PRIVATE_DOMAIN || "sutra-erp.railway.internal";
    async function lookupHost(host) {
      try {
        return await dnsPromises.lookup(host, { all: true });
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    }
    async function probeLivez(url) {
      try {
        const r = await proxyFetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        const text = await r.text();
        return {
          url,
          status: r.status,
          contentType: r.headers.get("content-type"),
          bodyPreview: text.slice(0, 120),
          looksLikeSpa: text.includes("<!doctype") || text.includes("<html"),
          looksLikeBot: text.includes('"status"') && !text.includes("<html"),
        };
      } catch (e) {
        const cause = e && typeof e === "object" ? e.cause : null;
        return {
          url,
          error: e instanceof Error ? e.message : String(e),
          code: cause && typeof cause === "object" ? cause.code : undefined,
        };
      }
    }
    const botLookup = await lookupHost(botHost);
    const selfLookup = await lookupHost(selfHost);
    const ports = [
      ...(process.env.ERP_BOT_PORT ? [process.env.ERP_BOT_PORT.trim()] : []),
      "8080",
      "8000",
      "8765",
    ];
    const uniquePorts = [...new Set(ports.filter(Boolean))];
    const probes = [];
    for (const p of uniquePorts) {
      probes.push(await probeLivez(`http://${botHost}:${p}/livez`));
    }
    // Also try IPv6 literal if present (legacy Railway private net).
    const v6 =
      Array.isArray(botLookup) &&
      botLookup.find((x) => x && x.family === 6 && x.address);
    if (v6) {
      probes.push(await probeLivez(`http://[${v6.address}]:8080/livez`));
    }
    const good = probes.find((p) => p.looksLikeBot);
    if (good) {
      ERP_BOT_BACKEND = good.url.replace(/\/livez$/, "");
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        {
          self_private_domain: process.env.RAILWAY_PRIVATE_DOMAIN || null,
          self_service: process.env.RAILWAY_SERVICE_NAME || null,
          self_lookup: selfLookup,
          bot_host: botHost,
          bot_lookup: botLookup,
          same_ip_as_frontend:
            Array.isArray(botLookup) &&
            Array.isArray(selfLookup) &&
            botLookup.some((b) =>
              selfLookup.some((s) => s.address && s.address === b.address),
            ),
          probes,
          selected_backend: ERP_BOT_BACKEND,
          hint: good
            ? `Found Python bot at ${ERP_BOT_BACKEND}`
            : "No JSON /livez on probed ports. On sutra-erp set ERP_BOT_BACKEND_URL=http://${{sutra-erp-bot.RAILWAY_PRIVATE_DOMAIN}}:${{sutra-erp-bot.PORT}}. On sutra-erp-bot confirm Root Directory=erp_bot and startCommand runs Python.",
        },
        null,
        2,
      ),
    );
    return;
  }

  // Prevent directory traversal attacks
  const safePath = normalize(rawPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(DIST_DIR, safePath);

  // Security: ensure the resolved path is inside dist/
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  // Try to serve the exact file requested
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) {
      const ext = extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || "application/octet-stream";
      const isHashedAsset = filePath.includes("/assets/");
      const cacheControl = isHashedAsset
        ? CACHE_CONTROL.assets
        : ext === ".html"
          ? CACHE_CONTROL.html
          : CACHE_CONTROL.other;

      const buf = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Cache-Control": cacheControl,
        "Content-Length": buf.length,
        "X-Content-Type-Options": "nosniff",
      });
      res.end(method === "HEAD" ? undefined : buf);
      return;
    }
  } catch {
    // File not found - fall through to SPA fallback
  }

  // ── SPA FALLBACK ─────────────────────────────────────────────────────────
  // For ALL unmatched routes, serve index.html (React handles routing client-side)
  // This is the CRITICAL fix for the blank white screen on direct URL access
  try {
    const indexBuf = await readFile(INDEX_PATH);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": CACHE_CONTROL.html,
      "Content-Length": indexBuf.length,
      "X-Content-Type-Options": "nosniff",
    });
    res.end(method === "HEAD" ? undefined : indexBuf);
  } catch (err) {
    console.error("[serve.mjs] Failed to read index.html:", err);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("500 Internal Server Error: Could not serve application");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    await serveRequest(req, res);
  } catch (err) {
    console.error("[serve.mjs] Unhandled error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("500 Internal Server Error");
    }
  }
});

const listenHost =
  process.env.HOST ||
  (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID ? "::" : "0.0.0.0");

await ensureErpBotBackend();

server.listen(PORT, listenHost, () => {
  console.log(`\n🚀 Sutra ERP server running on http://${listenHost}:${PORT}`);
  console.log(`   Serving files from: ${DIST_DIR}`);
  console.log(`   SPA mode: enabled (all routes → index.html)`);
  console.log(`   Orbix proxy target: ${ERP_BOT_BACKEND || "(missing)"}\n`);
});

// Graceful shutdown for platform SIGTERM
process.on("SIGTERM", () => {
  console.log("\n[serve.mjs] SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("[serve.mjs] Server closed.");
    process.exit(0);
  });
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => process.exit(1), 10000);
});
