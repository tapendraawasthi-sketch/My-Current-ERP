import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runMigrations } from './db/migrate.js';
import { pool } from './db/pool.js';

// Load env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS setup as requested
app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (!origin || allowed.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With']
}));
app.options('*', cors());

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});

import companyRoutes from './routes/companyRoutes.js';
import fiscalYearRoutes from './routes/fiscalYearRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import shortcutRoutes from './routes/shortcutRoutes.js';
import backupRoutes from './routes/backupRoutes.js';

// Routes
app.use('/api/company', companyRoutes);
app.use('/api/fiscal-years', fiscalYearRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/shortcuts', shortcutRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? (status < 500 ? err.message : 'Internal server error')
    : err.message;
  res.status(status).json({ 
    success: false, 
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }) 
  });
});

async function startServer() {
  try {
    // Run migrations before listening
    await runMigrations();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
