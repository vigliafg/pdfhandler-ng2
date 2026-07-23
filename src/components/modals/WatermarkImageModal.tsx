import { useState, useRef } from 'react';
import { watermarkImage } from '../../lib/docOperations';
import { ModalWrapper, Field, HelpBox, ErrorBanner } from './shared';

interface Props { pdfBytes: ArrayBuffer; onApply: (bytes: Uint8Array) => void; onClose: () => void; }

export function WatermarkImageModal({ pdfBytes, onApply, onClose }: Props) {
  const [imgBytes, setImgBytes] = useState<ArrayBuffer | null>(null);
  const [imgType, setImgType] = useState<'png' | 'jpg'>('png');
  const [scale, setScale] = useState(0.3);
  const [opacity, setOpacity] = useState(0.2);
  const [position, setPosition] = useState<'center' | 'tile'>('center');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    setImgBytes(buf);
    setImgType(f.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg');
  };

  const handleApply = async () => {
    if (!imgBytes) return;
    setLoading(true);
    setError(null);
    try {
      const bytes = await watermarkImage(pdfBytes, { imageBytes: imgBytes, imageType: imgType, scale, opacity, position });
      onApply(bytes);
      onClose();
    } catch (e: any) { setError(e.message || 'Failed to apply image watermark.'); }
    finally { setLoading(false); }
  };

  return (
    <ModalWrapper title="Watermark Image" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <HelpBox>Overlay a PNG or JPEG image as a watermark on every page. Adjust scale, opacity, and choose center or tiled placement.</HelpBox>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <div onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center h-24 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-500/5 transition-all">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={handleFile} className="hidden" />
          {imgBytes ? <span className="text-emerald-400">✅ Image loaded</span> : <span className="text-zinc-500">Click to upload PNG/JPG</span>}
        </div>
        <div className="flex gap-3">
          <Field label="Scale" className="flex-1">
            <input type="range" min="0.05" max="1" step="0.05" value={scale}
              onChange={(e) => setScale(+e.target.value)} className="w-full accent-emerald-500" />
            <span className="text-zinc-500 text-xs">{scale.toFixed(2)}</span>
          </Field>
          <Field label="Opacity" className="flex-1">
            <input type="range" min="0.05" max="1" step="0.05" value={opacity}
              onChange={(e) => setOpacity(+e.target.value)} className="w-full accent-emerald-500" />
            <span className="text-zinc-500 text-xs">{opacity.toFixed(2)}</span>
          </Field>
        </div>
        <Field label="Position">
          <select value={position} onChange={(e) => setPosition(e.target.value as any)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200">
            <option value="center">Center</option>
            <option value="tile">Tile (repeat)</option>
          </select>
        </Field>
        <button onClick={handleApply} disabled={!imgBytes || loading}
          className="w-full py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors mt-2">
          {loading ? 'Applying...' : 'Apply Watermark'}
        </button>
      </div>
    </ModalWrapper>
  );
}
