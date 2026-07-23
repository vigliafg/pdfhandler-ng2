import { useRef, useCallback, useState, useEffect, type ReactNode } from 'react';
import { TopBar } from './components/TopBar';
import { DrawerMenu, DrawerSection, DrawerItem, DrawerAction } from './components/DrawerMenu';
import { BottomToolbar, BottomToolbarButton } from './components/BottomToolbar';
import { PDFUploader } from './components/PDFUploader';
import { ViewerPanel } from './components/ViewerPanel';
import { EditorPanel } from './components/EditorPanel';
import { TOCPanel } from './components/TOCPanel';
import { Toast, useToast } from './components/Toast';
import { useResponsiveLayout } from './hooks/useResponsiveLayout';
import { useDialog } from './hooks/useDialog';

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
import { setMetadata, getMetadata, watermarkText,
  addPageNumbers, addBlankPages, getPDFInfo } from '../src/lib/docOperations';

type ViewMode = 'upload' | 'viewer' | 'editor';

// ── All tool definitions (matching original app) ────────────

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

const PAGE_TOOL_IDS = new Set(['extract', 'insertreplace', 'delete', 'rotate', 'copymove', 'reverse', 'split', 'merge', 'compose', 'reorder']);

export default function App() {
  const { isMobile, isTablet, isDesktop } = useResponsiveLayout();
  const { pdf, pdfBytes, numPages, loading, error, fileName, originalFileName, isModified, loadPDFFromFile, loadPDFFromBytes } = usePDFLoader();
  const { selectedPages, togglePage, selectAll, deselectAll, selectRange, selectedCount } = usePageSelection();
  const reorder = useReorder();
  const { toasts, showToast } = useToast();
  const dialog = useDialog();

  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [drawerOpen, setDrawerOpen] = useState(isDesktop);
  const [tocOpen, setTocOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const executingRef = useRef(false);
  const [pendingEncryptedBytes, setPendingEncryptedBytes] = useState<ArrayBuffer | null>(null);
  const [scrollToPage, setScrollToPage] = useState<number | null>(null);
  const [editorColumns, setEditorColumns] = useState(isMobile ? 3 : 5);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const [activePageTool, setActivePageTool] = useState<string | null>(null);
  const lastViewerPageRef = useRef(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDrawerOpen(isDesktop); }, [isDesktop]);
  useEffect(() => { if (pdf && numPages > 0) setViewMode('viewer'); }, [pdf, numPages]);

  const hasPDF = pdf !== null && numPages > 0;

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
    if (isEncryptedPDF(file.name)) {
      file.arrayBuffer().then(buf => { setPendingEncryptedBytes(buf); showToast('info', 'PDF cifrato — usa Decifra nel menu'); });
      return;
    }
    loadPDFFromFile(file);
  }, [loadPDFFromFile, deselectAll, showToast]);

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

  // ── Tool handlers (all 20 tools) ──────────────────────────

  // Page tools
  const toolExtract = useCallback(async () => {
    const pages = Array.from(selectedPages);
    if (pages.length === 0) { showToast('error', 'No pages selected'); return; }
    const isZip = await dialog.confirm('Extract', 'Separate files (ZIP)?');
    const outputType = isZip ? 'separate' : 'single';
    await runOp(async () => {
      const base = originalFileName?.replace(/\.pdf$/i, '') ?? fileName?.replace(/\.pdf$/i, '') ?? 'output';
      if (outputType === 'single') {
        downloadPDF(await extractPages(pdfBytes!, pages), `${base}-extracted.pdf`);
      } else {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        for (let i = 0; i < pages.length; i++) {
          zip.file(`${base}-p${String(i + 1).padStart(3, '0')}-page${pages[i]}.pdf`, await extractPages(pdfBytes!, [pages[i]]));
        }
        downloadZip(await zip.generateAsync({ type: 'uint8array' }), `${base}-extracted.zip`);
      }
    }, 'Extract');
  }, [selectedPages, pdfBytes, fileName, originalFileName, runOp, showToast, dialog]);

  const toolInsertReplace = useCallback(async () => {
    const isInsert = await dialog.confirm('Insert / Replace', 'Insert pages from another PDF?');
    const op = isInsert ? 'insert' : 'replace';
    if (op === 'replace') {
      const pages = Array.from(selectedPages);
      if (pages.length === 0) { showToast('error', 'Select pages to replace first'); return; }
    }
    showToast('info', `Use the original app for full ${op === 'insert' ? 'Insert' : 'Replace'} UI`);
  }, [selectedPages, showToast, dialog]);

  const toolDelete = useCallback(async () => {
    const pages = Array.from(selectedPages);
    if (pages.length === 0) { showToast('error', 'No pages selected'); return; }
    const confirmed = await dialog.confirm('Delete', `Delete ${pages.length} page(s)?\nThis is permanent and cannot be undone.`);
    if (!confirmed) return;
    await runOp(async () => {
      const tocItems = pdf ? await getOutline(pdf) : undefined;
      const result = await deletePages(pdfBytes!, pages, tocItems);
      deselectAll();
      await reloadPDF(result.bytes);
    }, 'Delete');
  }, [selectedPages, pdfBytes, pdf, deselectAll, reloadPDF, runOp, showToast, dialog]);

  const toolRotate = useCallback(async () => {
    const pages = Array.from(selectedPages);
    if (pages.length === 0) { showToast('error', 'No pages selected'); return; }
    const angle = await dialog.prompt('Rotate', 'Enter rotation angle:', '90');
    if (!angle || !['90', '180', '270'].includes(angle)) { showToast('error', 'Invalid angle — use 90, 180, or 270'); return; }
    await runOp(async () => {
      const tocItems = pdf ? await getOutline(pdf) : undefined;
      const result = await rotatePages(pdfBytes!, pages, parseInt(angle) as RotationAngle, tocItems);
      deselectAll(); await reloadPDF(result.bytes);
    }, 'Rotate');
  }, [selectedPages, pdfBytes, pdf, deselectAll, reloadPDF, runOp, showToast, dialog]);

  const toolCopyMove = useCallback(async () => {
    const pages = Array.from(selectedPages);
    if (pages.length === 0) { showToast('error', 'No pages selected'); return; }
    const isMove = await dialog.confirm('Copy / Move', 'Move pages?\nCancel = Copy instead');
    const op = isMove ? 'move' : 'copy';
    const copiesStr = op === 'copy' ? await dialog.prompt('Copy / Move', 'How many copies?', '1') : null;
    const copies = copiesStr ? parseInt(copiesStr, 10) : 1;
    const destStr = await dialog.prompt('Copy / Move', `Target page (before which page, 1-${numPages})?`, String(numPages));
    const destPage = parseInt(destStr || String(numPages), 10);
    await runOp(async () => {
      const tocItems = pdf ? await getOutline(pdf) : undefined;
      let result;
      if (op === 'move') {
        result = await movePages(pdfBytes!, pages, { location: 'before', page: destPage }, tocItems);
      } else {
        result = await duplicatePages(pdfBytes!, pages, copies, { location: 'before', page: destPage }, tocItems);
      }
      deselectAll(); await reloadPDF(result.bytes);
    }, op === 'move' ? 'Move' : 'Copy');
  }, [selectedPages, numPages, pdfBytes, pdf, deselectAll, reloadPDF, runOp, showToast, dialog]);

  const toolReverse = useCallback(async () => {
    const pages = Array.from(selectedPages);
    await runOp(async () => {
      const tocItems = pdf ? await getOutline(pdf) : undefined;
      const result = await reversePages(pdfBytes!, pages.length > 0 ? pages : undefined, tocItems);
      deselectAll(); await reloadPDF(result.bytes);
    }, 'Reverse');
  }, [selectedPages, pdfBytes, pdf, deselectAll, reloadPDF, runOp]);

  const toolSplit = useCallback(async () => {
    const pagesPerChunk = await dialog.prompt('Split', 'Pages per file:', '10');
    if (!pagesPerChunk) return;
    await runOp(async () => {
      const base = fileName?.replace(/\.pdf$/i, '') ?? 'document';
      downloadZip(await splitPages(pdfBytes!, parseInt(pagesPerChunk), base), `${base}-split.zip`);
    }, 'Split');
  }, [pdfBytes, fileName, runOp]);

  const toolMerge = useCallback(async () => {
    showToast('info', 'Apri file multipli dal menu Open (usa shift+click) oppure usa la versione desktop per il merge completo');
  }, [showToast]);

  const toolCompose = useCallback(async () => {
    showToast('info', 'Usa la versione desktop per Extract & Montage completo');
  }, [showToast]);

  const toolReorder = useCallback(() => {
    reorder.initializeOrder(numPages);
    setIsReorderMode(true);
    setActivePageTool('reorder');
    setViewMode('editor');
    setDrawerOpen(false);
  }, [reorder, numPages]);

  // Doc tools
  const toolInfo = useCallback(async () => {
    if (!pdfBytes) return;
    const info = await getPDFInfo(pdfBytes);
    await dialog.alert('PDF Info',
      `📄 ${fileName}\n\n` +
      `Pages: ${info.pageCount}\n` +
      `Size: ${formatBytes(info.fileSizeBytes)}\n\n` +
      `Title: ${info.title}\n` +
      `Author: ${info.author}\n` +
      `Subject: ${info.subject}\n` +
      `Creator: ${info.creator}\n` +
      `Producer: ${info.producer}`);
  }, [pdfBytes, fileName, dialog]);

  const toolMetadata = useCallback(async () => {
    if (!pdfBytes) return;
    const meta = await getMetadata(pdfBytes);
    const title = (await dialog.prompt('Metadata', 'Title:', meta.title)) || meta.title;
    const author = (await dialog.prompt('Metadata', 'Author:', meta.author)) || meta.author;
    const subject = (await dialog.prompt('Metadata', 'Subject:', meta.subject)) || meta.subject;
    const keywords = (await dialog.prompt('Metadata', 'Keywords:', meta.keywords)) || meta.keywords;
    await runOp(async () => {
      const bytes = await setMetadata(pdfBytes, { title, author, subject, keywords });
      await reloadPDF(bytes);
    }, 'Metadata');
  }, [pdfBytes, reloadPDF, runOp, dialog]);

  const toolWatermarkText = useCallback(async () => {
    if (!pdfBytes) return;
    const text = (await dialog.prompt('Watermark', 'Watermark text:', 'CONFIDENTIAL')) || 'DRAFT';
    await runOp(async () => {
      const bytes = await watermarkText(pdfBytes, {
        text, fontSize: 40, opacity: 0.15, angle: -45,
        color: { r: 0.5, g: 0.5, b: 0.5 }, position: 'center',
      });
      await reloadPDF(bytes);
    }, 'Watermark');
  }, [pdfBytes, reloadPDF, runOp, dialog]);

  const toolWatermarkImage = useCallback(async () => {
    showToast('info', 'Carica un\'immagine PNG/JPG dal menu Open — in sviluppo');
  }, [showToast]);

  const toolPageNumbers = useCallback(async () => {
    if (!pdfBytes) return;
    const format = (await dialog.prompt('Page Numbers', 'Format ({n}=page, {t}=total):', 'Page {n} of {t}')) || 'Page {n} of {t}';
    await runOp(async () => {
      const bytes = await addPageNumbers(pdfBytes, { format, fontSize: 10, position: 'bottom-center', startAt: 1 });
      await reloadPDF(bytes);
    }, 'Page Numbers');
  }, [pdfBytes, reloadPDF, runOp, dialog]);

  const toolAddPages = useCallback(async () => {
    if (!pdfBytes) return;
    const countStr = await dialog.prompt('Add Pages', 'How many blank pages?', '1');
    const count = parseInt(countStr || '1', 10);
    const atStart = await dialog.confirm('Add Pages', 'Add at beginning?\nCancel = Add at end');
    const pos = atStart ? 'start' : 'end';
    await runOp(async () => {
      const bytes = await addBlankPages(pdfBytes, { count, position: pos, size: 'A4' });
      await reloadPDF(bytes);
    }, 'Add Pages');
  }, [pdfBytes, reloadPDF, runOp, dialog]);

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

  const toolEncrypt = useCallback(async () => {
    if (!pdfBytes) return;
    const password = await dialog.prompt('Encrypt', 'Password for encryption:');
    if (!password) return;
    await runOp(async () => {
      const encrypted = await encryptPDF(new Uint8Array(pdfBytes), password);
      const blob = new Blob([encrypted as unknown as BlobPart], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (fileName?.replace(/\.pdf$/i, '') ?? 'document') + '.pdf.enc';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'Encrypt');
  }, [pdfBytes, fileName, runOp, dialog]);

  const toolDecrypt = useCallback(async () => {
    if (!pendingEncryptedBytes) { showToast('info', 'Apri prima un file .pdf.enc'); return; }
    const password = await dialog.prompt('Decrypt', 'Password to decrypt:');
    if (!password) return;
    try {
      const decrypted = await decryptPDF(new Uint8Array(pendingEncryptedBytes), password);
      const buf = decrypted.buffer.slice(decrypted.byteOffset, decrypted.byteOffset + decrypted.byteLength) as ArrayBuffer;
      await loadPDFFromBytes(buf, fileName ?? 'decrypted.pdf');
      setPendingEncryptedBytes(null);
      showToast('success', 'PDF decrypted');
    } catch { showToast('error', 'Wrong password'); }
  }, [pendingEncryptedBytes, loadPDFFromBytes, fileName, showToast, dialog]);

  // ── Tool dispatch (auto-switch to Editor for page tools) ─
  const handleToolClick = useCallback((id: string) => {
    // Auto-switch: page tools from Viewer → Editor for page selection
    if (viewMode === 'viewer' && PAGE_TOOL_IDS.has(id)) {
      setViewMode('editor');
      setDrawerOpen(false);
      showToast('info', 'Select the pages you want, then click the tool again');
      return;
    }
    const h = {
      extract: toolExtract, insertreplace: toolInsertReplace,
      delete: toolDelete, rotate: toolRotate, copymove: toolCopyMove,
      reverse: toolReverse, split: toolSplit, merge: toolMerge,
      compose: toolCompose, reorder: toolReorder,
      info: toolInfo, metadata: toolMetadata,
      'watermark-text': toolWatermarkText, 'watermark-image': toolWatermarkImage,
      'page-numbers': toolPageNumbers, 'add-pages': toolAddPages,
      'export-images': toolExportImages, 'extract-text': toolExtractText,
      encrypt: toolEncrypt, decrypt: toolDecrypt,
    } as Record<string, () => void>;
    h[id]?.();
    if (isMobile) setDrawerOpen(false);
  }, [viewMode, isMobile, showToast, dialog, toolExtract, toolInsertReplace, toolDelete, toolRotate, toolCopyMove, toolReverse, toolSplit, toolMerge, toolCompose, toolReorder, toolInfo, toolMetadata, toolWatermarkText, toolWatermarkImage, toolPageNumbers, toolAddPages, toolExportImages, toolExtractText, toolEncrypt, toolDecrypt]);

  // ── Reorder ───────────────────────────────────────────────
  const handleReorderApply = useCallback(async () => {
    await runOp(async () => {
      const tocItems = pdf ? await getOutline(pdf) : undefined;
      const result = await reorderPages(pdfBytes!, reorder.pageOrder, tocItems);
      deselectAll(); await reloadPDF(result.bytes);
      setIsReorderMode(false); setActivePageTool(null);
    }, 'Reorder');
  }, [pdfBytes, pdf, reorder.pageOrder, deselectAll, reloadPDF, runOp]);

  // ── Navigation ────────────────────────────────────────────
  const handleTOCNavigate = useCallback((page: number) => {
    setScrollToPage(page); setViewMode('viewer'); setTocOpen(false);
  }, []);
  const handleViewPage = useCallback((page: number) => {
    setScrollToPage(page); setViewMode('viewer');
  }, []);
  const switchViewer = useCallback(() => setViewMode('viewer'), []);
  const switchEditor = useCallback(() => setViewMode('editor'), []);
  const handleReorderSwap = useCallback((a: number, b: number) => reorder.swapPages(a, b), [reorder]);

  // ── Viewer drawer actions ─────────────────────────────────
  const viewerActions: { id: string; label: string; icon: string; onClick: () => void }[] = [
    { id: 'toc',     label: 'Contents',    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', onClick: () => setTocOpen(!tocOpen) },
    { id: 'download',label: 'Download',     icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4', onClick: () => setShowDownloadConfirm(true) },
    { id: 'open',    label: 'Open PDF',     icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-2l-2-2H9L7 5H5a2 2 0 00-2 2z', onClick: handleOpenFile },
  ];

  // ── Drawer content (viewer vs editor) ─────────────────────
  const drawerContent: ReactNode = viewMode === 'viewer' ? (
    <>
      <DrawerSection label="Navigation" color="blue">
        {viewerActions.map(a => (
          <DrawerItem key={a.id} icon={a.icon} label={a.label}
            onClick={() => { a.onClick(); if (isMobile) setDrawerOpen(false); }} />
        ))}
      </DrawerSection>
      <DrawerSection label="Editor Tools" color="blue" defaultOpen={false}>
        {PAGE_TOOLS.map(t => (
          <DrawerItem key={t.id} icon={t.icon} label={t.label}
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
      {pendingEncryptedBytes && (
        <DrawerSection label="Security" color="emerald">
          <DrawerAction icon="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            label="Decrypt PDF" onClick={toolDecrypt} />
        </DrawerSection>
      )}
    </>
  ) : (
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
            label="Decrypt PDF" onClick={toolDecrypt} />
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
            {hasPDF && (<>
              <button onClick={switchViewer} className={`px-2 py-0.5 text-[10px] font-semibold rounded ${viewMode==='viewer'?'bg-zinc-700 text-zinc-200':'text-zinc-400'}`}>View</button>
              <button onClick={switchEditor} className={`px-2 py-0.5 text-[10px] font-semibold rounded ${viewMode==='editor'?'bg-zinc-700 text-zinc-200':'text-zinc-400'}`}>Edit</button>
              <div className="w-px h-3 bg-zinc-700" />
            </>)}
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
          ) : viewMode === 'viewer' ? (
            <ViewerPanel pdf={pdf!} numPages={numPages} scrollToPage={scrollToPage}
              onCurrentPageChange={p => { lastViewerPageRef.current = p; }} />
          ) : (
            <EditorPanel pdf={pdf!} numPages={numPages} selectedPages={selectedPages} selectedCount={selectedCount}
              onTogglePage={togglePage} onRangeSelect={selectRange}
              onSelectAll={() => selectAll(numPages)} onDeselectAll={deselectAll}
              onViewPage={handleViewPage} isReorderMode={isReorderMode} pageOrder={reorder.pageOrder}
              onReorderSwap={handleReorderSwap}
              columns={isMobile ? Math.min(editorColumns, 3) : editorColumns}
              onColumnsChange={setEditorColumns} initialPage={lastViewerPageRef.current} />
          )}
        </div>
      </div>

      <BottomToolbar visible={isMobile && hasPDF}>
        <BottomToolbarButton icon="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" label="View" active={viewMode === 'viewer'} onClick={switchViewer} />
        <BottomToolbarButton icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" label="Edit" active={viewMode === 'editor'} onClick={switchEditor} />
        <BottomToolbarButton icon="M4 6h16M4 10h16M4 14h16M4 18h16" label="Contents" active={tocOpen} onClick={() => setTocOpen(!tocOpen)} />
        <BottomToolbarButton icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" label="Tools" badge={selectedCount > 0 ? String(selectedCount) : undefined} onClick={() => setDrawerOpen(!drawerOpen)} />
      </BottomToolbar>

      {isReorderMode && (isDesktop || isTablet) && (
        <div className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl animate-slide-up">
          <span className="text-sm text-amber-400 font-semibold">Reorder</span>
          <button onClick={() => { setIsReorderMode(false); setActivePageTool(null); }} className="px-3 py-1 text-xs font-medium text-zinc-300 bg-zinc-700 hover:bg-zinc-600 rounded-lg">Cancel</button>
          <button onClick={handleReorderApply} disabled={executing} className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 rounded-lg">
            {executing ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Applying...</> : 'Apply'}</button>
        </div>
      )}

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

      <Toast toasts={toasts} />
      {dialog.Dialog}
    </div>
  );
}

function formatBytes(b: number): string {
  return b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
}
