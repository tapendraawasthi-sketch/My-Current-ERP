import { pool } from "../db/pool.js";

export const getFiscalYears = async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM fiscal_years ORDER BY id DESC");
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const createFiscalYear = async (req, res, next) => {
  try {
    const {
      label,
      start_date_bs,
      end_date_bs,
      start_date_ad,
      end_date_ad,
      status,
      is_current,
      notes,
    } = req.body;
    const isCurrent = is_current === true || is_current === "true";

    await pool.query("BEGIN");

    if (is_current) {
      await pool.query("UPDATE fiscal_years SET is_current = false");
    }

    const { rows } = await pool.query(
      `
      INSERT INTO fiscal_years (label, start_date_bs, end_date_bs, start_date_ad, end_date_ad, status, is_current, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `,
      [
        label,
        start_date_bs,
        end_date_bs,
        start_date_ad,
        end_date_ad,
        status,
        isCurrent,
        notes,
        req.user?.id || null,
      ],
    );

    await pool.query("COMMIT");
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    await pool.query("ROLLBACK");
    if (err.code === "23505") {
      // Unique violation
      return res.status(400).json({ success: false, error: "Fiscal year label already exists" });
    }
    next(err);
  }
};

export const updateFiscalYear = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      label,
      start_date_bs,
      end_date_bs,
      start_date_ad,
      end_date_ad,
      status,
      is_current,
      notes,
    } = req.body;
    const isCurrent = is_current === true || is_current === "true";

    await pool.query("BEGIN");

    if (is_current) {
      await pool.query("UPDATE fiscal_years SET is_current = false");
    }

    const { rows } = await pool.query(
      `
      UPDATE fiscal_years SET
        label = COALESCE($1, label),
        start_date_bs = COALESCE($2, start_date_bs),
        end_date_bs = COALESCE($3, end_date_bs),
        start_date_ad = COALESCE($4, start_date_ad),
        end_date_ad = COALESCE($5, end_date_ad),
        status = COALESCE($6, status),
        is_current = COALESCE($7, is_current),
        notes = COALESCE($8, notes)
      WHERE id = $9 RETURNING *
    `,
      [label, start_date_bs, end_date_bs, start_date_ad, end_date_ad, status, isCurrent, notes, id],
    );

    await pool.query("COMMIT");
    if (rows.length === 0)
      return res.status(404).json({ success: false, error: "Fiscal year not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    await pool.query("ROLLBACK");
    next(err);
  }
};

export const closeFiscalYear = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      UPDATE fiscal_years SET
        status = 'closed',
        is_current = false,
        closed_at = NOW(),
        closed_by = $1
      WHERE id = $2 RETURNING *
    `,
      [req.user?.id || null, id],
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, error: "Fiscal year not found" });
    res.json({
      success: true,
      data: rows[0],
      message:
        "Fiscal Year successfully closed. Reversal and balance forwarding logic would trigger here.",
    });
  } catch (err) {
    next(err);
  }
};
