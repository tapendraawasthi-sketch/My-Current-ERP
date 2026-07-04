/** System configuration stored on companySettings.systemConfiguration */

export interface AgeingSlab {
  label: string;
  fromDays: number;
  toDays: number | null;
}

export interface InterestSlab {
  label: string;
  fromDays: number;
  toDays: number | null;
  ratePercent: number;
}

export interface WarningAlarmsConfig {
  creditLimitExceeded: boolean;
  overduePayment: boolean;
  lowStock: boolean;
  belowMinimumPrice: boolean;
}

export interface PartyDashboardConfig {
  showOutstanding: boolean;
  showLastInvoice: boolean;
  showCreditLimit: boolean;
  showAgingSummary: boolean;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  senderEmail: string;
  useTls: boolean;
}

export interface MessagingConfig {
  provider: string;
  apiKey: string;
  senderId: string;
  gatewayUrl: string;
}

export interface BackupConfig {
  autoBackupEnabled: boolean;
  backupFolder: string;
  frequency: "daily" | "weekly" | "monthly";
  retentionCount: number;
  compress: boolean;
}

export interface PrintConfig {
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  fontSize: number;
  showLogo: boolean;
  headerText: string;
  footerText: string;
}

export interface SystemConfiguration {
  partyDashboard: PartyDashboardConfig;
  email: EmailConfig;
  messaging: MessagingConfig;
  backup: BackupConfig;
  invoicePrint: PrintConfig;
  voucherPrint: PrintConfig;
  warningAlarms: WarningAlarmsConfig;
  ageingSlabs: AgeingSlab[];
  interestSlabs: InterestSlab[];
  maxVoucherEntries: number;
}

export const DEFAULT_SYSTEM_CONFIGURATION: SystemConfiguration = {
  partyDashboard: {
    showOutstanding: true,
    showLastInvoice: true,
    showCreditLimit: true,
    showAgingSummary: true,
  },
  email: {
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    senderEmail: "",
    useTls: true,
  },
  messaging: {
    provider: "",
    apiKey: "",
    senderId: "",
    gatewayUrl: "",
  },
  backup: {
    autoBackupEnabled: false,
    backupFolder: "",
    frequency: "daily",
    retentionCount: 7,
    compress: true,
  },
  invoicePrint: {
    marginTopMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 8,
    marginRightMm: 8,
    fontSize: 10,
    showLogo: true,
    headerText: "",
    footerText: "",
  },
  voucherPrint: {
    marginTopMm: 8,
    marginBottomMm: 8,
    marginLeftMm: 8,
    marginRightMm: 8,
    fontSize: 9,
    showLogo: false,
    headerText: "",
    footerText: "",
  },
  warningAlarms: {
    creditLimitExceeded: true,
    overduePayment: true,
    lowStock: true,
    belowMinimumPrice: true,
  },
  ageingSlabs: [
    { label: "Current", fromDays: 0, toDays: 0 },
    { label: "1-30 days", fromDays: 1, toDays: 30 },
    { label: "31-60 days", fromDays: 31, toDays: 60 },
    { label: "61-90 days", fromDays: 61, toDays: 90 },
    { label: "90+ days", fromDays: 91, toDays: null },
  ],
  interestSlabs: [
    { label: "0-30 days", fromDays: 0, toDays: 30, ratePercent: 12 },
    { label: "31-60 days", fromDays: 31, toDays: 60, ratePercent: 15 },
    { label: "61-90 days", fromDays: 61, toDays: 90, ratePercent: 18 },
    { label: "90+ days", fromDays: 91, toDays: null, ratePercent: 24 },
  ],
  maxVoucherEntries: 500,
};

export function mergeSystemConfiguration(
  raw?: Partial<SystemConfiguration> | null,
): SystemConfiguration {
  if (!raw) return { ...DEFAULT_SYSTEM_CONFIGURATION };
  return {
    partyDashboard: { ...DEFAULT_SYSTEM_CONFIGURATION.partyDashboard, ...raw.partyDashboard },
    email: { ...DEFAULT_SYSTEM_CONFIGURATION.email, ...raw.email },
    messaging: { ...DEFAULT_SYSTEM_CONFIGURATION.messaging, ...raw.messaging },
    backup: { ...DEFAULT_SYSTEM_CONFIGURATION.backup, ...raw.backup },
    invoicePrint: { ...DEFAULT_SYSTEM_CONFIGURATION.invoicePrint, ...raw.invoicePrint },
    voucherPrint: { ...DEFAULT_SYSTEM_CONFIGURATION.voucherPrint, ...raw.voucherPrint },
    warningAlarms: { ...DEFAULT_SYSTEM_CONFIGURATION.warningAlarms, ...raw.warningAlarms },
    ageingSlabs: raw.ageingSlabs?.length ? raw.ageingSlabs : DEFAULT_SYSTEM_CONFIGURATION.ageingSlabs,
    interestSlabs: raw.interestSlabs?.length
      ? raw.interestSlabs
      : DEFAULT_SYSTEM_CONFIGURATION.interestSlabs,
    maxVoucherEntries: raw.maxVoucherEntries ?? DEFAULT_SYSTEM_CONFIGURATION.maxVoucherEntries,
  };
}

export function getAgeingBucketIndex(days: number, slabs: AgeingSlab[]): number {
  for (let i = 0; i < slabs.length; i++) {
    const slab = slabs[i];
    const max = slab.toDays ?? Number.POSITIVE_INFINITY;
    if (days >= slab.fromDays && days <= max) return i;
  }
  return slabs.length - 1;
}

export function getInterestRateForDays(days: number, slabs: InterestSlab[]): number {
  for (const slab of slabs) {
    const max = slab.toDays ?? Number.POSITIVE_INFINITY;
    if (days >= slab.fromDays && days <= max) return slab.ratePercent;
  }
  const last = slabs[slabs.length - 1];
  return last?.ratePercent ?? 18;
}
