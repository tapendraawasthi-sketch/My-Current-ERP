// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: { tsconfigPaths: true },
    css: {
      // Switch from lightningcss to postcss to eliminate the
      // "Found 1 warning while optimizing generated CSS" errors.
      // lightningcss does not fully support all Tailwind v4 syntax.
      transformer: "postcss",
    },
    build: {
      // Suppress chunk size warning — our vendor chunks are intentionally large
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react/") || id.includes("react-dom/")) {
                return "vendor";
              }
              if (id.includes("recharts")) {
                return "charts";
              }
              if (id.includes("jspdf") || id.includes("jspdf-autotable")) {
                return "pdf";
              }
              if (id.includes("nepali-date-converter")) {
                return "date";
              }
            }
          },
        },
      },
    },
  },
});
