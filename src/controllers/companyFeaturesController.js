import { pool } from "../db/pool.js";

export const getCompanyFeatures = async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM company_features WHERE id = 1");
    if (rows.length === 0) {
      return res.json({ success: true, data: {} });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const updateCompanyFeatures = async (req, res, next) => {
  try {
    const {
      show_more_features,
      show_all_features,
      maintain_accounts,
      enable_bill_wise_entry,
      enable_cost_centres,
      enable_interest_calculation,
      maintain_inventory,
      integrate_accounts_with_inventory,
      enable_multiple_price_levels,
      enable_batches,
      maintain_expiry_date_for_batches,
      enable_job_order_processing,
      enable_cost_tracking,
      use_discount_column_in_invoices,
      use_separate_actual_billed_qty,
      enable_gst,
      gst_registration_type,
      gstin,
      gst_applicable_from,
      enable_tds,
      tan_number,
      tds_applicable_from,
      enable_tcs,
      tcs_applicable_from,
      enable_vat,
      vat_registration_number,
      vat_applicable_from,
      enable_excise,
      excise_registration_number,
      enable_service_tax,
      service_tax_registration_number,
      enable_browser_access_for_reports,
      enable_remote_access_sync,
      maintain_payroll,
      enable_payroll_statutory,
      pf_registration_number,
      esi_registration_number,
      enable_multiple_addresses,
      mark_modified_vouchers,
      mailing_details_in_local_language,
    } = req.body;

    // Dependency validations
    if (enable_bill_wise_entry && !maintain_accounts) {
      return res.status(400).json({
        success: false,
        error: "Enable Maintain Accounts before enabling Bill-wise Entry.",
      });
    }
    if (enable_cost_centres && !maintain_accounts) {
      return res.status(400).json({
        success: false,
        error: "Enable Maintain Accounts before enabling Cost Centres.",
      });
    }
    if (enable_interest_calculation && !maintain_accounts) {
      return res.status(400).json({
        success: false,
        error: "Enable Maintain Accounts before enabling Interest Calculation.",
      });
    }
    if (enable_batches && !maintain_inventory) {
      return res.status(400).json({
        success: false,
        error: "Enable Maintain Inventory before enabling Batches.",
      });
    }
    if (maintain_expiry_date_for_batches && !enable_batches) {
      return res.status(400).json({
        success: false,
        error: "Enable Batches before enabling Expiry Date for Batches.",
      });
    }
    if (enable_payroll_statutory && !maintain_payroll) {
      return res.status(400).json({
        success: false,
        error: "Enable Maintain Payroll before enabling Payroll Statutory.",
      });
    }

    // Auto-update dependent fields
    let finalShowMoreFeatures = show_more_features;
    if (show_all_features) {
      finalShowMoreFeatures = true;
    }

    // Validation for GSTIN
    if (enable_gst && gstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin)) {
        return res.status(400).json({
          success: false,
          error: "Invalid GSTIN format.",
        });
      }
    }

    // Validation for TAN
    if (enable_tds && tan_number) {
      const tanRegex = /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/;
      if (!tanRegex.test(tan_number)) {
        return res.status(400).json({
          success: false,
          error: "Invalid TAN format. Expected format: AAAA00000A",
        });
      }
    }

    // Capture old values for audit
    const oldResult = await pool.query("SELECT * FROM company_features WHERE id = 1");
    const oldData = oldResult.rows[0] || {};

    // Update query with COALESCE to handle null/undefined
    const result = await pool.query(
      `
      UPDATE company_features SET
        show_more_features = COALESCE($1, show_more_features),
        show_all_features = COALESCE($2, show_all_features),
        maintain_accounts = COALESCE($3, maintain_accounts),
        enable_bill_wise_entry = COALESCE($4, enable_bill_wise_entry),
        enable_cost_centres = COALESCE($5, enable_cost_centres),
        enable_interest_calculation = COALESCE($6, enable_interest_calculation),
        maintain_inventory = COALESCE($7, maintain_inventory),
        integrate_accounts_with_inventory = COALESCE($8, integrate_accounts_with_inventory),
        enable_multiple_price_levels = COALESCE($9, enable_multiple_price_levels),
        enable_batches = COALESCE($10, enable_batches),
        maintain_expiry_date_for_batches = COALESCE($11, maintain_expiry_date_for_batches),
        enable_job_order_processing = COALESCE($12, enable_job_order_processing),
        enable_cost_tracking = COALESCE($13, enable_cost_tracking),
        use_discount_column_in_invoices = COALESCE($14, use_discount_column_in_invoices),
        use_separate_actual_billed_qty = COALESCE($15, use_separate_actual_billed_qty),
        enable_gst = COALESCE($16, enable_gst),
        gst_registration_type = COALESCE($17, gst_registration_type),
        gstin = COALESCE($18, gstin),
        gst_applicable_from = COALESCE($19, gst_applicable_from),
        enable_tds = COALESCE($20, enable_tds),
        tan_number = COALESCE($21, tan_number),
        tds_applicable_from = COALESCE($22, tds_applicable_from),
        enable_tcs = COALESCE($23, enable_tcs),
        tcs_applicable_from = COALESCE($24, tcs_applicable_from),
        enable_vat = COALESCE($25, enable_vat),
        vat_registration_number = COALESCE($26, vat_registration_number),
        vat_applicable_from = COALESCE($27, vat_applicable_from),
        enable_excise = COALESCE($28, enable_excise),
        excise_registration_number = COALESCE($29, excise_registration_number),
        enable_service_tax = COALESCE($30, enable_service_tax),
        service_tax_registration_number = COALESCE($31, service_tax_registration_number),
        enable_browser_access_for_reports = COALESCE($32, enable_browser_access_for_reports),
        enable_remote_access_sync = COALESCE($33, enable_remote_access_sync),
        maintain_payroll = COALESCE($34, maintain_payroll),
        enable_payroll_statutory = COALESCE($35, enable_payroll_statutory),
        pf_registration_number = COALESCE($36, pf_registration_number),
        esi_registration_number = COALESCE($37, esi_registration_number),
        enable_multiple_addresses = COALESCE($38, enable_multiple_addresses),
        mark_modified_vouchers = COALESCE($39, mark_modified_vouchers),
        mailing_details_in_local_language = COALESCE($40, mailing_details_in_local_language),
        modified_by = $41,
        modified_at = NOW()
      WHERE id = 1
      RETURNING *
    `,
      [
        finalShowMoreFeatures,
        show_all_features,
        maintain_accounts,
        enable_bill_wise_entry,
        enable_cost_centres,
        enable_interest_calculation,
        maintain_inventory,
        integrate_accounts_with_inventory,
        enable_multiple_price_levels,
        enable_batches,
        maintain_expiry_date_for_batches,
        enable_job_order_processing,
        enable_cost_tracking,
        use_discount_column_in_invoices,
        use_separate_actual_billed_qty,
        enable_gst,
        gst_registration_type,
        gstin,
        gst_applicable_from,
        enable_tds,
        tan_number,
        tds_applicable_from,
        enable_tcs,
        tcs_applicable_from,
        enable_vat,
        vat_registration_number,
        vat_applicable_from,
        enable_excise,
        excise_registration_number,
        enable_service_tax,
        service_tax_registration_number,
        enable_browser_access_for_reports,
        enable_remote_access_sync,
        maintain_payroll,
        enable_payroll_statutory,
        pf_registration_number,
        esi_registration_number,
        enable_multiple_addresses,
        mark_modified_vouchers,
        mailing_details_in_local_language,
        req.user?.id || null,
      ],
    );

    if (result.rows.length > 0) {
      const newData = result.rows[0];
      const featureGroups = {
        maintain_accounts: "Accounting",
        enable_bill_wise_entry: "Accounting",
        enable_cost_centres: "Accounting",
        enable_interest_calculation: "Accounting",
        maintain_inventory: "Inventory",
        integrate_accounts_with_inventory: "Inventory",
        enable_multiple_price_levels: "Inventory",
        enable_batches: "Inventory",
        maintain_expiry_date_for_batches: "Inventory",
        enable_job_order_processing: "Inventory",
        enable_cost_tracking: "Inventory",
        use_discount_column_in_invoices: "Inventory",
        use_separate_actual_billed_qty: "Inventory",
        enable_gst: "Taxation",
        enable_tds: "Taxation",
        enable_tcs: "Taxation",
        enable_vat: "Taxation",
        enable_excise: "Taxation",
        enable_service_tax: "Taxation",
        enable_browser_access_for_reports: "Online Access",
        enable_remote_access_sync: "Online Access",
        maintain_payroll: "Payroll",
        enable_payroll_statutory: "Payroll",
        enable_multiple_addresses: "Others",
        mark_modified_vouchers: "Others",
        mailing_details_in_local_language: "Others",
      };

      for (const [field, newValue] of Object.entries(newData)) {
        if (Object.hasOwn(oldData, field) && oldData[field] !== newValue) {
          const featureGroup = featureGroups[field] || "General";
          await pool.query(
            `INSERT INTO company_feature_audit 
             (company_id, feature_group, feature_name, old_value, new_value, 
              changed_by, changed_by_name, ip_address, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'success')`,
            [
              1, // company_id
              featureGroup,
              field,
              oldData[field]?.toString() || null,
              newValue?.toString() || null,
              req.user?.id || null,
              req.user?.username || "System",
              req.ip,
            ],
          );
        }
      }
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: "Company features saved successfully.",
    });
  } catch (err) {
    next(err);
  }
};

export const getFeatureAuditLog = async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM company_feature_audit WHERE company_id = 1 ORDER BY changed_at DESC LIMIT 200",
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

export const getCompanyAddresses = async (req, res, next) => {
  try {
    // Check if table exists
    const tableCheck = await pool.query("SELECT to_regclass('public.company_addresses')");

    if (tableCheck.rows[0].to_regclass === null) {
      return res.json({ success: true, data: [] });
    }

    const result = await pool.query(
      "SELECT * FROM company_addresses WHERE company_id = 1 ORDER BY is_primary DESC, created_at ASC",
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

export const saveCompanyAddresses = async (req, res, next) => {
  try {
    const addresses = req.body.addresses || [];

    for (const address of addresses) {
      if (address.id) {
        // Update existing
        await pool.query(
          `
          UPDATE company_addresses SET
            address_type = $1, mailing_name = $2, address_line1 = $3, address_line2 = $4,
            address_line3 = $5, country = $6, state = $7, city = $8, pin_code = $9,
            phone = $10, mobile = $11, email = $12, website = $13, gstin = $14,
            contact_person = $15, is_primary = $16, is_default_for_invoice = $17,
            is_default_for_reports = $18, is_active = $19
          WHERE id = $20
        `,
          [
            address.address_type,
            address.mailing_name,
            address.address_line1,
            address.address_line2,
            address.address_line3,
            address.country,
            address.state,
            address.city,
            address.pin_code,
            address.phone,
            address.mobile,
            address.email,
            address.website,
            address.gstin,
            address.contact_person,
            address.is_primary,
            address.is_default_for_invoice,
            address.is_default_for_reports,
            address.is_active,
            address.id,
          ],
        );
      } else {
        // Insert new
        await pool.query(
          `
          INSERT INTO company_addresses (
            company_id, address_type, mailing_name, address_line1, address_line2,
            address_line3, country, state, city, pin_code, phone, mobile, email,
            website, gstin, contact_person, is_primary, is_default_for_invoice,
            is_default_for_reports, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        `,
          [
            1, // company_id
            address.address_type,
            address.mailing_name,
            address.address_line1,
            address.address_line2,
            address.address_line3,
            address.country,
            address.state,
            address.city,
            address.pin_code,
            address.phone,
            address.mobile,
            address.email,
            address.website,
            address.gstin,
            address.contact_person,
            address.is_primary,
            address.is_default_for_invoice,
            address.is_default_for_reports,
            address.is_active,
          ],
        );
      }
    }

    res.json({ success: true, message: "Addresses saved." });
  } catch (err) {
    next(err);
  }
};
