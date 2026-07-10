import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/__tests__/accounting/**/*.test.ts", "src/__tests__/plugin-kernel/**/*.test.ts"],
    setupFiles: ["src/__tests__/accounting/setup.ts"],
    pool: "forks",
  },
});
