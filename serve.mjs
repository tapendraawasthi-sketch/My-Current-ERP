import http from "http";
import { fileURLToPath } from "url";
import { join, extname, normalize } from "path";
import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";

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
// Private network alternative (same project; set PORT=8080 on the bot service):
//   ERP_BOT_BACKEND_URL=http://${{sutra-erp-bot.RAILWAY_PRIVATE_DOMAIN}}:${{sutra-erp-bot.PORT}}
function resolveErpBotBackend() {
  const explicit = (process.env.ERP_BOT_BACKEND_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;

  const onRailway = Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_NAME,
  );
  const onRender = Boolean(
    process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL,
  );

  // Local serve.mjs (:3000) — default to the standard erp_bot port so Orbix
  // works without forcing every developer to export ERP_BOT_BACKEND_URL.
  if (!onRailway && !onRender) {
    return "http://127.0.0.1:8765";
  }

  // Allow partial wiring: public host, or private host + port.
  const publicHost = (process.env.ERP_BOT_PUBLIC_DOMAIN || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
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

  // Same-project default private DNS (requires bot service named sutra-erp-bot + PORT var).
  if (privatePort) {
    return `http://sutra-erp-bot.railway.internal:${privatePort}`;
  }

  // Railway project default when ERP_BOT_BACKEND_URL was never set on sutra-erp.
  // Prefer dashboard: ERP_BOT_BACKEND_URL=https://${{sutra-erp-bot.RAILWAY_PUBLIC_DOMAIN}}
  // Runtime evidence (2026-07-20): /health had erp_bot_proxy=missing; Railway bot
  // public edge returned 429; Render sutra-erp-bot returned OIP+Groq ready.
  if (onRailway) {
    return (
      (process.env.ERP_BOT_RENDER_FALLBACK_URL || "").trim().replace(/\/$/, "") ||
      "https://sutra-erp-bot.onrender.com"
    );
  }

  return "";
}

const ERP_BOT_BACKEND = resolveErpBotBackend();

if (ERP_BOT_BACKEND) {
  console.log(`🧠 Orbix OIP proxy: /erp-bot → ${ERP_BOT_BACKEND}`);
} else {
  console.warn(
    "⚠️  ERP_BOT_BACKEND_URL not set — Orbix offline. On Railway sutra-erp Variables set:\n" +
      "    ERP_BOT_BACKEND_URL=https://${{sutra-erp-bot.RAILWAY_PUBLIC_DOMAIN}}",
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

  // Backend configured — actually proxy the request through.
  const targetUrl = `${ERP_BOT_BACKEND}${subpath}`;
  const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(req);

  // Check if this is a streaming endpoint (SSE)
  const isStreamingEndpoint = subpath === "/chat/stream" || subpath.endsWith("/stream");

  try {
    const forwardHeaders = { ...req.headers };
    delete forwardHeaders.host;
    delete forwardHeaders["content-length"];

    // For streaming, set Accept header
    if (isStreamingEndpoint) {
      forwardHeaders.accept = "text/event-stream";
    }

    const upstream = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body,
      signal: AbortSignal.timeout(isStreamingEndpoint ? 120000 : 30000), // 2 min for streaming
    });

    const contentType = upstream.headers.get("content-type") || "application/json";

    // Handle SSE streaming response
    if (isStreamingEndpoint && upstream.body) {
      res.writeHead(upstream.status, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      });

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch (streamErr) {
        console.error("[serve.mjs] SSE stream error:", streamErr);
      } finally {
        res.end();
      }
      return;
    }

    // Non-streaming response
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, { "Content-Type": contentType });
    res.end(buf);
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "ERP bot backend unreachable",
        detail: err instanceof Error ? err.message : String(err),
        target: targetUrl,
      }),
    );
  }
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
      }),
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

server.listen(PORT, listenHost, () => {
  console.log(`\n🚀 Sutra ERP server running on http://${listenHost}:${PORT}`);
  console.log(`   Serving files from: ${DIST_DIR}`);
  console.log(`   SPA mode: enabled (all routes → index.html)\n`);
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
