import { useState, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  DialogShell,
  PreviewBar,
  SectionHeader,
  HelpBox,
  ErrorBanner,
  WarningBanner,
  parseRangeString,
} from './shared';
import type { SourcePDF, Chunk } from '../../lib/pdfComposer';

const CHUNK_COLORS = [
  'border-l-blue-500',
  'border-l-emerald-500',
  'border-l-amber-500',
  'border-l-purple-500',
  'border-l-rose-500',
  'border-l-cyan-500',
  'border-l-orange-500',
  'border-l-lime-500',
];

const CHUNK_BG = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-lime-500',
];

let nextColorIndex = 0;
function getNextColorIndex(): number {
  const idx = nextColorIndex % CHUNK_COLORS.length;
  nextColorIndex++;
  return idx;
}

export interface ComposeParams {
  chunks: Chunk[];
  sources: Map<string, SourcePDF>;
  outputName?: string;
}

interface ComposeModalProps {
  onClose: () => void;
  onCompose: (params: ComposeParams) => Promise<void>;
  executing?: boolean;
}

interface SourceEntry {
  id: string;
  name: string;
  data: ArrayBuffer;
  totalPages: number;
  rangeMode: 'all' | 'custom';
  customRange: string;
}

export function ComposeModal({ onClose, onCompose, executing = false }: ComposeModalProps) {
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectedCount, setRejectedCount] = useState(0);

  // Editing state
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editStartPage, setEditStartPage] = useState('');
  const [editEndPage, setEditEndPage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Add source PDFs ─────────────────────────────────
  const addFiles = useCallback(async (files: FileList) => {
    const newSources: SourceEntry[] = [];
    let rejected = 0;
    for (const file of files) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const data = await file.arrayBuffer();
          const doc = await PDFDocument.load(data.slice(0), { ignoreEncryption: true });
          newSources.push({
            id: crypto.randomUUID(),
            name: file.name,
            data,
            totalPages: doc.getPageCount(),
            rangeMode: 'all',
            customRange: '',
          });
        } catch {
          rejected++;
        }
      } else {
        rejected++;
      }
    }
    if (rejected > 0) setRejectedCount((prev) => prev + rejected);
    setSources((prev) => [...prev, ...newSources]);
  }, []);

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    setChunks((prev) => {
      const remaining = prev.filter((c) => c.sourceId !== id);
      // Clear editing state if the edited chunk was removed
      if (editingChunkId && !remaining.find((c) => c.id === editingChunkId)) {
        setEditingChunkId(null);
      }
      return remaining;
    });
  }, [editingChunkId]);

  const updateSourceRange = useCallback((id: string, rangeMode: 'all' | 'custom', customRange: string) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, rangeMode, customRange } : s)));
  }, []);

  // ── Add chunk to composition ────────────────────────
  const addChunk = useCallback((source: SourceEntry) => {
    let pages: number[] = [];
    if (source.rangeMode === 'all') {
      for (let i = 1; i <= source.totalPages; i++) pages.push(i);
    } else {
      pages = parseRangeString(source.customRange, source.totalPages);
    }
    if (pages.length === 0) return;

    // Compute contiguous ranges
    const ranges: { start: number; end: number }[] = [];
    let rangeStart = pages[0];
    let rangeEnd = pages[0];
    for (let i = 1; i < pages.length; i++) {
      if (pages[i] === rangeEnd + 1) {
        rangeEnd = pages[i];
      } else {
        ranges.push({ start: rangeStart, end: rangeEnd });
        rangeStart = pages[i];
        rangeEnd = pages[i];
      }
    }
    ranges.push({ start: rangeStart, end: rangeEnd });

    const newChunks: Chunk[] = ranges.map((r) => ({
      id: crypto.randomUUID(),
      sourceId: source.id,
      sourceName: source.name,
      colorIndex: getNextColorIndex(),
      startPage: r.start,
      endPage: r.end,
      pageCount: r.end - r.start + 1,
    }));

    setChunks((prev) => [...prev, ...newChunks]);
  }, []);

  // ── Remove chunk ────────────────────────────────────
  const removeChunk = useCallback((id: string) => {
    setChunks((prev) => prev.filter((c) => c.id !== id));
    if (editingChunkId === id) setEditingChunkId(null);
  }, [editingChunkId]);

  // ── Drag & drop reorder ─────────────────────────────
  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setChunks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(idx);
  };

  const handleDragEnd = () => setDragIdx(null);

  // ── Edit chunk ──────────────────────────────────────
  const startEditing = useCallback((chunk: Chunk) => {
    setEditingChunkId(chunk.id);
    setEditStartPage(String(chunk.startPage));
    setEditEndPage(String(chunk.endPage));
  }, []);

  const applyEdit = useCallback(() => {
    if (!editingChunkId) return;
    const start = parseInt(editStartPage, 10);
    const end = parseInt(editEndPage, 10);
    if (isNaN(start) || isNaN(end) || start < 1 || end < start) return;

    const source = sources.find((s) => s.id === chunks.find((c) => c.id === editingChunkId)?.sourceId);
    if (!source || end > source.totalPages) return;

    setChunks((prev) =>
      prev.map((c) =>
        c.id === editingChunkId
          ? { ...c, startPage: start, endPage: end, pageCount: end - start + 1 }
          : c,
      ),
    );
    setEditingChunkId(null);
  }, [editingChunkId, editStartPage, editEndPage, sources, chunks]);

  const cancelEdit = useCallback(() => {
    setEditingChunkId(null);
  }, []);

  // ── Execute ─────────────────────────────────────────
  const totalPages = chunks.reduce((sum, c) => sum + c.pageCount, 0);

  const sourceMap = new Map<string, SourcePDF>();
  for (const s of sources) {
    sourceMap.set(s.id, { id: s.id, name: s.name, data: s.data, totalPages: s.totalPages });
  }

  const canExecute = chunks.length > 0 && !executing;

  const handleExecute = useCallback(async () => {
    if (!canExecute) return;
    setError(null);
    try {
      await onCompose({ chunks, sources: sourceMap, outputName: 'composed.pdf' });
    } catch (err: any) {
      setError(err?.message || 'Composition failed.');
    }
  }, [canExecute, onCompose, chunks, sourceMap]);

  // ── Preview ─────────────────────────────────────────
  const previewSummary = chunks.length === 0
    ? 'Add chunks from source PDFs to build your composition.'
    : `${chunks.length} chunk${chunks.length !== 1 ? 's' : ''} from ${new Set(chunks.map((c) => c.sourceId)).size} source${sources.length !== 1 ? 's' : ''} · ${totalPages} total pages.\nOutput: composed.pdf (${totalPages} pages)`;

  return (
    <DialogShell
      title="Extract & Montage"
      icon="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 13a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z"
      onCancel={onClose}
      onExecute={handleExecute}
      executeLabel={`Compose ${totalPages} pages`}
      executeDisabled={!canExecute}
      disabledReason={
        executing ? undefined
        : chunks.length === 0 ? 'Add at least one chunk from a source PDF'
        : undefined
      }
      executing={executing}
    >
      <HelpBox>
        Compose a new PDF from page ranges across multiple source PDFs.{' '}
        Upload source PDFs on the left, select page ranges, and add them as chunks.{' '}
        Drag to reorder chunks in the composition.{' '}
        The result <strong className="text-zinc-400">replaces the current document</strong>.
      </HelpBox>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {rejectedCount > 0 && (
        <WarningBanner
          message={`${rejectedCount} file${rejectedCount !== 1 ? 's' : ''} skipped — not a valid PDF or could not be read.`}
          onDismiss={() => setRejectedCount(0)}
        />
      )}

      {/* ── Two-panel layout ─────────────────────────── */}
      <div className="flex gap-3 min-h-0">
        {/* ── LEFT: Source PDFs ───────────────────────── */}
        <div className="w-1/2 space-y-3 shrink-0">
          <SectionHeader label="Source PDFs" />

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative flex flex-col items-center justify-center h-20 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
              }}
              className="absolute w-px h-px opacity-0 pointer-events-none overflow-hidden"
              tabIndex={-1}
            />
            <svg className="w-5 h-5 text-zinc-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <p className="text-xs text-zinc-500">Add source PDFs</p>
          </div>

          {/* Source list */}
          {sources.length > 0 && (
            <div className="space-y-3 max-h-[320px] overflow-y-auto">
              {sources.map((source) => {
                const resolved =
                  source.rangeMode === 'all'
                    ? Array.from({ length: source.totalPages }, (_, i) => i + 1)
                    : parseRangeString(source.customRange, source.totalPages);
                const chunkPageCount = resolved.length;

                return (
                  <div
                    key={source.id}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 truncate">{source.name}</p>
                        <p className="text-xs text-zinc-500">1–{source.totalPages} ({source.totalPages} pp.)</p>
                      </div>
                      <button
                        onClick={() => removeSource(source.id)}
                        className="p-0.5 text-zinc-600 hover:text-red-400 transition-colors shrink-0 ml-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Range selector for this source */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateSourceRange(source.id, 'all', '')}
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                          source.rangeMode === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-700 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => updateSourceRange(source.id, 'custom', source.customRange)}
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                          source.rangeMode === 'custom'
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-700 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Custom
                      </button>
                      {source.rangeMode === 'custom' && (
                        <input
                          type="text"
                          value={source.customRange}
                          onChange={(e) => updateSourceRange(source.id, 'custom', e.target.value)}
                          placeholder="e.g. 5-10, 15"
                          className="flex-1 min-w-0 px-2 py-1 text-[10px] font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                        />
                      )}
                    </div>

                    {/* Add to composition button */}
                    <button
                      onClick={() => addChunk(source)}
                      disabled={chunkPageCount === 0}
                      className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[10px] font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Add to composition
                      {chunkPageCount > 0 && (
                        <span className="tabular-nums ml-auto text-purple-400">
                          {chunkPageCount} pp.
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Composition ──────────────────────── */}
        <div className="w-1/2 space-y-2 shrink-0">
          <SectionHeader label={`Composition${chunks.length > 0 ? ` (${chunks.length})` : ''}`} />

          {chunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-zinc-600">
              <svg className="w-8 h-8 mb-1 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-xs">Add chunks from source PDFs</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[320px] overflow-y-auto">
              {chunks.map((chunk, idx) => {
                const isEditing = editingChunkId === chunk.id;
                const colorClass = CHUNK_COLORS[chunk.colorIndex % CHUNK_COLORS.length];

                return (
                  <div
                    key={chunk.id}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors border-l-2 ${colorClass} ${
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

                    {/* Chunk info / Edit mode */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-zinc-300 truncate">{chunk.sourceName}</p>
                      {isEditing ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="number"
                            min={1}
                            value={editStartPage}
                            onChange={(e) => setEditStartPage(e.target.value)}
                            className="w-12 px-1 py-0.5 text-[10px] font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-center focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-[10px] text-zinc-500">–</span>
                          <input
                            type="number"
                            min={1}
                            value={editEndPage}
                            onChange={(e) => setEditEndPage(e.target.value)}
                            className="w-12 px-1 py-0.5 text-[10px] font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-center focus:outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={applyEdit}
                            className="px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded transition-colors"
                          >
                            ✓
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-zinc-500 tabular-nums">
                          pp. {chunk.startPage}–{chunk.endPage} ({chunk.pageCount})
                        </p>
                      )}
                    </div>

                    {/* Edit / Delete buttons */}
                    {!isEditing && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => startEditing(chunk)}
                          title="Edit range"
                          className="p-0.5 text-zinc-600 hover:text-zinc-200 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeChunk(chunk.id)}
                          title="Remove chunk"
                          className="p-0.5 text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Divider ──────────────────────────────────── */}
      <div className="border-t border-zinc-800" />

      {/* ── Timeline Preview ─────────────────────────── */}
      {chunks.length > 0 && (
        <div className="space-y-2">
          <SectionHeader label="Timeline" />
          <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-zinc-800">
            {chunks.map((chunk) => (
              <div
                key={chunk.id}
                className={`h-full ${CHUNK_BG[chunk.colorIndex % CHUNK_BG.length]} transition-all`}
                style={{ flex: chunk.pageCount }}
                title={`${chunk.sourceName}: pp. ${chunk.startPage}–${chunk.endPage} (${chunk.pageCount} pages)`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Preview Bar ──────────────────────────────── */}
      <PreviewBar
        icon="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 13a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z"
        summary={previewSummary}
      />
    </DialogShell>
  );
}
