"""Structured Nepal accounting knowledge for e-Khata RAG and journal generation."""

from .nepal_accounting_kb import (
    CHART_OF_ACCOUNTS,
    ENTRY_RULES,
    KHATA_INTENT_TO_RULE_KEY,
    NEPAL_TAX_RATES,
    build_journal_lines,
    calculate_income_tax_individual,
    format_kb_snippet,
    get_account,
    get_entry_rule,
    lookup_tds_rate,
    resolve_rule_key,
    search_accounts,
    vat_split,
)

from .chart_of_accounts_framework import (
    coa_documents_for_rag,
    detect_sector,
    format_coa_context,
    get_nlu_vocabulary_summary,
    lookup_account_terms,
)

from .knowledge_registry import (
    ROUTE_TO_TASK,
    chunks_to_rag_documents,
    format_tiered_context,
    load_all_chunks,
    search_tiered_knowledge,
    segment_for_new_content,
    write_chunk_file,
)

__all__ = [
    "CHART_OF_ACCOUNTS",
    "ENTRY_RULES",
    "KHATA_INTENT_TO_RULE_KEY",
    "NEPAL_TAX_RATES",
    "build_journal_lines",
    "calculate_income_tax_individual",
    "format_kb_snippet",
    "get_account",
    "get_entry_rule",
    "lookup_tds_rate",
    "resolve_rule_key",
    "search_accounts",
    "vat_split",
    "coa_documents_for_rag",
    "detect_sector",
    "format_coa_context",
    "get_nlu_vocabulary_summary",
    "lookup_account_terms",
    "ROUTE_TO_TASK",
    "chunks_to_rag_documents",
    "format_tiered_context",
    "load_all_chunks",
    "search_tiered_knowledge",
    "segment_for_new_content",
    "write_chunk_file",
]
