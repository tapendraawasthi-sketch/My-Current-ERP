// src/lib/bankParsers/index.ts
// Nepal bank statement parsers — supports 10 formats with auto-detection

import NepaliDate from 'nepali-date-converter';

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface BankStatementEntry {
  date: string;        // AD date, YYYY-MM-DD
  description: string;
  refNo: string;
  debit: number;
  credit: number;
  balance: number;
  rawLine: string;
  bankFormat?: string;
}

export type NepalBankFormat =
  | 'NMB'
  | 'NABIL'
  | 'EVEREST'
  | 'SBL'
  | 'HIMALAYAN'
  | 'KUMARI'
  | 'NEPALSBI'
  | 'CONNECTIPS'
  | 'ESEWA'
  | 'KHALTI'
  | 'UNKNOWN';

export interface ParseResult {
  entries: BankStatementEntry[];
  format: NepalBankFormat;
  errors: string[];
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

const BS_MONTH_MAP: Record<string, number> = {
  baisakh: 1, baishakh: 1,
  jestha: 2, jyestha: 2,
  ashadh: 3, ashad: 3, asar: 3,
  shrawan: 4, sawan: 4, shravan: 4,
  bhadra: 5, bhadau: 5,
  ashwin: 6, ashoj: 6, aswin: 6,
  kartik: 7, kartick: 7,
  mangsir: 8, mangshir: 8,
  poush: 9, push: 9,
  magh: 10,
  falgun: 11, phalgun: 11, fagun: 11,
  chaitra: 12, chait: 12,
};

/** Convert BS date string "15-Shrawan-2081" → AD "YYYY-MM-DD" */
function bsDateStrToAD(raw: string): string {
  try {
    // Supports "15-Shrawan-2081" or "15 Shrawan 2081" or "15/Shrawan/2081"
    const parts = raw.trim().split(/[-\s/]+/);
    if (parts.length < 3) return raw;
    const day = parseInt(parts[0], 10);
    const monthName = parts[1].toLowerCase();
    const year = parseInt(parts[2], 10);
    const month = BS_MONTH_MAP[monthName];
    if (!month || isNaN(day) || isNaN(year)) return raw;
    const nd = new NepaliDate(year, month - 1, day);
    const ad = nd.toJsDate();
    return ad.toISOString().split('T')[0];
  } catch {
    return raw;
  }
}

/** Parse DD/MM/YYYY → YYYY-MM-DD */
function parseDMY(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return raw;
  return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}

/** Parse YYYY/MM/DD → YYYY-MM-DD */
function parseYMDSlash(raw: string): string {
  const m = raw.trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return raw;
  return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
}

/** Parse any recognisable date into YYYY-MM-DD */
export function parseAnyDate(raw: string): string {
  if (!raw) return '';
  raw = raw.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // YYYY/MM/DD or YYYY-MM-DD with slashes
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(raw)) return parseYMDSlash(raw);
  // DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(raw)) return parseDMY(raw);
  // BS textual "15-Shrawan-2081"
  if (/\d{1,2}[-\s\/][a-zA-Z]+[-\s\/]\d{4}/.test(raw)) return bsDateStrToAD(raw);
  return raw;
}

// ─── CSV Helpers ──────────────────────────────────────────────────────────────

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseMoney(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[,\s₹Rs]/gi, '').trim();
  return parseFloat(cleaned) || 0;
}

function getLines(csv: string): string[] {
  return csv.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
}

// ─── Format Auto-Detect ───────────────────────────────────────────────────────

export function detectBankFormat(csv: string): NepalBankFormat {
  const lines = getLines(csv);
  if (lines.length === 0) return 'UNKNOWN';
  const header = lines[0].toLowerCase();

  // ConnectIPS: has "transaction id" + "type" (Credit/Debit)
  if (header.includes('transaction id') && header.includes('type')) return 'CONNECTIPS';
  // eSewa: has "transaction id" + "remarks"
  if (header.includes('transaction id') && header.includes('remarks')) return 'ESEWA';
  // Khalti: has "merchant"
  if (header.includes('merchant')) return 'KHALTI';
  // Kumari: YYYY/MM/DD pattern in header hint or ref column
  if ((header.includes('narration') || header.includes('ref')) && header.includes('dr') && header.includes('cr')) {
    // Check first data line date format
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i]);
      if (cols[0] && /^\d{4}\/\d{2}\/\d{2}$/.test(cols[0].trim())) return 'KUMARI';
    }
  }
  // SBL: Nepali month names in data rows
  const fullText = lines.slice(1, 5).join(' ').toLowerCase();
  if (/shrawan|baisakh|jestha|ashadh|bhadra|ashwin|kartik|mangsir|poush|magh|falgun|chaitra/i.test(fullText)) return 'SBL';
  // NMB: has "ref no." or "withdrawal (dr.)" in header
  if (header.includes('ref no') || header.includes('withdrawal (dr.)') || header.includes('withdrawal')) return 'NMB';
  // Nabil: YYYY-MM-DD date + "narration" + "cheque no"
  if (header.includes('cheque no') && header.includes('narration')) return 'NABIL';
  // Everest / Himalayan: "particulars" column
  if (header.includes('particulars')) {
    // Himalayan tends to add a "value date" col
    if (header.includes('value date')) return 'HIMALAYAN';
    return 'EVEREST';
  }
  // Nepal SBI: often has "txn date" or "posting date"
  if (header.includes('txn date') || header.includes('posting date') || header.includes('value date')) return 'NEPALSBI';

  return 'UNKNOWN';
}

// ─── NMB Bank ─────────────────────────────────────────────────────────────────
// Columns: Date, Description, Ref No., Withdrawal (Dr.), Deposit (Cr.), Balance
// Date format: DD/MM/YYYY

export function parseNMBStatement(csv: string): BankStatementEntry[] {
  const lines = getLines(csv);
  const entries: BankStatementEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 5) continue;
    const date = parseAnyDate(cols[0]);
    if (!date) continue;
    const entry: BankStatementEntry = {
      date,
      description: cols[1] || '',
      refNo: cols[2] || '',
      debit: parseMoney(cols[3]),
      credit: parseMoney(cols[4]),
      balance: cols[5] ? parseMoney(cols[5]) : 0,
      rawLine: lines[i],
      bankFormat: 'NMB',
    };
    if (entry.debit === 0 && entry.credit === 0) continue;
    entries.push(entry);
  }
  return entries;
}

// ─── Nabil Bank ───────────────────────────────────────────────────────────────
// Columns: Date (YYYY-MM-DD), Narration, Cheque No., Debit, Credit, Balance

export function parseNabilStatement(csv: string): BankStatementEntry[] {
  const lines = getLines(csv);
  const entries: BankStatementEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 5) continue;
    const date = parseAnyDate(cols[0]);
    if (!date) continue;
    const entry: BankStatementEntry = {
      date,
      description: cols[1] || '',
      refNo: cols[2] || '',
      debit: parseMoney(cols[3]),
      credit: parseMoney(cols[4]),
      balance: cols[5] ? parseMoney(cols[5]) : 0,
      rawLine: lines[i],
      bankFormat: 'NABIL',
    };
    if (entry.debit === 0 && entry.credit === 0) continue;
    entries.push(entry);
  }
  return entries;
}

// ─── Everest Bank ─────────────────────────────────────────────────────────────
// Columns: Date, Particulars, Cheque, Withdrawal, Deposit, Balance

export function parseEverestStatement(csv: string): BankStatementEntry[] {
  const lines = getLines(csv);
  const entries: BankStatementEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 5) continue;
    const date = parseAnyDate(cols[0]);
    if (!date) continue;
    const entry: BankStatementEntry = {
      date,
      description: cols[1] || '',
      refNo: cols[2] || '',
      debit: parseMoney(cols[3]),
      credit: parseMoney(cols[4]),
      balance: cols[5] ? parseMoney(cols[5]) : 0,
      rawLine: lines[i],
      bankFormat: 'EVEREST',
    };
    if (entry.debit === 0 && entry.credit === 0) continue;
    entries.push(entry);
  }
  return entries;
}

// ─── Siddhartha Bank Limited (SBL) ───────────────────────────────────────────
// Columns: Date (DD-MonthName-YYYY BS), Description, Ref, Dr, Cr, Balance
// Date is in Bikram Sambat: e.g. "15-Shrawan-2081"

export function parseSBLStatement(csv: string): BankStatementEntry[] {
  const lines = getLines(csv);
  const entries: BankStatementEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 5) continue;
    // SBL may have date + month + year as separate tokens OR combined
    let dateRaw = cols[0];
    let offset = 0;
    // If the month name is in a separate column (some exports split on -)
    if (!/\d/.test(cols[1] || '') && cols[1]) {
      dateRaw = `${cols[0]}-${cols[1]}-${cols[2]}`;
      offset = 2;
    }
    const date = bsDateStrToAD(dateRaw);
    if (!date) continue;
    const entry: BankStatementEntry = {
      date,
      description: cols[1 + offset] || '',
      refNo: cols[2 + offset] || '',
      debit: parseMoney(cols[3 + offset]),
      credit: parseMoney(cols[4 + offset]),
      balance: cols[5 + offset] ? parseMoney(cols[5 + offset]) : 0,
      rawLine: lines[i],
      bankFormat: 'SBL',
    };
    if (entry.debit === 0 && entry.credit === 0) continue;
    entries.push(entry);
  }
  return entries;
}

// ─── Himalayan Bank ───────────────────────────────────────────────────────────
// Similar to Everest; may have extra "Value Date" column
// Columns: Date, Value Date, Particulars, Cheque, Withdrawal, Deposit, Balance

export function parseHimalayanStatement(csv: string): BankStatementEntry[] {
  const lines = getLines(csv);
  const entries: BankStatementEntry[] = [];
  const header = splitCSVLine(lines[0]).map(h => h.toLowerCase());
  const hasValueDate = header.some(h => h.includes('value'));
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 5) continue;
    let offset = 0;
    const date = parseAnyDate(cols[0]);
    if (!date) continue;
    if (hasValueDate) offset = 1; // skip value date column
    const entry: BankStatementEntry = {
      date,
      description: cols[1 + offset] || '',
      refNo: cols[2 + offset] || '',
      debit: parseMoney(cols[3 + offset]),
      credit: parseMoney(cols[4 + offset]),
      balance: cols[5 + offset] ? parseMoney(cols[5 + offset]) : 0,
      rawLine: lines[i],
      bankFormat: 'HIMALAYAN',
    };
    if (entry.debit === 0 && entry.credit === 0) continue;
    entries.push(entry);
  }
  return entries;
}

// ─── Kumari Bank ──────────────────────────────────────────────────────────────
// Columns: Date (YYYY/MM/DD), Narration, Ref, Dr, Cr, Balance

export function parseKumariStatement(csv: string): BankStatementEntry[] {
  const lines = getLines(csv);
  const entries: BankStatementEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 5) continue;
    const date = parseYMDSlash(cols[0]);
    if (!date || date === cols[0]) continue; // reject unparseable
    const entry: BankStatementEntry = {
      date,
      description: cols[1] || '',
      refNo: cols[2] || '',
      debit: parseMoney(cols[3]),
      credit: parseMoney(cols[4]),
      balance: cols[5] ? parseMoney(cols[5]) : 0,
      rawLine: lines[i],
      bankFormat: 'KUMARI',
    };
    if (entry.debit === 0 && entry.credit === 0) continue;
    entries.push(entry);
  }
  return entries;
}

// ─── Nepal SBI Bank ───────────────────────────────────────────────────────────
// Excel-style export (usually converted to CSV); may have merged header rows.
// Strategy: skip rows until we find the real header (contains "date" keyword),
// then parse from there.
// Columns (after skipping): Txn Date, Value Date, Particulars, Ref No, Debit, Credit, Balance

export function parseNepalSBIStatement(csv: string): BankStatementEntry[] {
  const lines = getLines(csv);
  const entries: BankStatementEntry[] = [];
  let dataStart = -1;
  let dateIdx = 0, descIdx = 2, refIdx = 3, drIdx = 4, crIdx = 5, balIdx = 6;

  // Find real header row
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('date') && (lower.includes('debit') || lower.includes('dr'))) {
      dataStart = i + 1;
      const headers = splitCSVLine(lines[i]).map(h => h.toLowerCase().replace(/\s+/g, ''));
      dateIdx = headers.findIndex(h => h.includes('date')) ?? 0;
      descIdx = headers.findIndex(h => h.includes('particular') || h.includes('narration') || h.includes('description'));
      if (descIdx === -1) descIdx = 1;
      refIdx = headers.findIndex(h => h.includes('ref') || h.includes('cheque'));
      if (refIdx === -1) refIdx = 3;
      drIdx = headers.findIndex(h => h.includes('debit') || h === 'dr');
      if (drIdx === -1) drIdx = 4;
      crIdx = headers.findIndex(h => h.includes('credit') || h === 'cr');
      if (crIdx === -1) crIdx = 5;
      balIdx = headers.findIndex(h => h.includes('balance'));
      if (balIdx === -1) balIdx = 6;
      break;
    }
  }

  if (dataStart === -1) dataStart = 1;

  for (let i = dataStart; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 4) continue;
    const date = parseAnyDate(cols[dateIdx] || '');
    if (!date || date.length < 8) continue;
    const entry: BankStatementEntry = {
      date,
      description: cols[descIdx] || '',
      refNo: cols[refIdx] || '',
      debit: parseMoney(cols[drIdx] || ''),
      credit: parseMoney(cols[crIdx] || ''),
      balance: parseMoney(cols[balIdx] || ''),
      rawLine: lines[i],
      bankFormat: 'NEPALSBI',
    };
    if (entry.debit === 0 && entry.credit === 0) continue;
    entries.push(entry);
  }
  return entries;
}

// ─── ConnectIPS ───────────────────────────────────────────────────────────────
// Columns: Date, Transaction ID, Description, Type (Credit/Debit), Amount, Balance

export function parseConnectIPSStatement(csv: string): BankStatementEntry[] {
  const lines = getLines(csv);
  const entries: BankStatementEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 5) continue;
    const date = parseAnyDate(cols[0]);
    if (!date) continue;
    const txnId = cols[1] || '';
    const description = cols[2] || '';
    const type = (cols[3] || '').toLowerCase();
    const amount = parseMoney(cols[4]);
    const balance = cols[5] ? parseMoney(cols[5]) : 0;
    if (amount === 0) continue;
    const isDebit = type === 'debit' || type === 'dr';
    const entry: BankStatementEntry = {
      date,
      description,
      refNo: txnId,
      debit: isDebit ? amount : 0,
      credit: isDebit ? 0 : amount,
      balance,
      rawLine: lines[i],
      bankFormat: 'CONNECTIPS',
    };
    entries.push(entry);
  }
  return entries;
}

// ─── eSewa ────────────────────────────────────────────────────────────────────
// Columns: Date, Transaction ID, Description, Amount, Type, Remarks

export function parseESewaStatement(csv: string): BankStatementEntry[] {
  const lines = getLines(csv);
  const entries: BankStatementEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 5) continue;
    const date = parseAnyDate(cols[0]);
    if (!date) continue;
    const txnId = cols[1] || '';
    const description = cols[2] || '';
    const amount = parseMoney(cols[3]);
    const type = (cols[4] || '').toLowerCase();
    const remarks = cols[5] || '';
    if (amount === 0) continue;
    // eSewa: "debit" means money paid out; "credit" means money received
    const isDebit = type === 'debit' || type === 'paid' || type === 'payment' || type === 'dr';
    const entry: BankStatementEntry = {
      date,
      description: description + (remarks ? ` | ${remarks}` : ''),
      refNo: txnId,
      debit: isDebit ? amount : 0,
      credit: isDebit ? 0 : amount,
      balance: 0,
      rawLine: lines[i],
      bankFormat: 'ESEWA',
    };
    entries.push(entry);
  }
  return entries;
}

// ─── Khalti ───────────────────────────────────────────────────────────────────
// Columns: Date, Transaction ID, Merchant, Amount, Status

export function parseKhaltiStatement(csv: string): BankStatementEntry[] {
  const lines = getLines(csv);
  const entries: BankStatementEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 4) continue;
    const date = parseAnyDate(cols[0]);
    if (!date) continue;
    const txnId = cols[1] || '';
    const merchant = cols[2] || '';
    const amount = parseMoney(cols[3]);
    const status = (cols[4] || '').toLowerCase();
    // Only import completed / successful transactions
    if (status && status !== 'completed' && status !== 'success' && status !== 'successful') continue;
    if (amount === 0) continue;
    // Khalti statements from merchant PoV: all amounts are receipts (credits to merchant)
    const entry: BankStatementEntry = {
      date,
      description: merchant,
      refNo: txnId,
      debit: 0,
      credit: amount,
      balance: 0,
      rawLine: lines[i],
      bankFormat: 'KHALTI',
    };
    entries.push(entry);
  }
  return entries;
}

// ─── Universal Parser (auto-detects format) ───────────────────────────────────

export function parseNepalBankStatement(csv: string): ParseResult {
  const format = detectBankFormat(csv);
  const errors: string[] = [];
  let entries: BankStatementEntry[] = [];

  try {
    switch (format) {
      case 'NMB':        entries = parseNMBStatement(csv); break;
      case 'NABIL':      entries = parseNabilStatement(csv); break;
      case 'EVEREST':    entries = parseEverestStatement(csv); break;
      case 'SBL':        entries = parseSBLStatement(csv); break;
      case 'HIMALAYAN':  entries = parseHimalayanStatement(csv); break;
      case 'KUMARI':     entries = parseKumariStatement(csv); break;
      case 'NEPALSBI':   entries = parseNepalSBIStatement(csv); break;
      case 'CONNECTIPS': entries = parseConnectIPSStatement(csv); break;
      case 'ESEWA':      entries = parseESewaStatement(csv); break;
      case 'KHALTI':     entries = parseKhaltiStatement(csv); break;
      default:
        // Generic fallback: auto-detect columns by header keywords
        entries = parseGenericCSV(csv);
        errors.push('Unknown format — using generic column detection. Please verify the imported data.');
    }
  } catch (err: any) {
    errors.push(`Parse error: ${err?.message || 'Unknown error'}`);
  }

  return { entries, format, errors };
}

// ─── Generic Fallback ─────────────────────────────────────────────────────────

function parseGenericCSV(csv: string): BankStatementEntry[] {
  const lines = getLines(csv);
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const find = (...patterns: string[]) =>
    headers.findIndex(h => patterns.some(p => h.includes(p)));

  const dateIdx    = find('date', 'txndate', 'valuedate');
  const descIdx    = find('narration', 'description', 'particulars', 'remarks');
  const refIdx     = find('refno', 'ref', 'cheque', 'chequeno');
  const drIdx      = find('debit', 'dr', 'withdrawal');
  const crIdx      = find('credit', 'cr', 'deposit');
  const balIdx     = find('balance', 'closingbalance');

  if (dateIdx === -1) return [];

  const entries: BankStatementEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const date = parseAnyDate(cols[dateIdx] || '');
    if (!date) continue;
    const debit  = drIdx  !== -1 ? parseMoney(cols[drIdx])  : 0;
    const credit = crIdx  !== -1 ? parseMoney(cols[crIdx])  : 0;
    if (debit === 0 && credit === 0) continue;
    entries.push({
      date,
      description: descIdx !== -1 ? cols[descIdx] || '' : '',
      refNo:       refIdx  !== -1 ? cols[refIdx]  || '' : '',
      debit,
      credit,
      balance:     balIdx  !== -1 ? parseMoney(cols[balIdx]) : 0,
      rawLine: lines[i],
      bankFormat: 'UNKNOWN',
    });
  }
  return entries;
}

// ─── Format Display Names ─────────────────────────────────────────────────────

export const BANK_FORMAT_LABELS: Record<NepalBankFormat, string> = {
  NMB:        'NMB Bank',
  NABIL:      'Nabil Bank',
  EVEREST:    'Everest Bank',
  SBL:        'Siddhartha Bank (SBL)',
  HIMALAYAN:  'Himalayan Bank',
  KUMARI:     'Kumari Bank',
  NEPALSBI:   'Nepal SBI Bank',
  CONNECTIPS: 'ConnectIPS',
  ESEWA:      'eSewa',
  KHALTI:     'Khalti',
  UNKNOWN:    'Unknown / Generic',
};
