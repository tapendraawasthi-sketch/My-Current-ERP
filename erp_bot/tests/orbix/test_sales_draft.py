"""Sales draft lifecycle unit tests."""

from src.khata.sales_draft import (
    extract_sale_fields,
    is_sale_message,
    start_or_merge_sale,
    clarification_message,
)


def test_sale_signal():
    assert is_sale_message("I sold a bike.")
    assert is_sale_message("2 ota bike 60000 rate ma cash beche")
    assert not is_sale_message("I bought a bike.")


def test_incomplete_sale_clarification():
    draft = start_or_merge_sale(
        "I sold a bike.",
        session_id="s1",
        tenant_id="t",
        company_id="c",
        user_id="u",
    )
    assert draft.status == "awaiting_clarification"
    assert "quantity" in draft.missing_fields or "rate_or_total" in draft.missing_fields
    assert "payment_method" in draft.missing_fields
    msg = clarification_message(draft)
    assert "sales" in msg.lower() or "quantity" in msg.lower()


def test_same_draft_continuation():
    d1 = start_or_merge_sale("I sold a bike.", session_id="s2", user_id="u")
    d2 = start_or_merge_sale("1, 60000 cash", session_id="s2", user_id="u", existing=d1)
    assert d2.draft_id == d1.draft_id
    assert d2.version >= d1.version
    assert d2.status == "previewed"
    assert d2.preview is not None
    assert d2.preview["payment"] == "cash"
    assert float(d2.preview["amount"]) == 60000.0


def test_credit_sale_fields():
    fields = extract_sale_fields("I sold 1 bike to Ram Traders for Rs 60000 on credit")
    assert fields.get("payment_method") == "credit"
    assert fields.get("customer") or fields.get("quantity")
