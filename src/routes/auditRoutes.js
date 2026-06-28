import express from 'express';
import { getAuditLogs, purgeAuditLogs } from '../controllers/auditController.js';

const router = express.Router();

// Mock auth middleware
const requireAdmin = (req, res, next) => {
  req.user = { id: 1, username: 'admin', role: 'admin' };
  next();
};

router.use(requireAdmin);

router.get('/', getAuditLogs);
router.delete('/purge', purgeAuditLogs);

export default router;
