import { pool } from '../db/pool.js';

export const auditLog = (action, module, options = {}) => {
  return (req, res, next) => {
    // We only capture response details after it's finished
    res.on('finish', async () => {
      try {
        const userId = req.user?.id || null;
        const username = req.user?.username || 'System';
        const userRole = req.user?.role || 'System';
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const userAgent = req.headers['user-agent'] || '';
        const method = req.method;
        const endpoint = req.originalUrl;
        const status = res.statusCode >= 400 ? 'failed' : 'success';
        
        let oldValue = null;
        let newValue = null;
        let diff = null;

        if (options.captureBody && method !== 'GET') {
          // Remove passwords
          const cleanBody = { ...req.body };
          if (cleanBody.password) delete cleanBody.password;
          if (cleanBody.smtp_pass) delete cleanBody.smtp_pass;
          
          oldValue = options.getOldValue ? await options.getOldValue(req) : null;
          newValue = cleanBody;
          
          if (oldValue && newValue) {
            diff = {};
            for (const key in newValue) {
              if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
                diff[key] = { old: oldValue[key], new: newValue[key] };
              }
            }
          }
        }

        // Insert into audit logs
        await pool.query(`
          INSERT INTO audit_logs (
            user_id, username, user_role, ip_address, user_agent,
            action, module, description, old_value, new_value, diff,
            status, http_method, endpoint, entity_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
          userId, username, userRole, ipAddress, userAgent,
          action, module, options.description || `${action} on ${module}`,
          oldValue, newValue, diff,
          status, method, endpoint, options.getEntityId ? options.getEntityId(req) : null
        ]);
        
      } catch (err) {
        console.error('Audit Log Error:', err);
      }
    });

    next();
  };
};
