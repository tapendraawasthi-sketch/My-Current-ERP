import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import multer from 'multer';
import * as importController from '../controllers/importController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/masters', requireAuth, upload.single('file'), importController.importMasters);
router.post('/transactions', requireAuth, upload.single('file'), importController.importTransactions);
router.post('/bank', requireAuth, upload.single('file'), importController.importBankStatement);
router.get('/logs', requireAuth, importController.getLogs);

export default router;
