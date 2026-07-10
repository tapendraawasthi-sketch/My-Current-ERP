import type { JsonObject } from "@fios/kernel";
import { executeCommand, executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export const invoiceDomain = {
  post(invoice: JsonObject) {
    return executeCommand({
      commandType: CommandTypes.POST_INVOICE,
      aggregateType: AggregateTypes.INVOICE,
      payload: invoice,
    });
  },
  update(id: string, updates: JsonObject) {
    return executeCommandVoid({
      commandType: CommandTypes.UPDATE_INVOICE,
      aggregateType: AggregateTypes.INVOICE,
      aggregateId: id,
      payload: { id, updates },
    });
  },
  cancel(id: string, reason: string) {
    return executeCommandVoid({
      commandType: CommandTypes.CANCEL_INVOICE,
      aggregateType: AggregateTypes.INVOICE,
      aggregateId: id,
      payload: { id, reason },
    });
  },
  list() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.LIST_INVOICES, payload: {} });
    }
    return state.getInvoices();
  },
  getById(id: string) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.GET_INVOICE, payload: { id } });
    }
    return state.getInvoices().find((inv) => (inv as { id?: string }).id === id) ?? null;
  },
};

export type InvoiceDomain = typeof invoiceDomain;
