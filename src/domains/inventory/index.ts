import type { JsonObject } from "@fios/kernel";
import { executeCommand, executeCommandVoid, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { executeQuerySync, QueryTypes } from "@fios/query-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export const inventoryDomain = {
  createItem(item: JsonObject) {
    return executeCommand({
      commandType: CommandTypes.CREATE_ITEM,
      aggregateType: AggregateTypes.ITEM,
      payload: item,
    });
  },
  updateItem(item: JsonObject) {
    return executeCommand({
      commandType: CommandTypes.UPDATE_ITEM,
      aggregateType: AggregateTypes.ITEM,
      aggregateId: String(item.id ?? ""),
      payload: item,
    });
  },
  listItems() {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.LIST_ITEMS, payload: {} });
    }
    return state.getItems();
  },
  listStockMovements() {
    return state.getStockMovements();
  },
  getItemById(id: string) {
    if (isMigrationFlagEnabled("MIGRATION_QUERY_BUS")) {
      return executeQuerySync({ queryType: QueryTypes.GET_ITEM, payload: { id } });
    }
    return state.getItems().find((item) => (item as { id?: string }).id === id) ?? null;
  },
};

export type InventoryDomain = typeof inventoryDomain;
