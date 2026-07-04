"""Watch ERP_PATH for changes and keep the index in sync with debouncing."""

from __future__ import annotations

import threading
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from ..config import (
    CODE_EXTENSIONS,
    ERP_PATH,
    FALLBACK_EXTENSIONS,
    SKIP_FOLDERS,
    SQL_EXTENSIONS,
    WHOLE_FILE_EXTENSIONS,
    WHOLE_FILE_FILENAMES,
)
from ..ingestion import embedder
from ..vectorstore import chroma_store


def _relative(file_path: Path) -> str:
    try:
        return str(file_path.relative_to(ERP_PATH))
    except ValueError:
        return str(file_path)


def _is_relevant(path_str: str) -> bool:
    parts = Path(path_str).parts
    if any(part in SKIP_FOLDERS for part in parts):
        return False

    path = Path(path_str)
    allowed_ext = CODE_EXTENSIONS | SQL_EXTENSIONS | FALLBACK_EXTENSIONS | WHOLE_FILE_EXTENSIONS
    return path.name in WHOLE_FILE_FILENAMES or path.suffix.lower() in allowed_ext


class ERPEventHandler(FileSystemEventHandler):
    def __init__(self):
        self._pending: dict[str, threading.Timer] = {}
        self._lock = threading.Lock()

    def _debounced(self, path_str: str, action) -> None:
        with self._lock:
            existing = self._pending.get(path_str)
            if existing is not None:
                existing.cancel()
            timer = threading.Timer(1.0, action)
            timer.daemon = True
            timer.start()
            self._pending[path_str] = timer

    def on_modified(self, event):
        if event.is_directory or not _is_relevant(event.src_path):
            return
        print(f"[WATCHER] Modified (debounced): {event.src_path}")
        self._debounced(event.src_path, lambda: self._reindex(event.src_path))

    def on_created(self, event):
        if event.is_directory or not _is_relevant(event.src_path):
            return
        print(f"[WATCHER] Created (debounced): {event.src_path}")
        self._debounced(event.src_path, lambda: self._reindex(event.src_path))

    def on_deleted(self, event):
        if event.is_directory or not _is_relevant(event.src_path):
            return
        print(f"[WATCHER] Deleted: {event.src_path}")
        self._debounced(event.src_path, lambda: self._remove(event.src_path))

    def on_moved(self, event):
        if not event.is_directory:
            self._debounced(event.src_path, lambda: self._remove(event.src_path))
        if _is_relevant(event.dest_path):
            self._debounced(event.dest_path, lambda: self._reindex(event.dest_path))

    def _reindex(self, path_str: str) -> None:
        try:
            result = embedder.ingest_file(Path(path_str))
            print(f"[WATCHER] {result}")
        except Exception as e:
            print(f"[WATCHER ERROR] {e}")

    def _remove(self, path_str: str) -> None:
        try:
            rel = _relative(Path(path_str))
            chroma_store.delete_by_file(rel)
            print(f"[WATCHER] Removed from index: {rel}")
        except Exception as e:
            print(f"[WATCHER ERROR] {e}")


def start_watcher() -> Observer:
    handler = ERPEventHandler()
    observer = Observer()
    observer.schedule(handler, path=str(ERP_PATH), recursive=True)
    observer.daemon = True
    observer.start()
    print(f"[WATCHER] Started watching: {ERP_PATH}")
    return observer
