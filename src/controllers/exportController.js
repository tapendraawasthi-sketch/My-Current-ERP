import { pool } from '../db/pool.js';

export const getLogs = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM export_logs ORDER BY exported_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

export const addLog = async (req, res, next) => {
  try {
    const { reportType, format, fileName, exportedBy, status, errorMessage } = req.body;
    await pool.query(
      'INSERT INTO export_logs (report_type, format, file_name, exported_by, status, error_message) VALUES ($1, $2, $3, $4, $5, $6)',
      [reportType, format, fileName, exportedBy, status, errorMessage]
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
