import { pool } from '../db/pool.js';

export const getAuditLogs = async (req, res, next) => {
  try {
    const { module, action, startDate, endDate, limit = 50, offset = 0 } = req.query;
    
    let queryText = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (module) {
      queryText += ` AND module = $${paramIdx++}`;
      params.push(module);
    }
    if (action) {
      queryText += ` AND action = $${paramIdx++}`;
      params.push(action);
    }
    if (startDate) {
      queryText += ` AND timestamp >= $${paramIdx++}`;
      params.push(startDate);
    }
    if (endDate) {
      queryText += ` AND timestamp <= $${paramIdx++}`;
      params.push(endDate);
    }

    queryText += ` ORDER BY timestamp DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit);
    params.push(offset);

    const { rows } = await pool.query(queryText, params);
    
    // Get total count for pagination
    let countQueryText = 'SELECT COUNT(*) FROM audit_logs WHERE 1=1';
    const countParams = [];
    let countParamIdx = 1;
    if (module) {
      countQueryText += ` AND module = $${countParamIdx++}`;
      countParams.push(module);
    }
    if (action) {
      countQueryText += ` AND action = $${countParamIdx++}`;
      countParams.push(action);
    }
    if (startDate) {
      countQueryText += ` AND timestamp >= $${countParamIdx++}`;
      countParams.push(startDate);
    }
    if (endDate) {
      countQueryText += ` AND timestamp <= $${countParamIdx++}`;
      countParams.push(endDate);
    }
    
    const countRes = await pool.query(countQueryText, countParams);
    const total = parseInt(countRes.rows[0].count, 10);

    res.json({ success: true, data: rows, meta: { total, limit, offset } });
  } catch (err) {
    next(err);
  }
};
