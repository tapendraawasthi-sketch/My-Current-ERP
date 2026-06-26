import { pool } from './pool.js';

export async function runMigrations() {
  const client = await pool.connect();
  console.log('Running database migrations...');
  try {
    await client.query('BEGIN');

    // 1. Company Settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL DEFAULT 'My Company',
        company_name_nepali VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        district VARCHAR(100),
        province VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Nepal',
        phone VARCHAR(50),
        mobile VARCHAR(50),
        email VARCHAR(255),
        website VARCHAR(255),
        pan_number VARCHAR(20),
        vat_number VARCHAR(20),
        registration_number VARCHAR(50),
        logo_url TEXT,
        fiscal_year_type VARCHAR(10) DEFAULT 'BS',
        currency_symbol VARCHAR(10) DEFAULT '₨',
        currency_code VARCHAR(5) DEFAULT 'NPR',
        date_format VARCHAR(20) DEFAULT 'BS',
        language VARCHAR(10) DEFAULT 'en',
        decimal_places INTEGER DEFAULT 2,
        enable_vat BOOLEAN DEFAULT true,
        vat_rate DECIMAL(5,2) DEFAULT 13.00,
        enable_tds BOOLEAN DEFAULT false,
        tds_rate DECIMAL(5,2) DEFAULT 0.00,
        invoice_prefix VARCHAR(20) DEFAULT 'INV',
        receipt_prefix VARCHAR(20) DEFAULT 'RCP',
        voucher_prefix VARCHAR(20) DEFAULT 'VCH',
        smtp_host VARCHAR(255),
        smtp_port INTEGER DEFAULT 587,
        smtp_user VARCHAR(255),
        smtp_pass VARCHAR(500),
        smtp_from VARCHAR(255),
        theme_color VARCHAR(20) DEFAULT '#1a2744',
        enable_nepali_date BOOLEAN DEFAULT true,
        show_both_dates BOOLEAN DEFAULT true,
        financial_year_start_month INTEGER DEFAULT 4,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Insert default company settings if empty
    await client.query(`
      INSERT INTO company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    `);

    // We need users table for references
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Fiscal Years
    await client.query(`
      CREATE TABLE IF NOT EXISTS fiscal_years (
        id SERIAL PRIMARY KEY,
        label VARCHAR(20) NOT NULL,
        start_date_bs VARCHAR(20) NOT NULL,
        end_date_bs VARCHAR(20) NOT NULL,
        start_date_ad DATE NOT NULL,
        end_date_ad DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'inactive',
        is_current BOOLEAN DEFAULT false,
        closed_at TIMESTAMP,
        closed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id),
        notes TEXT,
        CONSTRAINT unique_label UNIQUE (label)
      );
    `);

    // 3. Backup History
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_history (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(500) NOT NULL,
        file_size_bytes BIGINT,
        storage_backend VARCHAR(20) DEFAULT 'local',
        storage_path TEXT,
        download_url TEXT,
        backup_type VARCHAR(20) DEFAULT 'manual',
        status VARCHAR(20) DEFAULT 'completed',
        tables_backed_up INTEGER,
        rows_backed_up BIGINT,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id),
        notes TEXT,
        checksum VARCHAR(64),
        error_message TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_schedule (
        id SERIAL PRIMARY KEY,
        enabled BOOLEAN DEFAULT false,
        frequency VARCHAR(20) DEFAULT 'daily',
        time VARCHAR(10) DEFAULT '02:00',
        timezone VARCHAR(50) DEFAULT 'Asia/Kathmandu',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. Audit Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT NOW(),
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(100),
        user_role VARCHAR(50),
        ip_address VARCHAR(45),
        user_agent TEXT,
        action VARCHAR(100) NOT NULL,
        module VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50),
        entity_id VARCHAR(100),
        entity_name VARCHAR(255),
        description TEXT,
        old_value JSONB,
        new_value JSONB,
        diff JSONB,
        status VARCHAR(20) DEFAULT 'success',
        http_method VARCHAR(10),
        endpoint VARCHAR(255),
        duration_ms INTEGER,
        fiscal_year_id INTEGER REFERENCES fiscal_years(id)
      );
    `);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(module);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);`);

    // 5. Keyboard Shortcuts
    await client.query(`
      CREATE TABLE IF NOT EXISTS keyboard_shortcuts (
        id SERIAL PRIMARY KEY,
        key_combo VARCHAR(20) NOT NULL UNIQUE,
        label VARCHAR(100) NOT NULL,
        action_type VARCHAR(30) NOT NULL,
        action_value TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        icon VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed Shortcuts
    await client.query(`
      INSERT INTO keyboard_shortcuts (id, key_combo, label, action_type, action_value, category, icon, is_active, display_order)
      VALUES 
      (1, 'F1', 'Help', 'navigate', '/help', 'general', 'help-circle', true, 1),
      (2, 'F2', 'Add Account', 'modal', 'AddAccountModal', 'masters', 'user-plus', true, 2),
      (3, 'F3', 'Add Item', 'modal', 'AddItemModal', 'masters', 'package', true, 3),
      (4, 'F4', 'Add Master', 'navigate', '/masters', 'masters', 'database', true, 4),
      (5, 'F5', 'Add Voucher', 'modal', 'AddVoucherModal', 'transactions', 'file-plus', true, 5),
      (6, 'F6', 'Add Payment', 'modal', 'AddPaymentModal', 'transactions', 'credit-card', true, 6),
      (7, 'F7', 'Add Receipt', 'modal', 'AddReceiptModal', 'transactions', 'receipt', true, 7),
      (8, 'F8', 'Add Journal', 'modal', 'AddJournalModal', 'transactions', 'book', true, 8),
      (9, 'F9', 'Add Sales', 'modal', 'AddSalesModal', 'transactions', 'shopping-cart', true, 9),
      (10, 'B', 'Balance Sheet', 'report', 'balance_sheet', 'reports', 'bar-chart-2', true, 10),
      (11, 'T', 'Trial Balance', 'report', 'trial_balance', 'reports', 'list', true, 11),
      (12, 'S', 'Stock Status', 'report', 'stock_status', 'reports', 'box', true, 12),
      (13, 'A', 'Acc. Summary', 'report', 'acc_summary', 'reports', 'layout', true, 13),
      (14, 'L', 'Acc. Ledger', 'navigate', '/reports/ledger', 'reports', 'book-open', true, 14),
      (15, 'V', 'VAT Report', 'report', 'vat_report', 'reports', 'percent', true, 15),
      (16, 'D', 'Day Book', 'report', 'day_book', 'reports', 'calendar', true, 16),
      (17, 'G', 'GST/VAT Summary', 'report', 'gst_vat_summary', 'reports', 'file-text', true, 17),
      (18, 'U', 'Switch User', 'modal', 'SwitchUserModal', 'admin', 'users', true, 18),
      (19, 'F10', 'Configuration', 'navigate', '/company/settings', 'admin', 'settings', true, 19),
      (20, 'K', 'Lock Program', 'modal', 'LockProgramModal', 'admin', 'lock', true, 20)
      ON CONFLICT (key_combo) DO NOTHING;
    `);
    
    // Fix sequence if we seeded specific IDs
    await client.query(`
        SELECT setval('keyboard_shortcuts_id_seq', (SELECT MAX(id) FROM keyboard_shortcuts));
    `);

    // 6. Top Menu Bar & Additional Features
    await client.query(`
      CREATE TABLE IF NOT EXISTS export_logs (
        id SERIAL PRIMARY KEY,
        exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        exported_by VARCHAR(100),
        report_type VARCHAR(100),
        format VARCHAR(20),
        file_name VARCHAR(255),
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS import_logs (
        id SERIAL PRIMARY KEY,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        imported_by VARCHAR(100),
        import_type VARCHAR(100),
        file_name VARCHAR(255),
        total_records INT DEFAULT 0,
        success_records INT DEFAULT 0,
        failed_records INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'success'
      );

      CREATE TABLE IF NOT EXISTS print_logs (
        id SERIAL PRIMARY KEY,
        printed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        printed_by VARCHAR(100),
        document_type VARCHAR(100),
        document_number VARCHAR(100),
        printer_name VARCHAR(100),
        copies INT DEFAULT 1,
        status VARCHAR(20) DEFAULT 'success'
      );

      CREATE TABLE IF NOT EXISTS share_logs (
        id SERIAL PRIMARY KEY,
        shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        shared_by VARCHAR(100),
        shared_with TEXT,
        method VARCHAR(20),
        document_type VARCHAR(100),
        document_ref VARCHAR(255),
        status VARCHAR(20) DEFAULT 'sent',
        is_opened BOOLEAN DEFAULT FALSE,
        link_token VARCHAR(255),
        link_expiry TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS company_features (
        id SERIAL PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL,
        feature_key VARCHAR(100) NOT NULL,
        is_enabled BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(company_id, feature_key)
      );

      CREATE TABLE IF NOT EXISTS cloud_backup_settings (
        id SERIAL PRIMARY KEY,
        company_id VARCHAR(100),
        provider VARCHAR(50),
        schedule VARCHAR(50),
        retention_days INT DEFAULT 30,
        is_encrypted BOOLEAN DEFAULT TRUE,
        last_backup_at TIMESTAMPTZ,
        last_backup_status VARCHAR(20),
        is_active BOOLEAN DEFAULT FALSE
      );
    `);

    await client.query('COMMIT');
    console.log('Database migrations completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error running migrations:', err);
    throw err;
  } finally {
    client.release();
  }
}
