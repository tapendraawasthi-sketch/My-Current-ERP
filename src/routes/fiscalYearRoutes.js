import express from 'express';
import { getFiscalYears, createFiscalYear, updateFiscalYear, closeFiscalYear } from '../controllers/fiscalYearController.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

// Mock auth middleware for now
const requireAdmin = (req, res, next) => {
  req.user = { id: 1, username: 'admin', role: 'admin' };
  next();
};

router.use(requireAdmin);

router.get('/', getFiscalYears);

router.post('/', 
  auditLog('CREATE', 'FISCAL_YEAR', { captureBody: true }), 
  createFiscalYear
);

router.put('/:id', 
  auditLog('UPDATE', 'FISCAL_YEAR', { captureBody: true }), 
  updateFiscalYear
);

router.post('/:id/close', 
  auditLog('CLOSE', 'FISCAL_YEAR'), 
  closeFiscalYear
);

export default router;
