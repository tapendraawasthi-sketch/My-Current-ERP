#!/usr/bin/env python3
"""Merge LoRA adapter into base model for deployment.

Usage:
    python merge_adapter.py \
        --base-model Qwen/Qwen2.5-7B-Instruct \
        --adapter ./output/orbix-nepali-lora \
        --output ./output/orbix-merged

After merging, convert to GGUF for Ollama:
    python llama.cpp/convert_hf_to_gguf.py ./output/orbix-merged \
        --outfile ./output/orbix-nepali-q4_k_m.gguf \
        --outtype q4_k_m
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def merge_adapter(
    base_model_name: str,
    adapter_path: Path,
    output_path: Path,
    push_to_hub: bool = False,
    hub_repo: str | None = None,
):
    """Merge LoRA adapter into base model.
    
    Args:
        base_model_name: HuggingFace model ID or path
        adapter_path: Path to LoRA adapter directory
        output_path: Path to save merged model
        push_to_hub: Whether to push to HuggingFace Hub
        hub_repo: HuggingFace repo ID (required if push_to_hub)
    """
    print(f"Loading base model: {base_model_name}")
    
    # Load base model (full precision for merging)
    model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True,
    )
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
    
    print(f"Loading adapter from: {adapter_path}")
    
    # Load LoRA adapter
    model = PeftModel.from_pretrained(model, str(adapter_path))
    
    print("Merging adapter into base model...")
    
    # Merge and unload
    model = model.merge_and_unload()
    
    # Save merged model
    print(f"Saving merged model to: {output_path}")
    output_path.mkdir(parents=True, exist_ok=True)
    
    model.save_pretrained(output_path)
    tokenizer.save_pretrained(output_path)
    
    # Copy adapter config for reference
    adapter_config = adapter_path / "adapter_config.json"
    if adapter_config.exists():
        shutil.copy(adapter_config, output_path / "adapter_config_reference.json")
    
    print("Merge complete!")
    
    # Push to Hub if requested
    if push_to_hub and hub_repo:
        print(f"Pushing to HuggingFace Hub: {hub_repo}")
        model.push_to_hub(hub_repo)
        tokenizer.push_to_hub(hub_repo)
        print("Push complete!")
    
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Merge LoRA adapter into base model")
    parser.add_argument("--base-model", "-b", required=True, help="Base model name/path")
    parser.add_argument("--adapter", "-a", type=Path, required=True, help="Adapter directory")
    parser.add_argument("--output", "-o", type=Path, required=True, help="Output directory")
    parser.add_argument("--push-to-hub", action="store_true", help="Push to HuggingFace Hub")
    parser.add_argument("--hub-repo", help="HuggingFace repo ID")
    
    args = parser.parse_args()
    
    merge_adapter(
        base_model_name=args.base_model,
        adapter_path=args.adapter,
        output_path=args.output,
        push_to_hub=args.push_to_hub,
        hub_repo=args.hub_repo,
    )


if __name__ == "__main__":
    main()
