"""Single source of truth for all erp_bot configuration."""

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

MODEL_NAME = os.getenv("MODEL_NAME", "qwen2.5:7b-instruct")
KHATA_STRUCTURED_PARSE = os.getenv("KHATA_USE_STRUCTURED_PARSE", "true").lower() == "true"
KHATA_SYNTHESIZE_CONTEXT = os.getenv("KHATA_SYNTHESIZE_CONTEXT", "true").lower() == "true"
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1500"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))
MAX_CHUNK_CHARS = int(os.getenv("MAX_CHUNK_CHARS", "3000"))
MAX_AGENT_ITERATIONS = int(os.getenv("MAX_AGENT_ITERATIONS", "12"))
API_PORT = int(os.getenv("API_PORT", "8765"))

_chroma_path_env = os.getenv("CHROMA_PATH", "./data/chroma_db")
CHROMA_PATH = str((BOT_ROOT / _chroma_path_env).resolve())

SKIP_FOLDERS = frozenset({
    "node_modules", ".git", "dist", "build", ".vite", ".turbo", ".workspace",
    ".tanstack", "coverage", ".vercel", ".render", "erp_bot", "venv", ".venv",
    "__pycache__", "vendor", "migrations", ".husky", ".github", ".next", ".cache",
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

print(f"[CONFIG] ERP_PATH resolved to: {ERP_PATH}")
