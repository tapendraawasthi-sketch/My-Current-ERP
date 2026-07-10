import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ success: true, message: "Company API stub — use packages/backend for sync" });
});

export default router;
