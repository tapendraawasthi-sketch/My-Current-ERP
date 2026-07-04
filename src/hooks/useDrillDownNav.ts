import { useCallback, useRef, useState } from "react";

export interface DrillRow {
  id: string;
  depth: 0 | 1 | 2;
  isLeaf: boolean;
  isExpanded?: boolean;
  parentId: string | null;
  label: string;
}

/**
 * Keyboard navigation hook for a three-level drill-down tree (Group → Sub-Group → Ledger).
 *
 * @param params.visibleRows - Flat array of currently visible tree rows in display order.
 * @param params.onToggleExpand - Called to expand/collapse a group or sub-group row by id.
 * @param params.onOpenLeaf - Called when Enter is pressed on a ledger (leaf) row.
 * @param params.onEscapeToParent - Optional callback when Escape is pressed and focus is at
 *   depth 0 or unset; the calling screen decides what "exit" means.
 * @returns focusedId, setFocusedId, and handleKeyDown to attach to a focusable container.
 */
export function useDrillDownNav(params: {
  visibleRows: DrillRow[];
  onToggleExpand: (id: string) => void;
  onOpenLeaf: (id: string) => void;
  onEscapeToParent?: () => void;
}): {
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
} {
  const { visibleRows, onToggleExpand, onOpenLeaf, onEscapeToParent } = params;
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const typeAheadRef = useRef<{ buffer: string; timer: ReturnType<typeof setTimeout> | null }>({
    buffer: "",
    timer: null,
  });

  const getRow = useCallback(
    (id: string | null) => (id ? visibleRows.find((r) => r.id === id) : undefined),
    [visibleRows],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = focusedId ? visibleRows.findIndex((r) => r.id === focusedId) : -1;
      const currentRow = getRow(focusedId);

      if (e.key === "Escape") {
        if (!focusedId || currentRow?.depth === 0) {
          onEscapeToParent?.();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (visibleRows.length === 0) return;
        const nextIndex =
          currentIndex < 0 ? 0 : Math.min(currentIndex + 1, visibleRows.length - 1);
        setFocusedId(visibleRows[nextIndex].id);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (visibleRows.length === 0) return;
        const prevIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0);
        setFocusedId(visibleRows[prevIndex].id);
        return;
      }

      if (e.key === "ArrowRight" && currentRow && !currentRow.isLeaf && !currentRow.isExpanded) {
        e.preventDefault();
        onToggleExpand(currentRow.id);
        return;
      }

      if (e.key === "ArrowLeft" && currentRow) {
        e.preventDefault();
        if (!currentRow.isLeaf && currentRow.isExpanded) {
          onToggleExpand(currentRow.id);
        } else if (currentRow.parentId) {
          setFocusedId(currentRow.parentId);
        }
        return;
      }

      if (e.key === "Enter" && currentRow) {
        e.preventDefault();
        if (currentRow.isLeaf) {
          onOpenLeaf(currentRow.id);
        } else {
          onToggleExpand(currentRow.id);
        }
        return;
      }

      if (e.key === "Home") {
        e.preventDefault();
        if (visibleRows.length > 0) setFocusedId(visibleRows[0].id);
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        if (visibleRows.length > 0) setFocusedId(visibleRows[visibleRows.length - 1].id);
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key >= " ") {
        e.preventDefault();
        const ta = typeAheadRef.current;
        if (ta.timer) clearTimeout(ta.timer);
        ta.buffer += e.key.toLowerCase();

        const startIndex = currentIndex < 0 ? -1 : currentIndex;
        let matchId: string | null = null;

        for (let offset = 1; offset <= visibleRows.length; offset++) {
          const idx = (startIndex + offset) % visibleRows.length;
          const row = visibleRows[idx];
          if (row.label.toLowerCase().startsWith(ta.buffer)) {
            matchId = row.id;
            break;
          }
        }

        if (matchId) setFocusedId(matchId);

        ta.timer = setTimeout(() => {
          ta.buffer = "";
          ta.timer = null;
        }, 600);
      }
    },
    [focusedId, visibleRows, getRow, onToggleExpand, onOpenLeaf, onEscapeToParent],
  );

  return { focusedId, setFocusedId, handleKeyDown };
}
