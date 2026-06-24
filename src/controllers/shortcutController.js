import { pool } from '../db/pool.js';

export const getShortcuts = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM keyboard_shortcuts ORDER BY display_order ASC, id ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const updateShortcut = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { key_combo, is_active } = req.body;
    
    // Check for collision
    if (key_combo) {
      const { rows: existing } = await pool.query('SELECT id FROM keyboard_shortcuts WHERE key_combo = $1 AND id != $2', [key_combo, id]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, error: 'Key combination is already in use by another shortcut' });
      }
    }
    
    const { rows } = await pool.query(`
      UPDATE keyboard_shortcuts SET
        key_combo = COALESCE($1, key_combo),
        is_active = COALESCE($2, is_active),
        updated_at = NOW()
      WHERE id = $3 RETURNING *
    `, [key_combo, is_active, id]);
    
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Shortcut not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};
