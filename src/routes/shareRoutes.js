import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';
import * as shareController from '../controllers/shareController.js';

const router = express.Router();

router.post('/email', requireAuth, auditMiddleware, shareController.sendEmail);
router.post('/link', requireAuth, shareController.generateLink);
router.delete('/link/:token', requireAuth, shareController.revokeLink);
router.get('/history', requireAuth, shareController.getHistory);

export default router;
