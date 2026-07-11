"""Tests for reasoning leak prevention."""

from src.llm.reasoning_filter import append_no_think, strip_reasoning


def test_strip_tagged_thinking_block():
    raw = (
        "<think>internal scratchpad</think>\n\n"
        "VAT is 13% on taxable supplies."
    )
    assert strip_reasoning(raw) == "VAT is 13% on taxable supplies."


def test_strip_orphan_close_tag():
    raw = (
        "Okay, the user asked about VAT.\n"
        "Let me recall Nepal rules.\n"
        "</think>\n\n"
        "VAT is 13% on taxable supplies."
    )
    assert strip_reasoning(raw) == "VAT is 13% on taxable supplies."


def test_strip_leading_reasoning_prose():
    raw = (
        "Okay, the user asked about journal entries.\n\n"
        "A sale creates Dr Debtors, Cr Sales."
    )
    assert strip_reasoning(raw) == "A sale creates Dr Debtors, Cr Sales."


def test_strip_let_me_think_prefix():
    raw = "Let me think about this.\n\nNepal fiscal year starts Shrawan 1."
    assert strip_reasoning(raw) == "Nepal fiscal year starts Shrawan 1."


def test_append_no_think_once():
    assert append_no_think("hello") == "hello /no_think"
    assert append_no_think("hello /no_think") == "hello /no_think"
