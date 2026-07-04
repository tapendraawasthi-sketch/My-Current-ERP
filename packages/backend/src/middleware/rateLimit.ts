import type { Request, Response, NextFunction } from "express";
import { getRedis } from "../lib/redis.js";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.sub ?? req.ip ?? "anonymous";
    const key = `ratelimit:${userId}`;
    const redis = getRedis();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, WINDOW_MS);
    }
    if (count > MAX_REQUESTS) {
      res.status(429).json({
        success: false,
        error: "Rate limit exceeded (100 requests per minute)",
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next();
  } catch (err) {
    // If Redis is unavailable, allow the request rather than blocking the API entirely.
    console.warn("[rateLimit] Redis unavailable, skipping limit:", err);
    next();
  }
}
