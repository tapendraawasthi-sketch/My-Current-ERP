import { Decimal } from 'decimal.js';
import { Voucher } from '../../../../shared/src/types/index.js';

export class OutstandingEngine {
  /**
   * CalculateInterest: Computes interest on overdue bills
   */
  public static calculateInterest(
    account_id: string, 
    from_date: Date, 
    to_date: Date, 
    interest_as_on_date: Date, 
    rate_pct: Decimal
  ) {
    const bills: any[] = [];
    let total_interest = new Decimal(0);

    // a) Fetch all bill_references for account where is_cleared = false
    // ... DB fetch logic ...
    
    // b) For each bill
    /*
    for (const bill of fetchedBills) {
      const ms_diff = interest_as_on_date.getTime() - bill.due_date.getTime();
      const days_outstanding = Math.floor(ms_diff / (1000 * 60 * 60 * 24));
      
      if (days_outstanding > 0) {
        const interest = new Decimal(bill.balance_amt)
          .mul(rate_pct.div(100))
          .mul(new Decimal(days_outstanding).div(365));
          
        total_interest = total_interest.plus(interest);
        
        bills.push({
          ref_no: bill.ref_no,
          due_date: bill.due_date,
          balance_amt: bill.balance_amt,
          days_outstanding,
          interest
        });
      }
    }
    */

    return {
      bills,
      total_interest
    };
  }

  /**
   * PostInterestVoucher: Auto-creates a Journal voucher for calculated interest
   */
  public static async postInterestVoucher(
    company_id: string, 
    account_id: string, 
    total_interest: Decimal, 
    interest_calculation_date: Date
  ): Promise<Voucher> {
    // a) Auto-create Journal voucher
    // Dr. Party A/c
    // Cr. Interest Received A/c
    const voucher: Voucher = {
      id: crypto.randomUUID(),
      type: 'Journal',
      series_id: 'default',
      number: 1, // Get next number
      date: interest_calculation_date,
      party_ledger_id: account_id,
      narration: `Interest calculated on overdue bills as on ${interest_calculation_date.toISOString().split('T')[0]}`,
      status: 'posted'
    };
    
    return voucher;
  }

  /**
   * ComputePaymentReminder: Generates templated text for overdue accounts
   */
  public static computePaymentReminder(
    account_id: string, 
    as_on_date: Date, 
    template: 'reminder' | 'overdue_notice'
  ) {
    // Fetch bill_references where is_cleared=false AND due_date < as_on_date
    const overdue_bills: any[] = [];
    
    // Replace placeholders
    const letter_text = `Dear {party_name}, As per our records, you have overdue bills...`;

    return {
      party_name: 'Example Party',
      overdue_bills,
      letter_text
    };
  }

  /**
   * OnAccountVsAdjustment: Splits party balance into on-account advances vs bills
   */
  public static async onAccountVsAdjustment(company_id: string, party_id: string) {
    // Fetch bill_references where method='on_account' and is_cleared=false
    return {
      on_account_credit: new Decimal(0),
      adjustable_bills: []
    };
  }

  /**
   * BilledOutstanding: Nett vs Bill-by-Bill balance discrepancies
   */
  public static async billedOutstanding(
    company_id: string, 
    party_id: string, 
    scope: 'nett' | 'bill_by_bill'
  ): Promise<Decimal> {
    if (scope === 'bill_by_bill') {
      // sum of (ref.amount - ref.allocated_amount) where is_cleared=false
      return new Decimal(0);
    } else {
      // total balance from ledger perspective (sum of postings)
      return new Decimal(0);
    }
  }

  /**
   * MatchPaymentToBills: Adjusts payments against specific open bills
   */
  public static matchPaymentToBills(
    payment_voucher_id: string, 
    party_id: string, 
    bills: {ref_no: string, amount_to_clear: Decimal}[]
  ) {
    let matched_count = 0;
    let total_matched = new Decimal(0);
    let remaining_on_account = new Decimal(0);

    // a) For each bill to clear:
    // Reduce bill_reference.allocated_amount
    // b) If total allocated < payment amount: remainder goes to on-account
    
    return {
      matched_count,
      total_matched,
      remaining_on_account
    };
  }
}
