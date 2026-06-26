import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import * as featureController from '../controllers/featureController.js';

const router = express.Router();

router.get('/:companyId', requireAuth, featureController.getFeatures);
router.put('/:companyId', requireAuth, requirePermission('company.features'), featureController.updateFeatures);

export default router;
