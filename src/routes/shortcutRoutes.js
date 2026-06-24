import express from 'express';
import { getShortcuts, updateShortcut } from '../controllers/shortcutController.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

// Mock auth
const requireAdmin = (req, res, next) => {
  req.user = { id: 1, username: 'admin', role: 'admin' };
  next();
};

router.get('/', getShortcuts);

router.put('/:id', 
  requireAdmin,
  auditLog('UPDATE', 'SHORTCUTS', { captureBody: true }), 
  updateShortcut
);

export default router;
