import { useState, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  DialogShell,
  PreviewBar,
  SectionHeader,
  HelpBox,
  ErrorBanner,
  WarningBanner,
} from './shared';

interface MergeEntry {
  id: string;
  name: string;
  data: ArrayBuffer;
  pages: number;
}

interface MergeModalProps {
  onClose: () => void;
  onMerge: (entries: { data: ArrayBuffer; name: string }[]) => Promise<void>;
  executing?: boolean;
}

export function MergeModal({ onClose, onMerge, executing = false }: MergeModalProps) {
  const [entries, setEntries] = useState<MergeEntry[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectedCount, setRejectedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList) => {
    const newEntries: MergeEntry[] = [];
    let rejected = 0;
    for (const file of files) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const data = await file.arrayBuffer();
          const doc = await PDFDocument.load(data.slice(0), { ignoreEncryption: true });
          newEntries.push({
            id: crypto.randomUUID(),
            name: file.name,
            data,
            pages: doc.getPageCount(),
          });
        } catch {
          // Corrupted or encrypted PDF — count as rejected
          rejected++;
        }
      } else {
        rejected++;
      }
    }
    if (rejected > 0) setRejectedCount((prev) => prev + rejected);
    setEntries((prev) => [...prev, ...newEntries]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setEntries((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(idx);
  };

  const handleDragEnd = () => setDragIdx(null);

  const moveUp = useCallback((idx: number) => {
    if (idx <= 0) return;
    setEntries((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((idx: number) => {
    setEntries((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const handleExecute = useCallback(async () => {
    if (entries.length < 2 || executing) return;
    setError(null);
    setRejectedCount(0);
    try {
      const pdfs = entries.map((e) => ({ data: e.data, name: e.name }));
      await onMerge(pdfs);
    } catch (err: any) {
      setError(err?.message || 'Merge failed. One or more PDFs may be corrupted.');
    }
  }, [entries, executing, onMerge]);

  const totalPages = entries.reduce((sum, e) => sum + e.pages, 0);

  return (
    <DialogShell
      title="Merge PDFs"
      icon="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V4a1 1 0 00-1-1H4a1 1 0 00-1 1v12m17-4h-2a1 1 0 01-1-1V5a1 1 0 011-1h2a1 1 0 011 1v7a1 1 0 01-1 1z"
      onCancel={onClose}
      onExecute={handleExecute}
      executeLabel={`Merge ${entries.length} files`}
      executeDisabled={entries.length < 2 || executing}
      disabledReason={
        executing ? undefined
        : entries.length === 0 ? 'Add at least two PDF files to merge'
        : entries.length === 1 ? 'Add at least one more PDF file (need 2+ files to merge)'
        : undefined
      }
      executing={executing}
    >
      <HelpBox>Combine multiple PDFs into a single document. Drag to reorder, or use the arrow buttons. The result <strong className="text-zinc-400">replaces the current document</strong> — bookmarks from source files are not merged.</HelpBox>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {rejectedCount > 0 && (
        <WarningBanner
          message={`${rejectedCount} file${rejectedCount !== 1 ? 's' : ''} skipped — not a valid PDF or could not be read.`}
          onDismiss={() => setRejectedCount(0)}
        />
      )}
      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="relative flex flex-col items-center justify-center h-24 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 transition-all"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          data-testid="merge-file-input"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
          }}
          className="absolute w-px h-px opacity-0 pointer-events-none overflow-hidden"
          tabIndex={-1}
        />
        <svg className="w-6 h-6 text-zinc-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <p className="text-sm text-zinc-500">Add PDF files</p>
      </div>

      {/* File list */}
      {entries.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-auto">
          <SectionHeader label={`Files (${entries.length})`} />
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                dragIdx === idx ? 'opacity-50 bg-zinc-800' : 'bg-zinc-800/50 hover:bg-zinc-800'
              }`}
            >
              {/* Drag handle */}
              <div
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className="cursor-grab active:cursor-grabbing shrink-0"
              >
                <svg className="w-3 h-3 text-zinc-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z" />
                </svg>
              </div>

              <svg className="w-4 h-4 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="flex-1 text-sm text-zinc-300 truncate">{entry.name}</span>
              <span className="text-xs text-zinc-500 tabular-nums shrink-0">{entry.pages} pp.</span>

              {/* Up / Down buttons */}
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  title="Move up"
                  className="p-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors leading-none"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === entries.length - 1}
                  title="Move down"
                  className="p-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors leading-none"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Remove */}
              <button
                onClick={() => removeEntry(entry.id)}
                className="p-0.5 text-zinc-600 hover:text-red-400 transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* Preview */}
      {entries.length > 0 && (
        <PreviewBar
          icon="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 17a2 2 0 11-4 0 2 2 0 014 0z"
          summary={`${entries.length} files · ${totalPages} total pages will be merged into a single PDF.\nOutput: merged.pdf (${totalPages} pages)`}
        />
      )}
    </DialogShell>
  );
}
