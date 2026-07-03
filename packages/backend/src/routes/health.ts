import { Router } from "express";
import { sendSuccess } from "../middleware/responseEnvelope.js";

const router = Router();

router.get("/health", (_req, res) => {
  sendSuccess(res, { status: "ok" });
});

export default router;
