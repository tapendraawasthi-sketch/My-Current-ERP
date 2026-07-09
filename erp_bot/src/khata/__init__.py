"""e-Khata LLM module.

Phase 4 Architecture:
- khata_parser: LLM-based transaction extraction
- khata_validator: Deterministic double-entry validation
- khata_engine: Complete processing pipeline
- khata_chat: Legacy conversation handler (still works)
"""

from .khata_chat import clear_session, khata_chat

# Phase 4 — New structured pipeline
from .khata_parser import (
    ParsedEntry,
    EntryType,
    Direction,
    parse_transaction,
    parse_transaction_sync,
)
from .khata_validator import (
    JournalEntry,
    JournalLine,
    generate_journal_entry,
    validate_journal,
    generate_confirmation_card,
)
from .khata_engine import (
    KhataResult,
    process_khata_entry,
    process_khata_entry_sync,
    handle_khata_intent,
)

__all__ = [
    # Legacy
    "khata_chat",
    "clear_session",
    # Phase 4 — Parser
    "ParsedEntry",
    "EntryType",
    "Direction",
    "parse_transaction",
    "parse_transaction_sync",
    # Phase 4 — Validator
    "JournalEntry",
    "JournalLine",
    "generate_journal_entry",
    "validate_journal",
    "generate_confirmation_card",
    # Phase 4 — Engine
    "KhataResult",
    "process_khata_entry",
    "process_khata_entry_sync",
    "handle_khata_intent",
]
