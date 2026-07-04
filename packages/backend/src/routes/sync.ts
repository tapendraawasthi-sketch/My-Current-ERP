import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { sendSuccess } from "../middleware/responseEnvelope.js";
import { processSyncRecord, type SyncRecordInput } from "../lib/syncHandlers.js";
import { fetchSyncPull } from "../lib/syncPull.js";

const router = Router();

/** Returns server-side master changes since optional ISO timestamp. */
router.get("/pull", authMiddleware, async (req, res) => {
  try {
    const since = typeof req.query.since === "string" ? req.query.since : null;
    const data = await fetchSyncPull(req.user!, since);
    sendSuccess(res, data);
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : "Sync pull failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/** Accepts batched outbox records from the offline-first sync engine. */
router.post("/push", authMiddleware, async (req, res) => {
  const { records } = req.body ?? {};
  if (!Array.isArray(records)) {
    res.status(400).json({
      success: false,
      error: "records array is required",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const accepted: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const record of records as SyncRecordInput[]) {
    const recordId = record?.id;
    if (!recordId) continue;
    try {
      await processSyncRecord(req.user!, record);
      accepted.push(recordId);
    } catch (err) {
      failed.push({
        id: recordId,
        error: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }

  sendSuccess(res, {
    accepted,
    count: accepted.length,
    failed,
    failedCount: failed.length,
  });
});

export default router;
