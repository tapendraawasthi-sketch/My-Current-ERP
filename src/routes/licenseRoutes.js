import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as licenseController from '../controllers/licenseController.js';

const router = express.Router();

router.get('/status', requireAuth, licenseController.getStatus);
router.post('/activate', requireAuth, licenseController.activate);

export default router;
