import { pool } from '../db/pool.js';

export const sendEmail = async (req, res, next) => {
  try {
    const { to, cc, subject, body, attachmentFormat, sendCopyToMyself } = req.body;
    // Mock email sending
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    next(error);
  }
};

export const generateLink = async (req, res, next) => {
  try {
    const { documentRef, expiryHours, allowDownload } = req.body;
    res.json({ success: true, linkToken: 'mock-token-' + Date.now() });
  } catch (error) {
    next(error);
  }
};

export const revokeLink = async (req, res, next) => {
  try {
    const { token } = req.params;
    res.json({ success: true, message: 'Link revoked' });
  } catch (error) {
    next(error);
  }
};

export const getHistory = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM share_logs ORDER BY shared_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
