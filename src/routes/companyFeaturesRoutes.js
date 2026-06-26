import express from 'express';
import { getCompanyFeatures, updateCompanyFeatures, getFeatureAuditLog, getCompanyAddresses, saveCompanyAddresses } from '../controllers/companyFeaturesController.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

// Mock auth middleware
const requireAdmin = (req, res, next) => {
  req.user = { id: 1, username: 'admin', role: 'admin' };
  next();
};

// GET / -> getCompanyFeatures (no auth required)
router.get('/', getCompanyFeatures);

// PUT / -> requireAdmin, auditLog, updateCompanyFeatures
router.put('/', requireAdmin, auditLog('UPDATE', 'COMPANY_FEATURES', { captureBody: true }), updateCompanyFeatures);

// GET /audit-log -> requireAdmin, getFeatureAuditLog
router.get('/audit-log', requireAdmin, getFeatureAuditLog);

// GET /addresses -> getCompanyAddresses
router.get('/addresses', getCompanyAddresses);

// POST /addresses -> requireAdmin, auditLog, saveCompanyAddresses
router.post('/addresses', requireAdmin, auditLog('UPDATE', 'COMPANY_ADDRESSES', { captureBody: true }), saveCompanyAddresses);

export default router;
