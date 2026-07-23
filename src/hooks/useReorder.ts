import { useState, useCallback } from 'react';

export interface ReorderState {
  /** Ordered array of 1-based page numbers representing the current order. */
  pageOrder: number[];
  /** Initialize the order from total page count. */
  initializeOrder: (totalPages: number) => void;
  /** Move a page from `fromIndex` to `toIndex` (0-based indices in the array). */
  movePage: (fromIndex: number, toIndex: number) => void;
  /** Swap two pages by their 1-based page numbers. */
  swapPages: (pageA: number, pageB: number) => void;
  /** Reset to original order. */
  resetOrder: (totalPages: number) => void;
}

export function useReorder(): ReorderState {
  const [pageOrder, setPageOrder] = useState<number[]>([]);

  const initializeOrder = useCallback((totalPages: number) => {
    const order: number[] = [];
    for (let i = 1; i <= totalPages; i++) order.push(i);
    setPageOrder(order);
  }, []);

  const movePage = useCallback((fromIndex: number, toIndex: number) => {
    setPageOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const swapPages = useCallback((pageA: number, pageB: number) => {
    setPageOrder((prev) => {
      const idxA = prev.indexOf(pageA);
      const idxB = prev.indexOf(pageB);
      if (idxA === -1 || idxB === -1 || idxA === idxB) return prev;
      const next = [...prev];
      [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
      return next;
    });
  }, []);

  const resetOrder = useCallback((totalPages: number) => {
    initializeOrder(totalPages);
  }, [initializeOrder]);

  return { pageOrder, initializeOrder, movePage, swapPages, resetOrder };
}
