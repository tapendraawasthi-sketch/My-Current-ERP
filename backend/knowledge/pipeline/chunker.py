"""Text chunking for knowledge documents."""

from __future__ import annotations

import hashlib
import re
from uuid import UUID

from langchain_text_splitters import RecursiveCharacterTextSplitter

from backend.knowledge.config import CHUNK_OVERLAP, CHUNK_SIZE
from backend.knowledge.models import TextChunk


class MarkdownChunker:
    """Splits markdown into overlapping chunks for embedding."""

    def __init__(
        self,
        chunk_size: int = CHUNK_SIZE,
        chunk_overlap: int = CHUNK_OVERLAP,
    ) -> None:
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n## ", "\n### ", "\n\n", "\n", " ", ""],
        )

    def chunk(self, markdown: str, *, document_id: UUID) -> list[TextChunk]:
        sections = self._split_by_headers(markdown)
        chunks: list[TextChunk] = []
        index = 0
        for section_title, section_text in sections:
            for piece in self._splitter.split_text(section_text):
                piece = piece.strip()
                if len(piece) < 80:
                    continue
                text_hash = hashlib.sha256(piece.encode()).hexdigest()
                token_est = len(re.findall(r"\S+", piece))
                chunks.append(
                    TextChunk(
                        index=index,
                        text=piece,
                        text_hash=text_hash,
                        token_estimate=token_est,
                        metadata={
                            "document_id": str(document_id),
                            "section_title": section_title,
                            "chunk_index": index,
                        },
                    )
                )
                index += 1
        return chunks

    @staticmethod
    def _split_by_headers(markdown: str) -> list[tuple[str, str]]:
        lines = markdown.split("\n")
        sections: list[tuple[str, str]] = []
        title = "Document"
        buf: list[str] = []
        for line in lines:
            if line.startswith("#"):
                if buf:
                    sections.append((title, "\n".join(buf).strip()))
                    buf = []
                title = line.lstrip("#").strip() or title
            else:
                buf.append(line)
        if buf:
            sections.append((title, "\n".join(buf).strip()))
        if not sections:
            sections.append(("Document", markdown))
        return sections
