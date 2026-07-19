import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: [
      "src/__tests__/accounting/**/*.test.ts",
      "src/__tests__/plugin-kernel/**/*.test.ts",
      "src/__tests__/orbix/**/*.test.ts",
      "packages/backend/src/middleware/khataConfirmAuth.test.ts",
      "packages/backend/src/middleware/correlation.test.ts",
      "packages/backend/src/lib/launchMutationDeny.test.ts",
    ],
    setupFiles: ["src/__tests__/accounting/setup.ts"],
    pool: "forks",
  },
});
