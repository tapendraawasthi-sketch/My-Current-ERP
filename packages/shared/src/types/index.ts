// 1. Company & Tenant Layer

export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly plan: 'basic' | 'standard' | 'enterprise';
  readonly created_at: Date;
}

export interface Company {
  readonly id: string;
  readonly name: string;
  readonly GSTIN: string | null;
  readonly PAN: string | null;
  readonly FY_beginning: Date;
  readonly FY_end: Date;
  readonly currency: string;
  readonly settings: Record<string, unknown>;
}

export interface FiscalYear {
  readonly id: string;
  readonly label: string;
  readonly start_date: Date;
  readonly end_date: Date;
  readonly is_current: boolean;
  readonly is_closed: boolean;
}

// 2. Chart of Accounts

export interface AccountGroup {
  readonly id: string;
  readonly parent_id: string | null;
  readonly name: string;
  readonly nature: 'asset' | 'liability' | 'income' | 'expense';
}

export interface Ledger {
  readonly id: string;
  readonly group_id: string;
  readonly name: string;
  readonly alias: string | null;
  readonly opening_balance: number;
  readonly dr_cr: 'DR' | 'CR';
  readonly address: string | null;
  readonly GSTIN: string | null;
  readonly PAN: string | null;
  readonly bill_by_bill: boolean;
}

export interface TaxCategory {
  readonly id: string;
  readonly name: string;
  readonly cgst_rate: number;
  readonly sgst_rate: number;
  readonly igst_rate: number;
}

// 3. Inventory Masters

export interface ItemGroup {
  readonly id: string;
  readonly parent_id: string | null;
  readonly name: string;
}

export interface Unit {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimal_places: number;
  readonly UQC_code: string | null;
}

export interface UnitConversion {
  readonly from_unit: string;
  readonly to_unit: string;
  readonly factor: number;
}

export interface Item {
  readonly id: string;
  readonly name: string;
  readonly group_id: string;
  readonly unit_id: string;
  readonly hsn_code: string | null;
  readonly tax_category_id: string | null;
  readonly prices: Record<string, number>;
  readonly critical_level: number | null;
}

export interface MaterialCentre {
  readonly id: string;
  readonly name: string;
  readonly group: string | null;
  readonly stock_account_id: string | null;
  readonly accounting_in_stock: boolean;
}

export interface BillSundry {
  readonly id: string;
  readonly name: string;
  readonly type: 'additive' | 'subtractive';
  readonly nature: 'tax' | 'discount' | 'other';
  readonly account_id: string | null;
}

// 4. Voucher Framework

export interface VoucherSeries {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly prefix: string | null;
  readonly suffix: string | null;
  readonly next_number: number;
  readonly reset_on: 'never' | 'yearly' | 'monthly';
}

export interface Voucher {
  readonly id: string;
  readonly type: string;
  readonly series_id: string;
  readonly number: number;
  readonly date: Date;
  readonly party_ledger_id: string | null;
  readonly narration: string | null;
  readonly status: 'draft' | 'approved' | 'cancelled';
}

export interface VoucherLine {
  readonly id: string;
  readonly dc: 'DR' | 'CR';
  readonly ledger_id: string | null;
  readonly item_id: string | null;
  readonly debit: number | null;
  readonly credit: number | null;
  readonly qty: number | null;
  readonly price: number | null;
  readonly short_narration: string | null;
}

export interface BillReference {
  readonly id: string;
  readonly voucher_id: string;
  readonly ledger_id: string;
  readonly method: 'new_ref' | 'adjustment' | 'on_account';
  readonly ref_no: string;
  readonly amount: number;
  readonly dc: 'DR' | 'CR';
  readonly due_date: Date | null;
  readonly is_cleared: boolean;
}

export interface BillSundryLine {
  readonly id: string;
  readonly voucher_id: string;
  readonly bill_sundry_id: string;
  readonly rate: number | null;
  readonly amount: number;
}

// 5. GST & Tax

export interface E_Invoice {
  readonly id: string;
  readonly voucher_id: string;
  readonly irn: string;
  readonly signed_qr: string;
}

export interface EWayBill {
  readonly id: string;
  readonly voucher_id: string;
  readonly ewb_number: string;
  readonly valid_upto: Date;
  readonly transporter: string | null;
  readonly vehicle: string | null;
}

// 6. User & Access Control

export interface User {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly password_hash: string;
  readonly mfa_secret: string | null;
  readonly is_super_user: boolean;
}

export interface Role {
  readonly id: string;
  readonly name: string;
}

export interface Permission {
  readonly id: string;
  readonly resource: string;
  readonly action: 'add' | 'modify' | 'delete' | 'view' | 'print' | 'export';
}

export interface UserControl {
  readonly user_id: string;
  readonly allow_date_change: boolean;
  readonly allow_backdated_days: number | null;
  readonly max_discount_pct: number | null;
}

// 7. API Response Envelope

export interface ErrorDetail {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly value?: unknown;
}

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error?: ErrorDetail;
  readonly timestamp: string;
}
