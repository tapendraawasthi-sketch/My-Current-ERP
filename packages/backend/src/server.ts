import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import syncRouter from "./routes/sync.js";
import messagingRouter from "./routes/messaging.js";
import { envelopeMiddleware } from "./middleware/responseEnvelope.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { connectRedis } from "./lib/redis.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(envelopeMiddleware);
app.use(rateLimitMiddleware);

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/sync", syncRouter);
app.use("/api/messaging", messagingRouter);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found",
    timestamp: new Date().toISOString(),
  });
});

async function start() {
  try {
    await connectRedis();
  } catch (err) {
    console.warn("[server] Redis not connected — rate limiting and sessions may be degraded:", err);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Sutra ERP API running on http://0.0.0.0:${PORT}`);
    console.log(`   Health: GET /api/health\n`);
  });
}

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
