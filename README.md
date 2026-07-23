# 📱 pdfhandler-ng

**pdfhandler-ng** is the responsive, mobile-first version of [pdfhandler](https://github.com/vigliafg/pdfhandler) — a web application for manipulating PDF documents. Built with **React 19**, **TypeScript 6**, and **Tailwind CSS 4**, it offers the same 20 PDF tools with a fully responsive UI that adapts from desktop to tablet to smartphone.

No uploads to external servers. No watermarks. No paywalls. Everything happens client-side.

<p align="center">
  <img src="https://img.shields.io/badge/platform-web-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178c6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/responsive-mobile--first-green" alt="Responsive" />
</p>

---

## Table of Contents

- [Introduction](#introduction)
- [Responsive Design](#responsive-design)
- [Getting Started](#getting-started)
- [Application Overview](#application-overview)
  - [Viewer Mode](#viewer-mode)
  - [Editor Mode](#editor-mode)
  - [Hamburger Menu](#hamburger-menu)
- [Tools Reference](#tools-reference)
  - [Page Tools](#page-tools)
  - [Document Tools](#document-tools)
- [Custom Dialogs](#custom-dialogs)
- [TOC Navigation](#toc-navigation)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [License](#license)

---

## Introduction

**pdfhandler-ng** is the next-generation responsive variant of pdfhandler. It preserves all 20 PDF manipulation tools while introducing:

- **Mobile-first responsive UI** — drawer-based navigation, bottom sheets, adaptive toolbars
- **Custom dialog system** — native `prompt()`/`confirm()`/`alert()` replaced with scrollable bottom sheets (mobile) and centered modals (desktop)
- **Dynamic thumbnail scaling** — editor grid fills the entire viewport width with zero wasted space
- **Touch-optimized** — all interactive elements have 44px minimum touch targets (WCAG 2.5.5)
- **Auto-switch mode** — clicking a page tool from Viewer mode automatically switches to Editor mode

---

## Responsive Design

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| **Desktop** | ≥ 1024px | Persistent drawer sidebar, centered modals, side-panel TOC |
| **Tablet** | 768–1023px | Overlay drawer, bottom sheets, scrollable panels |
| **Mobile** | < 768px | Full-screen drawer overlay, bottom toolbar, TOC as bottom sheet |

Key responsive features:
- **DrawerMenu**: Persistent `w-64` sidebar on desktop, full overlay on tablet/mobile with backdrop blur
- **BottomToolbar**: Visible only on mobile, provides quick access to View/Edit/Contents/Tools
- **TOCPanel**: Side panel on desktop, scrollable bottom sheet (`max-h-[70vh]`) on mobile
- **DialogSheet**: Centered modal on desktop, bottom sheet with handle bar on mobile
- **ViewerPanel toolbar**: Full toolbar with layout modes (Single/Double/Triple), zoom, rotation, page navigation — all with 44px touch targets

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm**

### Development (Local)

```bash
# Clone the repository
git clone https://github.com/vigliafg/pdfhandler-ng.git
cd pdfhandler-ng

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Open **http://localhost:5174** in your browser.

### Production Build

```bash
npm run build
```

The output is in the `dist/` directory.

---

## Application Overview

The application has two main modes, toggled via the header or the bottom toolbar on mobile:

### Viewer Mode

A responsive PDF reader with:
- **Layout modes**: Single page, double-page spread, or 3-column view
- **Zoom**: Manual zoom in/out, fit-to-width
- **Rotation**: Rotate 90° CW or CCW
- **Page navigation**: Prev/next buttons, direct page jump input
- **Responsive toolbar**: All controls adapt from icon+label on desktop to compact icon-only on mobile

### Editor Mode

A thumbnail-based editor with:
- **Dynamic thumbnail grid**: Configurable columns (2–6), thumbnails scale to fill 100% of viewport width with zero horizontal gaps
- **Page selection**: Click, shift+click for ranges, Select All / Deselect All
- **Reorder mode**: Swap pages by entering numbers or drag-and-drop
- **Selection counter**: Visual badge showing selected page count

### Hamburger Menu

The hamburger menu adapts to the current mode:
- **Viewer drawer**: Navigation section (Contents, Download, Open) expanded by default; Editor Tools and Document Tools collapsible
- **Editor drawer**: Page Tools section expanded by default; Document Tools and Navigation collapsible
- **Auto-switch**: Clicking a page tool from Viewer mode automatically switches to Editor for page selection

---

## Tools Reference

All 20 tools from the original pdfhandler are available:

### Page Tools

| Tool | Description |
|------|-------------|
| **Extract** | Extract selected pages as single PDF or ZIP of individual pages |
| **Insert / Replace** | Insert pages from another PDF or replace selected pages |
| **Delete** | Remove selected pages (TOC preserved) |
| **Rotate** | Rotate selected pages by 90°, 180°, or 270° |
| **Copy / Move** | Duplicate or relocate selected pages |
| **Reverse** | Reverse order of all or selected pages |
| **Split** | Split PDF into chunks of N pages each |
| **Merge** | Combine multiple PDF files |
| **Extract & Montage** | Build a new PDF from page ranges of multiple sources |
| **Reorder** | Rearrange pages via swap or drag-and-drop |

### Document Tools

| Tool | Description |
|------|-------------|
| **Info** | View PDF metadata, page count, and file size |
| **Metadata** | Edit title, author, subject, keywords |
| **Watermark** | Add text watermark with configurable font, opacity, angle, position |
| **Watermark img** | Add image watermark (PNG/JPEG) |
| **Numera pagine** | Add page numbers with custom format |
| **Aggiungi pagine** | Insert blank A4 pages |
| **Esporta PNG** | Export all pages as PNG images in a ZIP |
| **Estrai testo** | Extract all text as a `.txt` file |
| **Cifra** | Encrypt PDF with AES-256-GCM password |
| **Decifra** | Decrypt `.pdf.enc` files |

---

## Custom Dialogs

pdfhandler-ng replaces all native browser dialogs with a custom `DialogSheet` component:

| Type | Desktop | Mobile |
|------|---------|--------|
| **Alert** | Centered modal, click backdrop to dismiss | Bottom sheet, backdrop dismiss |
| **Confirm** | Centered modal with OK/Cancel | Bottom sheet with OK/Cancel |
| **Prompt** | Centered modal with text input, autofocus | Bottom sheet with text input |

All dialogs:
- Have scrollable content areas (`max-h-[40vh]`)
- Use 44px minimum touch targets
- Support Enter/Escape keyboard shortcuts
- Animate with slide-up (mobile) or fade-in (desktop)

---

## TOC Navigation

The Table of Contents panel:
- **Desktop**: Persistent side panel (`w-72`) with scrollable tree
- **Mobile**: Bottom sheet (`max-h-[70vh]`) that auto-closes after navigation
- **Hierarchical**: Expandable/collapsible entries with page numbers
- **Touch targets**: All entries have `min-h-[44px]` with active state feedback

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | React 19 |
| **Language** | TypeScript 6.0 |
| **Bundler** | Vite 8 |
| **Styling** | Tailwind CSS 4 |
| **PDF Rendering** | pdfjs-dist 6 |
| **PDF Manipulation** | pdf-lib 1.17 |
| **Archiving** | JSZip 3 |

---

## Project Structure

```
pdfhandler-ng/
├── src/                          # Frontend source code
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root component, orchestrates all tools
│   ├── index.css                 # Global styles (Tailwind + responsive)
│   ├── index.html                # HTML entry point
│   ├── tsconfig.json             # TypeScript config
│   ├── components/
│   │   ├── TopBar.tsx            # Header with hamburger + actions
│   │   ├── DrawerMenu.tsx        # Responsive drawer (sidebar/overlay)
│   │   ├── BottomToolbar.tsx     # Mobile bottom navigation bar
│   │   ├── PDFUploader.tsx       # Drag-and-drop PDF upload
│   │   ├── ViewerPanel.tsx       # PDF reader (viewer mode)
│   │   ├── EditorPanel.tsx       # Thumbnail grid editor
│   │   ├── TOCPanel.tsx          # Table of contents (side panel / bottom sheet)
│   │   ├── DialogSheet.tsx       # Custom dialog (modal / bottom sheet)
│   │   └── Toast.tsx             # Toast notification system
│   ├── hooks/
│   │   ├── usePDFLoader.ts       # PDF loading and lifecycle
│   │   ├── usePageSelection.ts   # Page multi-selection logic
│   │   ├── useReorder.ts         # Reorder mode state
│   │   ├── useToolState.ts       # Page tools state management
│   │   ├── useDocToolState.ts    # Document tools state management
│   │   ├── useResponsiveLayout.ts # Breakpoint detection (mobile/tablet/desktop)
│   │   └── useDialog.tsx         # Dialog state management
│   └── lib/
│       ├── pdfOperations.ts      # Core PDF operations
│       ├── pdfExtractor.ts       # Page extraction
│       ├── pdfComposer.ts        # Multi-source PDF composition
│       ├── docOperations.ts      # Metadata, watermarks, page numbers
│       ├── crypto.ts             # AES-256-GCM encryption
│       ├── export.ts             # Text extraction and PNG export
│       ├── pdfRenderer.ts        # pdfjs-dist rendering utilities
│       ├── pdfMapping.ts         # Page number remapping for TOC
│       └── pdfOutline.ts         # TOC/outline read/write
├── scripts/
│   └── start.sh                  # Dev server launcher
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## License

[MIT](LICENSE)
