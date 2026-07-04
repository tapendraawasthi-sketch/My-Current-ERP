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

**Base model (no GPU fine-tune):**

```bash
bash erp_bot/training/create_base_model.sh ekhata-ca:7b
```

**After LoRA training:**

```bash
bash erp_bot/training/export_to_ollama.sh
# merges adapter via merge_config.yaml, then ollama create ekhata-ca:7b
```

Or manually:

```bash
llamafactory-cli export merge_config.yaml
bash erp_bot/training/create_base_model.sh ekhata-ca:7b
```

## 4. Configure erp_bot

Set in `erp_bot/.env`:

```
MODEL_NAME=ekhata-ca:7b
# or qwen2.5:7b-instruct before fine-tune
KHATA_USE_STRUCTURED_PARSE=true
```

## 6. Nepali grammar reference (NLU / Ollama)

Complete Nepali grammar knowledge for interpreting user messages (Devanagari, Roman, Halkhabar, code-switch):

- **Structured:** `data/ekhata/source/nepali-grammar-reference.txt` (33 sections)
- **Verbatim (all variations):** `data/ekhata/source/nepali-grammar-reference-verbatim.txt`
- **Search index:** `data/ekhata/nepali-grammar-search-index.json` (local BM25 — **no ChromaDB, Ollama, or API keys**)
- **Section map:** `data/ekhata/nepali-grammar-index.json`
- **Rebuild reference:** `python3 scripts/build_nepali_grammar_reference.py --force`
- **Rebuild verbatim:** `python3 scripts/build_nepali_grammar_reference_verbatim.py`
- **Rebuild search index:** `python3 erp_bot/scripts/ingest_nepali_grammar.py`

Ollama chat (`erp_bot/src/khata/khata_chat.py`) retrieves grammar sections automatically via local BM25 search when interpreting Nepali/mixed input.

## 7. User feedback loop

Confirmed entries in the e-KHATA panel are saved to:
- Browser `localStorage` (`ekhata-training-feedback-v1`)
- Server `data/ekhata/user-feedback.jsonl` via `POST /khata/feedback` (when erp_bot is running)

Monitor counts: `GET /khata/training/stats`

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
npm run test:ekhata-benchmark      # 13 audit regression cases
npm run test:ekhata-corpus-benchmark  # stratified sample from 5190 corpus
npm run test:ekhata-parser-parity     # TS vs Python intent classifier
npm run test:ekhata-all               # all of the above + validate
npm run test:ekhata-ca
npm run validate:ekhata-corpus
```
