"""Phase 3 — ChromaDB vector store for Nepal accounting/tax knowledge.

This module provides:
1. Markdown file ingestion with intelligent chunking
2. Semantic search over Nepal-specific knowledge
3. Source citation for RAG answers

The knowledge base replaces the JSONL template corpus as the runtime
source of truth. JSONL data becomes optional fine-tuning data only.
"""

from __future__ import annotations

import hashlib
import logging
import re
import threading
from pathlib import Path
from typing import Generator

import chromadb
from langchain_ollama import OllamaEmbeddings

from ..config import CHROMA_PATH, EMBED_MODEL, OLLAMA_BASE_URL
from ..knowledge.embed_cache import embed_query_cached

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# CHROMA CLIENT
# ══════════════════════════════════════════════════════════════════════════════

_client = chromadb.PersistentClient(path=CHROMA_PATH)
_embedder = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
_write_lock = threading.Lock()

COLLECTION_NAME = "nepal_knowledge"

# Knowledge directory (markdown files)
_BOT_ROOT = Path(__file__).resolve().parent.parent.parent
KNOWLEDGE_DIR = _BOT_ROOT / "knowledge" / "nepal"

# Meta/router docs — not embedded as RAG chunks
SKIP_INDEX_FILES = frozenset({"README.md", "quick_reference.md"})


def get_collection():
    """Get or create the Nepal knowledge collection."""
    return _client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "Nepal accounting, tax, and fiscal knowledge base"},
    )


# ══════════════════════════════════════════════════════════════════════════════
# MARKDOWN CHUNKING
# ══════════════════════════════════════════════════════════════════════════════

# Chunking parameters
CHUNK_SIZE = 1200  # Target chunk size in characters
CHUNK_OVERLAP = 200  # Overlap between chunks
MIN_CHUNK_SIZE = 100  # Minimum chunk size to keep


def _extract_title(content: str) -> str:
    """Extract the main title from markdown content."""
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return "Untitled"


def _split_by_headers(content: str) -> Generator[tuple[str, str, int], None, None]:
    """Split markdown by headers, yielding (section_title, section_content, level).
    
    Maintains header hierarchy for better context.
    """
    lines = content.split("\n")
    current_section = ""
    current_content: list[str] = []
    current_level = 0
    
    for line in lines:
        # Check for header
        header_match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if header_match:
            # Yield previous section if exists
            if current_content:
                text = "\n".join(current_content).strip()
                if len(text) >= MIN_CHUNK_SIZE:
                    yield (current_section, text, current_level)
            
            # Start new section
            level = len(header_match.group(1))
            title = header_match.group(2).strip()
            current_section = title
            current_level = level
            current_content = []
        else:
            current_content.append(line)
    
    # Yield final section
    if current_content:
        text = "\n".join(current_content).strip()
        if len(text) >= MIN_CHUNK_SIZE:
            yield (current_section, text, current_level)


def _chunk_text(text: str, max_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks, respecting paragraph boundaries."""
    if len(text) <= max_size:
        return [text]
    
    # Split by paragraphs first
    paragraphs = re.split(r"\n\n+", text)
    
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_size = 0
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        para_size = len(para)
        
        # If single paragraph exceeds max, split by sentences
        if para_size > max_size:
            # Flush current chunk
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = []
                current_size = 0
            
            # Split paragraph by sentences
            sentences = re.split(r"(?<=[.!?])\s+", para)
            sent_chunk: list[str] = []
            sent_size = 0
            
            for sent in sentences:
                if sent_size + len(sent) > max_size and sent_chunk:
                    chunks.append(" ".join(sent_chunk))
                    # Overlap: keep last sentence
                    sent_chunk = [sent_chunk[-1]] if sent_chunk else []
                    sent_size = len(sent_chunk[0]) if sent_chunk else 0
                sent_chunk.append(sent)
                sent_size += len(sent)
            
            if sent_chunk:
                chunks.append(" ".join(sent_chunk))
            continue
        
        # Check if adding paragraph exceeds limit
        if current_size + para_size > max_size and current_chunk:
            chunks.append("\n\n".join(current_chunk))
            # Overlap: keep last paragraph if small enough
            if para_size < overlap:
                current_chunk = [current_chunk[-1], para]
                current_size = len(current_chunk[0]) + para_size
            else:
                current_chunk = [para]
                current_size = para_size
        else:
            current_chunk.append(para)
            current_size += para_size
    
    # Final chunk
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))
    
    return chunks


def chunk_markdown_file(filepath: Path) -> list[dict]:
    """Chunk a markdown file into searchable pieces with metadata.
    
    Returns list of:
    {
        "id": str,           # Unique chunk ID
        "text": str,         # Chunk content
        "source": str,       # Source filename
        "section": str,      # Section header
        "title": str,        # Document title
    }
    """
    content = filepath.read_text(encoding="utf-8")
    filename = filepath.name
    doc_title = _extract_title(content)
    
    chunks: list[dict] = []
    
    # Split by sections, then chunk each section
    for section_title, section_content, level in _split_by_headers(content):
        # Skip disclaimer blocks
        if section_content.strip().startswith("> ⚠️"):
            disclaimer_end = section_content.find("\n\n")
            if disclaimer_end > 0:
                section_content = section_content[disclaimer_end:].strip()
        
        # Chunk the section content
        for i, chunk_text in enumerate(_chunk_text(section_content)):
            # Generate stable ID from content hash
            chunk_id = hashlib.md5(
                f"{filename}:{section_title}:{i}:{chunk_text[:100]}".encode()
            ).hexdigest()[:16]
            
            chunks.append({
                "id": f"nepal-{filename.replace('.md', '')}-{chunk_id}",
                "text": chunk_text,
                "source": filename,
                "section": section_title,
                "title": doc_title,
                "level": level,
            })
    
    return chunks


# ══════════════════════════════════════════════════════════════════════════════
# INGESTION
# ══════════════════════════════════════════════════════════════════════════════

def ingest_nepal_knowledge(force_reindex: bool = False) -> dict:
    """Ingest all markdown files from the Nepal knowledge directory.
    
    Args:
        force_reindex: If True, clear existing index and reindex all files
    
    Returns:
        Status dict with counts
    """
    if not KNOWLEDGE_DIR.exists():
        return {"status": "error", "message": f"Knowledge directory not found: {KNOWLEDGE_DIR}"}
    
    # Get all markdown files (including facts/ subfolder; skip meta docs)
    md_files = sorted(
        p
        for p in KNOWLEDGE_DIR.rglob("*.md")
        if p.name not in SKIP_INDEX_FILES
    )
    if not md_files:
        return {"status": "skipped", "message": "No markdown files found", "files": 0}
    
    collection = get_collection()
    
    # Clear if force reindex
    if force_reindex:
        try:
            _client.delete_collection(COLLECTION_NAME)
            collection = get_collection()
            logger.info("Cleared existing Nepal knowledge index")
        except Exception as e:
            logger.warning(f"Failed to clear collection: {e}")
    
    # Check if already indexed
    if not force_reindex and collection.count() > 0:
        return {
            "status": "ready",
            "message": "Index already populated",
            "chunks": collection.count(),
            "files": len(md_files),
        }
    
    # Chunk all files
    all_chunks: list[dict] = []
    for md_file in md_files:
        try:
            chunks = chunk_markdown_file(md_file)
            all_chunks.extend(chunks)
            logger.info(f"Chunked {md_file.name}: {len(chunks)} chunks")
        except Exception as e:
            logger.error(f"Failed to chunk {md_file}: {e}")
    
    if not all_chunks:
        return {"status": "error", "message": "No chunks generated"}
    
    # Embed and upsert in batches
    batch_size = 32
    indexed = 0
    
    try:
        for i in range(0, len(all_chunks), batch_size):
            batch = all_chunks[i : i + batch_size]
            
            texts = [c["text"] for c in batch]
            ids = [c["id"] for c in batch]
            metadatas = [
                {
                    "source": c["source"],
                    "section": c["section"],
                    "title": c["title"],
                    "level": c.get("level", 1),
                }
                for c in batch
            ]
            
            # Generate embeddings
            embeddings = _embedder.embed_documents(texts)
            
            # Upsert to collection
            with _write_lock:
                collection.upsert(
                    ids=ids,
                    embeddings=embeddings,
                    documents=texts,
                    metadatas=metadatas,
                )
            
            indexed += len(batch)
            logger.info(f"Indexed {indexed}/{len(all_chunks)} chunks")
        
        return {
            "status": "indexed",
            "chunks": indexed,
            "files": len(md_files),
            "embed_model": EMBED_MODEL,
        }
    except Exception as e:
        logger.exception("Ingestion failed")
        return {"status": "error", "message": str(e), "chunks": indexed}


# ══════════════════════════════════════════════════════════════════════════════
# SEARCH
# ══════════════════════════════════════════════════════════════════════════════

def search_nepal_knowledge(query: str, k: int = 5) -> list[dict]:
    """Semantic search over Nepal accounting/tax knowledge.
    
    Args:
        query: Search query
        k: Number of results to return
    
    Returns:
        List of matching chunks with metadata
    """
    try:
        collection = get_collection()
        if collection.count() == 0:
            logger.warning("Nepal knowledge index is empty")
            return []
        
        # Embed query
        query_vec = embed_query_cached(query)
        
        # Search
        result = collection.query(
            query_embeddings=[query_vec],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )
        
        docs = result.get("documents", [[]])[0]
        metas = result.get("metadatas", [[]])[0]
        dists = result.get("distances", [[]])[0]
        
        hits: list[dict] = []
        for doc, meta, dist in zip(docs, metas, dists):
            hits.append({
                "text": doc,
                "source": meta.get("source", "unknown"),
                "section": meta.get("section", ""),
                "title": meta.get("title", ""),
                "distance": dist,
                "relevance": max(0, 1 - dist),  # Convert distance to relevance score
            })
        
        return hits
    except Exception as e:
        logger.exception("Search failed")
        return []


def format_nepal_context(hits: list[dict], max_chars: int = 4000) -> str:
    """Format search results for LLM context injection.
    
    Args:
        hits: Search results from search_nepal_knowledge
        max_chars: Maximum characters to include
    
    Returns:
        Formatted context string with source citations
    """
    if not hits:
        return ""
    
    lines = [
        "[NEPAL ACCOUNTING & TAX KNOWLEDGE — Retrieved from knowledge base]",
        "Cite source files when answering. Rates/rules may have changed; advise verification with IRD.",
        "",
    ]
    
    total_chars = sum(len(line) for line in lines)
    
    for hit in hits:
        source = hit.get("source", "unknown")
        section = hit.get("section", "")
        text = hit.get("text", "").strip()
        relevance = hit.get("relevance", 0)
        
        if not text:
            continue
        
        # Header
        header = f"--- [{source}] {section} (relevance: {relevance:.2f}) ---"
        
        # Truncate if needed
        remaining = max_chars - total_chars - len(header) - 10
        if remaining <= 0:
            break
        
        if len(text) > remaining:
            text = text[:remaining] + "..."
        
        lines.append(header)
        lines.append(text)
        lines.append("")
        
        total_chars += len(header) + len(text) + 2
    
    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
# UTILITIES
# ══════════════════════════════════════════════════════════════════════════════

def get_nepal_knowledge_count() -> int:
    """Get the number of chunks in the index."""
    try:
        return get_collection().count()
    except Exception:
        return 0


def list_knowledge_files() -> list[str]:
    """List all markdown files in the knowledge directory."""
    if not KNOWLEDGE_DIR.exists():
        return []
    return [f.name for f in KNOWLEDGE_DIR.glob("*.md")]


def get_knowledge_stats() -> dict:
    """Get statistics about the knowledge base."""
    return {
        "collection": COLLECTION_NAME,
        "chunks": get_nepal_knowledge_count(),
        "files": list_knowledge_files(),
        "knowledge_dir": str(KNOWLEDGE_DIR),
        "embed_model": EMBED_MODEL,
    }
