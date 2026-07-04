import type { DBPriceList } from "./db";

/** Resolve the minimum allowed sale rate for an item (party price list or item master floor). */
export function resolveMinimumSaleRate(
  itemId: string,
  partyId: string | undefined,
  invoiceDate: string,
  items: Array<{ id: string; salePrice?: number; sellingPrice?: number; mrp?: number }>,
  parties: Array<{ id: string; priceListId?: string }>,
  priceLists: DBPriceList[],
): number {
  const item = items.find((i) => i.id === itemId);
  const itemFloor = Number(item?.salePrice ?? item?.sellingPrice ?? item?.mrp ?? 0);

  if (!partyId) return itemFloor;

  const party = parties.find((p) => p.id === partyId);
  const listId = party?.priceListId;
  if (!listId) return itemFloor;

  const list = priceLists.find((pl) => pl.id === listId && pl.isActive);
  if (!list) return itemFloor;

  const date = invoiceDate.slice(0, 10);
  if (list.validFrom && list.validFrom > date) return itemFloor;
  if (list.validTo && list.validTo < date) return itemFloor;

  const line = (list.lines || []).find((l) => l.itemId === itemId);
  const listRate = line ? Number(line.rate || 0) : 0;

  if (listRate > 0 && itemFloor > 0) return Math.max(itemFloor, listRate);
  if (listRate > 0) return listRate;
  return itemFloor;
}
