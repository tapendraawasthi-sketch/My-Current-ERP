import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ success: true, message: "Backup API stub" });
});

export default router;
