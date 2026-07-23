import { useState, useCallback } from 'react';

export type DocToolId =
  | 'metadata'
  | 'watermark-text'
  | 'watermark-image'
  | 'page-numbers'
  | 'add-pages'
  | 'info'
  | 'export-images'
  | 'extract-text'
  | 'encrypt'
  | 'decrypt';

export interface DocToolDefinition {
  id: DocToolId;
  label: string;
  icon: string;
  /** true if the tool opens a modal for input */
  needsModal: boolean;
}

export const DOC_TOOLS: DocToolDefinition[] = [
  {
    id: 'info',
    label: 'Info',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    needsModal: true,
  },
  {
    id: 'metadata',
    label: 'Metadata',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    needsModal: true,
  },
  {
    id: 'watermark-text',
    label: 'Watermark',
    icon: 'M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4',
    needsModal: true,
  },
  {
    id: 'watermark-image',
    label: 'Watermark img',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    needsModal: true,
  },
  {
    id: 'page-numbers',
    label: 'Numera pagine',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    needsModal: true,
  },
  {
    id: 'add-pages',
    label: 'Aggiungi pagine',
    icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
    needsModal: true,
  },
  {
    id: 'export-images',
    label: 'Esporta PNG',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M4 4h16v16H4V4z',
    needsModal: false,
  },
  {
    id: 'extract-text',
    label: 'Estrai testo',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    needsModal: false,
  },
  {
    id: 'encrypt',
    label: 'Cifra',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    needsModal: true,
  },
  {
    id: 'decrypt',
    label: 'Decifra',
    icon: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
    needsModal: true,
  },
];

export interface DocToolState {
  activeDocTool: DocToolId | null;
  setActiveDocTool: (tool: DocToolId | null) => void;
  activeDocToolDef: DocToolDefinition | null;
  /** Which modal is open (if any) */
  modalOpen: DocToolId | null;
  openModal: (tool: DocToolId) => void;
  closeModal: () => void;
}

export function useDocToolState(): DocToolState {
  const [activeDocTool, setActiveDocTool] = useState<DocToolId | null>(null);
  const [modalOpen, setModalOpen] = useState<DocToolId | null>(null);

  const activeDocToolDef =
    DOC_TOOLS.find((t) => t.id === activeDocTool) ?? null;

  const openModal = useCallback(
    (tool: DocToolId) => {
      setActiveDocTool(tool);
      setModalOpen(tool);
    },
    [],
  );

  const closeModal = useCallback(() => {
    setModalOpen(null);
  }, []);

  return {
    activeDocTool,
    setActiveDocTool,
    activeDocToolDef,
    modalOpen,
    openModal,
    closeModal,
  };
}
