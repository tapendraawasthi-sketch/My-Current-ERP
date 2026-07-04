import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { sendSuccess } from "../middleware/responseEnvelope.js";
import { sendEmailViaSmtp, sendSmsViaGateway } from "../lib/messaging.js";

const router = Router();

router.post("/email", authMiddleware, async (req, res) => {
  try {
    const { to, cc, bcc, subject, body, html, email } = req.body ?? {};
    if (!email || typeof email !== "object") {
      res.status(400).json({
        success: false,
        error: "email configuration object is required",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await sendEmailViaSmtp({ to, cc, bcc, subject, body, html, email });
    sendSuccess(res, { sent: true, method: "smtp" });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : "Email send failed",
      timestamp: new Date().toISOString(),
    });
  }
});

router.post("/sms", authMiddleware, async (req, res) => {
  try {
    const { to, message, messaging } = req.body ?? {};
    if (!messaging || typeof messaging !== "object") {
      res.status(400).json({
        success: false,
        error: "messaging configuration object is required",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await sendSmsViaGateway({ to, message, messaging });
    sendSuccess(res, { sent: true, method: "gateway" });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : "SMS send failed",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
