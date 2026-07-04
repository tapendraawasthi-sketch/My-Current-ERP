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
      `   On Render: ensure buildCommand runs before startCommand.\n`,
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

const ERP_BOT_BACKEND = (process.env.ERP_BOT_BACKEND_URL || "").replace(/\/$/, "");

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function handleErpBotRequest(req, res, method, rawPath) {
  const subpath = rawPath.replace(/^\/erp-bot/, "") || "/";

  if (ERP_BOT_BACKEND) {
    try {
      const targetUrl = `${ERP_BOT_BACKEND}${subpath}`;
      const headers = { ...req.headers, host: undefined };
      const init = { method, headers };
      if (method !== "GET" && method !== "HEAD") {
        init.body = await readRequestBody(req);
      }
      const upstream = await fetch(targetUrl, init);
      const body = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Content-Length": body.length,
      });
      res.end(body);
    } catch (err) {
      console.error("[serve.mjs] ERP bot proxy error:", err);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "ERP bot backend unreachable" }));
    }
    return;
  }

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
        message: "e-Khata built-in Nepali brain (self-contained, no external apps)",
      }),
    );
    return;
  }

  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      error: "ERP bot not deployed",
      mode: "builtin",
      hint: "Falcon AI answers from built-in guides when the bot is offline",
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

  // Health check endpoints (used by Render for health monitoring)
  if (rawPath === "/health" || rawPath === "/ping" || rawPath === "/_health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
        commit: process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || "unknown",
        service: "sutra-erp",
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Sutra ERP server running on http://0.0.0.0:${PORT}`);
  console.log(`   Serving files from: ${DIST_DIR}`);
  console.log(`   SPA mode: enabled (all routes → index.html)\n`);
});

// Graceful shutdown for Render's SIGTERM
process.on("SIGTERM", () => {
  console.log("\n[serve.mjs] SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("[serve.mjs] Server closed.");
    process.exit(0);
  });
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => process.exit(1), 10000);
});
