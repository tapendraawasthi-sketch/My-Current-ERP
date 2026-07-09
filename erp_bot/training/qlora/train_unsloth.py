#!/usr/bin/env python3
"""QLoRA fine-tuning with Unsloth (2x faster than standard HF).

Usage:
    python train_unsloth.py \
        --model Qwen/Qwen2.5-7B-Instruct \
        --dataset alpaca_training_data.json \
        --output ./output/orbix-nepali-lora \
        --epochs 3

Requirements:
    pip install unsloth
    pip install --no-deps trl peft accelerate bitsandbytes
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from datasets import Dataset
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_CONFIG = {
    # Model
    "max_seq_length": 2048,
    "load_in_4bit": True,
    "dtype": None,  # Auto-detect (bfloat16 for Ampere+)
    
    # LoRA
    "lora_r": 32,
    "lora_alpha": 64,
    "lora_dropout": 0.05,
    "target_modules": [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    "use_rslora": True,
    "bias": "none",
    
    # Training
    "epochs": 3,
    "batch_size": 4,
    "gradient_accumulation_steps": 4,
    "learning_rate": 2e-4,
    "warmup_ratio": 0.03,
    "weight_decay": 0.01,
    "lr_scheduler_type": "cosine",
    "logging_steps": 10,
    "save_steps": 100,
    "seed": 42,
}


# ══════════════════════════════════════════════════════════════════════════════
# DATA LOADING
# ══════════════════════════════════════════════════════════════════════════════

def load_alpaca_dataset(path: Path) -> Dataset:
    """Load Alpaca-format JSON dataset."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    
    # Convert to HuggingFace Dataset
    return Dataset.from_list(data)


def format_alpaca_prompt(example: dict, tokenizer) -> str:
    """Format example in Qwen chat template."""
    instruction = example.get("instruction", "")
    input_text = example.get("input", "")
    output = example.get("output", "")
    
    # Combine instruction and input
    if input_text:
        user_content = f"{instruction}\n\n{input_text}"
    else:
        user_content = instruction
    
    # Format as chat
    messages = [
        {"role": "system", "content": "You are Orbix, a friendly Nepal accounting assistant for Sutra ERP. You understand Romanized Nepali, Devanagari, and English."},
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": output},
    ]
    
    # Apply chat template
    return tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
    )


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING
# ══════════════════════════════════════════════════════════════════════════════

def train(
    model_name: str,
    dataset_path: Path,
    output_dir: Path,
    config: dict | None = None,
):
    """Run QLoRA fine-tuning with Unsloth."""
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    
    print(f"Loading model: {model_name}")
    print(f"Config: {cfg}")
    
    # Load model with Unsloth (4-bit quantization)
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_name,
        max_seq_length=cfg["max_seq_length"],
        dtype=cfg["dtype"],
        load_in_4bit=cfg["load_in_4bit"],
    )
    
    # Add LoRA adapters
    model = FastLanguageModel.get_peft_model(
        model,
        r=cfg["lora_r"],
        lora_alpha=cfg["lora_alpha"],
        lora_dropout=cfg["lora_dropout"],
        target_modules=cfg["target_modules"],
        use_rslora=cfg["use_rslora"],
        bias=cfg["bias"],
        use_gradient_checkpointing="unsloth",  # Unsloth optimization
        random_state=cfg["seed"],
    )
    
    # Load dataset
    print(f"Loading dataset: {dataset_path}")
    dataset = load_alpaca_dataset(dataset_path)
    print(f"Dataset size: {len(dataset)}")
    
    # Format dataset
    def format_fn(examples):
        return {
            "text": [
                format_alpaca_prompt({"instruction": i, "input": inp, "output": o}, tokenizer)
                for i, inp, o in zip(examples["instruction"], examples["input"], examples["output"])
            ]
        }
    
    dataset = dataset.map(format_fn, batched=True, remove_columns=dataset.column_names)
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=cfg["epochs"],
        per_device_train_batch_size=cfg["batch_size"],
        gradient_accumulation_steps=cfg["gradient_accumulation_steps"],
        learning_rate=cfg["learning_rate"],
        warmup_ratio=cfg["warmup_ratio"],
        weight_decay=cfg["weight_decay"],
        lr_scheduler_type=cfg["lr_scheduler_type"],
        logging_steps=cfg["logging_steps"],
        save_steps=cfg["save_steps"],
        save_total_limit=3,
        bf16=torch.cuda.is_bf16_supported(),
        fp16=not torch.cuda.is_bf16_supported(),
        optim="paged_adamw_8bit",
        seed=cfg["seed"],
        report_to="none",  # Disable wandb
    )
    
    # Create trainer
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=cfg["max_seq_length"],
        args=training_args,
    )
    
    # Train
    print("Starting training...")
    trainer_stats = trainer.train()
    
    # Save
    print(f"Saving to {output_dir}")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    
    # Save training stats
    stats_path = output_dir / "training_stats.json"
    with open(stats_path, "w") as f:
        json.dump({
            "model": model_name,
            "dataset": str(dataset_path),
            "config": cfg,
            "train_loss": trainer_stats.training_loss,
            "train_samples": len(dataset),
        }, f, indent=2)
    
    print("Training complete!")
    print(f"Final loss: {trainer_stats.training_loss:.4f}")
    
    return trainer_stats


def main():
    parser = argparse.ArgumentParser(description="QLoRA fine-tuning with Unsloth")
    parser.add_argument("--model", "-m", default="Qwen/Qwen2.5-7B-Instruct", help="Base model")
    parser.add_argument("--dataset", "-d", type=Path, required=True, help="Training data JSON")
    parser.add_argument("--output", "-o", type=Path, required=True, help="Output directory")
    parser.add_argument("--epochs", "-e", type=int, default=3, help="Number of epochs")
    parser.add_argument("--batch-size", "-b", type=int, default=4, help="Batch size")
    parser.add_argument("--learning-rate", "-lr", type=float, default=2e-4, help="Learning rate")
    parser.add_argument("--lora-r", type=int, default=32, help="LoRA rank")
    
    args = parser.parse_args()
    
    config = {
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "lora_r": args.lora_r,
        "lora_alpha": args.lora_r * 2,
    }
    
    train(
        model_name=args.model,
        dataset_path=args.dataset,
        output_dir=args.output,
        config=config,
    )


if __name__ == "__main__":
    main()
