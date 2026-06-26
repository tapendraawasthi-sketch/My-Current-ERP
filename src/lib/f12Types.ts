// src/lib/f12Types.ts
// F12 Configuration System — Type Definitions

export type F12ScreenCategory = 'global' | 'master' | 'voucher' | 'report';

export type F12FieldType = 'boolean' | 'dropdown' | 'integer' | 'text' | 'char';

/** Strict union of all available screen IDs */
export type F12ScreenId =
  | 'global'
  | 'ledger-master'
  | 'sales-voucher'
  | 'purchase-voucher'
  | 'payment'
  | 'receipt'
  | 'journal'
  | 'contra'
  | 'trial-balance'
  | 'profit-loss'
  | 'balance-sheet'
  | 'ledger'
  | 'day-book'
  | 'stock-summary';

export interface F12FieldOption {
  value: string;
  label: string;
}

/** Base interface for common field properties */
export interface F12BaseFieldDef {
  key: string;
  label: string;
  description: string;
}

export interface F12BooleanFieldDef extends F12BaseFieldDef {
  type: 'boolean';
  defaultValue: boolean;
}

export interface F12DropdownFieldDef extends F12BaseFieldDef {
  type: 'dropdown';
  defaultValue: string;
  options: F12FieldOption[];
}

export interface F12IntegerFieldDef extends F12BaseFieldDef {
  type: 'integer';
  defaultValue: number;
  min?: number;
  max?: number;
}

export interface F12TextFieldDef extends F12BaseFieldDef {
  type: 'text';
  defaultValue: string;
}

export interface F12CharFieldDef extends F12BaseFieldDef {
  type: 'char';
  defaultValue: string;
}

/** Discriminated union for field definitions ensures strict type safety based on field `type`. */
export type F12FieldDef =
  | F12BooleanFieldDef
  | F12DropdownFieldDef
  | F12IntegerFieldDef
  | F12TextFieldDef
  | F12CharFieldDef;

export interface F12SectionDef {
  sectionKey: string;
  sectionLabel: string;
  fields: F12FieldDef[];
}

export interface F12ScreenDef {
  screenId: F12ScreenId;
  screenLabel: string;
  category: F12ScreenCategory;
  sections: F12SectionDef[];
}

// ─── Stored value map ───────────────────────────────────────────────────────
export type F12ValueMap = Record<string, boolean | string | number>;

// ─── The full stored record per [companyId + screenId] ──────────────────────
export interface F12ConfigRecord {
  id: string;           // `${companyId}__${screenId}`
  companyId: string;
  screenId: F12ScreenId;
  values: F12ValueMap;
  updatedAt: string;
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════

// ─── GLOBAL (Gateway / Home screen) ─────────────────────────────────────────
export const GLOBAL_F12_DEF: F12ScreenDef = {
  screenId: 'global',
  screenLabel: 'Global / Gateway Configuration',
  category: 'global',
  sections: [
    {
      sectionKey: 'product_behavior',
      sectionLabel: 'Product Behavior',
      fields: [
        {
          key: 'enable_auto_backup',
          label: 'Enable Auto-Backup',
          description: 'Periodically saves a backup copy of all data to a specified path.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'use_advanced_entries',
          label: 'Use Advanced Entries During Data Entry',
          description: 'Enables multi-line compound entries in vouchers rather than simple debit/credit pairs.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'use_multiple_currencies',
          label: 'Use Multiple Currencies',
          description: 'When enabled, the system allows ledger accounts and transactions to be recorded in foreign currencies.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'use_cost_centres',
          label: 'Use Cost Centres',
          description: 'Activates the cost centre dimension across all voucher entry screens. When false, all cost centre fields are hidden system-wide.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'maintain_budgets',
          label: 'Maintain Budgets and Controls',
          description: 'Enables budget configuration and budget variance reports.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'activate_interest_calculation',
          label: 'Activate Interest Calculation',
          description: 'Enables automatic interest computation on outstanding balances for creditors/debtors.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'locale',
      sectionLabel: 'Country / Locale Settings',
      fields: [
        {
          key: 'country',
          label: 'Country',
          description: 'Selects the operating country. Changes which tax modules, statutory reports, and compliance formats are enabled.',
          type: 'dropdown',
          defaultValue: 'Nepal',
          options: [
            { value: 'Nepal', label: 'Nepal' },
            { value: 'India', label: 'India' },
            { value: 'USA', label: 'United States' },
            { value: 'UK', label: 'United Kingdom' },
            { value: 'Australia', label: 'Australia' },
            { value: 'Canada', label: 'Canada' },
            { value: 'Singapore', label: 'Singapore' },
            { value: 'UAE', label: 'United Arab Emirates' },
          ],
        },
        {
          key: 'currency_symbol',
          label: 'Currency Symbol',
          description: 'The symbol prepended or appended to monetary values (e.g. रू, $, £).',
          type: 'text',
          defaultValue: 'रू',
        },
        {
          key: 'decimal_separator',
          label: 'Decimal Separator',
          description: 'Single character used between whole and fractional parts of numbers.',
          type: 'char',
          defaultValue: '.',
        },
        {
          key: 'thousands_separator',
          label: 'Thousands Separator',
          description: 'Single character used as the digit group separator.',
          type: 'char',
          defaultValue: ',',
        },
        {
          key: 'date_format',
          label: 'Date Format',
          description: 'Controls how dates are entered and displayed throughout the system.',
          type: 'dropdown',
          defaultValue: 'DD-MM-YYYY',
          options: [
            { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' },
            { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY' },
            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
          ],
        },
        {
          key: 'date_separator',
          label: 'Date Separator',
          description: 'Single character used to separate date parts.',
          type: 'char',
          defaultValue: '-',
        },
      ],
    },
    {
      sectionKey: 'number_format',
      sectionLabel: 'Number Format Settings',
      fields: [
        {
          key: 'show_amounts_in_millions',
          label: 'Show Amounts in Millions',
          description: 'When enabled, figures are divided by 1,000,000 and a scale indicator is shown.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'decimal_places_amounts',
          label: 'Decimal Places for Amounts',
          description: 'How many decimal places to show on monetary values.',
          type: 'integer',
          defaultValue: 2,
          min: 0,
          max: 4,
        },
        {
          key: 'decimal_places_quantities',
          label: 'Decimal Places for Quantities',
          description: 'How many decimal places to show on stock quantities.',
          type: 'integer',
          defaultValue: 2,
          min: 0,
          max: 4,
        },
        {
          key: 'space_between_symbol_and_amount',
          label: 'Space Between Symbol and Amount',
          description: 'Controls whether रू1000 displays as रू 1,000.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
  ],
};

// ─── LEDGER MASTER ───────────────────────────────────────────────────────────
export const LEDGER_MASTER_F12_DEF: F12ScreenDef = {
  screenId: 'ledger-master',
  screenLabel: 'Ledger Master Configuration',
  category: 'master',
  sections: [
    {
      sectionKey: 'field_visibility',
      sectionLabel: 'Field Visibility Controls',
      fields: [
        {
          key: 'provide_bank_details',
          label: 'Provide Bank Details',
          description: 'When enabled, a sub-section appears for bank name, branch, account number, IFSC/SWIFT code, and account type.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'use_addresses',
          label: 'Use Addresses for Ledger Accounts',
          description: 'When enabled, a multi-line address block appears on the ledger form for full mailing/billing address.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'provide_contact_details',
          label: 'Provide Contact Details',
          description: 'When enabled, fields appear for phone, mobile, fax, email address, and website URL.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'bill_wise_non_trading',
          label: 'For Non-Trading Accounts Also (Bill-Wise)',
          description: 'When true, bill-by-bill settlement tracking is activated even for non-Sundry Debtors/Creditors accounts.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_opening_balance_revenue',
          label: 'Show Opening Balance for Revenue Items',
          description: 'When enabled, shows an opening balance field even for P&L / income-and-expense type accounts.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'activate_interest_for_ledger',
          label: 'Activate Interest Calculation for This Ledger',
          description: 'When enabled, fields appear to define interest rate, calculation basis, style (simple/compound), and grace period.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'tax_registration_details',
          label: 'Tax Registration Details',
          description: 'When enabled, fields appear for PAN, VAT number, and other tax identification numbers.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
  ],
};

// ─── SALES VOUCHER ───────────────────────────────────────────────────────────
export const SALES_VOUCHER_F12_DEF: F12ScreenDef = {
  screenId: 'sales-voucher',
  screenLabel: 'Sales Voucher Configuration',
  category: 'voucher',
  sections: [
    {
      sectionKey: 'field_skip',
      sectionLabel: 'Field Visibility Controls',
      fields: [
        {
          key: 'show_transaction_date',
          label: 'Show Transaction Date Field',
          description: 'When false, the date defaults to the last-used date and the cursor skips it.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_narration',
          label: 'Show Narration Field',
          description: 'When false, the narration/description line at the bottom of the voucher is suppressed.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_cost_centre',
          label: 'Show Cost Centre / Cost Category Allocation',
          description: 'When true, after each ledger line the system asks to allocate the amount to one or more cost centres.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_bill_wise',
          label: 'Show Bill-Wise Details (Outstanding Reference)',
          description: 'When true, a sub-screen appears to specify which invoice a payment/receipt is against.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
    {
      sectionKey: 'entry_mode',
      sectionLabel: 'Entry Mode Controls',
      fields: [
        {
          key: 'use_single_entry_mode',
          label: 'Use Single Entry Mode',
          description: 'When true, shows a simplified two-sided form. When false, multi-entry mode allows complex compound vouchers.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'prefill_last_narration',
          label: 'Prefill with Last Used Narration',
          description: 'When true, the narration field auto-populates with the narration from the most recently saved voucher of the same type.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'warnings',
      sectionLabel: 'Warning / Validation Controls',
      fields: [
        {
          key: 'warn_negative_stock',
          label: 'Warn on Negative Stock Balance',
          description: 'When true, alerts the user if a sales voucher would cause a stock item quantity to go negative.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'warn_duplicate_bill_ref',
          label: 'Warn If Same Bill Reference Exists',
          description: 'When true, warns of a potential duplicate entry if the invoice number has already been recorded.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
    {
      sectionKey: 'balance_display',
      sectionLabel: 'Balance Display Controls',
      fields: [
        {
          key: 'show_ledger_balance_on_entry',
          label: 'Show Ledger Balance as You Enter',
          description: 'When true, the current balance of a selected ledger account is shown inline.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_closing_balance_after_save',
          label: 'Show Closing Balance After Saving',
          description: 'When true, after the voucher is saved, the updated balance of the primary ledger is shown.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'tax',
      sectionLabel: 'Tax and Duty Controls',
      fields: [
        {
          key: 'modify_tax_rate',
          label: 'Modify Tax Rate Details',
          description: 'When true, the user can override the auto-calculated tax rate or tax amount on individual voucher lines.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'allow_modify_all_fields',
          label: 'Allow Modification of All Fields During Entry',
          description: 'A master override that enables the user to edit every field of a voucher that would otherwise be locked.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
  ],
};

// ─── PURCHASE VOUCHER ────────────────────────────────────────────────────────
export const PURCHASE_VOUCHER_F12_DEF: F12ScreenDef = {
  screenId: 'purchase-voucher',
  screenLabel: 'Purchase Voucher Configuration',
  category: 'voucher',
  sections: [
    {
      sectionKey: 'field_skip',
      sectionLabel: 'Field Visibility Controls',
      fields: [
        {
          key: 'show_transaction_date',
          label: 'Show Transaction Date Field',
          description: 'When false, the date defaults to the last-used date and the cursor skips it.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_narration',
          label: 'Show Narration Field',
          description: 'When false, the narration/description line at the bottom of the voucher is suppressed.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_cost_centre',
          label: 'Show Cost Centre Allocation',
          description: 'When true, after each ledger line the system asks to allocate the amount to one or more cost centres.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_bill_wise',
          label: 'Show Bill-Wise Details',
          description: 'When true, a sub-screen appears to specify which bill this payment is against.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
    {
      sectionKey: 'entry_mode',
      sectionLabel: 'Entry Mode Controls',
      fields: [
        {
          key: 'allow_expenses_in_purchase',
          label: 'Allow Expenses in Purchase Vouchers',
          description: 'When true, the user can add ledger lines from expense account groups (freight, packing charges) alongside the purchase ledger line.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'allow_fixed_assets_in_purchase',
          label: 'Allow Fixed Assets in Purchase Vouchers',
          description: 'Permits ledger lines from fixed asset account groups in a purchase voucher. Needed when purchasing capital equipment.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'prefill_last_narration',
          label: 'Prefill with Last Used Narration',
          description: 'When true, the narration field auto-populates with the narration from the most recently saved voucher of the same type.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'warnings',
      sectionLabel: 'Warning / Validation Controls',
      fields: [
        {
          key: 'warn_duplicate_bill_ref',
          label: 'Warn If Same Bill Reference Exists',
          description: 'When true, warns of a potential duplicate if the supplier invoice number has already been recorded.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
    {
      sectionKey: 'balance_display',
      sectionLabel: 'Balance Display Controls',
      fields: [
        {
          key: 'show_ledger_balance_on_entry',
          label: 'Show Ledger Balance as You Enter',
          description: 'When true, the current balance of a selected ledger account is shown inline.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
    {
      sectionKey: 'tax',
      sectionLabel: 'Tax and Duty Controls',
      fields: [
        {
          key: 'modify_tax_rate',
          label: 'Modify Tax Rate Details',
          description: 'When true, the user can override the auto-calculated tax rate on individual voucher lines.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
  ],
};

// ─── PAYMENT VOUCHER ─────────────────────────────────────────────────────────
export const PAYMENT_VOUCHER_F12_DEF: F12ScreenDef = {
  screenId: 'payment',
  screenLabel: 'Payment Voucher Configuration',
  category: 'voucher',
  sections: [
    {
      sectionKey: 'field_skip',
      sectionLabel: 'Field Visibility Controls',
      fields: [
        {
          key: 'show_transaction_date',
          label: 'Show Transaction Date Field',
          description: 'When false, the date defaults to the last-used date.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_narration',
          label: 'Show Narration Field',
          description: 'When false, the narration line is suppressed.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_cost_centre',
          label: 'Show Cost Centre Allocation',
          description: 'When true, after each ledger line the system prompts for cost centre allocation.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_bill_wise',
          label: 'Show Bill-Wise Details',
          description: 'When true, a sub-screen appears to specify which outstanding bill this payment is against.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
    {
      sectionKey: 'warnings',
      sectionLabel: 'Warning / Validation Controls',
      fields: [
        {
          key: 'warn_negative_cash',
          label: 'Warn on Negative Cash Balance',
          description: 'When true, if a payment voucher would cause cash-in-hand to go negative, the system warns before saving.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
    {
      sectionKey: 'balance_display',
      sectionLabel: 'Balance Display Controls',
      fields: [
        {
          key: 'show_ledger_balance_on_entry',
          label: 'Show Ledger Balance as You Enter',
          description: 'Critical for bank payment entries so the user can verify sufficient funds.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_closing_balance_after_save',
          label: 'Show Closing Balance After Saving',
          description: 'After the voucher is saved, shows the updated balance of the primary ledger.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
  ],
};

// ─── RECEIPT VOUCHER ─────────────────────────────────────────────────────────
export const RECEIPT_VOUCHER_F12_DEF: F12ScreenDef = {
  screenId: 'receipt',
  screenLabel: 'Receipt Voucher Configuration',
  category: 'voucher',
  sections: [
    {
      sectionKey: 'field_skip',
      sectionLabel: 'Field Visibility Controls',
      fields: [
        {
          key: 'show_transaction_date',
          label: 'Show Transaction Date Field',
          description: 'When false, the date defaults to the last-used date.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_narration',
          label: 'Show Narration Field',
          description: 'When false, the narration line is suppressed.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_bill_wise',
          label: 'Show Bill-Wise Details',
          description: 'When true, a sub-screen appears to specify which outstanding invoice this receipt is against.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
    {
      sectionKey: 'balance_display',
      sectionLabel: 'Balance Display Controls',
      fields: [
        {
          key: 'show_ledger_balance_on_entry',
          label: 'Show Ledger Balance as You Enter',
          description: 'When true, the current balance of a selected ledger account is shown inline.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
  ],
};

// ─── JOURNAL VOUCHER ─────────────────────────────────────────────────────────
export const JOURNAL_VOUCHER_F12_DEF: F12ScreenDef = {
  screenId: 'journal',
  screenLabel: 'Journal Voucher Configuration',
  category: 'voucher',
  sections: [
    {
      sectionKey: 'field_skip',
      sectionLabel: 'Field Visibility Controls',
      fields: [
        {
          key: 'show_transaction_date',
          label: 'Show Transaction Date Field',
          description: 'When false, the date defaults to the last-used date.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_narration',
          label: 'Show Narration Field',
          description: 'When false, the narration line is suppressed.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_cost_centre',
          label: 'Show Cost Centre Allocation',
          description: 'When true, after each ledger line the system prompts for cost centre allocation.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_bill_wise',
          label: 'Show Bill-Wise Details',
          description: 'When true, a sub-screen for bill references appears after each debtor/creditor line.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'balance_display',
      sectionLabel: 'Balance Display Controls',
      fields: [
        {
          key: 'show_ledger_balance_on_entry',
          label: 'Show Ledger Balance as You Enter',
          description: 'When true, the current balance of a selected ledger account is shown inline.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
  ],
};

// ─── CONTRA VOUCHER ──────────────────────────────────────────────────────────
export const CONTRA_VOUCHER_F12_DEF: F12ScreenDef = {
  screenId: 'contra',
  screenLabel: 'Contra Voucher Configuration',
  category: 'voucher',
  sections: [
    {
      sectionKey: 'field_skip',
      sectionLabel: 'Field Visibility Controls',
      fields: [
        {
          key: 'show_transaction_date',
          label: 'Show Transaction Date Field',
          description: 'When false, the date defaults to the last-used date.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_narration',
          label: 'Show Narration Field',
          description: 'When false, the narration line is suppressed.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
    {
      sectionKey: 'balance_display',
      sectionLabel: 'Balance Display Controls',
      fields: [
        {
          key: 'show_ledger_balance_on_entry',
          label: 'Show Ledger Balance as You Enter',
          description: 'When true, the current balance of each bank/cash account is shown as the user selects it.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
  ],
};

// ─── TRIAL BALANCE REPORT ────────────────────────────────────────────────────
export const TRIAL_BALANCE_F12_DEF: F12ScreenDef = {
  screenId: 'trial-balance',
  screenLabel: 'Trial Balance Configuration',
  category: 'report',
  sections: [
    {
      sectionKey: 'columns',
      sectionLabel: 'Column Visibility Controls',
      fields: [
        {
          key: 'show_opening_balance',
          label: 'Show Opening Balance Column',
          description: 'Displays the balance at the start of the selected period.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_closing_balance',
          label: 'Show Closing Balance Column',
          description: 'Displays the balance at the end of the selected period.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_dr_cr_separate',
          label: 'Show Debit and Credit Columns Separately',
          description: 'When true, Dr and Cr amounts are shown in separate columns. When false, a single net-balance column is used.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_transaction_count',
          label: 'Show Transaction Count',
          description: 'Adds a column showing the number of vouchers contributing to each line.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_zero_balance_accounts',
          label: 'Show Zero-Balance Accounts',
          description: 'Includes accounts with no movement in the period (which are normally suppressed).',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'name_appearance',
      sectionLabel: 'Name and Label Appearance',
      fields: [
        {
          key: 'show_full_account_names',
          label: 'Show Full Account Names',
          description: 'When true, ledger/group names are shown without abbreviation.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_account_code',
          label: 'Show Account Code / Alias',
          description: 'When true, an additional identifier column appears alongside the name.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_parent_group',
          label: 'Show Parent Group Name',
          description: 'Appends the parent account group name to each ledger name in brackets.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'number_format',
      sectionLabel: 'Number Formatting',
      fields: [
        {
          key: 'scale_factor',
          label: 'Scale Factor',
          description: 'All values in the report are divided by the selected factor.',
          type: 'dropdown',
          defaultValue: 'none',
          options: [
            { value: 'none', label: 'None' },
            { value: 'thousands', label: 'Thousands (÷1,000)' },
            { value: 'lakhs', label: 'Lakhs (÷1,00,000)' },
            { value: 'millions', label: 'Millions (÷10,00,000)' },
            { value: 'crores', label: 'Crores (÷1,00,00,000)' },
          ],
        },
        {
          key: 'show_without_decimals',
          label: 'Show Amounts Without Decimals',
          description: 'Rounds all displayed values to whole numbers (does not affect stored data).',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'negative_display_style',
          label: 'Negative Amount Display Style',
          description: 'Controls how negative balances are visually indicated.',
          type: 'dropdown',
          defaultValue: 'minus',
          options: [
            { value: 'parentheses', label: '(1,000) — Parentheses' },
            { value: 'minus', label: '-1,000 — Minus Sign' },
            { value: 'suffix_cr', label: '1,000 CR — Suffix' },
          ],
        },
      ],
    },
    {
      sectionKey: 'sorting',
      sectionLabel: 'Sorting Controls',
      fields: [
        {
          key: 'sort_by',
          label: 'Sort By',
          description: 'Controls the order in which accounts appear in the report.',
          type: 'dropdown',
          defaultValue: 'default',
          options: [
            { value: 'default', label: 'Default (Natural Order)' },
            { value: 'alpha_asc', label: 'Alphabetical A–Z' },
            { value: 'alpha_desc', label: 'Alphabetical Z–A' },
            { value: 'amount_asc', label: 'Amount (Ascending)' },
            { value: 'amount_desc', label: 'Amount (Descending)' },
            { value: 'account_code', label: 'Account Code' },
          ],
        },
      ],
    },
  ],
};

// ─── PROFIT & LOSS REPORT ────────────────────────────────────────────────────
export const PROFIT_LOSS_F12_DEF: F12ScreenDef = {
  screenId: 'profit-loss',
  screenLabel: 'Profit & Loss Configuration',
  category: 'report',
  sections: [
    {
      sectionKey: 'columns',
      sectionLabel: 'Column Visibility Controls',
      fields: [
        {
          key: 'show_percentage_column',
          label: 'Show Percentage Column',
          description: 'Adds a column showing each line value as a % of total revenue.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_gross_profit',
          label: 'Show Gross Profit',
          description: 'Adds a sub-total line for gross profit before operating expenses.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_percentage_of_net_revenue',
          label: 'Show Percentage of Net Revenue',
          description: 'Adds a % column where each expense line is shown as a % of total revenue.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'number_format',
      sectionLabel: 'Number Formatting',
      fields: [
        {
          key: 'scale_factor',
          label: 'Scale Factor',
          description: 'All values in the report are divided by the selected factor.',
          type: 'dropdown',
          defaultValue: 'none',
          options: [
            { value: 'none', label: 'None' },
            { value: 'thousands', label: 'Thousands (÷1,000)' },
            { value: 'lakhs', label: 'Lakhs (÷1,00,000)' },
            { value: 'millions', label: 'Millions (÷10,00,000)' },
            { value: 'crores', label: 'Crores (÷1,00,00,000)' },
          ],
        },
        {
          key: 'show_without_decimals',
          label: 'Show Amounts Without Decimals',
          description: 'Rounds all displayed values to whole numbers.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'period',
      sectionLabel: 'Date and Period Options',
      fields: [
        {
          key: 'group_by_period',
          label: 'Group By Period',
          description: 'Adds sub-total breaks at the selected interval within the report period.',
          type: 'dropdown',
          defaultValue: 'none',
          options: [
            { value: 'none', label: 'None' },
            { value: 'month', label: 'Monthly' },
            { value: 'quarter', label: 'Quarterly' },
            { value: 'year', label: 'Yearly' },
          ],
        },
        {
          key: 'show_period_in_header',
          label: 'Show Period in Report Header',
          description: 'Prints the from-date and to-date prominently in the report title block.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
  ],
};

// ─── BALANCE SHEET REPORT ────────────────────────────────────────────────────
export const BALANCE_SHEET_F12_DEF: F12ScreenDef = {
  screenId: 'balance-sheet',
  screenLabel: 'Balance Sheet Configuration',
  category: 'report',
  sections: [
    {
      sectionKey: 'columns',
      sectionLabel: 'Column Visibility Controls',
      fields: [
        {
          key: 'show_working_capital',
          label: 'Show Working Capital',
          description: 'Adds a sub-total for net current assets (current assets minus current liabilities).',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_percentage_column',
          label: 'Show Percentage Column',
          description: 'Adds a column showing each line value as a % of total assets/liabilities.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'number_format',
      sectionLabel: 'Number Formatting',
      fields: [
        {
          key: 'scale_factor',
          label: 'Scale Factor',
          description: 'All values in the report are divided by the selected factor.',
          type: 'dropdown',
          defaultValue: 'none',
          options: [
            { value: 'none', label: 'None' },
            { value: 'thousands', label: 'Thousands (÷1,000)' },
            { value: 'lakhs', label: 'Lakhs (÷1,00,000)' },
            { value: 'millions', label: 'Millions (÷10,00,000)' },
            { value: 'crores', label: 'Crores (÷1,00,00,000)' },
          ],
        },
        {
          key: 'show_without_decimals',
          label: 'Show Amounts Without Decimals',
          description: 'Rounds all displayed values to whole numbers.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'period',
      sectionLabel: 'Date and Period Options',
      fields: [
        {
          key: 'show_period_in_header',
          label: 'Show Period in Report Header',
          description: 'Prints the as-of date prominently in the report title block.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
  ],
};

// ─── GENERAL LEDGER (Ledger Report) ─────────────────────────────────────────
export const GENERAL_LEDGER_F12_DEF: F12ScreenDef = {
  screenId: 'ledger',
  screenLabel: 'General Ledger Report Configuration',
  category: 'report',
  sections: [
    {
      sectionKey: 'columns',
      sectionLabel: 'Column Visibility Controls',
      fields: [
        {
          key: 'show_running_balance',
          label: 'Show Running Balance Column',
          description: 'Adds a cumulative running balance column after each transaction row.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_dr_cr_separate',
          label: 'Show Debit and Credit Columns Separately',
          description: 'When true, Dr and Cr amounts are shown in separate columns.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_voucher_date',
          label: 'Show Voucher Date Alongside Ledger Name',
          description: 'In drill-down reports, adds the voucher date as a separate column.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
    {
      sectionKey: 'number_format',
      sectionLabel: 'Number Formatting',
      fields: [
        {
          key: 'show_without_decimals',
          label: 'Show Amounts Without Decimals',
          description: 'Rounds all displayed values to whole numbers.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'negative_display_style',
          label: 'Negative Amount Display Style',
          description: 'Controls how negative balances are visually indicated.',
          type: 'dropdown',
          defaultValue: 'minus',
          options: [
            { value: 'parentheses', label: '(1,000) — Parentheses' },
            { value: 'minus', label: '-1,000 — Minus Sign' },
            { value: 'suffix_cr', label: '1,000 CR — Suffix' },
          ],
        },
      ],
    },
  ],
};

// ─── DAY BOOK REPORT ─────────────────────────────────────────────────────────
export const DAY_BOOK_F12_DEF: F12ScreenDef = {
  screenId: 'day-book',
  screenLabel: 'Day Book Configuration',
  category: 'report',
  sections: [
    {
      sectionKey: 'columns',
      sectionLabel: 'Column Visibility Controls',
      fields: [
        {
          key: 'show_narration',
          label: 'Show Narration Column',
          description: 'When true, the narration/description is shown for each voucher line.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_voucher_number',
          label: 'Show Voucher Number Column',
          description: 'When true, the voucher number is displayed alongside each entry.',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'show_dr_cr_separate',
          label: 'Show Debit and Credit Columns Separately',
          description: 'When true, Dr and Cr amounts are shown in separate columns.',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    },
    {
      sectionKey: 'sorting',
      sectionLabel: 'Sorting Controls',
      fields: [
        {
          key: 'sort_by',
          label: 'Sort By',
          description: 'Controls the order in which vouchers appear in the day book.',
          type: 'dropdown',
          defaultValue: 'default',
          options: [
            { value: 'default', label: 'Default (Entry Order)' },
            { value: 'voucher_type', label: 'Voucher Type' },
            { value: 'amount_desc', label: 'Amount (Descending)' },
          ],
        },
      ],
    },
  ],
};

// ─── STOCK SUMMARY REPORT ────────────────────────────────────────────────────
export const STOCK_SUMMARY_F12_DEF: F12ScreenDef = {
  screenId: 'stock-summary',
  screenLabel: 'Stock Summary Configuration',
  category: 'report',
  sections: [
    {
      sectionKey: 'columns',
      sectionLabel: 'Column Visibility Controls',
      fields: [
        {
          key: 'show_godown_wise',
          label: 'Show Godown-Wise Breakup',
          description: 'Expands each stock item to show quantity and value per storage location (godown/warehouse).',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_opening_qty',
          label: 'Show Opening Quantity',
          description: 'Displays the opening quantity at the start of the period.',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'show_inward_outward',
          label: 'Show Inward and Outward Columns',
          description: 'Shows separate columns for quantities received and dispatched in the period.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
    {
      sectionKey: 'number_format',
      sectionLabel: 'Number Formatting',
      fields: [
        {
          key: 'show_without_decimals',
          label: 'Show Amounts Without Decimals',
          description: 'Rounds all displayed values to whole numbers.',
          type: 'boolean',
          defaultValue: false,
        },
      ],
    },
  ],
};

// ─── Registry: map screenId → definition ────────────────────────────────────
export const F12_SCREEN_REGISTRY: Record<F12ScreenId, F12ScreenDef> = {
  global: GLOBAL_F12_DEF,
  'ledger-master': LEDGER_MASTER_F12_DEF,
  'sales-voucher': SALES_VOUCHER_F12_DEF,
  'purchase-voucher': PURCHASE_VOUCHER_F12_DEF,
  payment: PAYMENT_VOUCHER_F12_DEF,
  receipt: RECEIPT_VOUCHER_F12_DEF,
  journal: JOURNAL_VOUCHER_F12_DEF,
  contra: CONTRA_VOUCHER_F12_DEF,
  'trial-balance': TRIAL_BALANCE_F12_DEF,
  'profit-loss': PROFIT_LOSS_F12_DEF,
  'balance-sheet': BALANCE_SHEET_F12_DEF,
  ledger: GENERAL_LEDGER_F12_DEF,
  'day-book': DAY_BOOK_F12_DEF,
  'stock-summary': STOCK_SUMMARY_F12_DEF,
};

// ─── Helper: get all default values for a screen ────────────────────────────
export function getDefaultValues(screenId: F12ScreenId): F12ValueMap {
  const def = F12_SCREEN_REGISTRY[screenId];
  if (!def) return {};
  
  return def.sections.reduce((acc, section) => {
    section.fields.forEach(field => {
      acc[field.key] = field.defaultValue;
    });
    return acc;
  }, {} as F12ValueMap);
}
