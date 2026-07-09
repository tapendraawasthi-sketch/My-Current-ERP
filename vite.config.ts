// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import { execSync } from "child_process";

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

const devPort = 3000;

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  define: {
    __APP_BUILD_SHA__: JSON.stringify(buildSha),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "node:fs": path.resolve(__dirname, "./src/lib/ekhata/vocabulary/stubs/node-fs.ts"),
      "node:module": path.resolve(__dirname, "./src/lib/ekhata/vocabulary/stubs/node-module.ts"),
      "node:path": path.resolve(__dirname, "./src/lib/ekhata/vocabulary/stubs/node-path.ts"),
      "node:url": path.resolve(__dirname, "./src/lib/ekhata/vocabulary/stubs/node-url.ts"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        ekhataHarness: path.resolve(__dirname, "e2e/ekhata.html"),
      },
      output: {
        manualChunks(id) {
          // Split large in-repo data so Render/Vite rolldown stays under WASM memory limits.
          if (id.includes("runtimeMaps")) return "nepal-runtime-maps";
          if (id.includes("lib/nepal-ai/")) return "nepal-ai";
          if (id.includes("lib/ekhata/")) return "ekhata-brain";
          if (id.includes("/src/ai/")) return "sutra-ai";
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
    port: devPort,
    host: true,
    strictPort: true,
    allowedHosts: true,
  },
});
