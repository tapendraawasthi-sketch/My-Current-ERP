import express from 'express';
import multer from 'multer';
import { exportDatabase, importDatabase } from '../controllers/backupController.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Mock auth
const requireAdmin = (req, res, next) => {
  req.user = { id: 1, username: 'admin', role: 'admin' };
  next();
};

router.use(requireAdmin);

router.get('/export', 
  auditLog('EXPORT', 'BACKUP'),
  exportDatabase
);

router.post('/import', 
  upload.single('file'),
  auditLog('IMPORT', 'BACKUP'),
  importDatabase
);

export default router;
