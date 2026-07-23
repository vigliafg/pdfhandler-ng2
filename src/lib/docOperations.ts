import { PDFDocument, StandardFonts, rgb, PageSizes, RotationTypes } from 'pdf-lib';

// ─── Helpers ────────────────────────────────────────────────

async function loadPDF(data: ArrayBuffer): Promise<PDFDocument> {
  return PDFDocument.load(data, { ignoreEncryption: true });
}

// ─── Metadata ───────────────────────────────────────────────

export interface PDFMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

export async function setMetadata(
  sourcePdfBytes: ArrayBuffer,
  meta: PDFMetadata,
): Promise<Uint8Array> {
  const doc = await loadPDF(sourcePdfBytes);
  doc.setTitle(meta.title);
  doc.setAuthor(meta.author);
  doc.setSubject(meta.subject);
  doc.setKeywords([meta.keywords]);
  return doc.save();
}

export async function getMetadata(
  sourcePdfBytes: ArrayBuffer,
): Promise<PDFMetadata> {
  const doc = await loadPDF(sourcePdfBytes);
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: doc.getKeywords() ?? '',
  };
}

// ─── Watermark Text ─────────────────────────────────────────

export interface WatermarkTextOptions {
  text: string;
  fontSize: number;
  opacity: number; // 0-1
  angle: number; // degrees
  color: { r: number; g: number; b: number }; // 0-1
  /** 'center' | 'tile' | custom {x, y} */
  position: 'center' | 'tile' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export async function watermarkText(
  sourcePdfBytes: ArrayBuffer,
  options: WatermarkTextOptions,
): Promise<Uint8Array> {
  const doc = await loadPDF(sourcePdfBytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();

    if (options.position === 'tile') {
      // Render watermark in a grid pattern
      const stepX = width / 3;
      const stepY = height / 3;
      for (let cx = stepX / 2; cx < width; cx += stepX) {
        for (let cy = stepY / 2; cy < height; cy += stepY) {
          page.drawText(options.text, {
            x: cx - options.fontSize * 2,
            y: cy,
            size: options.fontSize,
            font,
            color: rgb(options.color.r, options.color.g, options.color.b),
            opacity: options.opacity,
            rotate: { type: RotationTypes.Degrees, angle: options.angle },
          });
        }
      }
    } else {
      // Single centered or corner watermark
      const pos = getPositionXY(width, height, options.position, options.fontSize);
      page.drawText(options.text, {
        x: pos.x,
        y: pos.y,
        size: options.fontSize,
        font,
        color: rgb(options.color.r, options.color.g, options.color.b),
        opacity: options.opacity,
        rotate: { type: RotationTypes.Degrees, angle: options.angle },
      });
    }
  }

  return doc.save();
}

function getPositionXY(
  w: number, h: number,
  pos: WatermarkTextOptions['position'],
  fontSize: number,
): { x: number; y: number } {
  const pad = 40;
  switch (pos) {
    case 'center': return { x: w / 2 - fontSize * 2.5, y: h / 2 };
    case 'top-left': return { x: pad, y: h - pad - fontSize };
    case 'top-right': return { x: w - pad - fontSize * 4, y: h - pad - fontSize };
    case 'bottom-left': return { x: pad, y: pad };
    case 'bottom-right': return { x: w - pad - fontSize * 4, y: pad };
    default: return { x: w / 2 - fontSize * 2.5, y: h / 2 };
  }
}

// ─── Watermark Image ────────────────────────────────────────

export interface WatermarkImageOptions {
  imageBytes: ArrayBuffer;
  imageType: 'png' | 'jpg';
  scale: number; // 0-1, relative to page width
  opacity: number;
  position: 'center' | 'tile';
}

export async function watermarkImage(
  sourcePdfBytes: ArrayBuffer,
  options: WatermarkImageOptions,
): Promise<Uint8Array> {
  const doc = await loadPDF(sourcePdfBytes);
  const image = options.imageType === 'png'
    ? await doc.embedPng(options.imageBytes)
    : await doc.embedJpg(options.imageBytes);

  const pages = doc.getPages();
  const imgDims = image.scale(1);

  for (const page of pages) {
    const { width, height } = page.getSize();
    const targetW = width * options.scale;
    const targetH = (imgDims.height / imgDims.width) * targetW;

    if (options.position === 'tile') {
      const stepX = width / 2;
      const stepY = height / 2;
      for (let cx = stepX / 2; cx < width; cx += stepX) {
        for (let cy = stepY / 2; cy < height; cy += stepY) {
          page.drawImage(image, {
            x: cx - targetW / 2,
            y: cy - targetH / 2,
            width: targetW,
            height: targetH,
            opacity: options.opacity,
          });
        }
      }
    } else {
      page.drawImage(image, {
        x: width / 2 - targetW / 2,
        y: height / 2 - targetH / 2,
        width: targetW,
        height: targetH,
        opacity: options.opacity,
      });
    }
  }

  return doc.save();
}

// ─── Page Numbers ───────────────────────────────────────────

export interface PageNumbersOptions {
  /** Format: {n} = current page, {t} = total. Example: "Page {n} of {t}" */
  format: string;
  fontSize: number;
  position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center';
  /** Starting page number (1-based) — useful if the first pages are cover */
  startAt: number;
}

export async function addPageNumbers(
  sourcePdfBytes: ArrayBuffer,
  options: PageNumbersOptions,
): Promise<Uint8Array> {
  const doc = await loadPDF(sourcePdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  for (let i = 0; i < total; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const num = (i + options.startAt).toString();
    const text = options.format.replace('{n}', num).replace('{t}', total.toString());

    const textWidth = text.length * options.fontSize * 0.6;
    let x: number;
    const yBottom = 30;
    const yTop = height - 30;

    switch (options.position) {
      case 'bottom-center': x = width / 2 - textWidth / 2; break;
      case 'bottom-right': x = width - textWidth - 40; break;
      case 'bottom-left': x = 40; break;
      case 'top-center': x = width / 2 - textWidth / 2; break;
    }

    const y = options.position.startsWith('top') ? yTop : yBottom;

    page.drawText(text, {
      x,
      y,
      size: options.fontSize,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  return doc.save();
}

// ─── Blank Pages ────────────────────────────────────────────

export interface BlankPagesOptions {
  count: number;
  position: 'start' | 'end' | number; // page number after which to insert (1-based)
  size: 'A4' | 'Letter';
}

const PAGE_SIZES: Record<string, [number, number]> = {
  A4: PageSizes.A4 as [number, number],
  Letter: PageSizes.Letter as [number, number],
};

export async function addBlankPages(
  sourcePdfBytes: ArrayBuffer,
  options: BlankPagesOptions,
): Promise<Uint8Array> {
  const doc = await loadPDF(sourcePdfBytes);
  const total = doc.getPageCount();
  const dims = PAGE_SIZES[options.size] ?? PageSizes.A4;

  let insertIdx: number;
  if (options.position === 'start') insertIdx = 0;
  else if (options.position === 'end') insertIdx = total;
  else insertIdx = Math.min(options.position, total);

  for (let i = 0; i < options.count; i++) {
    doc.insertPage(insertIdx + i, dims);
  }

  return doc.save();
}

// ─── Info ───────────────────────────────────────────────────

export interface PDFInfo {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  pageCount: number;
  fileSizeBytes: number;
  pageSizes: { width: number; height: number }[];
}

export async function getPDFInfo(
  sourcePdfBytes: ArrayBuffer,
): Promise<PDFInfo> {
  const doc = await loadPDF(sourcePdfBytes);
  const pages = doc.getPages();

  return {
    title: doc.getTitle() ?? '—',
    author: doc.getAuthor() ?? '—',
    subject: doc.getSubject() ?? '—',
    keywords: doc.getKeywords() ?? '—',
    creator: doc.getCreator() ?? '—',
    producer: doc.getProducer() ?? '—',
    pageCount: doc.getPageCount(),
    fileSizeBytes: sourcePdfBytes.byteLength,
    pageSizes: pages.map((p) => {
      const s = p.getSize();
      return { width: s.width, height: s.height };
    }),
  };
}
