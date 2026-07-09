#!/usr/bin/env python3
"""Convert existing JSONL corpus to Alpaca-style training format.

Usage:
    python convert_corpus.py \
        --input ../../data/ekhata/ca-training-corpus-generated.jsonl \
        --output alpaca_training_data.json \
        --format alpaca
"""

from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path
from typing import Any


def load_jsonl(path: Path) -> list[dict]:
    """Load JSONL file into list of dicts."""
    records = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return records


def clean_text(text: str) -> str:
    """Clean and normalize text."""
    text = text.strip()
    # Remove excessive whitespace
    text = re.sub(r"\s+", " ", text)
    # Fix common issues
    text = text.replace("\\n", "\n")
    return text


def convert_qa_to_alpaca(record: dict) -> dict | None:
    """Convert Q&A format to Alpaca format."""
    # Handle various input formats
    instruction = (
        record.get("input") or 
        record.get("instruction") or 
        record.get("question") or
        record.get("prompt") or
        ""
    )
    output = (
        record.get("output") or 
        record.get("response") or 
        record.get("answer") or
        record.get("completion") or
        ""
    )
    
    instruction = clean_text(instruction)
    output = clean_text(output)
    
    if not instruction or not output:
        return None
    
    # Skip very short or low-quality examples
    if len(instruction) < 5 or len(output) < 10:
        return None
    
    return {
        "instruction": instruction,
        "input": "",  # Empty for single-turn
        "output": output,
    }


def convert_transaction_to_alpaca(record: dict) -> dict | None:
    """Convert transaction record to Alpaca training format."""
    narration = record.get("narration") or record.get("raw_text") or ""
    intent = record.get("intent") or ""
    party = record.get("party") or ""
    amount = record.get("amount") or 0
    journal_lines = record.get("journalLines") or record.get("journal_lines") or []
    
    if not narration or not amount:
        return None
    
    # Build instruction (user's transaction description)
    instruction = clean_text(narration)
    
    # Build output (expected response with journal entry)
    output_parts = []
    
    # Transaction type
    type_labels = {
        "khata_credit_sale": "Credit Sale (Udhaar Bikri)",
        "khata_cash_sale": "Cash Sale (Nagar Bikri)",
        "khata_payment_in": "Payment Received",
        "khata_payment_out": "Payment Made",
        "khata_purchase": "Purchase",
        "khata_expense": "Expense",
    }
    type_label = type_labels.get(intent, intent.replace("khata_", "").replace("_", " ").title())
    
    if party:
        output_parts.append(f"**{type_label}** — {party} lai Rs {amount:,}")
    else:
        output_parts.append(f"**{type_label}** — Rs {amount:,}")
    
    output_parts.append("\nJournal Entry:")
    
    # Journal lines
    for line in journal_lines:
        account = line.get("accountName") or line.get("account") or ""
        debit = line.get("debit", 0)
        credit = line.get("credit", 0)
        
        if debit:
            output_parts.append(f"  DEBIT: {account} — Rs {int(debit):,}")
        if credit:
            output_parts.append(f"  CREDIT: {account} — Rs {int(credit):,}")
    
    output_parts.append("\nYo thik cha? Confirm garnus.")
    
    output = "\n".join(output_parts)
    
    return {
        "instruction": instruction,
        "input": "",
        "output": output,
    }


def generate_synthetic_examples() -> list[dict]:
    """Generate synthetic training examples for coverage."""
    examples = []
    
    # Romanized Nepali greetings
    greetings = [
        ("namaste", "Namaste! Sutra ERP ma swagat cha. Ke help chahiyo aaja?"),
        ("k cha", "Thik cha! Tapaiko ni kasto cha? Accounting related kei help chahiyo?"),
        ("kasto cha", "Ramro cha, dhanyabad! Ke kaam garne aaja?"),
        ("dhanyabad", "Swagat cha! Aru kei help chahiyo bhane bhannus."),
        ("bye", "Namaste! Pheri bhetaula. Ramro din hos!"),
    ]
    
    for inp, out in greetings:
        examples.append({
            "instruction": inp,
            "input": "",
            "output": out,
        })
    
    # Transaction patterns
    transactions = [
        # Credit sales
        ("Ram lai 5000 udhaar becheko", "credit_sale", "Ram", 5000),
        ("Shyam lai Rs 10,000 ko saman udharo bikri", "credit_sale", "Shyam", 10000),
        ("customer lai 15000 udhaar ma diye", "credit_sale", "Customer", 15000),
        
        # Cash sales
        ("cash bikri 8000", "cash_sale", None, 8000),
        ("nagar bikri 5000", "cash_sale", None, 5000),
        
        # Receipts
        ("Ram bata 5000 payo", "receipt", "Ram", 5000),
        ("customer le 10000 tiryo", "receipt", "Customer", 10000),
        ("Hari bata paisa liye 3000", "receipt", "Hari", 3000),
        
        # Payments
        ("supplier lai 20000 tireko", "payment", "Supplier", 20000),
        ("Shyam lai 5000 diye", "payment", "Shyam", 5000),
        ("baki tireko 15000", "payment", None, 15000),
        
        # Expenses
        ("office rent 10000 tireko", "expense", None, 10000),
        ("bijuli kharcha 2000", "expense", None, 2000),
        ("telephone bill 1500", "expense", None, 1500),
    ]
    
    for narration, txn_type, party, amount in transactions:
        # Build journal entry based on type
        if txn_type == "credit_sale":
            journal = [
                {"accountName": f"Receivable - {party}" if party else "Accounts Receivable", "debit": amount, "credit": 0},
                {"accountName": "Sales Revenue", "debit": 0, "credit": amount},
            ]
            label = "Credit Sale (Udhaar Bikri)"
        elif txn_type == "cash_sale":
            journal = [
                {"accountName": "Cash", "debit": amount, "credit": 0},
                {"accountName": "Sales Revenue", "debit": 0, "credit": amount},
            ]
            label = "Cash Sale (Nagar Bikri)"
        elif txn_type == "receipt":
            journal = [
                {"accountName": "Cash", "debit": amount, "credit": 0},
                {"accountName": f"Receivable - {party}" if party else "Accounts Receivable", "debit": 0, "credit": amount},
            ]
            label = "Payment Received"
        elif txn_type == "payment":
            journal = [
                {"accountName": f"Payable - {party}" if party else "Accounts Payable", "debit": amount, "credit": 0},
                {"accountName": "Cash", "debit": 0, "credit": amount},
            ]
            label = "Payment Made"
        else:  # expense
            journal = [
                {"accountName": "Expense", "debit": amount, "credit": 0},
                {"accountName": "Cash", "debit": 0, "credit": amount},
            ]
            label = "Expense"
        
        record = {
            "narration": narration,
            "intent": f"khata_{txn_type}",
            "party": party,
            "amount": amount,
            "journalLines": journal,
        }
        
        converted = convert_transaction_to_alpaca(record)
        if converted:
            examples.append(converted)
    
    # Accounting Q&A
    qa_pairs = [
        ("VAT rate Nepal ma kati ho?", 
         "Nepal ma standard VAT rate 13% ho. Basic necessities ma exempt huncha. Latest rates ko lagi IRD website check garnus: https://ird.gov.np"),
        
        ("TDS k ho?", 
         "TDS (Tax Deducted at Source) bhanya payment garda advance tax katnu ho. Different payments ma different rates apply huncha - professional services ma 15%, rent ma 10%, goods supply ma 1.5%."),
        
        ("SSF contribution kati ho?",
         "SSF contribution rates:\n- Employee: 11% (basic salary ko)\n- Employer: 20% (basic salary ko)\nTotal: 31%"),
        
        ("double entry rule k ho?",
         "Double entry rule:\n1. Real Account: Debit what comes in, Credit what goes out\n2. Personal Account: Debit the receiver, Credit the giver\n3. Nominal Account: Debit expenses, Credit income"),
        
        ("fiscal year Nepal ma kahile suru huncha?",
         "Nepal ko fiscal year Shrawan 1 (mid-July) ma suru huncha ra Ashad end (mid-July next year) ma sakincha. AD ma roughly July 16 - July 15."),
    ]
    
    for q, a in qa_pairs:
        examples.append({
            "instruction": q,
            "input": "",
            "output": a,
        })
    
    return examples


def convert_corpus(
    input_path: Path,
    output_path: Path,
    format_type: str = "alpaca",
    add_synthetic: bool = True,
    train_split: float = 0.9,
) -> dict:
    """Convert corpus and save to output file.
    
    Args:
        input_path: Path to input JSONL file
        output_path: Path to output JSON file
        format_type: Output format (alpaca, sharegpt)
        add_synthetic: Whether to add synthetic examples
        train_split: Fraction of data for training (rest is eval)
    
    Returns:
        Statistics dict
    """
    records = load_jsonl(input_path)
    print(f"Loaded {len(records)} records from {input_path}")
    
    converted = []
    
    # Convert each record
    for record in records:
        # Try transaction format first
        if "journalLines" in record or "journal_lines" in record or "intent" in record:
            result = convert_transaction_to_alpaca(record)
        else:
            result = convert_qa_to_alpaca(record)
        
        if result:
            converted.append(result)
    
    print(f"Converted {len(converted)} records")
    
    # Add synthetic examples
    if add_synthetic:
        synthetic = generate_synthetic_examples()
        converted.extend(synthetic)
        print(f"Added {len(synthetic)} synthetic examples")
    
    # Shuffle
    random.shuffle(converted)
    
    # Split into train/eval
    split_idx = int(len(converted) * train_split)
    train_data = converted[:split_idx]
    eval_data = converted[split_idx:]
    
    # Save
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(train_data, f, ensure_ascii=False, indent=2)
    
    eval_path = output_path.with_stem(output_path.stem + "_eval")
    with open(eval_path, "w", encoding="utf-8") as f:
        json.dump(eval_data, f, ensure_ascii=False, indent=2)
    
    print(f"Saved {len(train_data)} training examples to {output_path}")
    print(f"Saved {len(eval_data)} eval examples to {eval_path}")
    
    return {
        "input_records": len(records),
        "converted": len(converted),
        "train": len(train_data),
        "eval": len(eval_data),
    }


def main():
    parser = argparse.ArgumentParser(description="Convert JSONL corpus to Alpaca format")
    parser.add_argument("--input", "-i", type=Path, required=True, help="Input JSONL file")
    parser.add_argument("--output", "-o", type=Path, required=True, help="Output JSON file")
    parser.add_argument("--format", "-f", default="alpaca", choices=["alpaca", "sharegpt"])
    parser.add_argument("--no-synthetic", action="store_true", help="Skip synthetic examples")
    parser.add_argument("--train-split", type=float, default=0.9, help="Train/eval split ratio")
    
    args = parser.parse_args()
    
    stats = convert_corpus(
        args.input,
        args.output,
        format_type=args.format,
        add_synthetic=not args.no_synthetic,
        train_split=args.train_split,
    )
    
    print(f"\nConversion complete: {stats}")


if __name__ == "__main__":
    main()
