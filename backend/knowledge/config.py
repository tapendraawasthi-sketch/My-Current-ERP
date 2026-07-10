"""Knowledge pipeline configuration."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_PROJECT_ROOT = _BACKEND_ROOT.parent
load_dotenv(_BACKEND_ROOT / ".env", override=False)
load_dotenv(_PROJECT_ROOT / ".env", override=False)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
REDIS_URL = os.getenv("REDIS_URL", "").strip()

KNOWLEDGE_CHROMA_PATH = os.getenv(
    "KNOWLEDGE_CHROMA_PATH",
    str(_PROJECT_ROOT / "erp_bot" / "data" / "chroma_db"),
)
KNOWLEDGE_COLLECTION = os.getenv("KNOWLEDGE_COLLECTION", "tenant_documents")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

CHUNK_SIZE = int(os.getenv("KNOWLEDGE_CHUNK_SIZE", "1200"))
CHUNK_OVERLAP = int(os.getenv("KNOWLEDGE_CHUNK_OVERLAP", "200"))
EMBED_BATCH_SIZE = int(os.getenv("KNOWLEDGE_EMBED_BATCH_SIZE", "50"))

WORKER_ENABLED = os.getenv("KNOWLEDGE_WORKER_ENABLED", "true").lower() in {
    "1",
    "true",
    "yes",
}
WORKER_POLL_INTERVAL_SEC = float(os.getenv("KNOWLEDGE_WORKER_POLL_INTERVAL_SEC", "2"))
JOB_MAX_ATTEMPTS = int(os.getenv("KNOWLEDGE_JOB_MAX_ATTEMPTS", "5"))
RETRY_BASE_DELAY_SEC = float(os.getenv("KNOWLEDGE_RETRY_BASE_DELAY_SEC", "30"))

OCR_MIME_PREFIXES = ("image/",)
OCR_PDF_SCAN_THRESHOLD_CHARS = int(
    os.getenv("KNOWLEDGE_OCR_PDF_SCAN_THRESHOLD_CHARS", "50")
)

R2_KNOWLEDGE_PREFIX = os.getenv("R2_KNOWLEDGE_PREFIX", "knowledge")
