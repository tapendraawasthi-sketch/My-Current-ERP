import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ success: true, shortcuts: [] });
});

export default router;
