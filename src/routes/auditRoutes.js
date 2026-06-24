import express from 'express';
import { getAuditLogs } from '../controllers/auditController.js';

const router = express.Router();

// Mock auth middleware
const requireAdmin = (req, res, next) => {
  req.user = { id: 1, username: 'admin', role: 'admin' };
  next();
};

router.use(requireAdmin);

router.get('/', getAuditLogs);

export default router;
