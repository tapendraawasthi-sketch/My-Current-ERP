import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: "./index.html",
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react/") || id.includes("react-dom/")) return "vendor";
            if (id.includes("@radix-ui")) return "ui";
            if (id.includes("recharts")) return "charts";
            if (id.includes("jspdf") || id.includes("jspdf-autotable")) return "pdf";
            if (id.includes("nepali-date-converter")) return "date";
            if (id.includes("dexie")) return "db";
          }
        },
      },
    },
  },
});
