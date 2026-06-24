import express from 'express';
import multer from 'multer';
import { getSettings, updateSettings, uploadLogo, testEmail } from '../controllers/companyController.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

// Mock auth middleware for now
const requireAdmin = (req, res, next) => {
  req.user = { id: 1, username: 'admin', role: 'admin' };
  next();
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpg, png, gif, webp)'));
    }
  },
});

router.get('/settings', getSettings);

router.put('/settings', 
  requireAdmin, 
  auditLog('UPDATE', 'COMPANY_SETTINGS', { captureBody: true }), 
  updateSettings
);

router.post('/settings/logo', 
  requireAdmin, 
  upload.single('logo'),
  auditLog('UPDATE_LOGO', 'COMPANY_SETTINGS'),
  uploadLogo
);

router.get('/settings/test-email', requireAdmin, testEmail);

export default router;
