export interface AccountGroup {
  id: string;
  name: string;
  alias?: string;
  isPrimary: boolean;
  parentId?: string;
  narration?: string;
  isSystem: boolean;
  nature: "debit" | "credit";
  category: string;
  sortOrder?: number;
}

export interface Ledger {
  id: string;
  name: string;
  alias?: string;
  printName?: string;
  groupId: string;
  accountType: string;
  address?: string;
  state?: string;
  pinCode?: string;
  country?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  gstin?: string;
  pan?: string;
  registrationType?: string;
  taxCategory?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  bankAccountType?: string;
  odCcLimit?: number;
  openingBalance?: number;
  openingBalanceType?: "Dr" | "Cr";
  billByBill?: boolean;
  maintainCostCenter?: boolean;
  maintainBranch?: boolean;
  multiCurrency?: boolean;
  tdsApplicable?: boolean;
  tcsApplicable?: boolean;
  gstApplicable?: boolean;
  reverseCharge?: boolean;
  creditLimit?: number;
  creditPeriod?: number;
  ledgerType?: "General Ledger" | "Sub Ledger";
  parentLedgerId?: string;
  optionalFields?: Record<string, unknown>;
  isActive?: boolean;
  balance?: number;
  createdAt?: string;
}

export interface FeatureConfig {
  multiCurrency: boolean;
  subLedgers: boolean;
  billByBill: boolean;
  autoRefSales: boolean;
  autoRefPurchase: boolean;
  bankInstruments: boolean;
  ledgerReconciliation: boolean;
  salesman: boolean;
  costCenter: boolean;
  budgeting: boolean;
  interestCalculation: boolean;
  tds: boolean;
  tcs: boolean;
  branchDivision: boolean;
  multiGodown: boolean;
}

export interface MasterConfig {
  dropdownDisplay: "name" | "name_alias" | "name_alias_group" | "name_code";
  additionalDropdownFields: Array<{ field: string; width: number }>;
  showBottomPanel: boolean;
  bottomPanelFields: string[];
  optionalFields: Array<{
    id: string;
    name: string;
    dataType: "text" | "numeric" | "date" | "list" | "yesno";
    listValues?: string;
    mandatory: boolean;
    maintainDB: boolean;
    defaultValue?: string;
    decimalPlaces?: number;
  }>;
  hiddenFields: string[];
  mandatoryFields: string[];
}

export interface DeleteTarget {
  type: "group" | "ledger";
  id: string;
  name: string;
}

/** Tree rows may be groups or ledgers; keep fields optional so renderers can branch on `kind`. */
export type TreeNode = {
  id: string;
  name: string;
  alias?: string;
  depth?: number;
  kind?: "group" | "ledger";
  category?: string;
  nature?: "debit" | "credit";
  isSystem?: boolean;
  isPrimary?: boolean;
  parentId?: string;
  groupId?: string;
  accountType?: string;
  balance?: number;
  gstin?: string;
  children?: TreeNode[];
  ledgers?: Ledger[];
};
