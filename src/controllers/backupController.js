import { pool } from '../db/pool.js';
import crypto from 'crypto';
 
// All tables that should be backed up (in dependency order)
const BACKUP_TABLES = [
  'company_settings',
  'fiscal_years',
  'keyboard_shortcuts',
  'audit_logs',
  'backup_history',
  'backup_schedule',
];
 
// Tables allowed to be restored (same list, strict whitelist)
const RESTORE_TABLES = [
  'company_settings',
  'fiscal_years',
  'keyboard_shortcuts',
  'backup_schedule',
  // NOTE: audit_logs and backup_history are intentionally excluded from restore
  // to preserve the audit trail integrity
];
 
export const exportDatabase = async (req, res, next) => {
  try {
    const backupData = {};
    let totalRows = 0;
    const startTime = Date.now();
 
    for (const table of BACKUP_TABLES) {
      try {
        const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY id ASC`);
        backupData[table] = rows;
        totalRows += rows.length;
      } catch (err) {
        console.warn(`[Backup] Could not export table ${table}:`, err.message);
        backupData[table] = []; // include empty array so restore knows table exists
      }
    }
 
    const now = new Date();
    const bsYear = now.getFullYear() + 57; // rough BS approximation for filename
    const backupPayload = {
      _meta: {
        version: '2.0',
        created_at: now.toISOString(),
        total_tables: BACKUP_TABLES.length,
        total_rows: totalRows,
        app_name: 'Sutra ERP',
      },
      ...backupData,
    };
 
    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const checksum = crypto.createHash('sha256').update(jsonStr).digest('hex');
    const fileSizeBytes = Buffer.byteLength(jsonStr, 'utf8');
    const durationMs = Date.now() - startTime;
 
    // Build filename with date
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `sutra_backup_${dateStr}_${now.getHours()}${String(now.getMinutes()).padStart(2,'0')}.json`;
 
    // Record backup in history
    try {
      await pool.query(
        `INSERT INTO backup_history (filename, file_size_bytes, backup_type, status, tables_backed_up, rows_backed_up, created_by, checksum)
         VALUES ($1, $2, 'manual', 'completed', $3, $4, $5, $6)`,
        [filename, fileSizeBytes, BACKUP_TABLES.length, totalRows, req.user?.id || null, checksum]
      );
    } catch (histErr) {
      console.warn('[Backup] Could not record backup history:', histErr.message);
    }
 
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Backup-Checksum', checksum);
    res.setHeader('X-Backup-Rows', String(totalRows));
    res.setHeader('X-Backup-Duration-Ms', String(durationMs));
    res.send(jsonStr);
  } catch (err) {
    next(err);
  }
};
 
export const importDatabase = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No backup file provided' });
  }
 
  const client = await pool.connect();
 
  try {
    const rawJson = req.file.buffer.toString('utf-8');
    const backupData = JSON.parse(rawJson);
 
    // Verify it's a valid Sutra ERP backup
    if (!backupData._meta || backupData._meta.app_name !== 'Sutra ERP') {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup file. This does not appear to be a Sutra ERP backup.',
      });
    }
 
    const checksum = crypto.createHash('sha256').update(rawJson).digest('hex');
 
    await client.query('BEGIN');
 
    let restoredTables = 0;
    let restoredRows = 0;
    const errors = [];
 
    for (const table of RESTORE_TABLES) {
      const rows = backupData[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;
 
      try {
        // Truncate and re-insert
        await client.query(`TRUNCATE ${table} RESTART IDENTITY CASCADE`);
 
        const columns = Object.keys(rows[0]);
        for (const row of rows) {
          const values = columns.map((col) => row[col]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
          );
        }
        restoredTables++;
        restoredRows += rows.length;
      } catch (tableErr) {
        console.error(`[Restore] Error restoring ${table}:`, tableErr.message);
        errors.push({ table, error: tableErr.message });
      }
    }
 
    // Fix sequences after restore with explicit IDs
    const seqTables = ['company_settings', 'fiscal_years', 'keyboard_shortcuts'];
    for (const t of seqTables) {
      try {
        await client.query(`SELECT setval('${t}_id_seq', COALESCE((SELECT MAX(id) FROM ${t}), 1))`);
      } catch {}
    }
 
    await client.query('COMMIT');
 
    // Log the restore
    try {
      await pool.query(
        `INSERT INTO backup_history (filename, backup_type, status, tables_backed_up, rows_backed_up, created_by, checksum, notes)
         VALUES ($1, 'restore', 'completed', $2, $3, $4, $5, $6)`,
        [
          req.file.originalname || 'uploaded_backup.json',
          restoredTables,
          restoredRows,
          req.user?.id || null,
          checksum,
          errors.length > 0 ? `Errors on: ${errors.map((e) => e.table).join(', ')}` : null,
        ]
      );
    } catch {}
 
    res.json({
      success: true,
      message: `Restore complete. Restored ${restoredRows} rows across ${restoredTables} tables.`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Restore] Fatal error:', err);
    res.status(500).json({
      success: false,
      error: err.message.includes('JSON') ? 'Invalid JSON in backup file.' : 'Failed to restore backup. ' + err.message,
    });
  } finally {
    client.release();
  }
};
 
export const getBackupHistory = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, filename, file_size_bytes, backup_type, status, tables_backed_up, rows_backed_up, created_at, checksum, notes
       FROM backup_history ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};
