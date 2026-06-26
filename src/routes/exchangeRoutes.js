import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as exchangeController from '../controllers/exchangeController.js';

const router = express.Router();

router.post('/sync', requireAuth, exchangeController.sync);
router.get('/logs', requireAuth, exchangeController.getLogs);
router.put('/settings', requireAuth, exchangeController.updateSettings);

export default router;
