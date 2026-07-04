import { Router } from "express";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { query } from "../lib/db.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  authMiddleware,
  type AuthTokenPayload,
} from "../middleware/auth.js";
import { sendError, sendSuccess } from "../middleware/responseEnvelope.js";
import { getRedis } from "../lib/redis.js";

const router = Router();

const JWT_EXPIRY = process.env.JWT_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

interface UserRow {
  id: string;
  tenant_id: string;
  company_id: string | null;
  username: string;
  name: string;
  role: string;
  password_hash: string;
  is_active: boolean;
}

function sessionKey(userId: string) {
  return `session:${userId}`;
}

function denylistKey(tokenId: string) {
  return `denylist:refresh:${tokenId}`;
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password, tenantId, forceLogoutOtherSessions } = req.body ?? {};
    if (!username || !password) {
      sendError(res, "username and password are required", 400);
      return;
    }

    const params: unknown[] = [username];
    let sql = `SELECT id, tenant_id, company_id, username, name, role, password_hash, is_active
               FROM users WHERE username = $1`;
    if (tenantId) {
      sql += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    sql += ` LIMIT 1`;

    const result = await query<UserRow>(sql, params);
    const user = result.rows[0];
    if (!user || !user.is_active) {
      sendError(res, "Invalid username or password", 401);
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      sendError(res, "Invalid username or password", 401);
      return;
    }

    const sessionId = randomUUID();
    const payload: AuthTokenPayload = {
      sub: user.id,
      tenantId: user.tenant_id,
      companyId: user.company_id ?? undefined,
      username: user.username,
      role: user.role,
      sessionId,
    };

    const accessToken = signAccessToken(payload, JWT_EXPIRY);
    const refreshToken = signRefreshToken(payload, REFRESH_TOKEN_EXPIRY);

    try {
      const redis = getRedis();
      if (forceLogoutOtherSessions) {
        await redis.del(sessionKey(user.id));
      }
      await redis.hset(sessionKey(user.id), sessionId, "active");
      await redis.expire(sessionKey(user.id), 7 * 24 * 60 * 60);
    } catch (err) {
      console.warn("[auth/login] session store unavailable:", err);
    }

    await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    sendSuccess(res, {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        tenantId: user.tenant_id,
        companyId: user.company_id,
      },
    });
  } catch (err) {
    console.error("[auth/login]", err);
    sendError(res, "Login failed", 500);
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) {
      sendError(res, "refreshToken is required", 400);
      return;
    }

    let payload: AuthTokenPayload & { type?: string };
    try {
      payload = verifyToken(refreshToken) as AuthTokenPayload & { type?: string };
    } catch {
      sendError(res, "Invalid refresh token", 401);
      return;
    }

    if (payload.type !== "refresh") {
      sendError(res, "Invalid refresh token", 401);
      return;
    }

    try {
      const redis = getRedis();
      const denied = await redis.get(denylistKey(payload.sessionId));
      if (denied) {
        sendError(res, "Refresh token has been revoked", 401);
        return;
      }
      const active = await redis.hget(sessionKey(payload.sub), payload.sessionId);
      if (!active) {
        sendError(res, "Session is no longer active", 401);
        return;
      }
    } catch (err) {
      console.warn("[auth/refresh] session check skipped:", err);
    }

    const accessPayload: AuthTokenPayload = {
      sub: payload.sub,
      tenantId: payload.tenantId,
      companyId: payload.companyId,
      username: payload.username,
      role: payload.role,
      sessionId: payload.sessionId,
    };
    const accessToken = signAccessToken(accessPayload, JWT_EXPIRY);
    sendSuccess(res, { accessToken });
  } catch (err) {
    console.error("[auth/refresh]", err);
    sendError(res, "Token refresh failed", 500);
  }
});

// POST /api/auth/logout
router.post("/logout", authMiddleware, async (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};
    const user = req.user!;

    if (refreshToken) {
      try {
        const payload = verifyToken(refreshToken) as AuthTokenPayload & {
          type?: string;
          exp?: number;
        };
        const redis = getRedis();
        const ttlSeconds = payload.exp
          ? Math.max(payload.exp - Math.floor(Date.now() / 1000), 60)
          : 7 * 24 * 60 * 60;
        await redis.setex(denylistKey(payload.sessionId), ttlSeconds, "1");
        await redis.hdel(sessionKey(user.sub), payload.sessionId);
      } catch (err) {
        console.warn("[auth/logout] refresh denylist skipped:", err);
      }
    } else if (user.sessionId) {
      try {
        const redis = getRedis();
        await redis.hdel(sessionKey(user.sub), user.sessionId);
      } catch (err) {
        console.warn("[auth/logout] session removal skipped:", err);
      }
    }

    sendSuccess(res, { loggedOut: true });
  } catch (err) {
    console.error("[auth/logout]", err);
    sendError(res, "Logout failed", 500);
  }
});

export default router;
