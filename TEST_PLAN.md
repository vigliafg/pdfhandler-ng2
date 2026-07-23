# 📋 Test Plan — pdfhandler-ng-test (Unified Viewport)

> **PDF di test:** `modern.pdf` (9 MB, multi-pagina con TOC) / `venerdi.pdf` (22 MB, multi-pagina)  
> **Viewport:** Desktop 1920×1080, Tablet 768×1024, Smartphone 375×812  
> **Data:** 24 luglio 2026  

---

## 🔧 Setup iniziale

- [ ] Avviare dev server: `cd pdfhandler-ng-test && npm run dev`
- [ ] Aprire `http://localhost:5174` in Chrome (modalità normale + incognito)
- [ ] Verificare che la pagina di upload si carichi senza errori console

---

## 📂 Caricamento PDF

| # | Test | Atteso |
|---|------|--------|
| 1 | Trascinare `modern.pdf` nella drop zone | PDF caricato, viewer attivo in modalità Single |
| 2 | Caricare `venerdi.pdf` (22 MB) | Caricamento completato, nessun crash |
| 3 | Caricare un `.pdf.enc` (cifrato) | Toast "PDF cifrato — usa Decifra nel menu" |
| 4 | Caricare un file non-PDF | Messaggio di errore |

---

## 🖥️ Unified Viewport — Layout

| # | Test | Atteso |
|---|------|--------|
| 5 | Layout **Single** — toolbar mostra [1][2][3][Grid] | 1 pagina per riga, zoomabile |
| 6 | Layout **Double** | 2 pagine affiancate, fit-to-width |
| 7 | Layout **Triple** | 3 pagine affiancate, fit-to-width |
| 8 | Layout **Grid** — default 5 colonne | Thumbnail riempiono tutto il viewport, **zero spazi vuoti** |
| 9 | Grid a **3 colonne** | Nessuno spazio a destra/sinistra |
| 10 | Grid a **4 colonne** | Nessuno spazio a destra/sinistra |
| 11 | Grid a **5 colonne** | Nessuno spazio a destra/sinistra |
| 12 | Grid a **6 colonne** | Nessuno spazio a destra/sinistra |
| 13 | Grid su **mobile** (2-3-4 colonne) | Nessuno spazio a destra/sinistra |

---

## 🔍 Zoom / Rotazione (Single/Double/Triple)

| # | Test | Atteso |
|---|------|--------|
| 14 | Zoom in [+] | Scala aumenta del 25%, label aggiornata |
| 15 | Zoom out [-] | Scala diminuisce del 25% |
| 16 | Fit width | Le pagine occupano tutta la larghezza |
| 17 | Ruota destra ↻ | Pagine ruotate di 90° |
| 18 | Ruota sinistra ↺ | Pagine ruotate di -90° |
| 19 | Zoom + rotazione combinati | Entrambi applicati correttamente |

---

## ✂️ Toggle Selezione

| # | Test | Atteso |
|---|------|--------|
| 20 | Premere **[✂️ Select]** | Overlay blu appare sulle pagine |
| 21 | Cliccare una pagina in modalità Select | Pagina selezionata (bordo blu + checkmark) |
| 22 | Shift+click su due pagine | Range selezionato (tutte le pagine intermedie) |
| 23 | Premere **All** | Tutte le pagine selezionate, badge "X sel." visibile |
| 24 | Premere **None** | Tutte deselezionate |
| 25 | Premere di nuovo **[✂️ Select]** | Modalità Select disattivata, overlay rimosso |
| 26 | Toggle Select via **BottomToolbar** (mobile) | Stesso comportamento |
| 27 | Toggle Select via **drawer** (Select All / Deselect All) | Stesso comportamento |

---

## 📄 Page Navigation

| # | Test | Atteso |
|---|------|--------|
| 28 | ◀ Previous / Next ▶ | Naviga avanti/indietro di `cols` pagine |
| 29 | Indicatore pagina "X / Y" | Mostra pagina corrente / totale |
| 30 | Jump-to-page (input numerico) | Inserire numero → Enter → scrolla alla pagina |
| 31 | Scroll libero | La pagina corrente si aggiorna automaticamente |

---

## 🧭 TOC (Table of Contents)

| # | Test | Atteso |
|---|------|--------|
| 32 | Caricare `modern.pdf` (ha TOC), premere **TOC** | Pannello TOC aperto |
| 33 | Desktop: TOC come side panel (sinistra) | Panel `w-72`, scrollabile se voci > viewport |
| 34 | Mobile: TOC come **bottom sheet** | Bottom sheet con handle bar, `max-h-[70vh]` |
| 35 | Cliccare una voce TOC | Naviga alla pagina corrispondente |
| 36 | Su mobile: dopo click TOC → chiusura automatica | Bottom sheet si chiude |
| 37 | TOC con voci annidate (expand/collapse) | Figli mostrati/nascosti correttamente |
| 38 | Touch target voci TOC ≥ 44px | `min-h-[44px]` su ogni voce |
| 39 | PDF senza TOC → premere TOC | Nessun errore, pannello vuoto o messaggio |

---

## 🍔 Drawer Menu (Hamburger)

| # | Test | Atteso |
|---|------|--------|
| 40 | Aprire drawer (☰) | Drawer laterale (desktop) o overlay (mobile) |
| 41 | **Page Tools** espanso di default | Extract, Insert/Replace, Delete, Rotate, Copy/Move, Reverse, Split, Merge, Compose, Reorder |
| 42 | **Document Tools** collassato di default | Info, Metadata, Watermark, Watermark img, Numera pagine, Aggiungi pagine, Esporta PNG, Estrai testo, Cifra, Decifra |
| 43 | **Navigation** collassato di default | Download, Open PDF, Contents |
| 44 | Cliccare un tool → chiude drawer su mobile | Sì |
| 45 | Drawer NON causa blur del viewport | Viewport rimane nitido |

---

## 🪟 Page Tool Modals

> **Ogni modale deve:** aprirsi al click del tool, mostrare il **RangeSelector** (All/Current/Selected/Custom), avere i pulsanti Cancel/Execute, validare gli input, eseguire l'operazione correttamente, chiudersi al termine, preservare il TOC se presente.

### 46-52 — Extract

| # | Test | Atteso |
|---|------|--------|
| 46 | Aprire Extract, Range "All pages", ZIP=No | Scarica PDF singolo con tutte le pagine |
| 47 | Range "Custom: 1-3,5", ZIP=No | Scarica PDF con pagine 1,2,3,5 |
| 48 | Range "Custom: 10-" (open-ended) | Scarica PDF da pagina 10 alla fine |
| 49 | Range "Selected pages" (con pagine selezionate visivamente) | Usa le pagine selezionate |
| 50 | Range "Selected pages" (senza selezione) | Opzione disabilitata o errore |
| 51 | ZIP=Yes | Scarica ZIP con file separati per pagina |
| 52 | "Delete after extraction" | Pagine rimosse dal PDF originale dopo estrazione |

### 53-58 — Delete

| # | Test | Atteso |
|---|------|--------|
| 53 | Eliminare pagine 1-3 con Range "Custom" | PDF ricaricato senza pagine 1-3 |
| 54 | Eliminare con Range "All pages" | Errore o conferma "eliminare tutto?" |
| 55 | Preview bar mostra conteggio pagine | "X pages will be deleted" |
| 56 | TOC preservato dopo delete | I bookmark delle pagine rimanenti sono corretti |
| 57 | Undo non disponibile → messaggio chiaro | "This is permanent" nel preview |
| 58 | Range "Current page" | Elimina solo la pagina corrente |

### 59-62 — Rotate

| # | Test | Atteso |
|---|------|--------|
| 59 | Ruotare pagine 1-2 di 90° | Pagine ruotate, PDF ricaricato |
| 60 | Ruotare di 180° | Pagine capovolte correttamente |
| 61 | Ruotare di 270° | Equivalente a -90° |
| 62 | TOC preservato dopo rotate | Bookmark invariati |

### 63-65 — Reverse

| # | Test | Atteso |
|---|------|--------|
| 63 | Reverse di pagine selezionate (es. 1-5) | Ordine invertito: 5,4,3,2,1 |
| 64 | Reverse di tutto il PDF (nessuna selezione) | Intero PDF invertito |
| 65 | TOC aggiornato dopo reverse | I bookmark puntano alle nuove posizioni |

### 66-72 — Copy / Move

| # | Test | Atteso |
|---|------|--------|
| 66 | Copy: copia pagine 1-2 dopo pagina 5 | Pagine 1-2 duplicate alla posizione 6-7 |
| 67 | Move: sposta pagine 1-2 prima di pagina 5 | Pagine 1-2 rimosse e reinserite |
| 68 | Copy con 3 copie | 3 duplicati delle pagine selezionate |
| 69 | Target page valido (1-numPages) | Anteprima corretta |
| 70 | Target page non valido (es. 0 o > numPages) | Errore di validazione |
| 71 | Location "before" vs "after" | Inserimento corretto |
| 72 | TOC preservato | Bookmark aggiornati |

### 73-80 — Split

| # | Test | Atteso |
|---|------|--------|
| 73 | Split "ogni N pagine" con N=10 | ZIP con chunk da 10 pagine |
| 74 | Split "in N parti uguali" con N=3 | ZIP con 3 file |
| 75 | Split "ogni pagina" | ZIP con 1 file per pagina |
| 76 | Split "custom ranges" (es. 1-5,6-10) | ZIP con 2 file |
| 77 | Split "per TOC" (PDF con bookmark) | ZIP con file per ogni voce TOC di primo livello |
| 78 | Split "per markers" (testo delimitatore) | ZIP diviso ai marker specificati |
| 79 | Filtro subset (odd/even) applicato | Solo pagine dispari/pari nei chunk |
| 80 | Split su PDF senza TOC → opzione "per TOC" | Disabilitata o messaggio chiaro |

### 81-86 — Insert / Replace

| # | Test | Atteso |
|---|------|--------|
| 81 | Insert: selezionare PDF sorgente, inserire dopo pagina 3 | Pagine inserite correttamente |
| 82 | Insert con selezione pagine dal sorgente | Solo le pagine scelte inserite |
| 83 | Replace: sostituire pagine 2-3 con pagine da altro PDF | Pagine 2-3 rimosse, nuove inserite |
| 84 | Replace senza selezionare target → errore | Messaggio "No target pages selected" |
| 85 | PDF sorgente non valido | Errore gestito |
| 86 | TOC preservato dopo insert/replace | Bookmark aggiornati |

### 87-88 — Merge

| # | Test | Atteso |
|---|------|--------|
| 87 | Merge: aggiungere 2+ file PDF | Unico PDF con tutte le pagine concatenate |
| 88 | Merge con file danneggiato | Errore gestito, gli altri file processati |

### 89-91 — Compose (Extract & Montage)

| # | Test | Atteso |
|---|------|--------|
| 89 | Compose: selezionare chunk da PDF diversi | PDF composto con i chunk specificati |
| 90 | Riordinare chunk nel montage | Ordine personalizzato rispettato |
| 91 | Output name personalizzato | Nome file corretto |

---

## 📝 Doc Tool Modals

### 92-93 — Info

| # | Test | Atteso |
|---|------|--------|
| 92 | Aprire Info | Modale con: pagine, dimensione, titolo, autore, soggetto, creator, producer |
| 93 | Info con PDF senza metadati | Campi vuoti mostrati come "—" o N/D |

### 94-97 — Metadata

| # | Test | Atteso |
|---|------|--------|
| 94 | Modificare Title + Author + Subject + Keywords | PDF ricaricato con nuovi metadati |
| 95 | Campi lasciati vuoti | Metadati rimossi (o invariati) |
| 96 | Caratteri speciali / Unicode | Supportati correttamente |
| 97 | Pulsante Cancel | Nessuna modifica applicata |

### 98-100 — Watermark (testo)

| # | Test | Atteso |
|---|------|--------|
| 98 | Watermark "CONFIDENTIAL", opacità 15%, angolo -45° | Testo in diagonale su tutte le pagine |
| 99 | Personalizzare font size, colore, posizione | Watermark applicato correttamente |
| 100 | Range "Current page only" | Watermark solo sulla pagina corrente |

### 101-102 — Watermark (immagine)

| # | Test | Atteso |
|---|------|--------|
| 101 | Caricare PNG come watermark | Immagine applicata su tutte le pagine |
| 102 | Regolare opacità e posizione | Parametri rispettati |

### 103-105 — Page Numbers

| # | Test | Atteso |
|---|------|--------|
| 103 | Formato "Page {n} of {t}", posizione bottom-center | Numeri aggiunti in fondo a ogni pagina |
| 104 | Range solo alcune pagine | Solo le pagine specificate numerate |
| 105 | Font size e start-at personalizzati | Parametri rispettati |

### 106-108 — Add Pages

| # | Test | Atteso |
|---|------|--------|
| 106 | Aggiungere 3 pagine vuote all'inizio | 3 blank page prima della pagina 1 |
| 107 | Aggiungere 2 pagine vuote alla fine | 2 blank page dopo l'ultima |
| 108 | Formato pagina (A4, Letter) | Dimensioni corrette |

---

## 🔐 Crypto

| # | Test | Atteso |
|---|------|--------|
| 109 | Cifra PDF con password "test123" | File `.pdf.enc` scaricato |
| 110 | Ricaricare il `.pdf.enc` → toast | "PDF cifrato — usa Decifra" |
| 111 | Decifra con password corretta | PDF decifrato e visualizzato |
| 112 | Decifra con password sbagliata | Toast "Decryption failed. Wrong password?" |
| 113 | Campo password vuoto → Execute disabilitato | Pulsante grigio, tooltip "Enter a password" |

---

## ⚡ Instant Doc Tools

| # | Test | Atteso |
|---|------|--------|
| 114 | Esporta PNG | ZIP con immagini PNG di ogni pagina |
| 115 | Estrai testo | File `.txt` scaricato con testo estratto |

---

## 🔄 Reorder (inline, non modale)

| # | Test | Atteso |
|---|------|--------|
| 116 | Cliccare Reorder | Modalità reorder attivata, barra Swap visibile |
| 117 | Swap pagine 1 e 5 | Le pagine si scambiano nella griglia |
| 118 | Apply reorder | PDF ricaricato con nuovo ordine |
| 119 | Cancel reorder | Torna alla visualizzazione normale, nessuna modifica |
| 120 | TOC preservato dopo reorder | Bookmark aggiornati alle nuove posizioni |

---

## 📱 Responsive Design

| # | Test | Atteso |
|---|------|--------|
| 121 | **Desktop 1920px**: drawer sempre visibile | Side panel aperto lateralmente |
| 122 | **Desktop**: TOC come side panel | Scrollabile, non overlay |
| 123 | **Desktop**: modali centrati | `max-w-lg`, scrollabili se contenuto > viewport |
| 124 | **Tablet 768px**: drawer overlay | Drawer si sovrappone al contenuto |
| 125 | **Tablet**: bottom toolbar visibile | Contents, Tools, Select |
| 126 | **Smartphone 375px**: layout Single default | Una pagina per riga |
| 127 | **Smartphone**: Grid 2-3-4 colonne | Nessuno spazio vuoto laterale |
| 128 | **Smartphone**: modali a tutto schermo | `max-h-[90vh]`, scrollabili, touch target ≥ 44px |
| 129 | **Smartphone**: TOC come bottom sheet | Handle bar, chiusura automatica dopo navigazione |
| 130 | **Smartphone**: BottomToolbar sempre visibile (con PDF) | 3 pulsanti ben spaziati |

---

## 🧹 Edge Cases & Robustezza

| # | Test | Atteso |
|---|------|--------|
| 131 | Cambiare PDF mentre un modale è aperto | Nessun crash, stato consistente |
| 132 | Eseguire due operazioni in rapida successione | La seconda attende o mostra "già in esecuzione" |
| 133 | PDF con una sola pagina — testare tutti i tool | Nessun crash, range validi (1-1) |
| 134 | PDF con centinaia di pagine — Grid a 6 colonne | Performance accettabile, scroll fluido |
| 135 | PDF con pagine landscape e portrait miste | Layout gestito correttamente (aspect ratio variabile?) |
| 136 | Aprire/chiudere drawer rapidamente | Nessun flickering o crash |
| 137 | Cambiare layout (Single↔Grid) durante selezione | Selezione mantenuta o resettata correttamente |
| 138 | Tastiera: ESC per chiudere modali | Modale chiuso |
| 139 | Tastiera: Enter nel jump-to-page | Naviga alla pagina |
| 140 | Hard refresh (Ctrl+Shift+R) con PDF caricato | Non applicabile (state non persistito) |

---

## 📊 Riepilogo

| Categoria | Test totali |
|-----------|-------------|
| Setup + Caricamento | 4 |
| Viewport + Layout | 9 |
| Zoom / Rotazione | 6 |
| Toggle Selezione | 8 |
| Page Navigation | 4 |
| TOC | 8 |
| Drawer Menu | 6 |
| Page Tool Modals | 46 |
| Doc Tool Modals | 17 |
| Crypto | 5 |
| Instant Tools | 2 |
| Reorder | 5 |
| Responsive | 10 |
| Edge Cases | 10 |
| **TOTALE** | **140** |

---

> **Note per domani:**
> - Iniziare dai test di base (caricamento, viewport, selezione) e proseguire tool per tool
> - Per ogni test fallito: screenshot, descrizione, console errors
> - Priorità massima: **Page Tool Modals** (46-91) e **Doc Tool Modals** (92-108) — sono i modali appena integrati
> - Priorità secondaria: Grid layout (8-13) e Responsive (121-130)
> - Usare `modern.pdf` per test TOC, `venerdi.pdf` per test multi-pagina generici
