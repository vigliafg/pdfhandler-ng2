import { useState, useEffect } from 'react';
import { getMetadata, setMetadata, type PDFMetadata } from '../../lib/docOperations';
import { ModalWrapper, HelpBox, ErrorBanner } from './shared';

interface Props { pdfBytes: ArrayBuffer; onApply: (bytes: Uint8Array) => void; onClose: () => void; }

export function MetadataModal({ pdfBytes, onApply, onClose }: Props) {
  const [meta, setMeta] = useState<PDFMetadata>({ title: '', author: '', subject: '', keywords: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMetadata(pdfBytes).then(setMeta).catch(() => {});
  }, [pdfBytes]);

  const handleApply = async () => {
    setLoading(true);
    setError(null);
    try {
      const bytes = await setMetadata(pdfBytes, meta);
      onApply(bytes);
      onClose();
    } catch (e: any) { setError(e.message || 'Failed to save metadata.'); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper title="Edit Metadata" onClose={onClose}>
      <div className="space-y-3">
        <HelpBox>Edit the PDF document properties (title, author, subject, keywords). These are embedded in the file and visible in PDF readers.</HelpBox>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {(['title', 'author', 'subject', 'keywords'] as const).map((k) => (
          <div key={k}>
            <label className="text-xs text-zinc-500 capitalize mb-1 block">{k}</label>
            <input
              value={meta[k]}
              onChange={(e) => setMeta((p) => ({ ...p, [k]: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        ))}
        <button onClick={handleApply} disabled={loading}
          className="w-full py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors mt-2">
          {loading ? 'Saving...' : 'Apply Metadata'}
        </button>
      </div>
    </ModalWrapper>
  );
}
