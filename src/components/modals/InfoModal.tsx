import { useEffect, useState } from 'react';
import { getPDFInfo, type PDFInfo } from '../../lib/docOperations';
import { ModalWrapper, HelpBox, ErrorBanner } from './shared';

interface Props { pdfBytes: ArrayBuffer; fileName: string; onClose: () => void; }

export function InfoModal({ pdfBytes, fileName, onClose }: Props) {
  const [info, setInfo] = useState<PDFInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getPDFInfo(pdfBytes).then(setInfo).catch((e: Error) => setErr(e.message));
  }, [pdfBytes]);

  return (
    <ModalWrapper title={`Info: ${fileName}`} onClose={onClose}>
      <HelpBox>View document properties including page count, file size, and embedded metadata.</HelpBox>

      {err && <ErrorBanner message={err} />}
      {!info && !err && <p className="text-zinc-400 text-sm">Loading...</p>}
      {info && (
        <div className="space-y-3 text-sm">
          <Row label="Pages" value={info.pageCount.toString()} />
          <Row label="File size" value={formatBytes(info.fileSizeBytes)} />
          <div className="border-t border-zinc-700 pt-2" />
          <Row label="Title" value={info.title} />
          <Row label="Author" value={info.author} />
          <Row label="Subject" value={info.subject} />
          <Row label="Keywords" value={info.keywords} />
          <Row label="Creator" value={info.creator} />
          <Row label="Producer" value={info.producer} />
          {info.pageSizes[0] && <Row label="Page size" value={`${info.pageSizes[0].width.toFixed(0)} × ${info.pageSizes[0].height.toFixed(0)} pts`} />}
        </div>
      )}
    </ModalWrapper>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 font-medium truncate ml-4 max-w-[250px]">{value}</span>
    </div>
  );
}

function formatBytes(b: number): string {
  return b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
}
