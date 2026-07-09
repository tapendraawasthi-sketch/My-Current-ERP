# Phase 5 — Romanized Nepali QLoRA Fine-Tuning Recipe

Complete guide to fine-tune Qwen3 for Romanized Nepali accounting domain using QLoRA.

## When to Fine-Tune vs. Use RAG

| Use Case | RAG | Fine-Tuning | Both |
|----------|-----|-------------|------|
| **Nepal tax rates/rules** | ✅ Best | ❌ Rates change | - |
| **Romanized Nepali understanding** | ❌ Weak | ✅ Best | - |
| **Accounting terminology** | ✅ Good | ✅ Better | ✅ |
| **Transaction parsing** | ❌ Inconsistent | ✅ Best | - |
| **Response style/tone** | ❌ Limited | ✅ Best | - |
| **ERP navigation** | ✅ Best | ❌ UI changes | - |

**Summary:**
- **RAG**: Facts that change (tax rates, UI paths, current rules)
- **Fine-tune**: Language understanding, style, consistent parsing
- **Both**: Domain expertise (accounting concepts + Nepal specifics)

## Hardware Requirements

| Model | VRAM (Training) | VRAM (Inference) | Time (3 epochs, 5K samples) |
|-------|-----------------|------------------|----------------------------|
| qwen3:8b | 18-20 GB | 8-10 GB | ~2-3 hours |
| qwen3:14b | 22-24 GB | 14-16 GB | ~4-6 hours |
| qwen3:32b | 40+ GB (A100) | 20-24 GB (Q4) | ~8-12 hours |

**Recommended for L4 (24GB):** Start with `qwen3:8b`, upgrade to 14b if it fits.

## QLoRA Configuration

```python
# Proven configuration for Qwen3 fine-tuning
qlora_config = {
    "quantization": "4-bit NF4",
    "compute_dtype": "bfloat16",
    "lora_r": 32,           # Rank
    "lora_alpha": 64,       # Alpha (usually 2x rank)
    "lora_dropout": 0.05,
    "target_modules": [
        "q_proj", "k_proj", "v_proj", "o_proj",  # Attention
        "gate_proj", "up_proj", "down_proj",      # MLP
    ],
    "use_rslora": True,     # Rank-Stabilized LoRA
    "bias": "none",
}

training_args = {
    "epochs": 3,
    "batch_size": 4,
    "gradient_accumulation": 4,
    "learning_rate": 2e-4,
    "warmup_ratio": 0.03,
    "max_seq_length": 2048,
    "optimizer": "paged_adamw_8bit",
}
```

## Dataset Format (Alpaca-Style)

### Single-Turn Format

```json
{
  "instruction": "Ram lai 5000 udhaar becheko. Journal entry dekhau.",
  "input": "",
  "output": "**Credit Sale to Ram — Rs 5,000**\n\nJournal Entry:\n  DEBIT: Accounts Receivable (Ram) — Rs 5,000\n  CREDIT: Sales Revenue — Rs 5,000\n\nYo thik cha? Confirm garnus."
}
```

### Multi-Turn / Conversation Format

```json
{
  "instruction": "You are Orbix, a Nepal accounting assistant.",
  "input": "User: Ram lai 5000 udhaar becheko\nAssistant: Credit sale ho. Party: Ram, Amount: Rs 5,000. Confirm?\nUser: yes confirm",
  "output": "Entry recorded! Ram ko receivable Rs 5,000 le badhyo. Aru kei help chahiyo?"
}
```

### Categories to Include

1. **Romanized Nepali Transactions** (40%)
   - udhaar becheko/kineko
   - paisa diye/liye/tireko
   - kharcha, bhaada, talab

2. **Devanagari Transactions** (20%)
   - उधारो बेचेको/किनेको
   - पैसा दिए/लिए

3. **English Transactions** (15%)
   - Sold on credit, purchased, paid, received

4. **Accounting Q&A** (15%)
   - What is VAT? TDS? SSF?
   - Journal entry for depreciation

5. **Chitchat / Style** (10%)
   - Greetings, thanks, small talk
   - Tone calibration

## Converting Existing JSONL Corpus

Run the conversion script:

```bash
python convert_corpus.py \
  --input ../../../data/ekhata/ca-training-corpus-generated.jsonl \
  --output alpaca_training_data.json \
  --format alpaca
```

See `convert_corpus.py` for the full conversion script.

## Training Script

### Option 1: Unsloth (Recommended — 2x faster)

```bash
# Install
pip install unsloth
pip install --no-deps trl peft accelerate bitsandbytes

# Train
python train_unsloth.py \
  --model Qwen/Qwen2.5-7B-Instruct \
  --dataset alpaca_training_data.json \
  --output ./output/orbix-nepali-lora \
  --epochs 3
```

### Option 2: TRL + PEFT (Standard)

```bash
# Install
pip install transformers trl peft bitsandbytes accelerate

# Train
python train_trl.py \
  --model Qwen/Qwen2.5-7B-Instruct \
  --dataset alpaca_training_data.json \
  --output ./output/orbix-nepali-lora \
  --epochs 3
```

## Loading into Ollama

### Step 1: Merge LoRA Adapter

```bash
python merge_adapter.py \
  --base-model Qwen/Qwen2.5-7B-Instruct \
  --adapter ./output/orbix-nepali-lora \
  --output ./output/orbix-merged
```

### Step 2: Convert to GGUF

```bash
# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Convert to GGUF
python convert_hf_to_gguf.py ../output/orbix-merged \
  --outfile ../output/orbix-nepali-q4_k_m.gguf \
  --outtype q4_k_m
```

### Step 3: Create Ollama Modelfile

```dockerfile
# Modelfile
FROM ./orbix-nepali-q4_k_m.gguf

TEMPLATE """{{ if .System }}<|im_start|>system
{{ .System }}<|im_end|>
{{ end }}{{ if .Prompt }}<|im_start|>user
{{ .Prompt }}<|im_end|>
{{ end }}<|im_start|>assistant
{{ .Response }}<|im_end|>
"""

PARAMETER stop "<|im_end|>"
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096

SYSTEM """You are Orbix, a friendly Nepal accounting assistant for Sutra ERP.
You understand Romanized Nepali (e.g., "Ram lai 5000 udhaar diye"), Devanagari, and English.
You help with journal entries, tax questions, and ERP navigation."""
```

### Step 4: Create Ollama Model

```bash
ollama create orbix-nepali -f Modelfile
ollama run orbix-nepali "Ram lai 5000 udhaar becheko"
```

## Loading into vLLM

```python
from vllm import LLM, SamplingParams

# Load merged model
llm = LLM(
    model="./output/orbix-merged",
    quantization="awq",  # or "gptq"
    tensor_parallel_size=1,
    max_model_len=4096,
)

# Or load base + adapter separately
llm = LLM(
    model="Qwen/Qwen2.5-7B-Instruct",
    enable_lora=True,
    max_loras=1,
    max_lora_rank=32,
)

# Generate
sampling_params = SamplingParams(temperature=0.7, top_p=0.9, max_tokens=512)
outputs = llm.generate(["Ram lai 5000 udhaar becheko"], sampling_params)
```

## Evaluation

After training, evaluate on held-out test set:

```bash
python evaluate.py \
  --model ./output/orbix-nepali-lora \
  --test-data test_data.json \
  --metrics "accuracy,bleu,journal_balance"
```

Key metrics:
1. **Transaction Parsing Accuracy** — Does it extract correct party/amount/type?
2. **Journal Balance** — Do generated entries always balance?
3. **Language Match** — Does it respond in user's language?
4. **BLEU Score** — Response quality vs. reference

## Directory Structure

```
training/qlora/
├── README.md              # This file
├── convert_corpus.py      # JSONL → Alpaca converter
├── train_unsloth.py       # Unsloth training script
├── train_trl.py           # TRL/PEFT training script
├── merge_adapter.py       # Merge LoRA into base
├── evaluate.py            # Evaluation script
├── Modelfile              # Ollama model definition
├── requirements.txt       # Dependencies
└── example_data/
    └── sample_alpaca.json # Example training data
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| OOM during training | Reduce batch_size, increase gradient_accumulation |
| Poor Nepali understanding | Add more Romanized Nepali examples |
| Unbalanced journal entries | Add validation loss for balance |
| Slow inference | Use Q4 quantization, reduce num_ctx |
| Ollama model fails to load | Check GGUF conversion, template format |

## Next Steps After Fine-Tuning

1. **Test thoroughly** with held-out data
2. **A/B test** against base model
3. **Update config.py** to use new model:
   ```
   CONVERSATIONAL_MODEL=orbix-nepali
   ```
4. **Monitor** production quality
5. **Iterate** with more training data from user feedback

---

*Fine-tuning is an offline process. Run on a machine with sufficient VRAM. The resulting model can be deployed to your L4 GPU for inference.*
