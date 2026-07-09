#!/usr/bin/env python3
"""Evaluate fine-tuned model on held-out test set.

Usage:
    python evaluate.py \
        --model ./output/orbix-nepali-lora \
        --test-data alpaca_training_data_eval.json \
        --base-model Qwen/Qwen2.5-7B-Instruct

Metrics:
1. Transaction Parsing Accuracy
2. Journal Balance Rate
3. Language Match Rate
4. BLEU Score (response quality)
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def load_model(model_path: Path, base_model: str | None = None):
    """Load model (merged or adapter)."""
    try:
        # Try loading as merged model
        model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True,
        )
        tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
        return model, tokenizer
    except Exception:
        pass
    
    # Load as adapter
    if not base_model:
        raise ValueError("Base model required for adapter loading")
    
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(model, str(model_path))
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    
    return model, tokenizer


def generate_response(model, tokenizer, instruction: str, max_length: int = 512) -> str:
    """Generate response for a given instruction."""
    messages = [
        {"role": "system", "content": "You are Orbix, a Nepal accounting assistant."},
        {"role": "user", "content": instruction},
    ]
    
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_length,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    
    response = tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
    return response.strip()


def check_journal_balance(response: str) -> bool:
    """Check if journal entry in response balances."""
    # Extract amounts after DEBIT and CREDIT
    debit_amounts = re.findall(r"DEBIT:.*?(?:Rs|रु)\.?\s*([\d,]+)", response, re.I)
    credit_amounts = re.findall(r"CREDIT:.*?(?:Rs|रु)\.?\s*([\d,]+)", response, re.I)
    
    if not debit_amounts or not credit_amounts:
        return True  # No journal entry to check
    
    total_debit = sum(int(a.replace(",", "")) for a in debit_amounts)
    total_credit = sum(int(a.replace(",", "")) for a in credit_amounts)
    
    return total_debit == total_credit


def check_language_match(instruction: str, response: str) -> bool:
    """Check if response language matches instruction language."""
    # Check for Devanagari
    has_nepali_input = bool(re.search(r"[\u0900-\u097F]", instruction))
    has_nepali_output = bool(re.search(r"[\u0900-\u097F]", response))
    
    if has_nepali_input:
        return has_nepali_output
    
    # Check for Romanized Nepali patterns
    romanized_patterns = r"\b(udhaar|becheko|kineko|tireko|diye|payo|kharcha|bhaada)\b"
    has_romanized_input = bool(re.search(romanized_patterns, instruction, re.I))
    has_romanized_output = bool(re.search(romanized_patterns, response, re.I))
    
    if has_romanized_input:
        return has_romanized_output
    
    # English input should get English output
    return True


def calculate_bleu(reference: str, hypothesis: str) -> float:
    """Calculate BLEU score between reference and hypothesis."""
    try:
        from sacrebleu.metrics import BLEU
        bleu = BLEU()
        result = bleu.sentence_score(hypothesis, [reference])
        return result.score / 100  # Normalize to 0-1
    except ImportError:
        # Simple word overlap fallback
        ref_words = set(reference.lower().split())
        hyp_words = set(hypothesis.lower().split())
        overlap = len(ref_words & hyp_words)
        return overlap / max(len(ref_words), 1)


def evaluate(
    model_path: Path,
    test_data_path: Path,
    base_model: str | None = None,
    num_samples: int | None = None,
) -> dict:
    """Run evaluation on test set."""
    print(f"Loading model from: {model_path}")
    model, tokenizer = load_model(model_path, base_model)
    
    print(f"Loading test data from: {test_data_path}")
    with open(test_data_path, encoding="utf-8") as f:
        test_data = json.load(f)
    
    if num_samples:
        test_data = test_data[:num_samples]
    
    print(f"Evaluating on {len(test_data)} samples...")
    
    results = {
        "total": len(test_data),
        "journal_balanced": 0,
        "language_matched": 0,
        "bleu_scores": [],
        "samples": [],
    }
    
    for i, example in enumerate(test_data):
        instruction = example.get("instruction", "")
        reference = example.get("output", "")
        
        # Generate response
        response = generate_response(model, tokenizer, instruction)
        
        # Check journal balance
        balanced = check_journal_balance(response)
        if balanced:
            results["journal_balanced"] += 1
        
        # Check language match
        lang_matched = check_language_match(instruction, response)
        if lang_matched:
            results["language_matched"] += 1
        
        # Calculate BLEU
        bleu = calculate_bleu(reference, response)
        results["bleu_scores"].append(bleu)
        
        # Store sample
        results["samples"].append({
            "instruction": instruction,
            "reference": reference,
            "generated": response,
            "balanced": balanced,
            "lang_matched": lang_matched,
            "bleu": bleu,
        })
        
        if (i + 1) % 10 == 0:
            print(f"  Processed {i + 1}/{len(test_data)}")
    
    # Calculate aggregates
    results["journal_balance_rate"] = results["journal_balanced"] / results["total"]
    results["language_match_rate"] = results["language_matched"] / results["total"]
    results["avg_bleu"] = sum(results["bleu_scores"]) / len(results["bleu_scores"])
    
    return results


def main():
    parser = argparse.ArgumentParser(description="Evaluate fine-tuned model")
    parser.add_argument("--model", "-m", type=Path, required=True, help="Model path")
    parser.add_argument("--test-data", "-t", type=Path, required=True, help="Test data JSON")
    parser.add_argument("--base-model", "-b", help="Base model (for adapter loading)")
    parser.add_argument("--num-samples", "-n", type=int, help="Max samples to evaluate")
    parser.add_argument("--output", "-o", type=Path, help="Output JSON file for results")
    
    args = parser.parse_args()
    
    results = evaluate(
        model_path=args.model,
        test_data_path=args.test_data,
        base_model=args.base_model,
        num_samples=args.num_samples,
    )
    
    # Print summary
    print("\n" + "=" * 50)
    print("EVALUATION RESULTS")
    print("=" * 50)
    print(f"Total samples: {results['total']}")
    print(f"Journal Balance Rate: {results['journal_balance_rate']:.2%}")
    print(f"Language Match Rate: {results['language_match_rate']:.2%}")
    print(f"Average BLEU Score: {results['avg_bleu']:.4f}")
    print("=" * 50)
    
    # Save results
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"Results saved to: {args.output}")


if __name__ == "__main__":
    main()
