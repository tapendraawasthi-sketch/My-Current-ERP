/** Document attachments and print metadata — F14 expands with plugins. */

import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { readLegacyState } from "@fios/legacy";

function extractPrintSettings(settings: Record<string, unknown> | null) {
  if (!settings) return null;
  return {
    logo: settings.logo,
    termsConditions: settings.termsConditions,
    invoiceFooter: settings.invoiceFooter,
    signatoryName: settings.signatoryName,
    printBankDetails: settings.printBankDetails,
    bankName: settings.bankName,
    bankAccount: settings.bankAccount,
    bankBranch: settings.bankBranch,
  };
}

export const documentDomain = {
  getCompanyPrintSettings() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      const settings = executeQuerySync<Record<string, unknown>>({
        queryType: QueryTypes.COMPANY_SETTINGS,
        payload: {},
      });
      return extractPrintSettings(settings);
    }
    const settings = readLegacyState().companySettings as Record<string, unknown> | null;
    return extractPrintSettings(settings);
  },
};

export type DocumentDomain = typeof documentDomain;
