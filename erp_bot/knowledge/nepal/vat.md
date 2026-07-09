# Nepal VAT (Value Added Tax)

> ⚠️ **DISCLAIMER**: Tax rates and thresholds change. Always verify current rules with IRD (Inland Revenue Department) at https://ird.gov.np before making business decisions.

## Standard VAT Rate

**Standard Rate: 13%**

Nepal applies a single-rate VAT system at **13%** on most goods and services.

## VAT Registration Threshold

| Business Type | Annual Turnover Threshold |
|--------------|---------------------------|
| Goods (trading/manufacturing) | Rs. 50,00,000 (50 lakh) |
| Services | Rs. 20,00,000 (20 lakh) |

Businesses exceeding these thresholds MUST register for VAT within 30 days.

## Zero-Rated Items (0% VAT)

The following are zero-rated (eligible for input tax credit):
- Exports of goods and services
- International transportation services
- Goods sold to duty-free shops

## VAT-Exempt Items (No VAT, No Input Credit)

### Basic Necessities
- Rice, paddy, wheat, maize, barley, millet (basic grains)
- Pulses (dal)
- Fresh vegetables and fruits
- Fresh meat, fish, eggs
- Salt
- Kerosene (for domestic use)

### Agricultural Inputs
- Seeds and seedlings
- Fertilizers
- Agricultural tools

### Healthcare
- Basic medicines (listed by government)
- Medical services by government hospitals

### Education
- Educational services by schools and universities
- Books and educational materials

### Financial Services
- Interest income
- Insurance services

## VAT Calculation

### VAT-Inclusive Price to VAT Amount

```
VAT Amount = (VAT-Inclusive Price × 13) ÷ 113
Taxable Amount = VAT-Inclusive Price - VAT Amount
```

### Taxable Amount to VAT-Inclusive Price

```
VAT Amount = Taxable Amount × 0.13
VAT-Inclusive Price = Taxable Amount × 1.13
```

## Example Journal Entries

### Sales with VAT

When selling goods worth Rs. 10,000 (excluding VAT):

| Account | Debit (Dr) | Credit (Cr) |
|---------|-----------|-------------|
| Accounts Receivable / Cash | 11,300 | - |
| Sales Revenue | - | 10,000 |
| VAT Payable (Output VAT) | - | 1,300 |

### Purchase with VAT

When purchasing goods worth Rs. 5,000 (excluding VAT):

| Account | Debit (Dr) | Credit (Cr) |
|---------|-----------|-------------|
| Inventory / Expense | 5,000 | - |
| VAT Receivable (Input VAT) | 650 | - |
| Accounts Payable / Cash | - | 5,650 |

### VAT Settlement

Monthly settlement when Output VAT > Input VAT:

| Account | Debit (Dr) | Credit (Cr) |
|---------|-----------|-------------|
| VAT Payable (Output VAT) | [Total Output] | - |
| VAT Receivable (Input VAT) | - | [Total Input] |
| Cash / Bank | - | [Difference to IRD] |

## VAT Return Filing

| Return Type | Due Date |
|-------------|----------|
| Monthly VAT Return | 25th of following month |
| Annual Reconciliation | Within 3 months of fiscal year end |

## VAT Invoice Requirements

A valid VAT invoice must contain:
1. Seller's PAN number
2. Buyer's PAN number (if registered)
3. Invoice number (sequential)
4. Date of invoice
5. Description of goods/services
6. Quantity and unit price
7. Taxable amount
8. VAT amount (13%)
9. Total amount

## Input VAT Credit Rules

Input VAT credit is ALLOWED for:
- Goods/services used in taxable business activities
- Capital goods used in business

Input VAT credit is NOT ALLOWED for:
- Personal use items
- Entertainment expenses
- Vehicles (except for transport business)
- Purchases from unregistered vendors
- Purchases without valid VAT invoice

## Reverse Charge VAT

Applies when importing services from abroad:
- Service recipient must self-assess VAT at 13%
- Deposited to IRD within 25th of following month
- Can claim input credit if used for taxable activities

---
*Source: Nepal VAT Act 2052 and VAT Rules 2053. Last updated: FY 2080/81. Verify with IRD for current rates.*
