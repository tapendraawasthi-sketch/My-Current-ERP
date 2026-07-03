import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { sendSuccess } from "../middleware/responseEnvelope.js";
import { processSyncRecord, type SyncRecordInput } from "../lib/syncHandlers.js";

const router = Router();

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
