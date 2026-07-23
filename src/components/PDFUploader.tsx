import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react';

interface PDFUploaderProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
  error: string | null;
}

export function PDFUploader({ onFileSelect, loading, error }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.pdf.enc')) {
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0]; if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4 safe-bottom">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center w-full max-w-md
          h-56 md:h-72 border-2 border-dashed rounded-2xl cursor-pointer
          transition-all duration-300 ease-out
          ${isDragging ? 'border-blue-400 bg-blue-500/10 scale-[1.02] shadow-lg shadow-blue-500/20'
            : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-900'}
          ${loading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input ref={inputRef} type="file" accept="application/pdf,.pdf,.pdf.enc" onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />

        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-zinc-400 text-lg font-medium">Loading PDF...</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <svg className="w-14 h-14 md:w-16 md:h-16 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-zinc-300 text-lg md:text-xl font-semibold mb-1">Drop your PDF here</p>
            <p className="text-zinc-500 text-xs md:text-sm mb-4">or tap to browse</p>
            <span className="px-3 py-1 text-xs font-medium text-zinc-500 bg-zinc-800 rounded-full border border-zinc-700/50">PDF / .pdf.enc</span>
          </>
        )}

        {error && (
          <div className="mt-4 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs md:text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
