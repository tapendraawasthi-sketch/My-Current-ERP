// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import { execSync } from "child_process";
import { searchWebViaDdgHtml } from "./scripts/ddgHtmlSearch.mjs";

function erpBotWebSearchPlugin() {
  return {
    name: "erp-bot-web-search",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/erp-bot/web-search")) {
          next();
          return;
        }

        const params = new URLSearchParams(url.split("?")[1] || "");
        const q = params.get("q") || "";
        const maxResults = Math.min(
          Math.max(parseInt(params.get("max_results") || "5", 10) || 5, 1),
          8,
        );

        try {
          const payload = await searchWebViaDdgHtml(q, maxResults);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message || "Web search failed" }));
        }
      });
    },
  };
}

const buildSha =
  process.env.RENDER_GIT_COMMIT ||
  process.env.GITHUB_SHA ||
  (() => {
    try {
      return execSync("git rev-parse --short HEAD").toString().trim();
    } catch {
      return "dev";
    }
  })();

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths(), erpBotWebSearchPlugin()],
  define: {
    __APP_BUILD_SHA__: JSON.stringify(buildSha),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom"))
            return "react";
          if (id.includes("node_modules/lucide-react") || id.includes("node_modules/recharts"))
            return "ui";
          if (id.includes("node_modules/dexie")) return "db";
          if (id.includes("node_modules/jspdf") || id.includes("node_modules/jspdf-autotable"))
            return "pdf";
          if (id.includes("node_modules/xlsx")) return "xlsx";
          if (id.includes("node_modules/@tanstack")) return "tanstack";
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "dexie", "zustand"],
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      "/erp-bot": {
        target: "http://localhost:8765",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/erp-bot/, ""),
        bypass(req) {
          if (req.url?.startsWith("/erp-bot/web-search")) {
            return req.url;
          }
        },
      },
    },
  },
});
