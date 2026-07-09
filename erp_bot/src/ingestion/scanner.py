"""Walk ERP_PATH and return every file worth indexing."""

from __future__ import annotations

import os
from collections import Counter
from pathlib import Path

from ..config import (
    CODE_EXTENSIONS,
    ERP_PATH,
    EXCLUDE_FILENAMES,
    FALLBACK_EXTENSIONS,
    MAX_FILE_BYTES,
    SKIP_FOLDERS,
    SKIP_RELATIVE_PREFIXES,
    SQL_EXTENSIONS,
    WHOLE_FILE_EXTENSIONS,
    WHOLE_FILE_FILENAMES,
)


def _relative_path(path: Path, base_path: Path) -> str:
    try:
        return str(path.relative_to(base_path)).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


def _should_skip_file(path: Path, base_path: Path) -> bool:
    rel = _relative_path(path, base_path)
    return any(rel == prefix or rel.startswith(prefix + "/") for prefix in SKIP_RELATIVE_PREFIXES)


def get_all_files(base_path: Path | None = None) -> list[Path]:
    """Return absolute paths of all files worth indexing under base_path."""
    if base_path is None:
        base_path = ERP_PATH

    files: list[Path] = []
    allowed_extensions = (
        CODE_EXTENSIONS | SQL_EXTENSIONS | FALLBACK_EXTENSIONS | WHOLE_FILE_EXTENSIONS
    )

    for root, dirs, filenames in os.walk(base_path):
        dirs[:] = [d for d in dirs if d not in SKIP_FOLDERS]

        for filename in filenames:
            if filename in EXCLUDE_FILENAMES:
                continue

            path = Path(root) / filename

            if _should_skip_file(path, base_path):
                continue

            try:
                if path.stat().st_size > MAX_FILE_BYTES:
                    continue
            except OSError:
                continue

            ext = path.suffix.lower()
            if filename in WHOLE_FILE_FILENAMES or ext in allowed_extensions:
                files.append(path.resolve())

    return files


def classify(file_path: Path) -> str:
    """Classify a file into an indexing category."""
    filename = file_path.name
    ext = file_path.suffix.lower()

    if filename in WHOLE_FILE_FILENAMES or ext in WHOLE_FILE_EXTENSIONS:
        return "whole_file"
    if ext in CODE_EXTENSIONS:
        return "code"
    if ext in SQL_EXTENSIONS:
        return "sql"
    if ext in FALLBACK_EXTENSIONS:
        return "fallback"
    return "skip"


def get_file_language(file_path: Path) -> str:
    """Map file extension to a language label."""
    ext = file_path.suffix.lower()
    mapping = {
        ".ts": "typescript",
        ".tsx": "typescript",
        ".js": "javascript",
        ".jsx": "javascript",
        ".mjs": "javascript",
        ".cjs": "javascript",
        ".sql": "sql",
        ".md": "markdown",
        ".css": "css",
        ".html": "html",
        ".json": "json",
        ".yml": "yaml",
        ".yaml": "yaml",
        ".toml": "toml",
    }
    return mapping.get(ext, "unknown")


if __name__ == "__main__":
    all_files = get_all_files()
    counts = Counter(classify(f) for f in all_files)
    ext_counts = Counter(f.suffix.lower() for f in all_files)

    print(f"Total files found: {len(all_files)}")
    print("\nBy category:")
    for category, count in sorted(counts.items()):
        print(f"  {category}: {count}")

    print("\nBy extension (top):")
    for ext, count in ext_counts.most_common(15):
        print(f"  {ext or '(no ext)'}: {count}")

    tsx_count = ext_counts.get(".tsx", 0)
    ts_count = ext_counts.get(".ts", 0)
    js_count = sum(ext_counts.get(e, 0) for e in (".js", ".jsx", ".mjs", ".cjs"))
    print(f"\nKey counts: .tsx={tsx_count}, .ts={ts_count}, .js*={js_count}")
