import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { sendSuccess } from "../middleware/responseEnvelope.js";

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

  const accepted = records.map((r: { id: string }) => r.id).filter(Boolean);
  sendSuccess(res, { accepted, count: accepted.length });
});

export default router;
