import { useState, useCallback } from 'react';

export type ToolId =
  | 'extract'
  | 'insertreplace'
  | 'delete'
  | 'rotate'
  | 'copymove'
  | 'reverse'
  | 'split'
  | 'merge'
  | 'reorder'
  | 'compose';

/** Which page-tool modal is currently open. */
export type PageModalId =
  | 'extract'
  | 'insertreplace'
  | 'delete'
  | 'copymove'
  | 'rotate'
  | 'reverse'
  | 'split'
  | 'merge'
  | 'compose'
  | null;

export interface ToolDefinition {
  id: ToolId;
  label: string;
  icon: string;
  needsSelection: boolean;
  needsPagesInput: boolean;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: 'extract',
    label: 'Extract',
    icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    needsSelection: false,
    needsPagesInput: false,
  },
  {
    id: 'insertreplace',
    label: 'Insert / Replace',
    icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
    needsSelection: false,
    needsPagesInput: false,
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    needsSelection: false,
    needsPagesInput: false,
  },
  {
    id: 'rotate',
    label: 'Rotate',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    needsSelection: false,
    needsPagesInput: false,
  },
  {
    id: 'copymove',
    label: 'Copy / Move',
    icon: 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2',
    needsSelection: false,
    needsPagesInput: false,
  },
  {
    id: 'reverse',
    label: 'Reverse',
    icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4',
    needsSelection: false,
    needsPagesInput: false,
  },
  {
    id: 'split',
    label: 'Split',
    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
    needsSelection: false,
    needsPagesInput: false,
  },
  {
    id: 'merge',
    label: 'Merge',
    icon: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V4a1 1 0 00-1-1H4a1 1 0 00-1 1v12m17-4h-2a1 1 0 01-1-1V5a1 1 0 011-1h2a1 1 0 011 1v7a1 1 0 01-1 1z',
    needsSelection: false,
    needsPagesInput: false,
  },
  {
    id: 'compose',
    label: 'Extract & Montage',
    icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 13a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z',
    needsSelection: false,
    needsPagesInput: false,
  },
  {
    id: 'reorder',
    label: 'Reorder',
    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16M8 6v12',
    needsSelection: false,
    needsPagesInput: false,
  },
];

export interface ToolState {
  activeTool: ToolId;
  setActiveTool: (tool: ToolId) => void;
  activeToolDef: ToolDefinition;
  /** Which page-tool modal is currently open, if any. */
  pageModalOpen: PageModalId;
  openPageModal: (id: PageModalId) => void;
  closePageModal: () => void;
  /** Reorder is a tool that toggles a mode on the thumbnail grid, not a modal. */
  isReorderMode: boolean;
  enterReorderMode: () => void;
  exitReorderMode: () => void;
}

export function useToolState(): ToolState {
  const [activeTool, setActiveTool] = useState<ToolId>('extract');
  const [pageModalOpen, setPageModalOpen] = useState<PageModalId>(null);

  const activeToolDef = TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0];

  const openPageModal = useCallback((id: PageModalId) => {
    setPageModalOpen(id);
  }, []);

  const closePageModal = useCallback(() => {
    setPageModalOpen(null);
  }, []);

  const [isReorderMode, setIsReorderMode] = useState(false);
  const enterReorderMode = useCallback(() => setIsReorderMode(true), []);
  const exitReorderMode = useCallback(() => setIsReorderMode(false), []);

  return {
    activeTool,
    setActiveTool: useCallback((tool: ToolId) => {
      setActiveTool(tool);
      setPageModalOpen(null);
    }, []),
    activeToolDef,
    pageModalOpen,
    openPageModal,
    closePageModal,
    isReorderMode,
    enterReorderMode,
    exitReorderMode,
  };
}
