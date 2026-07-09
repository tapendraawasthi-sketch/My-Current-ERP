"""Single source of truth for all erp_bot configuration.

Model architecture for L4 GPU (24GB VRAM):
- CONVERSATIONAL_MODEL: Qwen3-32B (AWQ/Q4) for warm, natural conversation
- FAST_MODEL: qwen3:4b for quick routing/classification
- EMBED_MODEL: nomic-embed-text for RAG retrieval

Set via environment variables or .env file.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BOT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BOT_ROOT / ".env")

DEFAULT_ERP_PATH = BOT_ROOT.parent

_erp_path_env = os.getenv("ERP_PATH", "").strip()
ERP_PATH = (_erp_path_env if _erp_path_env else str(DEFAULT_ERP_PATH))
ERP_PATH = Path(ERP_PATH).resolve()

# ══════════════════════════════════════════════════════════════════════════════
# MODEL CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════
#
# For L4 GPU (24GB VRAM), recommended setup:
#   CONVERSATIONAL_MODEL=qwen3:32b (or qwen3:32b-q4_K_M for quantized)
#   FAST_MODEL=qwen3:4b
#   EMBED_MODEL=nomic-embed-text
#
# If you have less VRAM, use qwen3:14b or qwen3:8b as CONVERSATIONAL_MODEL.
# ══════════════════════════════════════════════════════════════════════════════

# Primary conversational model — this is the "brain" that talks to users
# Use the largest Qwen3 your GPU can handle: 32B > 14B > 8B > 4B
CONVERSATIONAL_MODEL = os.getenv("CONVERSATIONAL_MODEL", "qwen3:32b")

# Fast model for routing, classification, quick extractions (must be <3s response)
FAST_MODEL = os.getenv("FAST_MODEL_NAME", "qwen3:4b")

# Embedding model for RAG retrieval
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")

# Legacy aliases (for backward compatibility with existing code)
MODEL_NAME = os.getenv("MODEL_NAME", CONVERSATIONAL_MODEL)
PRIMARY_MODEL = MODEL_NAME
DEEP_MODEL = os.getenv("DEEP_MODEL_NAME", CONVERSATIONAL_MODEL)

# ══════════════════════════════════════════════════════════════════════════════
# GENERATION PARAMETERS
# ══════════════════════════════════════════════════════════════════════════════

# Context window — L4 can handle 8K-12K comfortably with 32B quantized
# Increase if you have more VRAM, decrease if you see OOM errors
CONTEXT_SIZE = int(os.getenv("CONTEXT_SIZE", "8192"))

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6 — OLLAMA SERVING OPTIMIZATION (L4 GPU)
# ══════════════════════════════════════════════════════════════════════════════
#
# Performance expectations on NVIDIA L4 (24GB VRAM):
#
#   Model           | Load Time | First Token | Tokens/sec | VRAM Usage
#   ----------------|-----------|-------------|------------|------------
#   qwen3:32b Q4    | ~12s      | ~2-3s       | 8-15 t/s   | ~18-20GB
#   qwen3:14b Q4    | ~6s       | ~1-2s       | 15-25 t/s  | ~10-12GB
#   qwen3:8b Q4     | ~4s       | <1s         | 25-40 t/s  | ~6-8GB
#   qwen3:4b        | ~2s       | <0.5s       | 40-60 t/s  | ~3-4GB
#   nomic-embed     | ~1s       | instant     | N/A        | ~0.5GB
#
# Key optimization flags (set via OLLAMA_* env vars or Modelfile):
#
#   OLLAMA_NUM_GPU=99          # Use all GPU layers (default: auto)
#   OLLAMA_KEEP_ALIVE="10m"    # Keep model in VRAM 10min after last request
#   OLLAMA_NUM_PARALLEL=2      # Concurrent requests (careful with VRAM)
#   OLLAMA_MAX_LOADED_MODELS=2 # Keep fast + main model loaded
#
# ══════════════════════════════════════════════════════════════════════════════

# Keep model in VRAM between requests (reduces cold start)
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "10m")

# Number of parallel requests (2 allows fast model + main model concurrent)
OLLAMA_NUM_PARALLEL = int(os.getenv("OLLAMA_NUM_PARALLEL", "2"))

# Response caching for repeated questions
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "true").lower() == "true"
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "3600"))
CACHE_MAX_SIZE = int(os.getenv("CACHE_MAX_SIZE", "500"))

# Streaming chunk size (characters per SSE event)
STREAMING_CHUNK_SIZE = int(os.getenv("STREAMING_CHUNK_SIZE", "10"))

# Conversational model options — warmer temperature for natural chat
CONVERSATIONAL_MODEL_OPTIONS: dict[str, float | int] = {
    "temperature": float(os.getenv("TEMPERATURE", "0.7")),
    "num_ctx": CONTEXT_SIZE,
    "top_p": float(os.getenv("TOP_P", "0.9")),
    "repeat_penalty": float(os.getenv("REPEAT_PENALTY", "1.1")),
}

# Fast model options — lower temperature for deterministic routing
FAST_MODEL_OPTIONS: dict[str, float | int] = {
    "temperature": 0.1,
    "num_ctx": 2048,
    "top_p": 0.9,
}

# Legacy alias
PRIMARY_MODEL_OPTIONS = CONVERSATIONAL_MODEL_OPTIONS

# ══════════════════════════════════════════════════════════════════════════════
# OLLAMA & API SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
API_PORT = int(os.getenv("API_PORT", "8765"))

# ══════════════════════════════════════════════════════════════════════════════
# KHATA / NLU SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

KHATA_STRUCTURED_PARSE = os.getenv("KHATA_USE_STRUCTURED_PARSE", "true").lower() == "true"
KHATA_SYNTHESIZE_CONTEXT = os.getenv("KHATA_SYNTHESIZE_CONTEXT", "true").lower() == "true"

# Regex confidence — below this threshold, always use LLM for parsing
REGEX_CONFIDENCE_THRESHOLD = float(os.getenv("NLU_REGEX_THRESHOLD", "0.85"))

# ══════════════════════════════════════════════════════════════════════════════
# RAG / INDEXING SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1500"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))
MAX_CHUNK_CHARS = int(os.getenv("MAX_CHUNK_CHARS", "3000"))

_chroma_path_env = os.getenv("CHROMA_PATH", "./data/chroma_db")
CHROMA_PATH = str((BOT_ROOT / _chroma_path_env).resolve())

# ══════════════════════════════════════════════════════════════════════════════
# AGENT SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

MAX_AGENT_ITERATIONS = int(os.getenv("MAX_AGENT_ITERATIONS", "12"))
USE_AGENT_FOR_DATA_QUERIES = os.getenv("USE_AGENT_FOR_DATA", "true").lower() == "true"

# Conversation history — how many turns to keep in context
MAX_CONVERSATION_TURNS = int(os.getenv("MAX_CONVERSATION_TURNS", "10"))

# ══════════════════════════════════════════════════════════════════════════════
# FILE INDEXING FILTERS
# ══════════════════════════════════════════════════════════════════════════════

SKIP_FOLDERS = frozenset({
    "node_modules", ".git", "dist", "build", ".vite", ".turbo", ".workspace",
    ".tanstack", "coverage", ".vercel", ".render", "erp_bot", "venv", ".venv",
    "__pycache__", "vendor", "migrations", ".husky", ".github", ".next", ".cache",
})

# Relative path prefixes excluded from erp_codebase index (training/NLU data, not source)
SKIP_RELATIVE_PREFIXES = frozenset({
    "data/nepal-ai",
    "data/ekhata",
})

CODE_EXTENSIONS = frozenset({".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"})
SQL_EXTENSIONS = frozenset({".sql"})
FALLBACK_EXTENSIONS = frozenset({".css", ".html", ".json", ".yml", ".yaml", ".toml"})
WHOLE_FILE_EXTENSIONS = frozenset({".md"})
WHOLE_FILE_FILENAMES = frozenset({
    "package.json", "tsconfig.json", "tsconfig.node.json", "components.json",
    "vite.config.ts", "docker-compose.yml", "render.yaml", "vercel.json",
    "eslint.config.js", "bunfig.toml", "pnpm-workspace.yaml",
})
EXCLUDE_FILENAMES = frozenset({
    "package-lock.json", "pnpm-lock.yaml", "bun.lock", "yarn.lock",
})
MAX_FILE_BYTES = 1_500_000

# ══════════════════════════════════════════════════════════════════════════════
# STARTUP LOG
# ══════════════════════════════════════════════════════════════════════════════

print(f"[CONFIG] ERP_PATH resolved to: {ERP_PATH}")
print(f"[CONFIG] CONVERSATIONAL_MODEL: {CONVERSATIONAL_MODEL}")
print(f"[CONFIG] FAST_MODEL: {FAST_MODEL}")
print(f"[CONFIG] CONTEXT_SIZE: {CONTEXT_SIZE}")
print(f"[CONFIG] Temperature: {CONVERSATIONAL_MODEL_OPTIONS['temperature']}")
