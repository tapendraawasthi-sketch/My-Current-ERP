import { pool } from '../db/pool.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const exportDatabase = async (req, res, next) => {
  try {
    const tables = [
      'company_settings',
      'fiscal_years',
      'keyboard_shortcuts',
      'audit_logs'
      // Add other tables here as they are migrated to postgres
    ];

    const backupData = {};
    for (const table of tables) {
      try {
        const { rows } = await pool.query(`SELECT * FROM ${table}`);
        backupData[table] = rows;
      } catch (err) {
        console.error(`Failed to export table ${table}:`, err);
      }
    }

    const backupFileName = `sutra_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${backupFileName}`);
    
    res.send(JSON.stringify(backupData, null, 2));
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
    const backupData = JSON.parse(req.file.buffer.toString('utf-8'));
    
    await client.query('BEGIN');

    for (const [table, rows] of Object.entries(backupData)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      
      // Safety check: ensure table exists and only allow known tables
      const allowedTables = ['company_settings', 'fiscal_years', 'keyboard_shortcuts', 'audit_logs'];
      if (!allowedTables.includes(table)) continue;

      // In a real scenario we'd want to TRUNCATE CASCADE or carefully update.
      // For this simple version, we'll clear the table and insert
      await client.query(`TRUNCATE ${table} RESTART IDENTITY CASCADE`);
      
      const columns = Object.keys(rows[0]);
      
      for (const row of rows) {
        const values = columns.map(col => row[col]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        await client.query(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Database restored successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Restore error:', err);
    res.status(500).json({ success: false, error: 'Failed to restore database. Ensure the file is valid.' });
  } finally {
    client.release();
  }
};
