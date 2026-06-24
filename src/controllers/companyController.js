import { pool } from '../db/pool.js';
import nodemailer from 'nodemailer';

export const getSettings = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM company_settings WHERE id = 1');
    if (rows.length === 0) {
      return res.json({}); // Provide empty object, frontend falls back to defaults or we can insert one.
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const {
      company_name, company_name_nepali, address, city, district, province,
      country, phone, mobile, email, website, pan_number, vat_number,
      registration_number, fiscal_year_type, currency_symbol, currency_code,
      date_format, language, decimal_places, enable_vat, vat_rate,
      enable_tds, tds_rate, invoice_prefix, receipt_prefix, voucher_prefix,
      smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
      theme_color, enable_nepali_date, show_both_dates, financial_year_start_month
    } = req.body;

    // Validation
    if (pan_number && (pan_number.length !== 9 || !/^\d+$/.test(pan_number))) {
      return res.status(400).json({ success: false, error: 'PAN number must be exactly 9 digits' });
    }
    if (vat_rate < 0 || vat_rate > 100) {
      return res.status(400).json({ success: false, error: 'VAT rate must be between 0 and 100' });
    }
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    const { rows } = await pool.query(`
      UPDATE company_settings SET
        company_name = COALESCE($1, company_name),
        company_name_nepali = COALESCE($2, company_name_nepali),
        address = COALESCE($3, address),
        city = COALESCE($4, city),
        district = COALESCE($5, district),
        province = COALESCE($6, province),
        country = COALESCE($7, country),
        phone = COALESCE($8, phone),
        mobile = COALESCE($9, mobile),
        email = COALESCE($10, email),
        website = COALESCE($11, website),
        pan_number = COALESCE($12, pan_number),
        vat_number = COALESCE($13, vat_number),
        registration_number = COALESCE($14, registration_number),
        fiscal_year_type = COALESCE($15, fiscal_year_type),
        currency_symbol = COALESCE($16, currency_symbol),
        currency_code = COALESCE($17, currency_code),
        date_format = COALESCE($18, date_format),
        language = COALESCE($19, language),
        decimal_places = COALESCE($20, decimal_places),
        enable_vat = COALESCE($21, enable_vat),
        vat_rate = COALESCE($22, vat_rate),
        enable_tds = COALESCE($23, enable_tds),
        tds_rate = COALESCE($24, tds_rate),
        invoice_prefix = COALESCE($25, invoice_prefix),
        receipt_prefix = COALESCE($26, receipt_prefix),
        voucher_prefix = COALESCE($27, voucher_prefix),
        smtp_host = COALESCE($28, smtp_host),
        smtp_port = COALESCE($29, smtp_port),
        smtp_user = COALESCE($30, smtp_user),
        smtp_pass = COALESCE($31, smtp_pass),
        smtp_from = COALESCE($32, smtp_from),
        theme_color = COALESCE($33, theme_color),
        enable_nepali_date = COALESCE($34, enable_nepali_date),
        show_both_dates = COALESCE($35, show_both_dates),
        financial_year_start_month = COALESCE($36, financial_year_start_month),
        updated_at = NOW()
      WHERE id = 1 RETURNING *
    `, [
      company_name, company_name_nepali, address, city, district, province,
      country, phone, mobile, email, website, pan_number, vat_number,
      registration_number, fiscal_year_type, currency_symbol, currency_code,
      date_format, language, decimal_places, enable_vat, vat_rate,
      enable_tds, tds_rate, invoice_prefix, receipt_prefix, voucher_prefix,
      smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
      theme_color, enable_nepali_date, show_both_dates, financial_year_start_month
    ]);

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No logo file provided' });
    }
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    await pool.query('UPDATE company_settings SET logo_url = $1, updated_at = NOW() WHERE id = 1', [logoUrl]);
    res.json({ success: true, data: { logoUrl } });
  } catch (err) {
    next(err);
  }
};

export const testEmail = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, email FROM company_settings WHERE id = 1');
    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'SMTP settings not found' });
    }
    const settings = rows[0];

    if (!settings.smtp_host || !settings.smtp_user) {
      return res.status(400).json({ success: false, error: 'SMTP host and user must be configured first' });
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port || 587,
      secure: settings.smtp_port === 465,
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
    });

    await transporter.sendMail({
      from: settings.smtp_from || settings.smtp_user,
      to: settings.email || settings.smtp_user,
      subject: 'Test Email from Sutra ERP',
      text: 'This is a test email to verify your SMTP configuration is correct.',
    });

    res.json({ success: true, message: `Test email sent successfully to ${settings.email || settings.smtp_user}` });
  } catch (err) {
    res.status(500).json({ success: false, error: `SMTP Error: ${err.message}` });
  }
};
