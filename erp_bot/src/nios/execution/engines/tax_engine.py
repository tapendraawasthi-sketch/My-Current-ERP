"""Deterministic tax engines — mirror TS taxUtils / nepalTax."""

from __future__ import annotations

VAT_RATE = 0.13

# Nepal IRD progressive slabs (FY 2081/82)
NEPAL_TAX_SLABS = [
    (100_000, 0.01),
    (200_000, 0.10),
    (400_000, 0.20),
    (1_100_000, 0.30),
    (float("inf"), 0.36),
]

EPF_EMPLOYEE_RATE = 0.10
EPF_EMPLOYER_RATE = 0.10
SSF_EMPLOYEE_RATE = 0.01
SSF_EMPLOYER_RATE = 0.0333
CIT_RATE = 0.10
EXEMPTION_SINGLE = 400_000
EXEMPTION_MARRIED = 500_000


def round2(n: float) -> float:
    return round(float(n or 0), 2)


def compute_vat(taxable_amount: float, rate: float = 13.0) -> dict:
    taxable = round2(taxable_amount)
    vat = round2(taxable * (rate / 100))
    return {
        "taxable_amount": taxable,
        "vat_rate": rate,
        "vat_amount": vat,
        "grand_total": round2(taxable + vat),
        "engine": "cap.engine.tax.vat",
    }


def compute_tds(taxable_amount: float, rate: float = 1.5) -> dict:
    """Simple TDS on payment — full rules in TS taxUtils."""
    base = round2(taxable_amount)
    tds = round2(base * (rate / 100))
    return {
        "taxable_amount": base,
        "tds_rate": rate,
        "tds_amount": tds,
        "net_amount": round2(base - tds),
        "engine": "cap.engine.tax.tds",
    }


def compute_nepal_annual_tax(taxable_income: float) -> float:
    if taxable_income <= 0:
        return 0
    remaining = taxable_income
    tax = 0.0
    prev = 0.0
    for up_to, rate in NEPAL_TAX_SLABS:
        slab_width = remaining if up_to == float("inf") else up_to - prev
        taxable = min(remaining, slab_width)
        tax += taxable * rate
        remaining -= taxable
        prev = up_to if up_to != float("inf") else prev
        if remaining <= 0:
            break
    return round(tax)


def compute_payroll(
    basic_salary: float,
    *,
    gross_salary: float | None = None,
    marital_status: str = "single",
    epf_applicable: bool = True,
    ssf_applicable: bool = True,
    cit_applicable: bool = False,
) -> dict:
    gross = gross_salary if gross_salary is not None else basic_salary
    epf_emp = basic_salary * EPF_EMPLOYEE_RATE if epf_applicable else 0
    epf_er = basic_salary * EPF_EMPLOYER_RATE if epf_applicable else 0
    cit = basic_salary * CIT_RATE if cit_applicable else 0
    ssf_emp = gross * SSF_EMPLOYEE_RATE if ssf_applicable else 0
    ssf_er = gross * SSF_EMPLOYER_RATE if ssf_applicable else 0

    annual_gross = gross * 12
    deductions = (epf_emp + cit) * 12
    exemption = EXEMPTION_MARRIED if marital_status == "married" else EXEMPTION_SINGLE
    taxable = max(0, annual_gross - deductions - exemption)
    annual_tax = compute_nepal_annual_tax(taxable)
    tds_monthly = round(annual_tax / 12)

    total_deductions = epf_emp + cit + ssf_emp + tds_monthly
    net_pay = gross - total_deductions
    employer_cost = gross + epf_er + ssf_er

    return {
        "gross_salary": round2(gross),
        "basic_salary": round2(basic_salary),
        "epf_employee": round2(epf_emp),
        "epf_employer": round2(epf_er),
        "ssf_employee": round2(ssf_emp),
        "ssf_employer": round2(ssf_er),
        "cit": round2(cit),
        "tds_monthly": round2(tds_monthly),
        "annual_tax": annual_tax,
        "taxable_income_annual": round2(taxable),
        "total_deductions": round2(total_deductions),
        "net_pay": round2(net_pay),
        "employer_cost": round2(employer_cost),
        "engine": "cap.engine.payroll",
    }
