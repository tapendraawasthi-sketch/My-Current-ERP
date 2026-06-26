import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as exportController from '../controllers/exportController.js';

const router = express.Router();

router.get('/logs', requireAuth, exportController.getLogs);
router.post('/log', requireAuth, exportController.addLog);

export default router;
