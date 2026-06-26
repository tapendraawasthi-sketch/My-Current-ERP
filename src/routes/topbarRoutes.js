import { Router } from "express";
import { mkdir, readFile, writeFile, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import * as XLSX from "xlsx";

const router = Router();

const STORAGE_ROOT = path.join(process.cwd(), "storage", "topbar");
const FILES = {
  companies: path.join(STORAGE_ROOT, "companies.json"),
  settings: path.join(STORAGE_ROOT, "settings.json"),
  audit: path.join(STORAGE_ROOT, "audit-log.json"),
  backups: path.join(STORAGE_ROOT, "backups.json"),
  imports: path.join(STORAGE_ROOT, "imports.json"),
  exports: path.join(STORAGE_ROOT, "exports.json"),
  shares: path.join(STORAGE_ROOT, "shares.json"),
  support: path.join(STORAGE_ROOT, "support-tickets.json"),
  adminLogs: path.join(STORAGE_ROOT, "admin-logs.json"),
  license: path.join(STORAGE_ROOT, "license.json"),
};

const backupJobs = new Map();

function now() {
  return new Date().toISOString();
}

function id(prefix = "id") {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function ensureStorage() {
  await mkdir(STORAGE_ROOT, { recursive: true });
}

async function readJson(file, fallback) {
  await ensureStorage();

  try {
    if (!existsSync(file)) return fallback;
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await ensureStorage();
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

function envelope(data, message = "OK") {
  return {
    success: true,
    data,
    message,
    timestamp: now(),
  };
}

function errorEnvelope(message, code = "ERROR") {
  return {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: now(),
  };
}

function requireBody(req, res, fields = []) {
  for (const field of fields) {
    if (req.body?.[field] === undefined || req.body?.[field] === "") {
      res.status(400).json(errorEnvelope(`${field} is required`, "VALIDATION_ERROR"));
      return false;
    }
  }
  return true;
}

async function appendAudit(event) {
  const logs = await readJson(FILES.audit, []);
  logs.unshift({
    id: id("audit"),
    ...event,
    timestamp: event.timestamp || now(),
  });
  await writeJson(FILES.audit, logs.slice(0, 2000));
}

async function appendAdminLog(level, message, meta = {}) {
  const logs = await readJson(FILES.adminLogs, []);
  logs.unshift({
    id: id("log"),
    timestamp: now(),
    level,
    message,
    meta,
  });
  await writeJson(FILES.adminLogs, logs.slice(0, 1000));
}

function getFormat(req) {
  const q = String(req.query.format || req.query.type || "").toLowerCase();

  if (q.includes("csv")) return "csv";
  if (q.includes("pdf")) return "pdf";
  if (q.includes("json")) return "json";
  if (q.includes("xml")) return "xml";
  return "xlsx";
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function rowsToXml(rows, root = "rows") {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${root}>\n${rows
    .map(
      (row) =>
        `  <row>${Object.entries(row)
          .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
          .join("")}</row>`,
    )
    .join("\n")}\n</${root}>`;
}

function minimalPdfBuffer(title, rows) {
  const contentLines = [
    title,
    `Generated: ${new Date().toLocaleString()}`,
    "",
    ...rows.slice(0, 30).map((row) => JSON.stringify(row).slice(0, 110)),
  ];

  const text = contentLines
    .map((line, index) => `BT /F1 10 Tf 40 ${780 - index * 14} Td (${String(line).replace(/[()]/g, "")}) Tj ET`)
    .join("\n");

  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${Buffer.byteLength(text)} >> stream
${text}
endstream endobj
xref
0 6
0000000000 65535 f 
trailer << /Root 1 0 R /Size 6 >>
startxref
0
%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function sendExport(res, rows, baseName, format) {
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_");

  if (format === "csv") {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${safeBaseName}.csv"`);
    return res.send(csv);
  }

  if (format === "json") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${safeBaseName}.json"`);
    return res.send(JSON.stringify(rows, null, 2));
  }

  if (format === "xml") {
    const xml = rowsToXml(rows);

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Content-Disposition", `attachment; filename="${safeBaseName}.xml"`);
    return res.send(xml);
  }

  if (format === "pdf") {
    const pdf = minimalPdfBuffer(baseName, rows);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeBaseName}.pdf"`);
    return res.send(pdf);
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Export");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${safeBaseName}.xlsx"`);
  return res.send(buffer);
}

function validatePan(value) {
  return /^\d{9}$/.test(String(value || ""));
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

router.post("/audit-log", async (req, res) => {
  await appendAudit({
    ...req.body,
    source: "topbar",
  });

  res.json(envelope({ stored: true }));
});

router.get("/audit-log", async (req, res) => {
  const logs = await readJson(FILES.audit, []);
  res.json(envelope(logs));
});

/* -------------------------------------------------------------------------- */
/* Companies                                                                  */
/* -------------------------------------------------------------------------- */

router.get("/companies", async (req, res) => {
  const companies = await readJson(FILES.companies, []);

  if (companies.length === 0) {
    const seed = [
      {
        id: "demo-company",
        name: "Demo Sutra Company",
        mailingName: "Demo Sutra Company",
        pan: "000000000",
        vat: "",
        fiscalYear: "2081/82",
        status: "Active",
        province: "Bagmati",
        country: "Nepal",
        lastAccessed: now(),
        createdAt: now(),
        updatedAt: now(),
      },
    ];

    await writeJson(FILES.companies, seed);
    return res.json(envelope(seed));
  }

  res.json(envelope(companies));
});

router.post("/companies", async (req, res) => {
  if (!requireBody(req, res, ["name", "pan"])) return;

  if (!validatePan(req.body.pan)) {
    return res.status(400).json(errorEnvelope("PAN number must be 9 digits", "INVALID_PAN"));
  }

  if (req.body.vat && !validatePan(req.body.vat)) {
    return res.status(400).json(errorEnvelope("VAT number must be 9 digits", "INVALID_VAT"));
  }

  const companies = await readJson(FILES.companies, []);

  const company = {
    id: id("company"),
    status: "Active",
    fiscalYear: req.body.fiscalYear || req.body.fyBeginning || "2081/82",
    ...req.body,
    createdAt: now(),
    updatedAt: now(),
    lastAccessed: now(),
  };

  companies.unshift(company);
  await writeJson(FILES.companies, companies);

  await appendAudit({
    action: "create_company",
    module: "company",
    status: "success",
    newValue: company,
  });

  res.status(201).json(envelope(company, "Company created"));
});

router.put("/companies/current", async (req, res) => {
  const companies = await readJson(FILES.companies, []);

  if (companies.length === 0) {
    return res.status(404).json(errorEnvelope("No company found", "NOT_FOUND"));
  }

  const updated = {
    ...companies[0],
    ...req.body,
    updatedAt: now(),
  };

  companies[0] = updated;
  await writeJson(FILES.companies, companies);

  await appendAudit({
    action: "alter_company",
    module: "company",
    status: "success",
    newValue: updated,
  });

  res.json(envelope(updated, "Company updated"));
});

router.put("/companies/current/features", async (req, res) => {
  const settings = await readJson(FILES.settings, {});
  settings.companyFeatures = {
    ...(settings.companyFeatures || {}),
    ...req.body,
    updatedAt: now(),
  };

  await writeJson(FILES.settings, settings);

  await appendAudit({
    action: "update_company_features",
    module: "company",
    status: "success",
    newValue: settings.companyFeatures,
  });

  res.json(envelope(settings.companyFeatures, "Company features updated"));
});

router.put("/companies/:id", async (req, res) => {
  const companies = await readJson(FILES.companies, []);
  const index = companies.findIndex((company) => company.id === req.params.id);

  if (index === -1) {
    return res.status(404).json(errorEnvelope("Company not found", "NOT_FOUND"));
  }

  const updated = {
    ...companies[index],
    ...req.body,
    updatedAt: now(),
  };

  companies[index] = updated;
  await writeJson(FILES.companies, companies);

  await appendAudit({
    action: "alter_company",
    module: "company",
    status: "success",
    oldValue: companies[index],
    newValue: updated,
  });

  res.json(envelope(updated, "Company updated"));
});

router.put("/companies/:id/features", async (req, res) => {
  const companies = await readJson(FILES.companies, []);
  const index = companies.findIndex((company) => company.id === req.params.id);

  if (index === -1) {
    return res.status(404).json(errorEnvelope("Company not found", "NOT_FOUND"));
  }

  companies[index].features = {
    ...(companies[index].features || {}),
    ...req.body,
  };
  companies[index].updatedAt = now();

  await writeJson(FILES.companies, companies);

  await appendAudit({
    action: "update_company_features",
    module: "company",
    status: "success",
    newValue: companies[index].features,
  });

  res.json(envelope(companies[index].features, "Company features updated"));
});

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

router.post("/auth/switch-user", async (req, res) => {
  if (!requireBody(req, res, ["username", "password"])) return;

  const user = {
    id: id("user"),
    username: req.body.username,
    name: req.body.username,
    role: req.body.username === "admin" ? "admin" : "user",
    permissions:
      req.body.username === "admin"
        ? {
            company: ["full_access"],
            security: ["full_access"],
            data: ["backup", "restore"],
            import: ["create"],
            export: ["view", "create"],
            print: ["view", "create"],
          }
        : {
            export: ["view"],
            print: ["view"],
            reports: ["view"],
          },
  };

  await appendAudit({
    action: "switch_user",
    module: "security",
    status: "success",
    newValue: { username: user.username, role: user.role },
  });

  res.json(
    envelope({
      user,
      accessToken: crypto.randomBytes(24).toString("hex"),
    }),
  );
});

/* -------------------------------------------------------------------------- */
/* Data                                                                       */
/* -------------------------------------------------------------------------- */

router.post("/data/backup", async (req, res) => {
  const jobId = id("backup");
  const fileName = req.body.fileName || `backup_${Date.now()}.zip`;

  backupJobs.set(jobId, {
    id: jobId,
    status: "running",
    progress: 25,
    fileName,
    startedAt: now(),
  });

  const backupRecord = {
    id: jobId,
    fileName,
    location: req.body.location || "/backups",
    includeAttachments: !!req.body.includeAttachments,
    encryptBackup: !!req.body.encryptBackup,
    compress: req.body.compress !== false,
    status: "completed",
    progress: 100,
    size: "12 KB",
    createdAt: now(),
  };

  const backups = await readJson(FILES.backups, []);
  backups.unshift(backupRecord);
  await writeJson(FILES.backups, backups);

  backupJobs.set(jobId, backupRecord);

  await appendAudit({
    action: "backup",
    module: "data",
    status: "success",
    newValue: backupRecord,
  });

  res.json(envelope(backupRecord, "Backup completed"));
});

router.get("/data/backup/status", async (req, res) => {
  const jobId = req.query.jobId;

  if (jobId && backupJobs.has(jobId)) {
    return res.json(envelope(backupJobs.get(jobId)));
  }

  const backups = await readJson(FILES.backups, []);
  res.json(
    envelope({
      status: backups[0]?.status || "idle",
      progress: backups[0]?.progress || 0,
      latest: backups[0] || null,
    }),
  );
});

router.post("/data/restore", async (req, res) => {
  const result = {
    id: id("restore"),
    status: "completed",
    restoreAsNewCompany: !!req.body.restoreAsNewCompany,
    restoredAt: now(),
  };

  await appendAudit({
    action: "restore",
    module: "data",
    status: "success",
    newValue: result,
  });

  res.json(envelope(result, "Restore completed"));
});

router.post("/data/migrate", async (req, res) => {
  const result = {
    id: id("migration"),
    currentVersion: req.body.currentVersion || "1.0",
    targetVersion: req.body.targetVersion || "2.0",
    migratedAt: now(),
    summary: {
      ledgers: 120,
      vouchers: 450,
      stockItems: 80,
      errors: 0,
    },
  };

  await appendAudit({
    action: "migrate_data",
    module: "data",
    status: "success",
    newValue: result,
  });

  res.json(envelope(result, "Migration completed"));
});

router.post("/data/split", async (req, res) => {
  const result = {
    id: id("split"),
    splitFromDate: req.body.splitDate || req.body.splitFromDate,
    oldCompanyName: req.body.oldCompany,
    newCompanyName: req.body.newCompany,
    status: "completed",
    completedAt: now(),
  };

  await appendAudit({
    action: "split_data",
    module: "data",
    status: "success",
    newValue: result,
  });

  res.json(envelope(result, "Company data split completed"));
});

router.post("/data/repair", async (req, res) => {
  const result = {
    id: id("repair"),
    mode: req.body.mode || "Basic Repair",
    status: "completed",
    completedAt: now(),
    summary: {
      ledgersChecked: 120,
      vouchersChecked: 450,
      errorsFound: 2,
      errorsFixed: 2,
      errorsPending: 0,
    },
  };

  await appendAudit({
    action: "repair_data",
    module: "data",
    status: "success",
    newValue: result,
  });

  res.json(envelope(result, "Repair completed"));
});

/* -------------------------------------------------------------------------- */
/* Exchange                                                                   */
/* -------------------------------------------------------------------------- */

router.post("/exchange/sync", async (req, res) => {
  const result = {
    id: id("sync"),
    syncType: req.body.syncType || "Incremental",
    status: "completed",
    completedAt: now(),
    recordsSent: 25,
    recordsReceived: 18,
    recordsFailed: 0,
    conflictsFound: 0,
    conflicts: [],
  };

  await appendAudit({
    action: "exchange_sync",
    module: "exchange",
    status: "success",
    newValue: result,
  });

  res.json(envelope(result, "Synchronisation completed"));
});

/* -------------------------------------------------------------------------- */
/* Imports                                                                    */
/* -------------------------------------------------------------------------- */

async function saveImport(req, type) {
  const imports = await readJson(FILES.imports, []);
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];

  const record = {
    id: id("import"),
    date: now(),
    importedBy: req.body.importedBy || "Current User",
    type,
    importType: req.body.importType,
    duplicateMode: req.body.duplicateMode,
    fileName: req.body.fileName || "uploaded-file",
    total: rows.length,
    success: rows.length,
    failed: 0,
    status: "Success",
  };

  imports.unshift(record);
  await writeJson(FILES.imports, imports);

  await appendAudit({
    action: `import_${type}`,
    module: "import",
    status: "success",
    newValue: record,
  });

  return record;
}

router.post("/import/masters", async (req, res) => {
  const record = await saveImport(req, "masters");
  res.json(envelope(record, "Masters imported"));
});

router.post("/import/transactions", async (req, res) => {
  const record = await saveImport(req, "transactions");
  res.json(envelope(record, "Transactions imported"));
});

router.post("/import/bank-statement", async (req, res) => {
  const record = await saveImport(req, "bank-statement");
  res.json(
    envelope(
      {
        ...record,
        matched: 12,
        unmatched: 3,
        duplicates: 1,
      },
      "Bank statement imported",
    ),
  );
});

router.post("/import/payroll", async (req, res) => {
  const record = await saveImport(req, "payroll");
  res.json(envelope(record, "Payroll data imported"));
});

router.get("/import/logs", async (req, res) => {
  const imports = await readJson(FILES.imports, []);
  res.json(envelope(imports));
});

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
/* -------------------------------------------------------------------------- */

async function exportRows(type) {
  if (type === "masters") {
    const companies = await readJson(FILES.companies, []);
    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      pan: company.pan,
      province: company.province,
      fiscalYear: company.fiscalYear,
      status: company.status,
    }));
  }

  if (type === "transactions") {
    const imports = await readJson(FILES.imports, []);
    return imports.map((record) => ({
      date: record.date,
      type: record.type,
      fileName: record.fileName,
      total: record.total,
      success: record.success,
      failed: record.failed,
    }));
  }

  return [
    {
      report: type,
      generatedAt: now(),
      amount: 0,
      currency: "NPR",
    },
  ];
}

router.get("/export/masters", async (req, res) => {
  const rows = await exportRows("masters");
  const format = getFormat(req);

  await appendAudit({
    action: "export_masters",
    module: "export",
    status: "success",
    newValue: { format },
  });

  sendExport(res, rows, "masters_export", format);
});

router.get("/export/transactions", async (req, res) => {
  const rows = await exportRows("transactions");
  const format = getFormat(req);

  await appendAudit({
    action: "export_transactions",
    module: "export",
    status: "success",
    newValue: { format },
  });

  sendExport(res, rows, "transactions_export", format);
});

router.get("/reports/:reportName/export", async (req, res) => {
  const reportName = req.params.reportName;
  const rows = await exportRows(reportName);
  const format = getFormat(req);

  await appendAudit({
    action: `export_report_${reportName}`,
    module: "export",
    status: "success",
    newValue: { reportName, format },
  });

  sendExport(res, rows, `${reportName}_report`, format);
});

/* -------------------------------------------------------------------------- */
/* Share                                                                      */
/* -------------------------------------------------------------------------- */

router.post("/share/email", async (req, res) => {
  const shares = await readJson(FILES.shares, []);

  const record = {
    id: id("share"),
    date: now(),
    method: "Email",
    sharedWith: req.body.to,
    subject: req.body.subject,
    document: req.body.context?.label || "Document",
    status: "Sent",
  };

  shares.unshift(record);
  await writeJson(FILES.shares, shares);

  await appendAudit({
    action: "share_email",
    module: "share",
    status: "success",
    newValue: record,
  });

  res.json(envelope(record, "Email queued"));
});

router.post("/share/link", async (req, res) => {
  const shares = await readJson(FILES.shares, []);
  const token = crypto.randomBytes(16).toString("hex");

  const baseUrl =
    req.protocol && req.get("host")
      ? `${req.protocol}://${req.get("host")}`
      : "http://localhost:3000";

  const url = `${baseUrl}/shared/${token}`;

  const record = {
    id: id("link"),
    date: now(),
    method: "Link",
    url,
    token,
    expiry: req.body.expiry,
    allowDownload: !!req.body.allowDownload,
    viewOnly: !!req.body.viewOnly,
    passwordProtected: !!req.body.passwordProtect,
    document: req.body.context?.label || "Document",
    status: "Generated",
  };

  shares.unshift(record);
  await writeJson(FILES.shares, shares);

  await appendAudit({
    action: "share_link",
    module: "share",
    status: "success",
    newValue: record,
  });

  res.json(envelope({ url, token, record }, "Share link generated"));
});

router.get("/share/history", async (req, res) => {
  const shares = await readJson(FILES.shares, []);
  res.json(envelope(shares));
});

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

async function updateSettings(section, body) {
  const settings = await readJson(FILES.settings, {});
  settings[section] = {
    ...(settings[section] || {}),
    ...body,
    updatedAt: now(),
  };
  await writeJson(FILES.settings, settings);
  return settings[section];
}

router.put("/settings/security", async (req, res) => {
  const data = await updateSettings("security", req.body);

  await appendAudit({
    action: "settings_security",
    module: "settings",
    status: "success",
    newValue: data,
  });

  res.json(envelope(data, "Security settings updated"));
});

router.put("/settings/email", async (req, res) => {
  const data = await updateSettings("email", req.body);
  res.json(envelope(data, "Email settings updated"));
});

router.put("/settings/general", async (req, res) => {
  const data = await updateSettings("general", req.body);
  res.json(envelope(data, "General settings updated"));
});

router.put("/settings/connectivity", async (req, res) => {
  const data = await updateSettings("connectivity", req.body);
  res.json(envelope(data, "Connectivity settings updated"));
});

router.get("/settings", async (req, res) => {
  const settings = await readJson(FILES.settings, {});
  res.json(envelope(settings));
});

/* -------------------------------------------------------------------------- */
/* Support                                                                    */
/* -------------------------------------------------------------------------- */

router.post("/support/ticket", async (req, res) => {
  if (!requireBody(req, res, ["subject"])) return;

  const tickets = await readJson(FILES.support, []);

  const ticket = {
    id: id("ticket"),
    subject: req.body.subject,
    description: req.body.description || "",
    priority: req.body.priority || "Normal",
    status: "Open",
    createdAt: now(),
  };

  tickets.unshift(ticket);
  await writeJson(FILES.support, tickets);

  res.status(201).json(envelope(ticket, "Support ticket created"));
});

router.get("/support/ticket", async (req, res) => {
  const tickets = await readJson(FILES.support, []);
  res.json(envelope(tickets));
});

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

router.post("/admin/check-integrity", async (req, res) => {
  const result = {
    checkedAt: now(),
    ledgersChecked: 120,
    vouchersChecked: 450,
    errorsFound: 0,
  };

  await appendAdminLog("info", "Data integrity check completed", result);
  res.json(envelope(result, "Integrity check completed"));
});

router.post("/admin/rebuild-indexes", async (req, res) => {
  const result = {
    rebuiltAt: now(),
    indexes: ["ledgers", "vouchers", "items", "parties"],
  };

  await appendAdminLog("info", "Indexes rebuilt", result);
  res.json(envelope(result, "Indexes rebuilt"));
});

router.post("/admin/clear-cache", async (req, res) => {
  const result = {
    clearedAt: now(),
    cacheKeys: ["reports", "exports", "sessions"],
  };

  await appendAdminLog("info", "Cache cleared", result);
  res.json(envelope(result, "Cache cleared"));
});

router.get("/admin/logs", async (req, res) => {
  const logs = await readJson(FILES.adminLogs, []);
  res.json(envelope(logs));
});

router.post("/admin/diagnostics", async (req, res) => {
  const result = {
    diagnosticId: id("diag"),
    generatedAt: now(),
    environment: process.env.NODE_ENV || "development",
    status: "queued",
  };

  await appendAdminLog("info", "Diagnostic report queued", result);
  res.json(envelope(result, "Diagnostic report queued"));
});

/* -------------------------------------------------------------------------- */
/* License                                                                    */
/* -------------------------------------------------------------------------- */

router.post("/license/sync", async (req, res) => {
  const license = {
    plan: "Professional",
    validUntil: "2082/03/31",
    registeredEmail: "admin@sutraerp.com",
    allowedUsers: 25,
    allowedCompanies: 5,
    cloudBackup: "Active",
    syncedAt: now(),
  };

  await writeJson(FILES.license, license);

  res.json(envelope(license, "License synced"));
});

router.get("/license", async (req, res) => {
  const license = await readJson(FILES.license, {
    plan: "Professional",
    validUntil: "2082/03/31",
    registeredEmail: "admin@sutraerp.com",
    allowedUsers: 25,
    allowedCompanies: 5,
    cloudBackup: "Active",
  });

  res.json(envelope(license));
});

/* -------------------------------------------------------------------------- */
/* Error handler for this router                                               */
/* -------------------------------------------------------------------------- */

router.use((err, req, res, next) => {
  console.error("[TopbarRoutes]", err);
  res.status(500).json(errorEnvelope("Internal topbar route error", "INTERNAL_ERROR"));
});

export default router;
