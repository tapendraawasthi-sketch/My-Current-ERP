import { Decimal } from 'decimal.js';

// Import types (assuming they are exported from shared package)
import { 
  Voucher, 
  VoucherLine, 
  BillSundryLine, 
  Item, 
  ErrorDetail 
} from '../../../../shared/src/types/index.js';

export interface ValidationResult {
  isValid: boolean;
  errors: { field: string; message: string }[];
}

export interface TaxComputationResult {
  cgst: Decimal;
  sgst: Decimal;
  igst: Decimal;
  cess: Decimal;
  taxable_value: Decimal;
  total_tax: Decimal;
}

export type SaleType = 'IGST' | 'SGST+CGST' | 'EXEMPT';

export class AccountingEngine {
  /**
   * PostVoucher: Validates and generates atomic ledger and inventory postings
   */
  public static postVoucher(
    voucher: Voucher,
    lines: VoucherLine[],
    billSundries: BillSundryLine[],
    party_bill_by_bill: boolean
  ) {
    const ledger_postings: any[] = [];
    const inventory_postings: any[] = [];
    const bill_references: any[] = [];

    // a) Validate voucher is balanced
    const validation = this.validateVoucher(voucher, lines);
    if (!validation.isValid) {
      throw new Error(`UNBALANCED_VOUCHER: ${JSON.stringify(validation.errors)}`);
    }

    // b) Validate party GSTIN if GST enabled (assuming implemented elsewhere or checked here)
    
    // c) Process each line
    for (const line of lines) {
      if (line.ledger_id) {
        // Accounting only
        ledger_postings.push({
          voucher_id: voucher.id,
          ledger_id: line.ledger_id,
          debit: line.dc === 'DR' ? (line.debit || 0) : 0,
          credit: line.dc === 'CR' ? (line.credit || 0) : 0,
          date: voucher.date,
        });
      } else if (line.item_id) {
        // Inventory
        const qty = new Decimal(line.qty || 0);
        const price = new Decimal(line.price || 0);
        const value = qty.mul(price);

        // Compute tax (pseudo-logic for missing item context)
        // const tax = this.computeTax(item, qty, price, 'SGST+CGST');

        // Create inventory posting
        inventory_postings.push({
          voucher_id: voucher.id,
          item_id: line.item_id,
          qty_in: line.dc === 'DR' ? qty.toNumber() : 0,
          qty_out: line.dc === 'CR' ? qty.toNumber() : 0,
          value_in: line.dc === 'DR' ? value.toNumber() : 0,
          value_out: line.dc === 'CR' ? value.toNumber() : 0,
          date: voucher.date,
        });
      }
    }

    // d) Process bill sundries
    for (const sundry of billSundries) {
      ledger_postings.push({
        voucher_id: voucher.id,
        ledger_id: sundry.bill_sundry_id, // Map to account_id in real implementation
        debit: sundry.amount > 0 ? sundry.amount : 0,
        credit: sundry.amount < 0 ? Math.abs(sundry.amount) : 0,
        date: voucher.date,
      });
    }

    // e) Party Bill-by-Bill
    if (party_bill_by_bill && voucher.party_ledger_id) {
      const totalAmount = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
      bill_references.push({
        voucher_id: voucher.id,
        ledger_id: voucher.party_ledger_id,
        method: 'new_ref',
        ref_no: voucher.number.toString(),
        amount: totalAmount,
        dc: 'DR',
        due_date: new Date(new Date(voucher.date).getTime() + 30 * 24 * 60 * 60 * 1000), // +30 days default
        is_cleared: false,
      });
    }

    // f) Return list of postings to insert atomically
    return {
      ledger_postings,
      inventory_postings,
      bill_references,
    };
  }

  /**
   * AllocateBills: Apply bill-by-bill adjustment against pending bills
   */
  public static allocateBills(
    voucher_id: string,
    party_id: string,
    allocations: { ref_no: string; amount: number }[],
    pendingBills: any[] // passed from DB
  ) {
    const updates: any[] = [];
    
    // b) For each allocation
    for (const allocation of allocations) {
      const pendingBill = pendingBills.find((b) => b.ref_no === allocation.ref_no);
      if (!pendingBill) {
        throw new Error(`PENDING_BILL_NOT_FOUND: ${allocation.ref_no}`);
      }

      // Check if fully cleared
      const is_cleared = allocation.amount >= pendingBill.amount;
      
      updates.push({
        id: pendingBill.id,
        is_cleared,
        allocated_amount: allocation.amount,
      });
    }
    
    return updates;
  }

  /**
   * ComputeTax: Computes SGST, CGST, IGST based on sale type and item rates
   */
  public static computeTax(
    item: any, // expecting Item & TaxCategory
    qty: Decimal,
    price: Decimal,
    sale_type: SaleType
  ): TaxComputationResult {
    const taxable_value = qty.mul(price);
    let cgst = new Decimal(0);
    let sgst = new Decimal(0);
    let igst = new Decimal(0);
    let cess = new Decimal(0);

    const cgst_rate = new Decimal(item.cgst_rate || 0).div(100);
    const sgst_rate = new Decimal(item.sgst_rate || 0).div(100);
    const igst_rate = new Decimal(item.igst_rate || 0).div(100);

    if (sale_type === 'IGST') {
      igst = taxable_value.mul(igst_rate);
    } else if (sale_type === 'SGST+CGST') {
      cgst = taxable_value.mul(cgst_rate);
      sgst = taxable_value.mul(sgst_rate);
    }

    const total_tax = cgst.plus(sgst).plus(igst).plus(cess);

    return {
      cgst,
      sgst,
      igst,
      cess,
      taxable_value,
      total_tax,
    };
  }

  /**
   * ReverseVoucher: Creates a reversal voucher for an existing one
   */
  public static reverseVoucher(originalVoucher: Voucher, nextNumber: number): Voucher {
    // a) Return new reversal voucher
    return {
      ...originalVoucher,
      id: crypto.randomUUID(),
      number: nextNumber,
      status: 'draft',
      narration: `Reversal of voucher ${originalVoucher.number}`,
      // Reversal logic for lines applied outside pure function
    };
  }

  /**
   * ValidateVoucher: Ensures debit == credit and data integrity
   */
  public static validateVoucher(voucher: Voucher, lines: VoucherLine[]): ValidationResult {
    const errors: { field: string; message: string }[] = [];
    
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of lines) {
      if (line.dc === 'DR') {
        totalDebit = totalDebit.plus(line.debit || 0);
      } else {
        totalCredit = totalCredit.plus(line.credit || 0);
      }
    }

    if (!totalDebit.equals(totalCredit)) {
      errors.push({
        field: 'amounts',
        message: `Total Debit (${totalDebit.toNumber()}) does not match Total Credit (${totalCredit.toNumber()})`,
      });
    }

    if (!voucher.date) {
      errors.push({ field: 'date', message: 'Voucher date is required' });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
