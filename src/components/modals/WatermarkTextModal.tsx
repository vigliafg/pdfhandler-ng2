import { useState } from 'react';
import { watermarkText, type WatermarkTextOptions } from '../../lib/docOperations';
import { ModalWrapper, Field, HelpBox, ErrorBanner } from './shared';

interface Props { pdfBytes: ArrayBuffer; onApply: (bytes: Uint8Array) => void; onClose: () => void; }

const DEFAULT: WatermarkTextOptions = {
  text: 'CONFIDENTIAL',
  fontSize: 40,
  opacity: 0.15,
  angle: -45,
  color: { r: 0.5, g: 0.5, b: 0.5 },
  position: 'center',
};

export function WatermarkTextModal({ pdfBytes, onApply, onClose }: Props) {
  const [opts, setOpts] = useState(DEFAULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    setLoading(true);
    setError(null);
    try {
      const bytes = await watermarkText(pdfBytes, opts);
      onApply(bytes);
      onClose();
    } catch (e: any) { setError(e.message || 'Failed to apply watermark.'); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper title="Watermark Text" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <HelpBox>Add a text watermark (e.g. "CONFIDENTIAL", "DRAFT") across every page. You can customize font size, angle, opacity, and position.</HelpBox>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <Field label="Text">
          <input value={opts.text} onChange={(e) => setOpts((p) => ({ ...p, text: e.target.value }))}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-emerald-500" />
        </Field>
        <div className="flex gap-3">
          <Field label="Font Size" className="flex-1">
            <input type="number" value={opts.fontSize} onChange={(e) => setOpts((p) => ({ ...p, fontSize: +e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-center" />
          </Field>
          <Field label="Angle °" className="flex-1">
            <input type="number" value={opts.angle} onChange={(e) => setOpts((p) => ({ ...p, angle: +e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-center" />
          </Field>
        </div>
        <Field label="Opacity">
          <input type="range" min="0.05" max="1" step="0.05" value={opts.opacity}
            onChange={(e) => setOpts((p) => ({ ...p, opacity: +e.target.value }))}
            className="w-full accent-emerald-500" />
          <span className="text-zinc-500 text-xs">{opts.opacity.toFixed(2)}</span>
        </Field>
        <Field label="Position">
          <select value={opts.position} onChange={(e) => setOpts((p) => ({ ...p, position: e.target.value as any }))}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200">
            <option value="center">Center</option>
            <option value="tile">Tile (repeat)</option>
            <option value="top-left">Top Left</option>
            <option value="top-right">Top Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="bottom-right">Bottom Right</option>
          </select>
        </Field>
        <button onClick={handleApply} disabled={loading}
          className="w-full py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors mt-2">
          {loading ? 'Applying...' : 'Apply Watermark'}
        </button>
      </div>
    </ModalWrapper>
  );
}
