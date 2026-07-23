import { useState, useCallback } from 'react';

export interface PageSelectionState {
  selectedPages: Set<number>;
  togglePage: (pageNum: number) => void;
  selectAll: (totalPages: number) => void;
  deselectAll: () => void;
  selectRange: (start: number, end: number) => void;
  selectedCount: number;
}

export function usePageSelection(): PageSelectionState {
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

  const togglePage = useCallback((pageNum: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((totalPages: number) => {
    const all = new Set<number>();
    for (let i = 1; i <= totalPages; i++) {
      all.add(i);
    }
    setSelectedPages(all);
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedPages(new Set());
  }, []);

  const selectRange = useCallback((start: number, end: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      const [s, e] = start < end ? [start, end] : [end, start];
      for (let i = s; i <= e; i++) {
        next.add(i);
      }
      return next;
    });
  }, []);

  const selectedCount = selectedPages.size;

  return {
    selectedPages,
    togglePage,
    selectAll,
    deselectAll,
    selectRange,
    selectedCount,
  };
}
