import { useRef, useCallback, useState, useEffect, type ReactNode } from 'react';
import { TopBar } from './components/TopBar';
import { DrawerMenu, DrawerSection, DrawerItem, DrawerAction } from './components/DrawerMenu';
import { BottomToolbar, BottomToolbarButton, BottomToolbarSelect, BottomToolbarRotate } from './components/BottomToolbar';
import { PDFUploader } from './components/PDFUploader';
import { UnifiedViewer } from './components/UnifiedViewer';
import { TOCPanel } from './components/TOCPanel';
import { Toast, useToast } from './components/Toast';
import { useResponsiveLayout } from './hooks/useResponsiveLayout';

// Tool modal state hooks
import { useToolState, type PageModalId } from './hooks/useToolState';
import { useDocToolState, type DocToolId } from './hooks/useDocToolState';
// Page tool modals
import { ExtractModal, type ExtractOptions } from './components/modals/ExtractModal';
import { DeleteModal } from './components/modals/DeleteModal';
import { RotateModal } from './components/modals/RotateModal';
import { ReverseModal } from './components/modals/ReverseModal';
import { CopyMoveModal } from './components/modals/CopyMoveModal';
import { SplitModal, type SplitParams } from './components/modals/SplitModal';
import { InsertReplaceModal, type InsertReplaceParams } from './components/modals/InsertReplaceModal';
import { MergeModal } from './components/modals/MergeModal';
import { ComposeModal, type ComposeParams } from './components/modals/ComposeModal';
// Doc tool modals
import { InfoModal } from './components/modals/InfoModal';
import { MetadataModal } from './components/modals/MetadataModal';
import { WatermarkTextModal } from './components/modals/WatermarkTextModal';
import { WatermarkImageModal } from './components/modals/WatermarkImageModal';
import { PageNumbersModal } from './components/modals/PageNumbersModal';
import { AddPagesModal } from './components/modals/AddPagesModal';
import { CryptoModal } from './components/modals/CryptoModal';
import { composePDF } from './lib/pdfComposer';
import { insertPages, replacePages, splitByRanges, splitByMarkers, splitByTOC, type TOCItem } from './lib/pdfOperations';

import { usePDFLoader } from '../src/hooks/usePDFLoader';
import { usePageSelection } from '../src/hooks/usePageSelection';
import { useReorder } from '../src/hooks/useReorder';
import { extractPages, downloadPDF } from '../src/lib/pdfExtractor';
import { encryptPDF, decryptPDF, isEncryptedPDF } from '../src/lib/crypto';
import { extractText, downloadText, exportImagesAsZip } from '../src/lib/export';
import { getOutline } from '../src/lib/pdfRenderer';
import {
  deletePages, rotatePages, reversePages, splitPages,
  reorderPages, downloadZip, duplicatePages, movePages,
  type RotationAngle,
} from '../src/lib/pdfOperations';

// ── All tool definitions ─────────────────────────────────────

const PAGE_TOOLS = [
  { id: 'extract', label: 'Extract', icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'insertreplace', label: 'Insert / Replace', icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'delete', label: 'Delete', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
  { id: 'rotate', label: 'Rotate', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { id: 'copymove', label: 'Copy / Move', icon: 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2' },
  { id: 'reverse', label: 'Reverse', icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
  { id: 'split', label: 'Split', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  { id: 'merge', label: 'Merge', icon: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V4a1 1 0 00-1-1H4a1 1 0 00-1 1v12m17-4h-2a1 1 0 01-1-1V5a1 1 0 011-1h2a1 1 0 011 1v7a1 1 0 01-1 1z' },
  { id: 'compose', label: 'Extract & Montage', icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 13a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z' },
  { id: 'reorder', label: 'Reorder', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16M8 6v12' },
];

const DOC_TOOLS = [
  { id: 'info', label: 'Info', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'metadata', label: 'Metadata', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { id: 'watermark-text', label: 'Watermark', icon: 'M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4' },
  { id: 'watermark-image', label: 'Watermark img', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { id: 'page-numbers', label: 'Numera pagine', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { id: 'add-pages', label: 'Aggiungi pagine', icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'export-images', label: 'Esporta PNG', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M4 4h16v16H4V4z' },
  { id: 'extract-text', label: 'Estrai testo', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'encrypt', label: 'Cifra', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  { id: 'decrypt', label: 'Decifra', icon: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z' },
];

// ── App ──────────────────────────────────────────────────────

export default function App() {
  const { isMobile, isDesktop, isCompact } = useResponsiveLayout();
  const { pdf, pdfBytes, numPages, loading, error, fileName, originalFileName, isModified, loadPDFFromFile, loadPDFFromBytes } = usePDFLoader();
  const { selectedPages, togglePage, selectAll, deselectAll, selectRange, selectedCount } = usePageSelection();
  const reorder = useReorder();
  const { toasts, showToast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(isDesktop);
  const [selectMode, setSelectMode] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const executingRef = useRef(false);
  const [pendingEncryptedBytes, setPendingEncryptedBytes] = useState<ArrayBuffer | null>(null);
  const [scrollToPage, setScrollToPage] = useState<number | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const [activePageTool, setActivePageTool] = useState<string | null>(null);
  const tocNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up pending TOC navigation timer on unmount
  useEffect(() => {
    return () => {
      if (tocNavTimerRef.current) clearTimeout(tocNavTimerRef.current);
    };
  }, []);

  const lastViewerPageRef = useRef(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editorCurrentPage, setEditorCurrentPage] = useState(1);
  const [swapPageA, setSwapPageA] = useState('');
  const [swapPageB, setSwapPageB] = useState('');
  const [rotation, setRotation] = useState(0);
  const rotateCW  = () => setRotation(r => (r + 90) % 360);
  const rotateCCW = () => setRotation(r => (r + 270) % 360);

  useEffect(() => { setDrawerOpen(isDesktop); }, [isDesktop]);

  const hasPDF = pdf !== null && numPages > 0;

  const swapANum = parseInt(swapPageA, 10);
  const swapBNum = parseInt(swapPageB, 10);
  const canSwap = !isNaN(swapANum) && swapANum >= 1 && swapANum <= numPages &&
    !isNaN(swapBNum) && swapBNum >= 1 && swapBNum <= numPages && swapANum !== swapBNum;

  // ── Tool modal state ─────────────────────────────────────
  const tool = useToolState();
  const doc = useDocToolState();
  const [tocItemsForSplit, setTocItemsForSplit] = useState<TOCItem[] | null>(null);
  const [cachedTOCItems, setCachedTOCItems] = useState<TOCItem[] | null>(null);
  const [tocLoading, setTocLoading] = useState(false);

  // Load TOC for Split modal
  useEffect(() => {
    if (tool.pageModalOpen === 'split' && pdf) {
      if (cachedTOCItems && cachedTOCItems.length > 0) {
        setTocItemsForSplit(cachedTOCItems);
        setTocLoading(false);
      } else {
        setTocItemsForSplit(null);
        setTocLoading(true);
        getOutline(pdf).then((items) => { setTocItemsForSplit(items); setCachedTOCItems(items); })
          .catch(() => setTocItemsForSplit([]))
          .finally(() => setTocLoading(false));
      }
    } else if (tool.pageModalOpen !== 'split') {
      setTocItemsForSplit(null);
    }
  }, [tool.pageModalOpen, pdf, cachedTOCItems]);

  // ── Selected pages summary for modal display ────────────
  const selectedPagesSummary = (() => {
    if (selectedCount === 0) return undefined;
    const arr = Array.from(selectedPages).sort((a, b) => a - b);
    if (arr.length <= 8) return arr.join(', ');
    const shown = arr.slice(0, 6).join(', ');
    return `${shown}... (+${arr.length - 6} more)`;
  })();

  // ── Utility: run an async operation with executing guard ───
  const runOp = useCallback(async (fn: () => Promise<void>, label: string) => {
    if (!pdfBytes || executingRef.current) return;
    executingRef.current = true;
    setExecuting(true);
    try { await fn(); showToast('success', `${label} completed`); }
    catch (err: any) { showToast('error', err.message); }
    finally { executingRef.current = false; setExecuting(false); }
  }, [pdfBytes, showToast]);

  // ── File handling ─────────────────────────────────────────
  const handleFileSelect = useCallback((file: File) => {
    deselectAll();
    setSelectMode(false);
    setIsReorderMode(false);
    setCachedTOCItems(null);
    if (isEncryptedPDF(file.name)) {
      file.arrayBuffer().then(buf => { setPendingEncryptedBytes(buf); doc.openModal('decrypt'); });
      return;
    }
    loadPDFFromFile(file);
  }, [loadPDFFromFile, deselectAll, showToast, doc]);

  const handleOpenFile = useCallback(() => fileInputRef.current?.click(), []);

  const reloadPDF = useCallback(async (newBytes: Uint8Array) => {
    const buffer = newBytes.buffer.slice(newBytes.byteOffset, newBytes.byteOffset + newBytes.byteLength) as ArrayBuffer;
    await loadPDFFromBytes(buffer, fileName ?? undefined);
  }, [loadPDFFromBytes, fileName]);

  const handleDownload = useCallback(() => {
    if (!pdfBytes) return;
    const base = originalFileName?.replace(/\.pdf$/i, '') ?? fileName?.replace(/\.pdf$/i, '') ?? 'document';
    downloadPDF(new Uint8Array(pdfBytes), isModified ? `${base}_modified.pdf` : (fileName ?? `${base}.pdf`));
  }, [pdfBytes, fileName, originalFileName, isModified]);

  // ── Page tool modal callbacks ──────────────────────────────

  const handleExtract = useCallback(async (pageNumbers: number[], options: ExtractOptions) => {
    if (!pdfBytes) return;
    setExecuting(true);
    try {
      const pages = pageNumbers.length > 0 ? pageNumbers : Array.from(selectedPages);
      if (pages.length === 0) throw new Error('No pages to extract');
      const base = originalFileName?.replace(/\.pdf$/i, '') ?? fileName?.replace(/\.pdf$/i, '') ?? 'output';
      if (options.outputType === 'single') {
        downloadPDF(await extractPages(pdfBytes, pages), `${base}-extracted.pdf`);
      } else {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        for (let i = 0; i < pages.length; i++) {
          zip.file(`${base}-p${String(i + 1).padStart(3, '0')}-page${pages[i]}.pdf`, await extractPages(pdfBytes, [pages[i]]));
        }
        downloadZip(await zip.generateAsync({ type: 'uint8array' }), `${base}-extracted.zip`);
      }
      if (options.deleteAfter) {
        deselectAll();
        const tocItems = pdf ? await getOutline(pdf) : undefined;
        const result = await deletePages(pdfBytes, pages, tocItems);
        setCachedTOCItems(result.tocItems ?? null);
        await reloadPDF(result.bytes);
      }
    } catch (err: any) { showToast('error', err.message); }
    finally { setExecuting(false); tool.closePageModal(); }
  }, [pdfBytes, selectedPages, fileName, originalFileName, deselectAll, reloadPDF, tool, pdf, showToast]);

  const handleDelete = useCallback(async (pageNumbers: number[]) => {
    if (!pdfBytes) return;
    setExecuting(true);
    try {
      const pages = pageNumbers.length > 0 ? pageNumbers : Array.from(selectedPages);
      if (pages.length === 0) throw new Error('No pages to delete');
      deselectAll();
      setTocLoading(true);
      const tocItems = pdf ? await getOutline(pdf) : undefined;
      setTocLoading(false);
      const result = await deletePages(pdfBytes, pages, tocItems);
      setCachedTOCItems(result.tocItems ?? null);
      await reloadPDF(result.bytes);
    } catch (err: any) { showToast('error', err.message); setTocLoading(false); }
    finally { setExecuting(false); tool.closePageModal(); }
  }, [pdfBytes, selectedPages, deselectAll, reloadPDF, tool, pdf, showToast]);

  const handleRotate = useCallback(async (pageNumbers: number[], angle: RotationAngle) => {
    if (!pdfBytes) return;
    setExecuting(true);
    try {
      const pages = pageNumbers.length > 0 ? pageNumbers : Array.from(selectedPages);
      if (pages.length === 0) throw new Error('No pages to rotate');
      deselectAll();
      const tocItems = pdf ? await getOutline(pdf) : undefined;
      const result = await rotatePages(pdfBytes, pages, angle, tocItems);
      setCachedTOCItems(result.tocItems ?? null);
      await reloadPDF(result.bytes);
    } catch (err: any) { showToast('error', err.message); }
    finally { setExecuting(false); tool.closePageModal(); }
  }, [pdfBytes, selectedPages, deselectAll, reloadPDF, tool, pdf, showToast]);

  const handleReverse = useCallback(async (pageNumbers: number[]) => {
    if (!pdfBytes) return;
    setExecuting(true);
    try {
      const pages = pageNumbers.length > 0 ? pageNumbers : Array.from(selectedPages);
      deselectAll();
      const tocItems = pdf ? await getOutline(pdf) : undefined;
      const result = await reversePages(pdfBytes, pages.length > 0 ? pages : undefined, tocItems);
      setCachedTOCItems(result.tocItems ?? null);
      await reloadPDF(result.bytes);
    } catch (err: any) { showToast('error', err.message); }
    finally { setExecuting(false); tool.closePageModal(); }
  }, [pdfBytes, selectedPages, deselectAll, reloadPDF, tool, pdf, showToast]);

  const handleCopyMove = useCallback(async (
    pageNumbers: number[], copies: number, location: 'before' | 'after',
    targetPage: number, operation: 'copy' | 'move',
  ) => {
    if (!pdfBytes) return;
    setExecuting(true);
    try {
      const pages = pageNumbers.length > 0 ? pageNumbers : Array.from(selectedPages);
      if (pages.length === 0) throw new Error('No pages selected');
      deselectAll();
      const tocItems = pdf ? await getOutline(pdf) : undefined;
      let result;
      if (operation === 'move') {
        result = await movePages(pdfBytes, pages, { location, page: targetPage }, tocItems);
      } else {
        result = await duplicatePages(pdfBytes, pages, copies, { location, page: targetPage }, tocItems);
      }
      setCachedTOCItems(result.tocItems ?? null);
      await reloadPDF(result.bytes);
    } catch (err: any) { showToast('error', err.message); }
    finally { setExecuting(false); tool.closePageModal(); }
  }, [pdfBytes, selectedPages, deselectAll, reloadPDF, tool, pdf, showToast]);

  const handleSplit = useCallback(async (params: SplitParams) => {
    if (!pdfBytes) return;
    setExecuting(true);
    try {
      const base = fileName?.replace(/\.pdf$/i, '') ?? 'document';
      let zipBytes: Uint8Array;
      if (params.mode === 'customRanges' && params.ranges) {
        zipBytes = await splitByRanges(pdfBytes, params.ranges, base, params.filteredPages);
      } else if (params.mode === 'perMarkers' && params.markers) {
        zipBytes = await splitByMarkers(pdfBytes, params.markers, base, params.filteredPages);
      } else if (params.mode === 'perTOC' && params.tocDepth !== undefined && tocItemsForSplit && tocItemsForSplit.length > 0) {
        zipBytes = await splitByTOC(pdfBytes, tocItemsForSplit, params.tocDepth, base, params.filteredPages, params.onProgress);
      } else if (params.mode === 'perPage') {
        zipBytes = await splitPages(pdfBytes, 1, base, params.filteredPages);
      } else {
        const pagesPerChunk = params.mode === 'perPages' ? params.value : Math.ceil(numPages / params.value);
        zipBytes = await splitPages(pdfBytes, pagesPerChunk, base, params.filteredPages);
      }
      downloadZip(zipBytes, `${base}-split.zip`);
    } catch (err: any) { showToast('error', err.message); setTocLoading(false); }
    finally { setExecuting(false); tool.closePageModal(); }
  }, [pdfBytes, fileName, numPages, tool, tocItemsForSplit, showToast]);

  const handleInsertReplace = useCallback(async (params: InsertReplaceParams) => {
    if (!pdfBytes) return;
    setExecuting(true);
    try {
      const tocItems = pdf ? await getOutline(pdf) : undefined;
      let result;
      if (params.operation === 'insert') {
        result = await insertPages(pdfBytes, params.sourceBytes, params.sourcePages, {
          location: params.location, page: params.targetPage,
        }, tocItems);
      } else {
        const pages = params.targetPages.length > 0 ? params.targetPages : Array.from(selectedPages);
        if (pages.length === 0) throw new Error('No target pages selected for replacement');
        result = await replacePages(pdfBytes, params.sourceBytes, pages, params.sourcePages, tocItems);
      }
      deselectAll();
      setCachedTOCItems(result.tocItems ?? null);
      await reloadPDF(result.bytes);
    } catch (err: any) { showToast('error', err.message); }
    finally { setExecuting(false); tool.closePageModal(); }
  }, [pdfBytes, selectedPages, deselectAll, reloadPDF, tool, pdf, showToast]);

  const handleMerge = useCallback(async (entries: { data: ArrayBuffer; name: string }[]) => {
    if (!pdfBytes) return;
    setExecuting(true);
    try {
      const { PDFDocument: PDFDoc } = await import('pdf-lib');
      const mergedDoc = await PDFDoc.create();
      for (const entry of entries) {
        const srcDoc = await PDFDoc.load(entry.data.slice(0), { ignoreEncryption: true });
        const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((p) => mergedDoc.addPage(p));
      }
      const mergedBytes = await mergedDoc.save();
      const buf = (mergedBytes.buffer.slice(mergedBytes.byteOffset, mergedBytes.byteOffset + mergedBytes.byteLength) as ArrayBuffer);
      deselectAll();
      setCachedTOCItems(null);
      await loadPDFFromBytes(buf, 'merged.pdf');
    } catch (err: any) { showToast('error', err.message); }
    finally { setExecuting(false); tool.closePageModal(); }
  }, [pdfBytes, deselectAll, loadPDFFromBytes, tool, showToast]);

  const handleCompose = useCallback(async (params: ComposeParams) => {
    if (!pdfBytes) return;
    setExecuting(true);
    try {
      const bytes = await composePDF(params.chunks, params.sources);
      const buf = (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      deselectAll();
      setCachedTOCItems(null);
      await loadPDFFromBytes(buf, params.outputName || 'composed.pdf');
    } catch (err: any) { showToast('error', err.message); }
    finally { setExecuting(false); tool.closePageModal(); }
  }, [pdfBytes, deselectAll, loadPDFFromBytes, tool, showToast]);

  // ── Doc tool modal callbacks ───────────────────────────────

  const handleMetadataApply = useCallback(async (bytes: Uint8Array) => {
    await reloadPDF(bytes);
    doc.closeModal();
  }, [reloadPDF, doc]);

  const handleWatermarkTextApply = useCallback(async (bytes: Uint8Array) => {
    await reloadPDF(bytes);
    doc.closeModal();
  }, [reloadPDF, doc]);

  const handleWatermarkImageApply = useCallback(async (bytes: Uint8Array) => {
    await reloadPDF(bytes);
    doc.closeModal();
  }, [reloadPDF, doc]);

  const handlePageNumbersApply = useCallback(async (bytes: Uint8Array) => {
    await reloadPDF(bytes);
    doc.closeModal();
  }, [reloadPDF, doc]);

  const handleAddPagesApply = useCallback(async (bytes: Uint8Array) => {
    deselectAll();
    await reloadPDF(bytes);
    doc.closeModal();
  }, [reloadPDF, deselectAll, doc]);

  // ── Crypto handlers ────────────────────────────────────────

  const handleEncrypt = useCallback(async (password: string) => {
    if (!pdfBytes) return;
    setExecuting(true);
    try {
      const encrypted = await encryptPDF(new Uint8Array(pdfBytes), password);
      const blob = new Blob([encrypted as unknown as BlobPart], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const base = originalFileName?.replace(/\.pdf$/i, '') ?? fileName?.replace(/\.pdf$/i, '') ?? 'document';
      a.download = isModified ? `${base}_modified.pdf.enc` : `${base}.pdf.enc`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) { showToast('error', err.message); }
    finally { setExecuting(false); doc.closeModal(); }
  }, [pdfBytes, fileName, originalFileName, isModified, showToast, doc]);

  const handleDecrypt = useCallback(async (password: string) => {
    if (!pendingEncryptedBytes) return;
    setExecuting(true);
    try {
      const decrypted = await decryptPDF(new Uint8Array(pendingEncryptedBytes), password);
      const buf = decrypted.buffer.slice(decrypted.byteOffset, decrypted.byteOffset + decrypted.byteLength) as ArrayBuffer;
      await loadPDFFromBytes(buf, fileName ?? 'decrypted.pdf');
      setPendingEncryptedBytes(null);
      showToast('success', 'PDF decrypted');
    } catch { showToast('error', 'Decryption failed. Wrong password?'); }
    finally { setExecuting(false); doc.closeModal(); }
  }, [pendingEncryptedBytes, loadPDFFromBytes, fileName, showToast, doc]);

  // ── Instant doc tools (no modal) ───────────────────────────

  const toolExportImages = useCallback(async () => {
    if (!pdfBytes) return;
    const base = fileName?.replace(/\.pdf$/i, '') ?? 'output';
    await runOp(async () => {
      const zip = await exportImagesAsZip(pdfBytes, base, 1.5, 'png');
      downloadZip(zip, `${base}-images.zip`);
    }, 'Export PNG');
  }, [pdfBytes, fileName, runOp]);

  const toolExtractText = useCallback(async () => {
    if (!pdfBytes) return;
    const base = fileName?.replace(/\.pdf$/i, '') ?? 'output';
    await runOp(async () => {
      downloadText(await extractText(pdfBytes), `${base}-text.txt`);
    }, 'Extract Text');
  }, [pdfBytes, fileName, runOp]);

  // ── Reorder (inline mode, not a modal) ────────────────────

  const toolReorder = useCallback(() => {
    reorder.initializeOrder(numPages);
    setIsReorderMode(true);
    setActivePageTool('reorder');
    setSelectMode(true);
    setDrawerOpen(false);
    setSwapPageA('');
    setSwapPageB('');
  }, [reorder, numPages]);

  // ── Tool dispatch (open modal for page/doc tools) ────────

  const PAGE_MODAL_IDS = new Set<PageModalId>(['extract', 'insertreplace', 'delete', 'copymove', 'rotate', 'reverse', 'split', 'merge', 'compose']);
  const DOC_MODAL_IDS: Record<string, DocToolId> = {
    info: 'info', metadata: 'metadata', 'watermark-text': 'watermark-text',
    'watermark-image': 'watermark-image', 'page-numbers': 'page-numbers',
    'add-pages': 'add-pages', encrypt: 'encrypt', decrypt: 'decrypt',
  };
  const DOC_INSTANT: Record<string, () => void> = {
    'export-images': toolExportImages, 'extract-text': toolExtractText,
  };

  const handleToolClick = useCallback((id: string) => {
    if (id === 'reorder') { toolReorder(); return; }
    if (PAGE_MODAL_IDS.has(id as PageModalId)) {
      tool.openPageModal(id as PageModalId);
      if (isMobile) setDrawerOpen(false);
      return;
    }
    if (DOC_MODAL_IDS[id]) { doc.openModal(DOC_MODAL_IDS[id]); if (isMobile) setDrawerOpen(false); return; }
    DOC_INSTANT[id]?.();
    if (isMobile) setDrawerOpen(false);
  }, [tool, doc, isMobile, toolReorder, toolExportImages, toolExtractText]);

  // ── Reorder apply ─────────────────────────────────────────

  const handleReorderApply = useCallback(async () => {
    await runOp(async () => {
      const tocItems = pdf ? await getOutline(pdf) : undefined;
      const result = await reorderPages(pdfBytes!, reorder.pageOrder, tocItems);
      setCachedTOCItems(result.tocItems ?? null);
      deselectAll(); await reloadPDF(result.bytes);
      setIsReorderMode(false); setActivePageTool(null); setSelectMode(false);
    }, 'Reorder');
  }, [pdfBytes, pdf, reorder.pageOrder, deselectAll, reloadPDF, runOp]);

  // ── Navigation ────────────────────────────────────────────

  // TOC navigation: defer scrollToPage until after the TOC panel closes
  // and the layout stabilizes (ResizeObserver debounce is 50ms, we wait 100ms
  // to be safe). This mimics the manual workaround: close TOC → wait → jump.
  const handleTOCNavigate = useCallback((page: number) => {
    setTocOpen(false);
    if (tocNavTimerRef.current) clearTimeout(tocNavTimerRef.current);
    tocNavTimerRef.current = setTimeout(() => {
      setScrollToPage(page);
      tocNavTimerRef.current = null;
    }, 100);
  }, []);
  const handleViewPage = useCallback((page: number) => {
    setScrollToPage(page);
    setEditorCurrentPage(page);
  }, []);
  const handleReorderSwap = useCallback((a: number, b: number) => reorder.swapPages(a, b), [reorder]);

  const handleSwap = useCallback(() => {
    if (!canSwap) return;
    reorder.swapPages(swapANum, swapBNum);
    setSwapPageA('');
    setSwapPageB('');
  }, [canSwap, swapANum, swapBNum, reorder]);

  // ── Drawer content ────────────────────────────────────────

  const drawerContent: ReactNode = (
    <>
      <DrawerSection label="Page Tools" color="blue">
        {PAGE_TOOLS.map(t => (
          <DrawerItem key={t.id} icon={t.icon} label={t.label}
            active={activePageTool === t.id}
            onClick={() => handleToolClick(t.id)} />
        ))}
        <div className="border-t border-zinc-800 my-1" />
        <DrawerItem icon="M4 6h16M4 10h16M4 14h16M4 18h16M8 6v12" label="Select All"
          badge={selectedCount > 0 ? String(selectedCount) : undefined}
          onClick={() => { selectAll(numPages); if (isMobile) setDrawerOpen(false); }} />
        <DrawerItem icon="M6 18L18 6M6 6l12 12" label="Deselect All"
          onClick={() => { deselectAll(); if (isMobile) setDrawerOpen(false); }} />
      </DrawerSection>
      <DrawerSection label="Document Tools" color="emerald" defaultOpen={false}>
        {DOC_TOOLS.map(t => (
          <DrawerAction key={t.id} icon={t.icon} label={t.label}
            onClick={() => handleToolClick(t.id)} />
        ))}
      </DrawerSection>
      <DrawerSection label="Navigation" color="blue" defaultOpen={false}>
        <DrawerItem icon="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" label="Download"
          onClick={() => { setShowDownloadConfirm(true); if (isMobile) setDrawerOpen(false); }} />
        <DrawerItem icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-2l-2-2H9L7 5H5a2 2 0 00-2 2z" label="Open PDF"
          onClick={() => { handleOpenFile(); if (isMobile) setDrawerOpen(false); }} />
        <DrawerItem icon="M4 6h16M4 10h16M4 14h16M4 18h16" label="Contents"
          onClick={() => { setTocOpen(!tocOpen); if (isMobile) setDrawerOpen(false); }} />
      </DrawerSection>
      {pendingEncryptedBytes && (
        <DrawerSection label="Security" color="emerald">
          <DrawerAction icon="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            label="Decrypt PDF" onClick={() => doc.openModal('decrypt')} />
        </DrawerSection>
      )}
    </>
  );

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950">
      <input ref={fileInputRef} type="file" accept="application/pdf,.pdf,.pdf.enc"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} className="hidden" />

      <TopBar title="pdfhandler" subtitle={fileName ?? undefined}
        onMenuToggle={() => setDrawerOpen(!drawerOpen)} isDrawerOpen={drawerOpen}
        actions={
          <div className="flex items-center gap-1">
            <button onClick={hasPDF ? () => setTocOpen(!tocOpen) : handleOpenFile}
              className="px-2 py-1 text-[10px] font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded">
              {hasPDF ? 'TOC' : 'Open'}</button>
            {hasPDF && <button onClick={() => setShowDownloadConfirm(true)}
              className="px-2 py-1 text-[10px] font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded">Save</button>}
          </div>
        } />

      <div className="flex-1 flex overflow-hidden relative">
        <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {drawerContent}
        </DrawerMenu>

        {hasPDF && <TOCPanel pdf={pdf!} open={tocOpen} onClose={() => setTocOpen(false)} onNavigate={handleTOCNavigate} />}

        <div className="flex-1 flex flex-col overflow-hidden">
          {!hasPDF ? (
            <PDFUploader onFileSelect={handleFileSelect} loading={loading} error={error} />
          ) : (
            <UnifiedViewer
              pdf={pdf!} numPages={numPages} scrollToPage={scrollToPage}
              onCurrentPageChange={p => { lastViewerPageRef.current = p; setEditorCurrentPage(p); }}
              selectMode={selectMode} onSelectModeChange={setSelectMode}
              selectedPages={selectedPages} selectedCount={selectedCount}
              onTogglePage={togglePage} onRangeSelect={selectRange}
              onSelectAll={() => selectAll(numPages)} onDeselectAll={deselectAll}
              onViewPage={handleViewPage}
              isReorderMode={isReorderMode} pageOrder={reorder.pageOrder}
              onReorderSwap={handleReorderSwap} rotation={rotation}
              onRotateCW={rotateCW} onRotateCCW={rotateCCW}
              initialPage={lastViewerPageRef.current} />
          )}
        </div>
      </div>

      <BottomToolbar visible={isCompact && hasPDF}>
        <BottomToolbarButton icon="M4 6h16M4 10h16M4 14h16M4 18h16" label="Contents" active={tocOpen} onClick={() => setTocOpen(!tocOpen)} />
        <BottomToolbarSelect selectMode={selectMode} onToggle={() => setSelectMode(!selectMode)} selectedCount={selectedCount} onSelectAll={() => selectAll(numPages)} onDeselectAll={deselectAll} />
        <BottomToolbarRotate onRotateCCW={rotateCCW} onRotateCW={rotateCW} />
        <BottomToolbarButton icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" label="Tools" badge={selectedCount > 0 ? String(selectedCount) : undefined} onClick={() => setDrawerOpen(!drawerOpen)} />
      </BottomToolbar>

      {/* TOC Loading Toast */}
      {tocLoading && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl">
            <div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            <span className="text-sm text-zinc-200 font-medium">Extracting table of contents...</span>
          </div>
        </div>
      )}

      {/* Reorder swap bar — visible on all screen sizes */}
      {isReorderMode && (
        <div className="fixed bottom-20 sm:bottom-6 right-2 sm:right-6 left-2 sm:left-auto z-40 flex flex-wrap items-center justify-center sm:justify-end gap-2 px-4 py-2.5 bg-zinc-800 border border-amber-600/30 rounded-xl shadow-2xl animate-slide-up">
          <span className="text-xs sm:text-sm text-amber-400 font-semibold shrink-0">Swap</span>
          <input type="number" min={1} max={numPages} value={swapPageA} onChange={e => setSwapPageA(e.target.value)}
            placeholder="A" className="w-14 h-9 px-2 text-sm font-mono bg-zinc-700 border border-zinc-600 rounded-lg text-zinc-200 text-center shrink-0 focus:outline-none focus:border-amber-500" />
          <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <input type="number" min={1} max={numPages} value={swapPageB} onChange={e => setSwapPageB(e.target.value)}
            placeholder="B" className="w-14 h-9 px-2 text-sm font-mono bg-zinc-700 border border-zinc-600 rounded-lg text-zinc-200 text-center shrink-0 focus:outline-none focus:border-amber-500" />
          <button onClick={handleSwap} disabled={!canSwap}
            className="h-9 px-3 text-xs font-semibold text-amber-300 bg-amber-600/20 hover:bg-amber-600/30 active:bg-amber-600/40 border border-amber-600/30 rounded-lg disabled:opacity-30 shrink-0 transition-colors">
            Swap
          </button>
          <div className="w-px h-5 bg-zinc-700 shrink-0 hidden sm:block" />
          <button onClick={() => { setIsReorderMode(false); setActivePageTool(null); setSelectMode(false); setSwapPageA(''); setSwapPageB(''); }}
            className="h-9 px-3 text-xs font-medium text-zinc-300 bg-zinc-700 hover:bg-zinc-600 rounded-lg shrink-0 transition-colors">
            Cancel
          </button>
          <button onClick={handleReorderApply} disabled={executing}
            className="flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 rounded-lg shrink-0 transition-colors">
            {executing ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Applying...</> : 'Apply'}
          </button>
        </div>
      )}

      {/* Download confirm */}
      {showDownloadConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-sm w-full shadow-2xl animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </div><div><p className="text-zinc-200 font-semibold text-sm">Download PDF?</p><p className="text-zinc-400 text-xs mt-0.5 truncate max-w-[200px]">{fileName}</p></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDownloadConfirm(false)} className="px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg">Cancel</button>
              <button onClick={() => { setShowDownloadConfirm(false); handleDownload(); }} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg">Download</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Tool Modals ────────────────────────────────── */}
      {tool.pageModalOpen === 'extract' && pdfBytes && (
        <ExtractModal numPages={numPages} currentPage={editorCurrentPage}
          selectedCount={selectedCount} selectedPagesSummary={selectedPagesSummary}
          fileName={fileName} onClose={tool.closePageModal}
          onExtract={handleExtract} executing={executing} />
      )}
      {tool.pageModalOpen === 'delete' && pdfBytes && (
        <DeleteModal numPages={numPages} currentPage={editorCurrentPage}
          selectedCount={selectedCount} selectedPagesSummary={selectedPagesSummary}
          onClose={tool.closePageModal} onDelete={handleDelete} executing={executing} />
      )}
      {tool.pageModalOpen === 'rotate' && pdfBytes && (
        <RotateModal numPages={numPages} currentPage={editorCurrentPage}
          selectedCount={selectedCount} selectedPagesSummary={selectedPagesSummary}
          onClose={tool.closePageModal} onRotate={handleRotate} executing={executing} />
      )}
      {tool.pageModalOpen === 'reverse' && pdfBytes && (
        <ReverseModal numPages={numPages} currentPage={editorCurrentPage}
          selectedCount={selectedCount} selectedPagesSummary={selectedPagesSummary}
          onClose={tool.closePageModal} onReverse={handleReverse} executing={executing} />
      )}
      {tool.pageModalOpen === 'copymove' && pdfBytes && (
        <CopyMoveModal numPages={numPages} currentPage={editorCurrentPage}
          selectedCount={selectedCount} selectedPagesSummary={selectedPagesSummary}
          onClose={tool.closePageModal} onCopyMove={handleCopyMove} executing={executing} />
      )}
      {tool.pageModalOpen === 'split' && pdfBytes && (
        <SplitModal numPages={numPages} fileName={fileName}
          tocItems={tocItemsForSplit} onClose={tool.closePageModal}
          onSplit={handleSplit} executing={executing} />
      )}
      {tool.pageModalOpen === 'insertreplace' && pdfBytes && (
        <InsertReplaceModal numPages={numPages} currentPage={editorCurrentPage}
          selectedCount={selectedCount} selectedPagesSummary={selectedPagesSummary}
          onClose={tool.closePageModal} onApply={handleInsertReplace} executing={executing} />
      )}
      {tool.pageModalOpen === 'merge' && pdfBytes && (
        <MergeModal onClose={tool.closePageModal} onMerge={handleMerge} executing={executing} />
      )}
      {tool.pageModalOpen === 'compose' && pdfBytes && (
        <ComposeModal onClose={tool.closePageModal} onCompose={handleCompose} executing={executing} />
      )}

      {/* ── Doc Tool Modals ─────────────────────────────────── */}
      {doc.modalOpen === 'info' && pdfBytes && (
        <InfoModal pdfBytes={pdfBytes} fileName={fileName ?? 'document.pdf'} onClose={doc.closeModal} />
      )}
      {doc.modalOpen === 'metadata' && pdfBytes && (
        <MetadataModal pdfBytes={pdfBytes} onApply={handleMetadataApply} onClose={doc.closeModal} />
      )}
      {doc.modalOpen === 'watermark-text' && pdfBytes && (
        <WatermarkTextModal pdfBytes={pdfBytes} onApply={handleWatermarkTextApply} onClose={doc.closeModal} />
      )}
      {doc.modalOpen === 'watermark-image' && pdfBytes && (
        <WatermarkImageModal pdfBytes={pdfBytes} onApply={handleWatermarkImageApply} onClose={doc.closeModal} />
      )}
      {doc.modalOpen === 'page-numbers' && pdfBytes && (
        <PageNumbersModal pdfBytes={pdfBytes} onApply={handlePageNumbersApply} onClose={doc.closeModal} />
      )}
      {doc.modalOpen === 'add-pages' && pdfBytes && (
        <AddPagesModal pdfBytes={pdfBytes} totalPages={numPages} onApply={handleAddPagesApply} onClose={doc.closeModal} />
      )}
      {doc.modalOpen === 'encrypt' && (
        <CryptoModal mode="encrypt" onExecute={handleEncrypt} onClose={doc.closeModal} />
      )}
      {doc.modalOpen === 'decrypt' && (
        <CryptoModal mode="decrypt" onExecute={handleDecrypt} onClose={doc.closeModal} />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}


