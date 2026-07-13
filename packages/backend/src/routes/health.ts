import { Router } from "express";
import { sendSuccess } from "../middleware/responseEnvelope.js";

const router = Router();

router.get("/health", (_req, res) => {
  sendSuccess(res, { status: "ok" });
});

/** Phase 5 sync readiness — no secrets. */
router.get("/sync/ready", (_req, res) => {
  const testMode = process.env.ORBIX_SYNC_TEST_MODE === "true";
  const useFile =
    testMode ||
    process.env.ORBIX_SYNC_USE_FILE_STORE === "true" ||
    !process.env.DATABASE_URL;
  const persistence = useFile ? "file_store" : "postgresql";
  const authMode = testMode ? "jwt_or_e2e_test_token" : "jwt_required";

  sendSuccess(res, {
    api: true,
    sync_push_ready: true,
    sync_pull_ready: true,
    persistence_mode: persistence,
    test_mode: testMode,
    authentication_mode: authMode,
    company_scoping: testMode
      ? "token_company_or_body_in_test_mode"
      : "token_company_required",
    migration_state: useFile ? "file_store_no_pg_migration" : "ensureEventSyncTables_on_demand",
    production_url_guard: !String(process.env.VITE_API_URL || "").includes("production"),
    e2e_reset_available: testMode,
  });
});

export default router;
