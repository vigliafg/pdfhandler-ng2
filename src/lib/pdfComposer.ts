import { PDFDocument } from 'pdf-lib';

export interface SourcePDF {
  id: string;
  name: string;
  data: ArrayBuffer;
  totalPages: number;
}

export interface Chunk {
  id: string;
  sourceId: string;
  sourceName: string;
  colorIndex: number;
  startPage: number;  // 1-based
  endPage: number;    // 1-based
  pageCount: number;
}

/**
 * Compose a new PDF from chunks of multiple source PDFs.
 * Each chunk specifies a page range from a source PDF.
 * Chunks are assembled in order.
 */
export async function composePDF(
  chunks: Chunk[],
  sources: Map<string, SourcePDF>,
): Promise<Uint8Array> {
  const result = await PDFDocument.create();

  for (const chunk of chunks) {
    const source = sources.get(chunk.sourceId);
    if (!source) throw new Error(`Source PDF "${chunk.sourceName}" not found`);
    const srcDoc = await PDFDocument.load(source.data, { ignoreEncryption: true });
    const indices: number[] = [];
    for (let p = chunk.startPage; p <= chunk.endPage; p++) indices.push(p - 1);
    const pages = await result.copyPages(srcDoc, indices);
    for (const page of pages) result.addPage(page);
  }

  return result.save();
}
