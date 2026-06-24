import express from 'express';
import multer from 'multer';
import { exportDatabase, importDatabase, getBackupHistory } from '../controllers/backupController.js';
import { auditLog } from '../middleware/audit.js';
 
const router = express.Router();
 
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON backup files are allowed'), false);
    }
  },
});
 
// Mock auth middleware — replace with real JWT auth when ready
const requireAdmin = (req, res, next) => {
  req.user = { id: 1, username: 'admin', role: 'admin' };
  next();
};
 
router.use(requireAdmin);
 
router.get('/export', auditLog('EXPORT', 'BACKUP'), exportDatabase);
 
router.post('/import',
  upload.single('file'),
  auditLog('IMPORT', 'BACKUP'),
  importDatabase
);
 
router.get('/history', getBackupHistory);
 
export default router;
