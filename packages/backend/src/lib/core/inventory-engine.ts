import { Decimal } from 'decimal.js';

export type ValuationMethod = 'fifo' | 'weighted_avg' | 'lifo';

export interface CurrentStock {
  qty: Decimal;
  value: Decimal;
  avg_rate: Decimal;
}

export interface InventoryPosting {
  item_id: string;
  mc_id: string;
  qty_in: number;
  qty_out: number;
  value_in: number;
  value_out: number;
  date: Date;
  batch_no?: string;
}

export class InventoryEngine {
  /**
   * UpdateStock: Projects the stock closing balance from inventory events
   */
  public static updateStock(
    postings: InventoryPosting[], // All historical postings fetched from DB
    new_qty_in: Decimal,
    new_qty_out: Decimal,
    new_value_in: Decimal,
    new_value_out: Decimal,
    valuation_method: ValuationMethod
  ): CurrentStock {
    let opening_qty = new Decimal(0);
    let opening_value = new Decimal(0);

    // a) Compute opening stock from historical postings
    for (const p of postings) {
      opening_qty = opening_qty.plus(p.qty_in).minus(p.qty_out);
      opening_value = opening_value.plus(p.value_in).minus(p.value_out);
    }

    // b) Compute closing stock
    const closing_qty = opening_qty.plus(new_qty_in).minus(new_qty_out);
    let closing_value = new Decimal(0);

    // c) Compute closing value
    if (closing_qty.isZero()) {
      closing_value = new Decimal(0);
    } else if (valuation_method === 'weighted_avg') {
      const avg_rate = opening_qty.plus(new_qty_in).isZero() 
        ? new Decimal(0)
        : (opening_value.plus(new_value_in)).div(opening_qty.plus(new_qty_in));
      
      closing_value = closing_qty.mul(avg_rate);
    } else {
      // FIFO / LIFO requires detailed batch tracking array, simplified here
      closing_value = opening_value.plus(new_value_in).minus(new_value_out);
    }

    return {
      qty: closing_qty,
      value: closing_value,
      avg_rate: closing_qty.isZero() ? new Decimal(0) : closing_value.div(closing_qty),
    };
  }

  /**
   * CheckNegativeStock: Determines if a transaction forces stock below 0
   */
  public static checkNegativeStock(
    current_qty: Decimal,
    new_qty_out: Decimal,
    allow_negative_stock: 'allow' | 'warn' | 'deny'
  ) {
    const after_posting = current_qty.minus(new_qty_out);
    const is_negative = after_posting.isNegative();

    if (is_negative && allow_negative_stock === 'deny') {
      throw new Error(`NEGATIVE_STOCK: Cannot issue ${new_qty_out.toNumber()}. Available: ${current_qty.toNumber()}`);
    }

    return {
      is_negative,
      qty: after_posting,
      threshold: allow_negative_stock === 'warn' ? 'WARNING' : 'OK',
    };
  }

  /**
   * ProcessProductionVoucher: Generates BoM inventory movements
   */
  public static processProductionVoucher(
    voucher_id: string,
    finished_item_id: string,
    qty_produced: Decimal,
    bom_components: { item_id: string; qty: number; rate: number }[]
  ) {
    const postings: any[] = [];
    let total_cost = new Decimal(0);

    // b & c) Auto-fill components
    for (const comp of bom_components) {
      const consumed_qty = new Decimal(comp.qty).mul(qty_produced);
      const consumed_value = consumed_qty.mul(comp.rate);
      total_cost = total_cost.plus(consumed_value);

      postings.push({
        voucher_id,
        item_id: comp.item_id,
        qty_in: 0,
        qty_out: consumed_qty.toNumber(),
        value_in: 0,
        value_out: consumed_value.toNumber(),
      });
    }

    // Finished item
    postings.push({
      voucher_id,
      item_id: finished_item_id,
      qty_in: qty_produced.toNumber(),
      qty_out: 0,
      value_in: total_cost.toNumber(),
      value_out: 0,
    });

    return postings;
  }

  /**
   * ProcessPhysicalStock: Computes variance for stock journals
   */
  public static processPhysicalStock(
    voucher_id: string,
    counted_items: { item_id: string; mc_id: string; physical_qty: number; book_qty: number; rate: number }[]
  ) {
    const adjustments: any[] = [];

    for (const item of counted_items) {
      const variance = new Decimal(item.book_qty).minus(item.physical_qty);
      const variance_value = variance.abs().mul(item.rate);

      if (variance.isPositive()) {
        // Loss (book > physical) -> qty_out
        adjustments.push({
          voucher_id,
          item_id: item.item_id,
          qty_out: variance.toNumber(),
          value_out: variance_value.toNumber(),
        });
      } else if (variance.isNegative()) {
        // Gain (book < physical) -> qty_in
        adjustments.push({
          voucher_id,
          item_id: item.item_id,
          qty_in: variance.abs().toNumber(),
          value_in: variance_value.toNumber(),
        });
      }
    }

    return adjustments;
  }
}
