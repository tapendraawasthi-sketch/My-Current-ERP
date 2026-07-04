# e-Khata LoRA Fine-Tuning Pipeline

Fine-tune **Qwen2.5-7B-Instruct** (or Llama-3.1-8B-Instruct) on the generated Nepal accounting corpus.

## Prerequisites

```bash
pip install llama-factory torch transformers datasets
# or: pip install axolotl
ollama pull qwen2.5:7b-instruct   # base model for Ollama export
```

## 1. Generate training corpus (5000+ examples)

From repo root:

```bash
npm run generate:ekhata-corpus
```

Outputs:
- `data/ekhata/ca-training-corpus-generated.jsonl` — structured examples
- `data/ekhata/lora-instruction-dataset.jsonl` — Alpaca format for LLaMA-Factory
- `data/ekhata/domain-classifier-dataset.jsonl` — router labels

## 2. Train with LLaMA-Factory

```bash
cd erp_bot/training
llamafactory-cli train lora_config.yaml
```

Or use the helper script:

```bash
bash erp_bot/training/train_ekhata_lora.sh
```

## 3. Merge & export to Ollama

```bash
llamafactory-cli export merge_config.yaml
# Create Modelfile and: ollama create ekhata-ca:7b -f Modelfile
```

## 4. Configure erp_bot

Set in `erp_bot/.env`:

```
MODEL_NAME=ekhata-ca:7b
# or qwen2.5:7b-instruct before fine-tune
KHATA_USE_STRUCTURED_PARSE=true
```

## 5. User feedback loop

Confirmed entries in the e-KHATA panel are saved to `localStorage` (`ekhata-training-feedback-v1`).

Export from browser console:

```javascript
import { downloadTrainingFeedbackExport } from './src/lib/ekhata/trainingFeedback';
downloadTrainingFeedbackExport();
```

Append exported JSONL to `lora-instruction-dataset.jsonl` for monthly re-training.

## Dataset composition (target)

| Type | Count | Purpose |
|------|-------|---------|
| Journal entry parse | ~3500 | NL → structured JSON |
| Accounting Q&A | ~1200 | Concept + entry explanation |
| Domain classify | ~800 | Router training |
| User confirmed | growing | RLHF-lite |

## Evaluation

```bash
npm run test:ekhata-benchmark
npm run test:ekhata-ca
npm run eval:ekhata-lora   # after model deployed
```
