// Run: bun add nodemailer  (if not already installed)
// Render Start Command: node serve.mjs
// Required Environment Variables:
// - SMTP_HOST: The SMTP server hostname (e.g., smtp.gmail.com)
// - SMTP_PORT: The SMTP server port (e.g., 587 or 465)
// - SMTP_USER: The SMTP authentication username/email
// - SMTP_PASS: The SMTP authentication password/app password
// - SMTP_FROM_NAME: (Optional) The display name for the sender (defaults to 'Sutra ERP')
// - SMTP_FROM_EMAIL: (Optional) The sender email address (defaults to SMTP_USER)
// - SMTP_SECURE: (Optional) Set to 'true' to force secure connection (defaults to true if port is 465)
// - SUTRA_API_KEY: Shared secret api key to authorize all /api/* requests
import nodemailer from "nodemailer";
import http from "http";
import { readFile, stat, access } from "fs/promises";
import { join, extname } from "path";

const __dirname = new URL(".", import.meta.url).pathname;
const PORT = parseInt(process.env.PORT || "3000");

process.on("uncaughtException", (err) => {
  console.error("[serve] Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[serve] Unhandled Rejection at:", promise, "reason:", reason);
});

if (typeof crypto === "undefined" || !crypto.getRandomValues) {
  const { webcrypto } = await import("node:crypto");
  globalThis.crypto = webcrypto;
}
console.log(
  `[serve] crypto.getRandomValues available:`,
  typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function",
);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".json": "application/json",
  ".webp": "image/webp",
};

const otpStore = new Map();
// otpStore structure: Map<email_lowercase, { otp, expiresAt, attempts, username }>

const ipRateLimitStore = new Map();
// ipRateLimitStore structure: Map<ip, { sendCount, windowStart }>

// Cleanup expired OTPs and IP rate limit states every 5 minutes to prevent memory leaks
setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of otpStore.entries()) {
      if (val.expiresAt < now) otpStore.delete(key);
    }
    for (const [key, val] of ipRateLimitStore.entries()) {
      if (val.windowStart + 3600000 < now) ipRateLimitStore.delete(key);
    }
  },
  5 * 60 * 1000,
);

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress;
}

function generateOtp() {
  // Cryptographically random 6-digit OTP
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
}

// Auto-detect whichever output directory the build produced.
// TanStack Start + Nitro cloudflare → .output/public/
// TanStack Start vinxi default      → dist/client/
// Plain Vite fallback               → dist/
async function findClientDir() {
  const candidates = [
    join(__dirname, ".output", "public"),
    join(__dirname, "dist", "client"),
    join(__dirname, "dist"),
  ];
  for (const dir of candidates) {
    try {
      await access(join(dir, "index.html"));
      console.log(`[serve] Detected build output at: ${dir}`);
      return dir;
    } catch {
      /* not found, try next */
    }
  }
  return null;
}

const CLIENT_DIR = await findClientDir();

if (!CLIENT_DIR) {
  console.error("[serve] ERROR: No build output found. Run: npm run build");
  console.error("[serve] Checked: .output/public, dist/client, dist");
}

async function handleApiRoute(req, res) {
  // Shared-secret check for all /api/* requests
  const apiKey = req.headers["x-sutra-api-key"];
  const expectedApiKey = process.env.SUTRA_API_KEY;
  if (!expectedApiKey || apiKey !== expectedApiKey) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: "Unauthorized: Invalid or missing API key" }));
    return;
  }

  // Parse request body
  let body = "";
  for await (const chunk of req) body += chunk;
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: "Invalid JSON body" }));
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  // ─── POST /api/send-otp ───────────────────────────────────
  if (pathname === "/api/send-otp" && req.method === "POST") {
    try {
      const { to, toName, username, isTest } = payload;

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFromName = process.env.SMTP_FROM_NAME || "Sutra ERP";
      const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser;

      const safeTo = to ? to.replace(/(.{2}).+(@.+)/, "$1***$2") : "undefined";
      console.log(`[OTP] Received /api/send-otp request for ${safeTo} via ${smtpHost}`);

      if (!to) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Missing required field: to" }));
        return;
      }

      if (!smtpHost || !smtpUser || !smtpPass) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: "SMTP environment variables are not configured on the server.",
          }),
        );
        return;
      }

      // IP Rate limiting: max 20 requests per IP per hour
      const ip = getClientIp(req);
      const ipLimit = ipRateLimitStore.get(ip);
      if (ipLimit && ipLimit.sendCount >= 20 && ipLimit.windowStart + 3600000 > Date.now()) {
        const waitMins = Math.ceil((ipLimit.windowStart + 3600000 - Date.now()) / 60000);
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: `Too many OTP requests from this IP. Please wait ${waitMins} minute(s).`,
          }),
        );
        return;
      }

      // Rate limiting: max 3 OTP requests per email per hour
      const emailKey = to.toLowerCase();
      const existing = otpStore.get(emailKey);
      if (
        existing &&
        existing.sendCount >= 3 &&
        existing.rateLimitWindowStart + 3600000 > Date.now()
      ) {
        const waitMins = Math.ceil((existing.rateLimitWindowStart + 3600000 - Date.now()) / 60000);
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: `Too many OTP requests. Please wait ${waitMins} minute(s).`,
          }),
        );
        return;
      }

      const otp = isTest ? "123456" : generateOtp();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
      const prevCount =
        existing && existing.rateLimitWindowStart + 3600000 > Date.now() ? existing.sendCount : 0;

      // Update IP count
      const currentIpLimit = ipRateLimitStore.get(ip);
      const prevIpCount =
        currentIpLimit && currentIpLimit.windowStart + 3600000 > Date.now()
          ? currentIpLimit.sendCount
          : 0;
      ipRateLimitStore.set(ip, {
        sendCount: prevIpCount + 1,
        windowStart:
          currentIpLimit && currentIpLimit.windowStart + 3600000 > Date.now()
            ? currentIpLimit.windowStart
            : Date.now(),
      });

      otpStore.set(emailKey, {
        otp,
        expiresAt,
        attempts: 0,
        username: username || "",
        sendCount: prevCount + 1,
        rateLimitWindowStart: existing?.rateLimitWindowStart || Date.now(),
      });

      // Create Nodemailer transporter from server SMTP environment variables
      let transporter;
      try {
        transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(smtpPort) || 587,
          secure: process.env.SMTP_SECURE === "true" || Number(smtpPort) === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          connectionTimeout: 10000,
          greetingTimeout: 8000,
          socketTimeout: 10000,
        });
        console.log(`[OTP] Nodemailer transporter created successfully for ${smtpHost}`);
      } catch (err) {
        console.error("[OTP] Failed to create transporter:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: "Failed to create email transporter: " + err.message,
          }),
        );
        return;
      }

      // Build email HTML
      const subject = isTest
        ? "✅ Sutra ERP — SMTP Test Successful"
        : "🔐 Sutra ERP — Your Password Reset OTP";

      const htmlBody = isTest
        ? `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border:1px solid #dde1ea;border-radius:8px;overflow:hidden">
            <div style="background:#1557b0;padding:24px;text-align:center">
              <h1 style="color:white;font-size:20px;margin:0">✅ SMTP Test Successful</h1>
            </div>
            <div style="padding:24px">
              <p style="color:#374151;font-size:14px">Your Sutra ERP email configuration is working correctly.</p>
              <p style="color:#374151;font-size:14px">OTP-based password recovery is now active for your users.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
              <p style="color:#9ca3af;font-size:11px;text-align:center">Sutra ERP • Professional Accounting for Nepal</p>
            </div>
          </div>`
        : `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border:1px solid #dde1ea;border-radius:8px;overflow:hidden">
            <div style="background:#1557b0;padding:24px;text-align:center">
              <h1 style="color:white;font-size:20px;margin:0">🔐 Password Reset OTP</h1>
              <p style="color:#bfdbfe;font-size:13px;margin:6px 0 0">Sutra ERP</p>
            </div>
            <div style="padding:32px 24px">
              <p style="color:#374151;font-size:14px;margin-bottom:8px">Hello <strong>${toName || "User"}</strong>,</p>
              <p style="color:#374151;font-size:14px;margin-bottom:24px">Your One-Time Password (OTP) for resetting your Sutra ERP password is:</p>
              <div style="background:#f0f4ff;border:2px dashed #1557b0;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
                <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#1557b0;font-family:monospace">${otp}</span>
              </div>
              <p style="color:#6b7280;font-size:13px;margin-bottom:6px">⏱ This OTP expires in <strong>10 minutes</strong>.</p>
              <p style="color:#6b7280;font-size:13px;margin-bottom:6px">🔒 Do not share this code with anyone — Sutra ERP staff will never ask for it.</p>
              <p style="color:#6b7280;font-size:13px;">If you did not request a password reset, please ignore this email or contact your administrator.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
              <p style="color:#9ca3af;font-size:11px;text-align:center">Sutra ERP • Professional Accounting for Nepal<br/>This is an automated message — please do not reply.</p>
            </div>
          </div>`;

      try {
        await transporter.sendMail({
          from: `"${smtpFromName}" <${smtpFromEmail}>`,
          to: `"${toName || ""}" <${to}>`,
          subject,
          html: htmlBody,
        });

        console.log(
          `[OTP] ${isTest ? "Test email" : "OTP"} sent successfully to ${to.replace(/(.{2}).+(@.+)/, "$1***$2")}`,
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error("[OTP] sendMail failed. Raw Error:", err);
        otpStore.delete(emailKey); // Remove stored OTP if email failed
        let friendlyError = err.message;
        if (
          err.message.includes("Invalid login") ||
          err.message.includes("Username and Password")
        ) {
          friendlyError = "SMTP authentication failed. Check your email and App Password.";
        } else if (
          err.message.includes("connect ECONNREFUSED") ||
          err.message.includes("ENOTFOUND")
        ) {
          friendlyError = "Cannot connect to SMTP server. Check the host and port.";
        } else if (err.message.includes("self signed") || err.message.includes("certificate")) {
          friendlyError = "SSL certificate error. Try toggling the SSL setting.";
        }
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: friendlyError }));
      }
    } catch (fatalErr) {
      console.error("[OTP] Fatal error in /api/send-otp handler:", fatalErr);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Internal Server Error" }));
    }
    return;
  }

  // ─── POST /api/verify-otp ─────────────────────────────────
  if (pathname === "/api/verify-otp" && req.method === "POST") {
    const { email, otp } = payload;

    if (!email || !otp) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Missing email or otp" }));
      return;
    }

    const emailKey = email.toLowerCase();
    const session = otpStore.get(emailKey);

    if (!session) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: "No active OTP session. Please request a new OTP.",
        }),
      );
      return;
    }

    if (Date.now() > session.expiresAt) {
      otpStore.delete(emailKey);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: false, error: "OTP has expired. Please request a new one." }),
      );
      return;
    }

    if (session.attempts >= 3) {
      otpStore.delete(emailKey);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: "Too many wrong attempts. Please request a new OTP.",
        }),
      );
      return;
    }

    if (otp.trim() !== session.otp) {
      session.attempts += 1;
      otpStore.set(emailKey, session);
      const remaining = 3 - session.attempts;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
        }),
      );
      return;
    }

    // OTP correct — mark as verified and extend expiry by 2 minutes for password change
    session.verified = true;
    session.expiresAt = Date.now() + 2 * 60 * 1000;
    otpStore.set(emailKey, session);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, username: session.username }));
    return;
  }

  // ─── POST /api/consume-otp (called after password is changed to invalidate OTP) ───
  if (pathname === "/api/consume-otp" && req.method === "POST") {
    const { email } = payload;
    if (email) otpStore.delete(email.toLowerCase());
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // 404 for unrecognized API routes
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ success: false, error: "API route not found" }));
}

http
  .createServer(async (req, res) => {
    // Handle CORS for API routes
    if (req.url && req.url.startsWith("/api/")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Sutra-Api-Key");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      await handleApiRoute(req, res);
      return;
    }

    if (!CLIENT_DIR) {
      res.writeHead(503, { "Content-Type": "text/plain" });
      return res.end("Build output not found — redeploy with a successful npm run build");
    }

    const urlPath = (req.url || "/").split("?")[0];
    const filePath = join(CLIENT_DIR, urlPath);

    // Security: block path traversal outside CLIENT_DIR
    if (!filePath.startsWith(CLIENT_DIR)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    try {
      const s = await stat(filePath);
      if (s.isFile()) {
        const buf = await readFile(filePath);
        const ct = MIME[extname(filePath)] || "application/octet-stream";
        res.writeHead(200, {
          "Content-Type": ct,
          "Cache-Control": "public, max-age=31536000, immutable",
        });
        return res.end(buf);
      }
    } catch {
      /* not a file — fall through to SPA shell */
    }

    // SPA fallback: serve index.html for all non-asset routes
    try {
      const html = await readFile(join(CLIENT_DIR, "index.html"));
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      return res.end(html);
    } catch {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("index.html missing from build output");
    }
  })
  .listen(PORT, () => console.log(`[serve] Sutra ERP ready on port ${PORT}`));
