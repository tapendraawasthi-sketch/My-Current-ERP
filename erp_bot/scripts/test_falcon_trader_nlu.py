#!/usr/bin/env python3
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from falcon_trader import parse_khata_message


def check(name: str, text: str, expected: dict) -> bool:
    result = parse_khata_message(text)
    ok = True
    for key, value in expected.items():
        if result.get(key) != value:
            print(f"FAIL {name}: {key} expected {value!r}, got {result.get(key)!r}")
            ok = False
    if ok:
        print(f"PASS {name}")
    return ok


def main() -> int:
    today = date.today().isoformat()
    passed = 0
    total = 15

    tests = [
        (
            "1",
            "Ram lai 500 udhaar diye",
            {"intent": "khata_credit_sale", "PARTY": "Ram", "AMOUNT": 500},
        ),
        (
            "2",
            "Shyam le 200 tiryo",
            {"intent": "khata_payment_in", "PARTY": "Shyam", "AMOUNT": 200},
        ),
        (
            "3",
            "aja 1 hajar ko sabji kineko",
            {"intent": "khata_purchase", "AMOUNT": 1000, "ITEM": "sabji", "DATE": today},
        ),
        (
            "4",
            "cash ma 750 ko chai becheko",
            {"intent": "khata_cash_sale", "AMOUNT": 750, "ITEM": "chai"},
        ),
        (
            "5",
            "500 diye",
            {"intent": None, "clarifying_question": "Aaple diye ki unle diye?"},
        ),
        (
            "6",
            "bijuli kharcha 300",
            {"intent": "khata_expense", "AMOUNT": 300, "ITEM": "bijuli"},
        ),
        (
            "7",
            "Gita lai 2 hajar payment gareko",
            {"intent": "khata_payment_out", "PARTY": "Gita", "AMOUNT": 2000},
        ),
        (
            "8",
            "१५०० उधार दिए",
            {"intent": "khata_credit_sale", "AMOUNT": 1500},
        ),
        (
            "9",
            "sold tea for 50 cash",
            {"intent": "khata_cash_sale", "AMOUNT": 50, "ITEM": "tea"},
        ),
        (
            "10",
            "purchase khandsari 5 saya",
            {"intent": "khata_purchase", "AMOUNT": 500, "ITEM": "khandsari"},
        ),
        (
            "11",
            "Ram le 1.5k udhaar diye",
            {"intent": "khata_credit_sale", "PARTY": "Ram", "AMOUNT": 1500},
        ),
        (
            "12",
            "hijo 300 kharcha petrol",
            {"intent": "khata_expense", "AMOUNT": 300, "ITEM": "petrol"},
        ),
        (
            "13",
            "500 cash ma becheko",
            {"intent": "khata_cash_sale", "AMOUNT": 500},
        ),
        (
            "14",
            "Hari le 1000 payment gareko",
            {"intent": "khata_payment_out", "PARTY": "Hari", "AMOUNT": 1000},
        ),
        (
            "15",
            "Ram lai 500 credit diye for dal",
            {"intent": "khata_credit_sale", "PARTY": "Ram", "AMOUNT": 500},
        ),
    ]

    for name, text, expected in tests:
        if check(name, text, expected):
            passed += 1

    print(f"\n{passed}/{total} passed")
    return 0 if passed >= 14 else 1


if __name__ == "__main__":
    raise SystemExit(main())
