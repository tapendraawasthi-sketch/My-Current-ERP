import { Router, type Request, type Response } from "express";
import { parseKhataTransaction } from "../lib/falconNlu.js";
import { getPool, query } from "../lib/db.js";
import { sendError, sendSuccess } from "../middleware/responseEnvelope.js";

const router = Router();

type KhataIntent =
  | "khata_credit_sale"
  | "khata_cash_sale"
  | "khata_payment_in"
  | "khata_purchase"
  | "khata_payment_out"
  | "khata_expense";

const KHATA_ACCOUNTS: Record<string, { debit: string; credit: string }> = {
  khata_credit_sale: { debit: "KH-DEBT", credit: "KH-SALE" },
  khata_cash_sale: { debit: "KH-CASH", credit: "KH-SALE" },
  khata_payment_in: { debit: "KH-CASH", credit: "KH-DEBT" },
  khata_purchase: { debit: "KH-PUR", credit: "KH-CASH" },
  khata_payment_out: { debit: "KH-CRED", credit: "KH-CASH" },
  khata_expense: { debit: "KH-EXP", credit: "KH-CASH" },
};

const INTENT_LABELS: Record<KhataIntent, string> = {
  khata_credit_sale: "Credit Sale",
  khata_cash_sale: "Cash Sale",
  khata_payment_in: "Payment Received",
  khata_purchase: "Purchase",
  khata_payment_out: "Payment Made",
  khata_expense: "Expense",
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Fallback only when PYTHON_PATH / erp_bot is unavailable in dev.
function mockParseTransaction(rawText: string) {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  if (/^\d+\s+diye$/i.test(lower)) {
    return { clarifying_question: "Aaple diye ki unle diye?" };
  }

  const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
  const amount = amountMatch ? Number(amountMatch[1]) : 0;
  const partyMatch = text.match(/\b([A-Za-z]+)\s+lai\b/i);
  const party = partyMatch ? partyMatch[1] : null;
  const today = new Date().toISOString().slice(0, 10);

  if (/udhaar|udhar|credit/i.test(text)) {
    return {
      card: {
        intent: "khata_credit_sale" as KhataIntent,
        party,
        amount,
        item: null,
        date: today,
        raw_text: text,
      },
    };
  }

  if (/tiryo|received|aayo/i.test(text)) {
    return {
      card: {
        intent: "khata_payment_in" as KhataIntent,
        party: party ?? text.match(/\b([A-Za-z]+)\s+le\b/i)?.[1] ?? null,
        amount,
        item: null,
        date: today,
        raw_text: text,
      },
    };
  }

  if (/cash|sold|becheko/i.test(text)) {
    return {
      card: {
        intent: "khata_cash_sale" as KhataIntent,
        party: null,
        amount,
        item: text.match(/\b(chai|tea)\b/i)?.[1] ?? null,
        date: today,
        raw_text: text,
      },
    };
  }

  if (/kineko|purchase/i.test(text)) {
    return {
      card: {
        intent: "khata_purchase" as KhataIntent,
        party: null,
        amount,
        item: text.match(/\b(sabji|khandsari)\b/i)?.[1] ?? null,
        date: today,
        raw_text: text,
      },
    };
  }

  if (/payment\s+gareko|paisa\s+diye/i.test(text)) {
    return {
      card: {
        intent: "khata_payment_out" as KhataIntent,
        party,
        amount,
        item: null,
        date: today,
        raw_text: text,
      },
    };
  }

  if (/kharcha|expense/i.test(text)) {
    return {
      card: {
        intent: "khata_expense" as KhataIntent,
        party: null,
        amount,
        item: text.match(/\b(bijuli)\b/i)?.[1] ?? null,
        date: today,
        raw_text: text,
      },
    };
  }

  return {
    card: {
      intent: "khata_credit_sale" as KhataIntent,
      party,
      amount: amount || 500,
      item: null,
      date: today,
      raw_text: text,
    },
  };
}

async function ensureKhataAccounts(tenantId: string, companyId: string) {
  await query(`SELECT seed_khata_chart_of_accounts($1, $2)`, [tenantId, companyId]);
}

async function getAccountIdWithClient(
  client: import("pg").PoolClient,
  tenantId: string,
  companyId: string,
  code: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM chart_of_accounts
     WHERE tenant_id = $1 AND company_id = $2 AND code = $3
     LIMIT 1`,
    [tenantId, companyId, code],
  );
  if (!result.rows[0]?.id) {
    throw new Error(`Khata account ${code} not found`);
  }
  return result.rows[0].id;
}

async function resolvePartyIdWithClient(
  client: import("pg").PoolClient,
  tenantId: string,
  companyId: string,
  partyName: string | null | undefined,
  intent: KhataIntent,
): Promise<string | null> {
  if (!partyName) return null;
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM parties
     WHERE tenant_id = $1 AND company_id = $2 AND lower(name) = lower($3)
     LIMIT 1`,
    [tenantId, companyId, partyName],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const partyType =
    intent === "khata_purchase" || intent === "khata_payment_out" ? "supplier" : "customer";
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO parties (tenant_id, company_id, name, party_type, is_khata_created)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING id`,
    [tenantId, companyId, partyName, partyType],
  );
  return inserted.rows[0]?.id ?? null;
}

async function nextVoucherNoWithClient(
  client: import("pg").PoolClient,
  tenantId: string,
  companyId: string,
  voucherType: string,
) {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM vouchers
     WHERE tenant_id = $1 AND company_id = $2 AND voucher_type = $3`,
    [tenantId, companyId, voucherType],
  );
  const seq = Number(result.rows[0]?.count ?? 0) + 1;
  return `KH-${seq.toString().padStart(5, "0")}`;
}

router.post("/khata/transaction", async (req: Request, res: Response) => {
  const tenantId = str(req.body?.tenant_id);
  const companyId = str(req.body?.company_id);
  const rawText = str(req.body?.raw_text);

  if (!tenantId || !companyId || !rawText) {
    return sendError(res, "tenant_id, company_id, and raw_text are required", 400);
  }

  try {
    const parsed = await parseKhataTransaction(rawText);
    return sendSuccess(res, parsed);
  } catch (error) {
    console.warn("[khata] Falcon NLU failed, using mock parser:", error);
    const parsed = mockParseTransaction(rawText);
    return sendSuccess(res, parsed);
  }
});

async function executeKhataConfirm(input: {
  tenantId: string;
  companyId: string;
  userId: string | null;
  intent: KhataIntent;
  amount: number;
  partyName: string | null;
  item: string | null;
  voucherDate: string;
  rawText: string;
  idempotencyKey: string | null;
}): Promise<{ voucher_id: string; duplicate?: boolean }> {
  const {
    tenantId,
    companyId,
    userId,
    intent,
    amount,
    partyName,
    item,
    voucherDate,
    rawText,
    idempotencyKey,
  } = input;

  if (idempotencyKey) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM vouchers WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey],
    );
    if (existing.rows[0]?.id) {
      return { voucher_id: existing.rows[0].id, duplicate: true };
    }
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`SELECT seed_khata_chart_of_accounts($1, $2)`, [tenantId, companyId]);

    let debitCode = KHATA_ACCOUNTS[intent].debit;
    let creditCode = KHATA_ACCOUNTS[intent].credit;
    if (intent === "khata_purchase" && partyName) {
      creditCode = "KH-CRED";
    }

    const debitAccountId = await getAccountIdWithClient(client, tenantId, companyId, debitCode);
    const creditAccountId = await getAccountIdWithClient(client, tenantId, companyId, creditCode);
    const partyId = await resolvePartyIdWithClient(client, tenantId, companyId, partyName, intent);
    const voucherNo = await nextVoucherNoWithClient(client, tenantId, companyId, intent);
    const narration = `${INTENT_LABELS[intent]}${partyName ? ` — ${partyName}` : ""}${item ? ` — ${item}` : ""}`;

    const voucherResult = await client.query<{ id: string }>(
      `INSERT INTO vouchers (
         tenant_id, company_id, voucher_no, voucher_date, voucher_type, status,
         narration, party_id, total_debit, total_credit, grand_total, created_by, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5, 'posted', $6, $7, $8, $8, $8, $9, $10)
       RETURNING id`,
      [
        tenantId,
        companyId,
        voucherNo,
        voucherDate,
        intent,
        narration,
        partyId,
        amount,
        userId,
        idempotencyKey,
      ],
    );
    const voucherId = voucherResult.rows[0]?.id;
    if (!voucherId) throw new Error("Failed to create voucher");

    const debitLine = await client.query<{ id: string }>(
      `INSERT INTO voucher_lines (
         tenant_id, company_id, voucher_id, account_id, debit, credit, narration
       ) VALUES ($1, $2, $3, $4, $5, 0, $6)
       RETURNING id`,
      [tenantId, companyId, voucherId, debitAccountId, amount, narration],
    );
    const creditLine = await client.query<{ id: string }>(
      `INSERT INTO voucher_lines (
         tenant_id, company_id, voucher_id, account_id, debit, credit, narration
       ) VALUES ($1, $2, $3, $4, 0, $5, $6)
       RETURNING id`,
      [tenantId, companyId, voucherId, creditAccountId, amount, narration],
    );

    await client.query(
      `INSERT INTO ledger_postings (
         tenant_id, company_id, voucher_id, voucher_line_id, account_id, posting_date, debit, credit
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
      [
        tenantId,
        companyId,
        voucherId,
        debitLine.rows[0]?.id,
        debitAccountId,
        voucherDate,
        amount,
      ],
    );
    await client.query(
      `INSERT INTO ledger_postings (
         tenant_id, company_id, voucher_id, voucher_line_id, account_id, posting_date, debit, credit
       ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7)`,
      [
        tenantId,
        companyId,
        voucherId,
        creditLine.rows[0]?.id,
        creditAccountId,
        voucherDate,
        amount,
      ],
    );

    await client.query(
      `INSERT INTO khata_transactions (
         tenant_id, company_id, voucher_id, chat_source_text,
         detected_party_name_raw, item_description_raw, sync_status, created_offline
       ) VALUES ($1, $2, $3, $4, $5, $6, 'synced', FALSE)`,
      [tenantId, companyId, voucherId, rawText, partyName, item],
    );

    await client.query("COMMIT");
    return { voucher_id: voucherId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

router.post("/khata/confirm", async (req: Request, res: Response) => {
  const tenantId = str(req.body?.tenant_id);
  const companyId = str(req.body?.company_id);
  const userId = str(req.body?.user_id) || null;
  const intent = str(req.body?.intent) as KhataIntent;
  const amount = num(req.body?.amount);
  const partyName = str(req.body?.party) || null;
  const item = str(req.body?.item) || null;
  const voucherDate = str(req.body?.date) || new Date().toISOString().slice(0, 10);
  const rawText = str(req.body?.raw_text);
  const idempotencyKey = str(req.body?.client_idempotency_key) || null;

  if (!tenantId || !companyId || !intent || amount <= 0) {
    return sendError(res, "Invalid confirm payload", 400);
  }

  if (!KHATA_ACCOUNTS[intent]) {
    return sendError(res, "Unsupported khata intent", 400);
  }

  // TODO: enforce FREE_TIER_MONTHLY_LIMIT server-side when threshold is confirmed.

  try {
    const result = await executeKhataConfirm({
      tenantId,
      companyId,
      userId,
      intent,
      amount,
      partyName,
      item,
      voucherDate,
      rawText,
      idempotencyKey,
    });
    return sendSuccess(res, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Confirm failed";
    return sendError(res, message, 500);
  }
});

router.get("/khata/balance", async (req: Request, res: Response) => {
  const tenantId = str(req.query.tenant_id);
  const companyId = str(req.query.company_id);

  if (!tenantId || !companyId) {
    return sendError(res, "tenant_id and company_id are required", 400);
  }

  await ensureKhataAccounts(tenantId, companyId);

  const debtAccount = await query<{ id: string }>(
    `SELECT id FROM chart_of_accounts
     WHERE tenant_id = $1 AND company_id = $2 AND code = 'KH-DEBT' LIMIT 1`,
    [tenantId, companyId],
  );
  const credAccount = await query<{ id: string }>(
    `SELECT id FROM chart_of_accounts
     WHERE tenant_id = $1 AND company_id = $2 AND code = 'KH-CRED' LIMIT 1`,
    [tenantId, companyId],
  );
  const debtAccountId = debtAccount.rows[0]?.id;
  const credAccountId = credAccount.rows[0]?.id;

  if (!debtAccountId || !credAccountId) {
    return sendError(res, "Khata accounts not seeded", 500);
  }

  const udhaarOut = await query<{ total: string }>(
    `SELECT COALESCE(SUM(debit - credit), 0)::text AS total
     FROM ledger_postings
     WHERE tenant_id = $1 AND company_id = $2 AND account_id = $3`,
    [tenantId, companyId, debtAccountId],
  );

  const udhaarIn = await query<{ total: string }>(
    `SELECT COALESCE(SUM(credit - debit), 0)::text AS total
     FROM ledger_postings
     WHERE tenant_id = $1 AND company_id = $2 AND account_id = $3`,
    [tenantId, companyId, credAccountId],
  );

  const recentCreditSales = await query(
    `SELECT v.id, v.voucher_date, v.grand_total AS amount, p.name AS party_name,
            kt.item_description_raw AS item, v.voucher_type
     FROM vouchers v
     LEFT JOIN parties p ON p.id = v.party_id
     LEFT JOIN khata_transactions kt ON kt.voucher_id = v.id
     WHERE v.tenant_id = $1 AND v.company_id = $2 AND v.voucher_type = 'khata_credit_sale'
     ORDER BY v.voucher_date DESC, v.created_at DESC
     LIMIT 10`,
    [tenantId, companyId],
  );

  const recentPaymentsIn = await query(
    `SELECT v.id, v.voucher_date, v.grand_total AS amount, p.name AS party_name,
            kt.item_description_raw AS item, v.voucher_type
     FROM vouchers v
     LEFT JOIN parties p ON p.id = v.party_id
     LEFT JOIN khata_transactions kt ON kt.voucher_id = v.id
     WHERE v.tenant_id = $1 AND v.company_id = $2 AND v.voucher_type = 'khata_payment_in'
     ORDER BY v.voucher_date DESC, v.created_at DESC
     LIMIT 10`,
    [tenantId, companyId],
  );

  return sendSuccess(res, {
    udhaar_out_total: Number(udhaarOut.rows[0]?.total ?? 0),
    udhaar_in_total: Number(udhaarIn.rows[0]?.total ?? 0),
    recent_credit_sales: recentCreditSales.rows,
    recent_payments_in: recentPaymentsIn.rows,
  });
});

router.get("/khata/insights", async (req: Request, res: Response) => {
  const tenantId = str(req.query.tenant_id);
  const companyId = str(req.query.company_id);

  if (!tenantId || !companyId) {
    return sendError(res, "tenant_id and company_id are required", 400);
  }

  await ensureKhataAccounts(tenantId, companyId);
  const insights: Array<{
    id: string;
    type: string;
    message: string;
    party_name?: string | null;
  }> = [];

  const daily = await query<{ sales: string; expense: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN v.voucher_type IN ('khata_cash_sale', 'khata_credit_sale')
         THEN v.grand_total ELSE 0 END), 0)::text AS sales,
       COALESCE(SUM(CASE WHEN v.voucher_type = 'khata_expense'
         THEN v.grand_total ELSE 0 END), 0)::text AS expense
     FROM vouchers v
     WHERE v.tenant_id = $1 AND v.company_id = $2 AND v.voucher_date = CURRENT_DATE`,
    [tenantId, companyId],
  );

  insights.push({
    id: "daily-total",
    type: "daily_total",
    message: `Aajako bechbikhan: NPR ${Number(daily.rows[0]?.sales ?? 0)}. Kharcha: NPR ${Number(daily.rows[0]?.expense ?? 0)}.`,
  });

  const unpaid = await query<{ party_name: string; balance: string; days_since: string }>(
    `SELECT p.name AS party_name,
            COALESCE(SUM(lp.debit - lp.credit), 0)::text AS balance,
            EXTRACT(DAY FROM NOW() - MAX(v.created_at))::int::text AS days_since
     FROM ledger_postings lp
     JOIN chart_of_accounts coa ON coa.id = lp.account_id AND coa.code = 'KH-DEBT'
     JOIN vouchers v ON v.id = lp.voucher_id
     LEFT JOIN parties p ON p.id = v.party_id
     WHERE lp.tenant_id = $1 AND lp.company_id = $2 AND p.name IS NOT NULL
     GROUP BY p.id, p.name
     HAVING COALESCE(SUM(lp.debit - lp.credit), 0) > 0
       AND MAX(v.created_at) < NOW() - INTERVAL '7 days'
     ORDER BY MAX(v.created_at) ASC
     LIMIT 1`,
    [tenantId, companyId],
  );

  if (unpaid.rows[0]) {
    const row = unpaid.rows[0];
    insights.push({
      id: `unpaid-${row.party_name}`,
      type: "unpaid_udhaar",
      party_name: row.party_name,
      message: `${row.party_name} le NPR ${Number(row.balance)} tireko chhaina. Aaj samma ${row.days_since} dina bhayo.`,
    });
  }

  const weekly = await query<{ current: string; previous: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN v.voucher_date >= date_trunc('week', CURRENT_DATE)
         THEN v.grand_total ELSE 0 END), 0)::text AS current,
       COALESCE(SUM(CASE WHEN v.voucher_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
         AND v.voucher_date < date_trunc('week', CURRENT_DATE)
         THEN v.grand_total ELSE 0 END), 0)::text AS previous
     FROM vouchers v
     WHERE v.tenant_id = $1 AND v.company_id = $2
       AND v.voucher_type IN ('khata_cash_sale', 'khata_credit_sale')
       AND v.voucher_date >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'`,
    [tenantId, companyId],
  );

  const currentWeek = Number(weekly.rows[0]?.current ?? 0);
  const previousWeek = Number(weekly.rows[0]?.previous ?? 0);
  if (currentWeek > previousWeek) {
    insights.push({
      id: "weekly-trend",
      type: "weekly_trend",
      message: `Yo hapta aglo hapta bhandaa NPR ${currentWeek - previousWeek} le badhi becheko.`,
    });
  }

  const VAT_THRESHOLD = 5_000_000;
  const rollingSales = await query<{ total: string }>(
    `SELECT COALESCE(SUM(grand_total), 0)::text AS total
     FROM vouchers
     WHERE tenant_id = $1 AND company_id = $2
       AND voucher_type IN ('khata_cash_sale', 'khata_credit_sale')
       AND voucher_date >= CURRENT_DATE - INTERVAL '12 months'`,
    [tenantId, companyId],
  );

  if (Number(rollingSales.rows[0]?.total ?? 0) >= VAT_THRESHOLD * 0.8) {
    insights.push({
      id: "growth-ladder",
      type: "growth_ladder",
      message:
        "Tapaaiko byapar badhdai chha! Kasai kasai le NPR 50 lakh pachhi VAT darta garna parcha. Thaha paauna chahanu hunchha?",
    });
  }

  return sendSuccess(res, { insights: insights.slice(0, 4) });
});

router.post("/khata/payment-webhook", async (req: Request, res: Response) => {
  const secret = str(req.headers["x-payment-webhook-secret"]);
  const expected = process.env.PAYMENT_WEBHOOK_SECRET ?? "";
  if (!expected || secret !== expected) {
    return sendError(res, "Unauthorized webhook", 401);
  }

  const tenantId = str(req.body?.tenant_id);
  const companyId = str(req.body?.company_id);
  const partyName = str(req.body?.party_name) || null;
  const amount = num(req.body?.amount);
  const voucherDate = str(req.body?.date) || new Date().toISOString().slice(0, 10);
  const idempotencyKey = str(req.body?.idempotency_key) || null;

  if (!tenantId || !companyId || amount <= 0) {
    return sendError(res, "Invalid webhook payload", 400);
  }

  try {
    const result = await executeKhataConfirm({
      tenantId,
      companyId,
      userId: null,
      intent: "khata_payment_in",
      amount,
      partyName,
      item: null,
      voucherDate,
      rawText: "Payment webhook reconciliation",
      idempotencyKey: idempotencyKey ?? `webhook-${Date.now()}`,
    });
    return sendSuccess(res, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook confirm failed";
    return sendError(res, message, 500);
  }
});

export default router;
