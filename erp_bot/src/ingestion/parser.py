"""Dispatch each file to the right chunking strategy and produce CodeChunk objects."""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter

from ..config import CHUNK_OVERLAP, CHUNK_SIZE, ERP_PATH, MAX_CHUNK_CHARS
from .scanner import classify, get_file_language
from .ts_chunker import chunk_source


@dataclass
class CodeChunk:
    text: str
    metadata: dict


def _relative(file_path: Path) -> str:
    try:
        return str(file_path.relative_to(ERP_PATH))
    except ValueError:
        return str(file_path)


def _cap_size(text: str, base_metadata: dict) -> list[CodeChunk]:
    if len(text) <= MAX_CHUNK_CHARS:
        return [CodeChunk(text=text, metadata=base_metadata)]

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )
    splits = splitter.split_text(text)
    out: list[CodeChunk] = []
    for i, split_text in enumerate(splits):
        if not split_text.strip():
            continue
        meta = {**base_metadata, "chunk_id": f'{base_metadata["chunk_id"]}::part{i}'}
        out.append(CodeChunk(text=split_text, metadata=meta))
    return out


def chunk_file(file_path: Path) -> list[CodeChunk]:
    category = classify(file_path)
    if category == "skip":
        return []

    try:
        raw_bytes = file_path.read_bytes()
    except OSError:
        return []

    rel = _relative(file_path)
    language = get_file_language(file_path)
    ext = file_path.suffix.lower()

    if category == "whole_file":
        try:
            text = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return []
        base_meta = {
            "source": rel,
            "language": language,
            "function_name": "",
            "class_name": "",
            "kind": "whole_file",
            "start_line": 1,
            "end_line": text.count("\n") + 1,
            "chunk_id": f"{rel}::whole",
        }
        return _cap_size(text, base_meta)

    if category == "sql":
        try:
            text = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return []
        statements = [s.strip() for s in text.split(";") if s.strip()]
        out: list[CodeChunk] = []
        for i, stmt in enumerate(statements):
            base_meta = {
                "source": rel,
                "language": "sql",
                "function_name": "",
                "class_name": "",
                "kind": "sql_statement",
                "start_line": 0,
                "end_line": 0,
                "chunk_id": f"{rel}::stmt{i}",
            }
            out.extend(_cap_size(stmt, base_meta))
        return out

    if category == "code":
        try:
            raw_chunks = chunk_source(raw_bytes, ext)
        except Exception:
            raw_chunks = []
        if not raw_chunks:
            try:
                text = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                return []
            base_meta = {
                "source": rel,
                "language": language,
                "function_name": "",
                "class_name": "",
                "kind": "fallback_whole_file",
                "start_line": 1,
                "end_line": text.count("\n") + 1,
                "chunk_id": f"{rel}::whole",
            }
            return _cap_size(text, base_meta)

        out: list[CodeChunk] = []
        for rc in raw_chunks:
            base_meta = {
                "source": rel,
                "language": language,
                "function_name": rc.name,
                "class_name": rc.class_name,
                "kind": rc.kind,
                "start_line": rc.start_line,
                "end_line": rc.end_line,
                "chunk_id": f"{rel}::{rc.class_name}::{rc.name}::{rc.start_line}",
            }
            out.extend(_cap_size(rc.text, base_meta))
        return out

    # category == "fallback"
    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )
    out: list[CodeChunk] = []
    for i, split_text in enumerate(splitter.split_text(text)):
        if not split_text.strip():
            continue
        out.append(CodeChunk(
            text=split_text,
            metadata={
                "source": rel,
                "language": language,
                "function_name": "",
                "class_name": "",
                "kind": "text_split",
                "start_line": 0,
                "end_line": 0,
                "chunk_id": f"{rel}::split{i}",
            },
        ))
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m src.ingestion.parser <file-path>")
        sys.exit(1)

    target = Path(sys.argv[1])
    if not target.is_absolute():
        target = ERP_PATH / target

    chunks = chunk_file(target)
    print(f"File: {target}")
    print(f"Chunks produced: {len(chunks)}")
    for i, chunk in enumerate(chunks):
        preview = chunk.text[:200].replace("\n", "\\n")
        name = chunk.metadata.get("function_name") or chunk.metadata.get("kind")
        print(f"\n--- Chunk {i + 1} ({name}) ---")
        print(preview)
