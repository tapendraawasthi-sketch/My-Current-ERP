import { pool } from '../db/pool.js';

export const importMasters = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Masters imported successfully' });
  } catch (error) {
    next(error);
  }
};

export const importTransactions = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Transactions imported successfully' });
  } catch (error) {
    next(error);
  }
};

export const importBankStatement = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Bank statement imported successfully' });
  } catch (error) {
    next(error);
  }
};

export const getLogs = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM import_logs ORDER BY imported_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
