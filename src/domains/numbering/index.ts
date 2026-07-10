import { executeQuery, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { createNumberingService } from "@fios/legacy";
import { generateSerialNumber, generateNextNumber } from "@/lib/accounting";

const numbering = createNumberingService();

export const numberingDomain = {
  nextVoucherNo(type: string) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuery<{ number: string }>({
        queryType: QueryTypes.NUMBER_SERIES,
        payload: { action: "voucher", type },
      }).then((result) => result.number);
    }
    return numbering.generateNextVoucherNo(type);
  },
  nextInvoiceNo(type: string) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuery<{ number: string }>({
        queryType: QueryTypes.NUMBER_SERIES,
        payload: { action: "invoice", type },
      }).then((result) => result.number);
    }
    return numbering.generateNextInvoiceNo(type);
  },
  serialNumber(voucherType: string, seriesId?: string, fiscalYearBS?: string, preview?: boolean) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuery<{ number: string }>({
        queryType: QueryTypes.NUMBER_SERIES,
        payload: { action: "serial", type: voucherType, seriesId, fiscalYearBS, preview },
      }).then((result) => result.number);
    }
    return generateSerialNumber(voucherType, seriesId, fiscalYearBS, preview);
  },
  nextNumber(type: string) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuery<{ number: string }>({
        queryType: QueryTypes.NUMBER_SERIES,
        payload: { action: "next", type },
      }).then((result) => result.number);
    }
    return generateNextNumber(type);
  },
};

export type NumberingDomain = typeof numberingDomain;
