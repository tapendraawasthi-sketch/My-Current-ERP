import http from "http";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { join, extname } from "path";
import { readFile, stat } from "fs/promises";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = parseInt(process.env.PORT || "3000");

const MIME = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".html": "text/html",
  ".json": "application/json",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".txt": "text/plain",
};

http
  .createServer(async (req, res) => {
    const urlPath = (req.url || "/").split("?")[0];

    if (urlPath === "/health" || urlPath === "/ping") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("OK");
    }

    // 1. Try to serve static files from dist
    if (urlPath !== "/") {
      const filePath = join(__dirname, "dist", urlPath);
      try {
        const fileStat = await stat(filePath);
        if (fileStat.isFile()) {
          const buf = await readFile(filePath);
          const ext = extname(filePath);
          res.writeHead(200, {
            "Content-Type": MIME[ext] || "application/octet-stream",
            "Cache-Control": urlPath.includes("/assets/")
              ? "public, max-age=31536000, immutable"
              : "no-cache",
          });
          return res.end(buf);
        }
      } catch {
        // File not found, fall through to SPA fallback
      }
    }

    if (urlPath.startsWith("/api/")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Not found" }));
    }

    // 2. SPA Fallback: Serve dist/index.html
    try {
      const indexPath = join(__dirname, "dist", "index.html");
      const buf = await readFile(indexPath);
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Cache-Control": "no-cache",
      });
      return res.end(buf);
    } catch (err) {
      console.error("Error reading index.html:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error: index.html not found. Run build first.");
    }
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`Sutra ERP server ready on port ${PORT}`);
  });
