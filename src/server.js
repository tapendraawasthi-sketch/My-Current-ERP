import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, existsSync } from 'fs';
import { runMigrations } from './db/migrate.js';
import { pool } from './db/pool.js';
 
dotenv.config();
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
 
const app = express();
const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV !== 'production';
const DIST_DIR = path.join(__dirname, '..', 'dist');
 
// ── CORS ─────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
 
app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin requests (from the same Render service) have no Origin header
      if (!origin) return callback(null, true);
      // Explicitly allowed origins
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow localhost in dev
      if (isDev && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
        return callback(null, true);
      }
      // In production, block unknown origins
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.options(/.*/, cors());
 
// ── BODY PARSERS ─────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
 
// ── HEALTH CHECK ─────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});
 
// ── API ROUTES ───────────────────────────────────────────────────
import companyRoutes from './routes/companyRoutes.js';
import fiscalYearRoutes from './routes/fiscalYearRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import shortcutRoutes from './routes/shortcutRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
 
app.use('/api/company', companyRoutes);
app.use('/api/fiscal-years', fiscalYearRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/shortcuts', shortcutRoutes);
 
// ── SERVE UPLOADED FILES (logos) ─────────────────────────────────
// In production, logos are stored as base64 in DB. But serve /uploads for local dev.
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));
 
// ── SERVE REACT SPA (production only) ────────────────────────────
if (!isDev) {
  if (existsSync(DIST_DIR)) {
    // Serve static assets (JS, CSS, etc)
    app.use(express.static(DIST_DIR, {
      maxAge: '1y',
      etag: true,
      index: false, // We handle this manually below for SPA
    }));
 
    // SPA fallback: ALL non-API routes serve index.html
    app.get(/.*/, (req, res) => {
      if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, error: 'API route not found' });
      const indexPath = path.join(DIST_DIR, 'index.html');
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(503).send('App not built. Run npm run build first.');
      }
    });
  } else {
    console.warn('[WARN] dist/ not found — frontend not available. Run npm run build.');
    app.get(/.*/, (req, res) => {
      if (!req.path.startsWith('/api/')) {
        res.status(503).send('Frontend not built. Run: npm run build');
      }
    });
  }
}
 
// ── 404 FOR API ──────────────────────────────────────────────────
app.use('/api', (req, res, next) => {
  if (req.path === '/') return next(); // Let other things handle /api strictly if needed, but we probably just want 404
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});
 
// ── GLOBAL ERROR HANDLER ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ERROR ${req.method} ${req.path}`, err.message);
  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && status >= 500
      ? 'Internal server error'
      : err.message;
  res.status(status).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});
 
// ── START ────────────────────────────────────────────────────────
async function startServer() {
  try {
    await runMigrations();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Sutra ERP] Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
      console.log(`[Sutra ERP] Frontend served from: ${existsSync(DIST_DIR) ? DIST_DIR : 'NOT BUILT'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}
 
startServer();
