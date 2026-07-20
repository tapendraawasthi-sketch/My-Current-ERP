/**
 * Nepal business natures for company setup / settings.
 * Aligns with Customized business nature master plan (PACK / CAP composition).
 */

export type BusinessNatureId =
  | "manufacturing"
  | "wholesale_trading"
  | "retail_trading"
  | "import_business"
  | "export_business"
  | "distribution"
  | "professional_services"
  | "general_services"
  | "information_technology"
  | "education"
  | "healthcare"
  | "hospitality"
  | "restaurant_food_service"
  | "tourism_travel"
  | "transportation_logistics"
  | "construction"
  | "real_estate"
  | "agriculture"
  | "cooperative"
  | "banking_financial"
  | "microfinance"
  | "investment_company"
  | "insurance"
  | "capital_market"
  | "npo"
  | "ngo"
  | "ingo"
  | "government"
  | "public_enterprise"
  | "utility_services"
  | "media_entertainment"
  | "advertising_marketing"
  | "jewellery"
  | "automobile"
  | "fuel_energy"
  | "mining_quarry"
  | "rental_leasing"
  | "franchise"
  | "multi_business"
  | "other";

export interface BusinessNatureOption {
  id: BusinessNatureId;
  label: string;
  shortDescription: string;
  packId: string;
}

/** Company feature flags driven by nature (stored on companySettings). */
export interface NatureFeatureFlags {
  enableInventory: boolean;
  enablePOS: boolean;
  enableProduction: boolean;
  enableJobWork: boolean;
  enableBatchTracking: boolean;
  enableCostCenter: boolean;
  enablePayroll: boolean;
  enableMultiCurrency: boolean;
  enableBillWiseTracking: boolean;
  /** Show budget surfaces (NGO/gov/projects). */
  enableBudget: boolean;
}

export interface NatureNavProfile {
  /** Shell nav group ids to hide entirely (e.g. "inventory"). */
  hiddenGroups: string[];
  /** Specific page ids to hide even if group is visible. */
  hiddenPages: string[];
}

export interface NatureProfile {
  features: NatureFeatureFlags;
  nav: NatureNavProfile;
  /** Short hint shown under the selector. */
  hint: string;
}

export const BUSINESS_NATURES: readonly BusinessNatureOption[] = [
  { id: "manufacturing", label: "Manufacturing", shortDescription: "Converts raw materials into finished goods.", packId: "PACK-MFG" },
  { id: "wholesale_trading", label: "Wholesale Trading", shortDescription: "Buys in bulk and sells to retailers/distributors.", packId: "PACK-WHOLE" },
  { id: "retail_trading", label: "Retail Trading", shortDescription: "Sells goods directly to end consumers.", packId: "PACK-RETAIL" },
  { id: "import_business", label: "Import Business", shortDescription: "Imports goods or materials from abroad.", packId: "PACK-IMPORT" },
  { id: "export_business", label: "Export Business", shortDescription: "Exports local goods to international markets.", packId: "PACK-EXPORT" },
  { id: "distribution", label: "Distribution", shortDescription: "Distributes products from manufacturers to dealers.", packId: "PACK-DIST" },
  { id: "professional_services", label: "Professional Services", shortDescription: "Accounting, legal, engineering, consulting.", packId: "PACK-SVC-PRO" },
  { id: "general_services", label: "General Services", shortDescription: "Maintenance, security, cleaning, events.", packId: "PACK-SVC-GEN" },
  { id: "information_technology", label: "Information Technology (IT)", shortDescription: "Software, IT services, cloud, support.", packId: "PACK-IT" },
  { id: "education", label: "Education", shortDescription: "Schools, colleges, training institutions.", packId: "PACK-EDU" },
  { id: "healthcare", label: "Healthcare", shortDescription: "Medical, diagnostic, pharmacy services.", packId: "PACK-HEALTH" },
  { id: "hospitality", label: "Hospitality", shortDescription: "Hotels, resorts, lodges, accommodation.", packId: "PACK-HOTEL" },
  { id: "restaurant_food_service", label: "Restaurant & Food Service", shortDescription: "Restaurants, cafés, bakeries, catering.", packId: "PACK-REST" },
  { id: "tourism_travel", label: "Tourism & Travel", shortDescription: "Travel, trekking, tours, ticketing.", packId: "PACK-TOUR" },
  { id: "transportation_logistics", label: "Transportation & Logistics", shortDescription: "Cargo, courier, freight, passenger transport.", packId: "PACK-TRANS" },
  { id: "construction", label: "Construction", shortDescription: "Construction, infrastructure, contracting.", packId: "PACK-CONST" },
  { id: "real_estate", label: "Real Estate", shortDescription: "Develop, buy, sell, rent, manage property.", packId: "PACK-RE" },
  { id: "agriculture", label: "Agriculture", shortDescription: "Farming, livestock, fisheries, agribusiness.", packId: "PACK-AGRI" },
  { id: "cooperative", label: "Cooperative", shortDescription: "Savings, credit, agri, multipurpose cooperative.", packId: "PACK-COOP" },
  { id: "banking_financial", label: "Banking & Financial Institution", shortDescription: "Banking, lending, deposit services.", packId: "PACK-BANK" },
  { id: "microfinance", label: "Microfinance", shortDescription: "Small-scale lending to individuals/groups.", packId: "PACK-MFI" },
  { id: "investment_company", label: "Investment Company", shortDescription: "Invests in businesses, securities, assets.", packId: "PACK-INVCO" },
  { id: "insurance", label: "Insurance", shortDescription: "Life, non-life, health, reinsurance.", packId: "PACK-INS" },
  { id: "capital_market", label: "Capital Market", shortDescription: "Broker, merchant banker, DP.", packId: "PACK-CAPM" },
  { id: "npo", label: "Non-Profit Organization (NPO)", shortDescription: "Charitable, educational, religious, social.", packId: "PACK-NPO" },
  { id: "ngo", label: "Non-Governmental Organization (NGO)", shortDescription: "Community development and social welfare.", packId: "PACK-NGO" },
  { id: "ingo", label: "International NGO (INGO)", shortDescription: "International development/humanitarian work.", packId: "PACK-INGO" },
  { id: "government", label: "Government Organization", shortDescription: "Ministry, department, municipality, office.", packId: "PACK-GOV" },
  { id: "public_enterprise", label: "Public Enterprise", shortDescription: "Government-owned commercial/service enterprise.", packId: "PACK-PE" },
  { id: "utility_services", label: "Utility Services", shortDescription: "Electricity, water, telecom, gas.", packId: "PACK-UTIL" },
  { id: "media_entertainment", label: "Media & Entertainment", shortDescription: "News, broadcast, publishing, entertainment.", packId: "PACK-MEDIA" },
  { id: "advertising_marketing", label: "Advertising & Marketing", shortDescription: "Branding, advertising, digital marketing.", packId: "PACK-ADS" },
  { id: "jewellery", label: "Jewellery Business", shortDescription: "Gold, silver, diamond, gemstone jewelry.", packId: "PACK-JEWEL" },
  { id: "automobile", label: "Automobile Business", shortDescription: "Vehicles, spare parts, workshops.", packId: "PACK-AUTO" },
  { id: "fuel_energy", label: "Fuel & Energy", shortDescription: "Petroleum, LPG, renewable energy.", packId: "PACK-FUEL" },
  { id: "mining_quarry", label: "Mining & Quarry", shortDescription: "Minerals, sand, stone, natural resources.", packId: "PACK-MINE" },
  { id: "rental_leasing", label: "Rental & Leasing", shortDescription: "Rents vehicles, equipment, properties.", packId: "PACK-RENT" },
  { id: "franchise", label: "Franchise Business", shortDescription: "Operates under a licensed franchise brand.", packId: "PACK-FRAN" },
  { id: "multi_business", label: "Multi-Business Enterprise", shortDescription: "Multiple activities under one organization.", packId: "PACK-MULTI" },
  { id: "other", label: "Other", shortDescription: "Does not fit the categories above.", packId: "PACK-OTHER" },
] as const;

const TRADE_FEATURES: NatureFeatureFlags = {
  enableInventory: true,
  enablePOS: false,
  enableProduction: false,
  enableJobWork: false,
  enableBatchTracking: false,
  enableCostCenter: false,
  enablePayroll: false,
  enableMultiCurrency: false,
  enableBillWiseTracking: true,
  enableBudget: false,
};

const RETAIL_FEATURES: NatureFeatureFlags = {
  ...TRADE_FEATURES,
  enablePOS: true,
};

const SERVICE_FEATURES: NatureFeatureFlags = {
  enableInventory: false,
  enablePOS: false,
  enableProduction: false,
  enableJobWork: false,
  enableBatchTracking: false,
  enableCostCenter: true,
  enablePayroll: true,
  enableMultiCurrency: false,
  enableBillWiseTracking: true,
  enableBudget: false,
};

const ALL_NAV: NatureNavProfile = { hiddenGroups: [], hiddenPages: [] };

const SERVICE_NAV: NatureNavProfile = {
  hiddenGroups: [],
  hiddenPages: [
    "pos-billing",
    "stock-transfer",
    "stock-journal",
    "physical-stock",
    "job-work-register",
    "batch-management",
    "goods-receipt",
    "delivery-challan",
  ],
};

const FINANCE_NAV: NatureNavProfile = {
  hiddenGroups: ["inventory"],
  hiddenPages: [
    "pos-billing",
    "billing",
    "sales-return",
    "sales-order",
    "delivery-challan",
    "purchase",
    "purchase-return",
    "purchase-order",
    "goods-receipt",
  ],
};

function profile(
  features: NatureFeatureFlags,
  nav: NatureNavProfile,
  hint: string,
): NatureProfile {
  return { features, nav, hint };
}

/** Default profiles per nature. Unlisted flags fall through OTHER (show most). */
export const NATURE_PROFILES: Record<BusinessNatureId, NatureProfile> = {
  manufacturing: profile(
    {
      ...TRADE_FEATURES,
      enableProduction: true,
      enableJobWork: true,
      enableCostCenter: true,
      enableBatchTracking: true,
    },
    { hiddenGroups: [], hiddenPages: ["pos-billing"] },
    "BOM, production, job-work, and stock are enabled. POS stays off by default.",
  ),
  wholesale_trading: profile(
    TRADE_FEATURES,
    { hiddenGroups: [], hiddenPages: ["pos-billing", "job-work-register"] },
    "Trading, godowns, credit & schemes. Counter POS hidden.",
  ),
  retail_trading: profile(
    RETAIL_FEATURES,
    ALL_NAV,
    "POS counter, inventory, and fast billing are enabled.",
  ),
  import_business: profile(
    { ...TRADE_FEATURES, enableMultiCurrency: true, enableCostCenter: true },
    { hiddenGroups: [], hiddenPages: ["pos-billing"] },
    "Inventory, multi-currency, and cost tracking for landed cost.",
  ),
  export_business: profile(
    { ...TRADE_FEATURES, enableMultiCurrency: true, enableCostCenter: true },
    { hiddenGroups: [], hiddenPages: ["pos-billing"] },
    "Export sales, multi-currency receivables, and cost sheets.",
  ),
  distribution: profile(
    { ...TRADE_FEATURES, enableBatchTracking: true },
    { hiddenGroups: [], hiddenPages: ["pos-billing"] },
    "Channel stock, schemes, and batch/expiry where needed.",
  ),
  professional_services: profile(
    SERVICE_FEATURES,
    SERVICE_NAV,
    "Engagements, billing, TDS — inventory/POS hidden.",
  ),
  general_services: profile(
    { ...SERVICE_FEATURES, enableInventory: true },
    { hiddenGroups: [], hiddenPages: ["pos-billing", "job-work-register", "batch-management"] },
    "Jobs/AMC with optional materials; POS off.",
  ),
  information_technology: profile(
    { ...SERVICE_FEATURES, enableMultiCurrency: true },
    SERVICE_NAV,
    "Projects, milestones, optional FX for export services.",
  ),
  education: profile(
    { ...SERVICE_FEATURES, enablePayroll: true, enableBudget: true },
    {
      hiddenGroups: [],
      hiddenPages: ["pos-billing", "job-work-register", "batch-management", "stock-journal"],
    },
    "Fee collection focus; payroll & budget on; manufacturing off.",
  ),
  healthcare: profile(
    {
      ...RETAIL_FEATURES,
      enableBatchTracking: true,
      enablePayroll: true,
      enableCostCenter: true,
    },
    ALL_NAV,
    "OPD/pharmacy-style billing with batch/expiry stock.",
  ),
  hospitality: profile(
    { ...RETAIL_FEATURES, enableCostCenter: true, enableMultiCurrency: true, enablePayroll: true },
    ALL_NAV,
    "Rooms/folio-style ops with POS for outlets.",
  ),
  restaurant_food_service: profile(
    { ...RETAIL_FEATURES, enableProduction: true, enableCostCenter: true },
    ALL_NAV,
    "POS, recipes/production lite, and daily shift close.",
  ),
  tourism_travel: profile(
    { ...SERVICE_FEATURES, enableMultiCurrency: true, enableCostCenter: true },
    SERVICE_NAV,
    "Packages, advances, supplier costs — inventory light.",
  ),
  transportation_logistics: profile(
    { ...SERVICE_FEATURES, enableInventory: false, enableCostCenter: true },
    {
      hiddenGroups: ["inventory"],
      hiddenPages: ["pos-billing", "goods-receipt", "delivery-challan"],
    },
    "Trips/fleet costing; trading inventory hidden.",
  ),
  construction: profile(
    {
      enableInventory: true,
      enablePOS: false,
      enableProduction: false,
      enableJobWork: false,
      enableBatchTracking: false,
      enableCostCenter: true,
      enablePayroll: true,
      enableMultiCurrency: false,
      enableBillWiseTracking: true,
      enableBudget: true,
    },
    { hiddenGroups: [], hiddenPages: ["pos-billing", "job-work-register"] },
    "Site/project costing, material to site, retention-ready billing.",
  ),
  real_estate: profile(
    {
      ...SERVICE_FEATURES,
      enableInventory: true,
      enableBudget: true,
    },
    { hiddenGroups: [], hiddenPages: ["pos-billing", "job-work-register", "batch-management"] },
    "Unit inventory & installment collections; POS off.",
  ),
  agriculture: profile(
    { ...TRADE_FEATURES, enableCostCenter: true, enableBatchTracking: true },
    { hiddenGroups: [], hiddenPages: ["pos-billing"] },
    "Season/cycle costing with input & produce stock.",
  ),
  cooperative: profile(
    {
      enableInventory: false,
      enablePOS: false,
      enableProduction: false,
      enableJobWork: false,
      enableBatchTracking: false,
      enableCostCenter: true,
      enablePayroll: true,
      enableMultiCurrency: false,
      enableBillWiseTracking: true,
      enableBudget: true,
    },
    FINANCE_NAV,
    "Member/loan accounting focus — trading POS/inventory off.",
  ),
  banking_financial: profile(
    {
      enableInventory: false,
      enablePOS: false,
      enableProduction: false,
      enableJobWork: false,
      enableBatchTracking: false,
      enableCostCenter: true,
      enablePayroll: true,
      enableMultiCurrency: true,
      enableBillWiseTracking: true,
      enableBudget: true,
    },
    FINANCE_NAV,
    "GL / treasury accounting layer — not a core banking system.",
  ),
  microfinance: profile(
    {
      enableInventory: false,
      enablePOS: false,
      enableProduction: false,
      enableJobWork: false,
      enableBatchTracking: false,
      enableCostCenter: true,
      enablePayroll: true,
      enableMultiCurrency: false,
      enableBillWiseTracking: true,
      enableBudget: false,
    },
    FINANCE_NAV,
    "Portfolio & collections accounting — not a full CBS.",
  ),
  investment_company: profile(
    {
      ...SERVICE_FEATURES,
      enableMultiCurrency: true,
      enableBudget: true,
    },
    {
      hiddenGroups: ["inventory"],
      hiddenPages: ["pos-billing", "billing", "purchase", "goods-receipt"],
    },
    "Portfolio & holdings journals; retail inventory off.",
  ),
  insurance: profile(
    { ...SERVICE_FEATURES, enableMultiCurrency: false, enableBudget: true },
    FINANCE_NAV,
    "Premium/commission/claims accounting worksheets — not policy admin.",
  ),
  capital_market: profile(
    { ...SERVICE_FEATURES, enableMultiCurrency: true },
    FINANCE_NAV,
    "Client ledger & brokerage — not an exchange matching engine.",
  ),
  npo: profile(
    {
      ...SERVICE_FEATURES,
      enableBudget: true,
      enablePayroll: true,
    },
    {
      hiddenGroups: [],
      hiddenPages: ["pos-billing", "job-work-register", "batch-management", "sales-order"],
    },
    "Fund/donor style budgets; trading POS off.",
  ),
  ngo: profile(
    {
      ...SERVICE_FEATURES,
      enableBudget: true,
      enablePayroll: true,
      enableMultiCurrency: true,
    },
    {
      hiddenGroups: [],
      hiddenPages: ["pos-billing", "job-work-register", "batch-management"],
    },
    "Project funds, advances, strong audit trail.",
  ),
  ingo: profile(
    {
      ...SERVICE_FEATURES,
      enableBudget: true,
      enablePayroll: true,
      enableMultiCurrency: true,
    },
    {
      hiddenGroups: [],
      hiddenPages: ["pos-billing", "job-work-register", "batch-management"],
    },
    "Multi-currency awards and HQ-ready reporting.",
  ),
  government: profile(
    {
      ...SERVICE_FEATURES,
      enableBudget: true,
      enablePayroll: true,
    },
    {
      hiddenGroups: ["inventory"],
      hiddenPages: ["pos-billing", "billing", "purchase-return"],
    },
    "Budget control focus — not a full government IFMIS.",
  ),
  public_enterprise: profile(
    {
      ...TRADE_FEATURES,
      enableCostCenter: true,
      enablePayroll: true,
      enableBudget: true,
    },
    ALL_NAV,
    "Commercial books plus subsidy/segment tracking.",
  ),
  utility_services: profile(
    {
      ...SERVICE_FEATURES,
      enableInventory: true,
      enableBillWiseTracking: true,
    },
    { hiddenGroups: [], hiddenPages: ["pos-billing", "job-work-register"] },
    "Cycle billing & collections; counter POS off.",
  ),
  media_entertainment: profile(
    { ...SERVICE_FEATURES, enableCostCenter: true },
    SERVICE_NAV,
    "Show/title job costing and ad billing.",
  ),
  advertising_marketing: profile(
    { ...SERVICE_FEATURES, enableCostCenter: true },
    SERVICE_NAV,
    "Campaign jobs and media pass-through billing.",
  ),
  jewellery: profile(
    {
      ...RETAIL_FEATURES,
      enableJobWork: true,
      enableProduction: true,
      enableBatchTracking: true,
    },
    ALL_NAV,
    "Weight/purity stock, making charges, karigar job-work.",
  ),
  automobile: profile(
    {
      ...RETAIL_FEATURES,
      enableJobWork: true,
      enableBatchTracking: true,
      enableCostCenter: true,
    },
    ALL_NAV,
    "Vehicle/parts stock and workshop job cards.",
  ),
  fuel_energy: profile(
    { ...RETAIL_FEATURES, enableBatchTracking: false, enableCostCenter: true },
    ALL_NAV,
    "Pump/tank volume sales and shift reconciliation.",
  ),
  mining_quarry: profile(
    {
      ...TRADE_FEATURES,
      enableProduction: true,
      enableCostCenter: true,
    },
    { hiddenGroups: [], hiddenPages: ["pos-billing"] },
    "Extraction, royalty, and weighbridge sales.",
  ),
  rental_leasing: profile(
    { ...SERVICE_FEATURES, enableInventory: true, enableCostCenter: true },
    { hiddenGroups: [], hiddenPages: ["pos-billing", "job-work-register", "batch-management"] },
    "Asset contracts, deposits, periodic invoices.",
  ),
  franchise: profile(
    { ...RETAIL_FEATURES, enableCostCenter: true, enableProduction: true },
    ALL_NAV,
    "Outlet POS/inventory with royalty-ready cost centres.",
  ),
  multi_business: profile(
    {
      enableInventory: true,
      enablePOS: true,
      enableProduction: true,
      enableJobWork: true,
      enableBatchTracking: true,
      enableCostCenter: true,
      enablePayroll: true,
      enableMultiCurrency: true,
      enableBillWiseTracking: true,
      enableBudget: true,
    },
    ALL_NAV,
    "All major modules visible — refine later per division.",
  ),
  other: profile(
    {
      enableInventory: true,
      enablePOS: true,
      enableProduction: false,
      enableJobWork: false,
      enableBatchTracking: false,
      enableCostCenter: false,
      enablePayroll: false,
      enableMultiCurrency: false,
      enableBillWiseTracking: true,
      enableBudget: false,
    },
    ALL_NAV,
    "Generic books — pick a nearer nature anytime in settings.",
  ),
};

export function isBusinessNatureId(value: unknown): value is BusinessNatureId {
  return typeof value === "string" && value in NATURE_PROFILES;
}

export function getBusinessNature(id: string | null | undefined): BusinessNatureOption | null {
  if (!id) return null;
  return BUSINESS_NATURES.find((n) => n.id === id) ?? null;
}

export function getNatureProfile(id: string | null | undefined): NatureProfile {
  if (isBusinessNatureId(id)) return NATURE_PROFILES[id];
  return NATURE_PROFILES.other;
}

/** Merge nature feature flags into a companySettings-like object. */
export function applyNatureToCompanySettings<T extends Record<string, unknown>>(
  settings: T,
  natureId: string | null | undefined,
): T & NatureFeatureFlags & { businessNature: BusinessNatureId } {
  const id: BusinessNatureId = isBusinessNatureId(natureId) ? natureId : "other";
  const { features } = NATURE_PROFILES[id];
  return {
    ...settings,
    businessNature: id,
    ...features,
    enableBillWise: features.enableBillWiseTracking,
  };
}
