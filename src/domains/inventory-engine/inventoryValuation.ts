import type { ValuationMethod } from "@/lib/stockValuation";

export type { ValuationMethod };

export interface IValuationEngine {
  readonly method: ValuationMethod | "standard_cost" | "specific_identification";
  computeIssueCost(layers: Array<{ qty: number; rate: number }>, issueQty: number): number;
}

export interface IWeightedAverageValuation extends IValuationEngine {
  readonly method: "weighted_average";
}

export interface IFifoValuation extends IValuationEngine {
  readonly method: "fifo";
}

export interface ILifoValuation extends IValuationEngine {
  readonly method: "lifo";
}

export interface IStandardCostValuation extends IValuationEngine {
  readonly method: "standard_cost";
}

export interface ISpecificIdentificationValuation extends IValuationEngine {
  readonly method: "specific_identification";
}

export class WeightedAverageValuation implements IWeightedAverageValuation {
  readonly method = "weighted_average" as const;

  computeIssueCost(layers: Array<{ qty: number; rate: number }>, issueQty: number): number {
    const totalQty = layers.reduce((s, l) => s + l.qty, 0);
    const totalValue = layers.reduce((s, l) => s + l.qty * l.rate, 0);
    if (totalQty <= 0) return 0;
    return (totalValue / totalQty) * issueQty;
  }
}

export class FifoValuation implements IFifoValuation {
  readonly method = "fifo" as const;

  computeIssueCost(layers: Array<{ qty: number; rate: number }>, issueQty: number): number {
    let remaining = issueQty;
    let cost = 0;
    for (const layer of layers) {
      if (remaining <= 0) break;
      const take = Math.min(layer.qty, remaining);
      cost += take * layer.rate;
      remaining -= take;
    }
    return cost;
  }
}

export class LifoValuationStub implements ILifoValuation {
  readonly method = "lifo" as const;

  computeIssueCost(layers: Array<{ qty: number; rate: number }>, issueQty: number): number {
    let remaining = issueQty;
    let cost = 0;
    for (let i = layers.length - 1; i >= 0; i--) {
      if (remaining <= 0) break;
      const layer = layers[i];
      const take = Math.min(layer.qty, remaining);
      cost += take * layer.rate;
      remaining -= take;
    }
    return cost;
  }
}

export class StandardCostValuationStub implements IStandardCostValuation {
  readonly method = "standard_cost" as const;

  computeIssueCost(_layers: Array<{ qty: number; rate: number }>, issueQty: number): number {
    return 0;
  }
}

export class SpecificIdentificationValuationStub implements ISpecificIdentificationValuation {
  readonly method = "specific_identification" as const;

  computeIssueCost(layers: Array<{ qty: number; rate: number }>, issueQty: number): number {
    return new FifoValuation().computeIssueCost(layers, issueQty);
  }
}

export function createValuationEngine(method: ValuationMethod): IValuationEngine {
  switch (method) {
    case "fifo":
      return new FifoValuation();
    case "lifo":
      return new LifoValuationStub();
    case "weighted_average":
    default:
      return new WeightedAverageValuation();
  }
}
