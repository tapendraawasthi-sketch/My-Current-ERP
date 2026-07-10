import type { CostLayer } from "./inventoryAggregate";

const layers: CostLayer[] = [];

export function addCostLayer(input: Omit<CostLayer, "id" | "createdAt" | "remainingQty">): CostLayer {
  const row: CostLayer = {
    ...input,
    id: crypto.randomUUID(),
    remainingQty: input.qty,
    createdAt: new Date().toISOString(),
  };
  layers.push(row);
  return row;
}

export function consumeCostLayers(
  itemId: string,
  warehouseId: string,
  qty: number,
): Array<{ layerId: string; qty: number; rate: number }> {
  const itemLayers = layers.filter(
    (l) => l.itemId === itemId && l.warehouseId === warehouseId && l.remainingQty > 0,
  );
  let remaining = qty;
  const consumed: Array<{ layerId: string; qty: number; rate: number }> = [];
  for (const layer of itemLayers) {
    if (remaining <= 0) break;
    const take = Math.min(layer.remainingQty, remaining);
    layer.remainingQty -= take;
    remaining -= take;
    consumed.push({ layerId: layer.id, qty: take, rate: layer.rate });
  }
  return consumed;
}

export function listCostLayers(itemId?: string): CostLayer[] {
  if (!itemId) return [...layers];
  return layers.filter((l) => l.itemId === itemId);
}

export function clearCostLayers(): void {
  layers.length = 0;
}
