import { useState, useCallback, useRef } from 'react';
import { loadPDFDocument, type PDFDocument } from '../lib/pdfRenderer';

export interface PDFLoaderState {
  pdf: PDFDocument | null;
  pdfBytes: ArrayBuffer | null;
  numPages: number;
  loading: boolean;
  error: string | null;
  fileName: string | null;
  /** The original, unmodified PDF bytes — always preserved for non-destructive operations. */
  originalPdfBytes: ArrayBuffer | null;
  /** The original file name, used to generate `_modified.pdf` download names. */
  originalFileName: string | null;
  /** Whether the working copy has been modified from the original. */
  isModified: boolean;
  loadPDFFromFile: (file: File) => Promise<void>;
  loadPDFFromBytes: (bytes: ArrayBuffer, name?: string) => Promise<void>;
  reset: () => void;
}

export function usePDFLoader(): PDFLoaderState {
  const [pdf, setPdf] = useState<PDFDocument | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [originalPdfBytes, setOriginalPdfBytes] = useState<ArrayBuffer | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const [isModified, setIsModified] = useState(false);
  const loadingRef = useRef(false);
  const pdfRef = useRef<PDFDocument | null>(null);

  const loadPDFFromFile = useCallback(async (file: File) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    // Release previous PDF reference so GC can clean it up
    if (pdfRef.current) {
      pdfRef.current = null;
    }

    setLoading(true);
    setError(null);
    setPdf(null);
    setPdfBytes(null);
    setNumPages(0);
    setFileName(null);
    setOriginalPdfBytes(null);
    setOriginalFileName(null);
    setIsModified(false);

    try {
      const bytes = await file.arrayBuffer();

      // Clone the buffer before passing to pdfjs-dist,
      // because pdfjs-dist may transfer/detach the original ArrayBuffer
      // (especially when using workers), which would break pdf-lib extraction.
      const pdfDoc = await loadPDFDocument(bytes.slice(0));

      pdfRef.current = pdfDoc;
      setPdf(pdfDoc);
      setPdfBytes(bytes);
      setNumPages(pdfDoc.numPages);
      setFileName(file.name);
      setOriginalPdfBytes(bytes.slice(0));
      setOriginalFileName(file.name);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load PDF';
      setError(message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  const loadPDFFromBytes = useCallback(async (bytes: ArrayBuffer, name?: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    if (pdfRef.current) {
      pdfRef.current = null;
    }

    setLoading(true);
    setError(null);
    // NOT setting pdf=null here — that would cause a flicker
    // (hasPDF would become false and upload view would flash).
    // Instead we swap atomically when the new doc is ready.

    try {
      // clone so pdfjs-dist doesn't transfer our buffer
      const pdfDoc = await loadPDFDocument(bytes.slice(0));
      pdfRef.current = pdfDoc;
      setPdf(pdfDoc);
      setPdfBytes(bytes);
      setNumPages(pdfDoc.numPages);
      if (name) setFileName(name);
      // When loading from bytes (e.g. after an operation), mark as modified
      // if we already have an original.
      setIsModified(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load PDF';
      setError(message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    if (pdfRef.current) {
      pdfRef.current = null;
    }
    setPdf(null);
    setPdfBytes(null);
    setNumPages(0);
    setError(null);
    setFileName(null);
    setOriginalPdfBytes(null);
    setOriginalFileName(null);
    setIsModified(false);
  }, []);

  return {
    pdf,
    pdfBytes,
    numPages,
    loading,
    error,
    fileName,
    originalPdfBytes,
    originalFileName,
    isModified,
    loadPDFFromFile,
    loadPDFFromBytes,
    reset,
  };
}
