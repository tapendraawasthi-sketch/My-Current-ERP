"""Master intent taxonomy for the customer-facing Falcon chatbot."""

from __future__ import annotations

from typing import Literal

CustomerIntent = Literal[
    "SALE_CASH",
    "SALE_CREDIT",
    "PAYMENT_RECEIVED",
    "PURCHASE_CASH",
    "PURCHASE_CREDIT",
    "PAYMENT_MADE",
    "EXPENSE",
    "RETURN_SALES",
    "RETURN_PURCHASE",
    "DISCOUNT_GIVEN",
    "QUERY_BALANCE_ONE",
    "QUERY_BALANCE_ALL",
    "QUERY_DAILY_TOTAL",
    "QUERY_STOCK",
    "REMINDER_REQUEST",
    "OPENING_ENTRY",
    "GENERAL",
]

TRANSACTION_INTENTS: frozenset[str] = frozenset({
    "SALE_CASH",
    "SALE_CREDIT",
    "PAYMENT_RECEIVED",
    "PURCHASE_CASH",
    "PURCHASE_CREDIT",
    "PAYMENT_MADE",
    "EXPENSE",
    "RETURN_SALES",
    "RETURN_PURCHASE",
    "DISCOUNT_GIVEN",
    "OPENING_ENTRY",
})

QUERY_INTENTS: frozenset[str] = frozenset({
    "QUERY_BALANCE_ONE",
    "QUERY_BALANCE_ALL",
    "QUERY_DAILY_TOTAL",
    "QUERY_STOCK",
    "REMINDER_REQUEST",
})

ALL_INTENTS: tuple[str, ...] = (
    "SALE_CASH",
    "SALE_CREDIT",
    "PAYMENT_RECEIVED",
    "PURCHASE_CASH",
    "PURCHASE_CREDIT",
    "PAYMENT_MADE",
    "EXPENSE",
    "RETURN_SALES",
    "RETURN_PURCHASE",
    "DISCOUNT_GIVEN",
    "QUERY_BALANCE_ONE",
    "QUERY_BALANCE_ALL",
    "QUERY_DAILY_TOTAL",
    "QUERY_STOCK",
    "REMINDER_REQUEST",
    "OPENING_ENTRY",
    "GENERAL",
)
