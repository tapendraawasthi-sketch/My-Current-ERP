import { pool } from '../db/pool.js';

export const getFeatures = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { rows } = await pool.query('SELECT * FROM company_features WHERE company_id = $1', [companyId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

export const updateFeatures = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const features = req.body; // array of feature key/value objects
    // Mock update
    res.json({ success: true, message: 'Features updated' });
  } catch (error) {
    next(error);
  }
};
