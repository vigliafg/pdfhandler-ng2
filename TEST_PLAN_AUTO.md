# 🧪 Piano di test automatici — TOC & ancoraggio

> **Prerequisito:** server avviato su `http://localhost:5174/`
> **URL di test:** `http://localhost:5174/?debug=1` (carica automaticamente `hreview.pdf`)
> **Esecuzione:** ogni prompt è autonomo — incollalo in browser-use. Se browser-use non funziona, esegui i test manualmente seguendo gli stessi passi.

---

## 🔹 Gruppo A — Navigazione TOC base

| # | Prompt browser-use | Cosa verificare |
|---|-------------------|-----------------|
| A1 | `Vai a http://localhost:5174/?debug=1. Aspetta che il PDF si carichi (compaiono le pagine nel viewer). Clicca il pulsante "TOC" nella barra superiore. Verifica che appaia un pannello overlay sulla destra con la lista dei capitoli. Fai uno screenshot.` | TOC si apre come overlay destro |
| A2 | `(dopo A1) Nel TOC aperto, clicca su una voce con un numero di pagina visibile (es. la prima Section). Verifica che il viewer scrolli alla pagina corretta. Il contatore pagina in basso deve mostrare il numero giusto. Screenshot.` | Navigazione alla pagina corretta |
| A3 | `(dopo A2) Chiudi il TOC cliccando lo sfondo scuro dietro il pannello. Verifica che il viewer sia ancora sulla stessa pagina. Il contatore NON deve cambiare. Screenshot.` | Chiusura TOC mantiene posizione |
| A4 | `Riapri il TOC, clicca una voce annidata (sotto-sezione di un capitolo). Verifica che il viewer mostri la pagina esatta indicata dal TOC. Screenshot.` | Navigazione annidata |

---

## 🔹 Gruppo B — Ancoraggio cambio layout (icon mode)

| # | Prompt | Verifica |
|---|--------|----------|
| B1 | `Carica il PDF con ?debug=1. Seleziona layout Double (icona 2 pagine). Apri TOC, naviga a una pagina a metà documento. Chiudi TOC. Cambia layout a Triple (icona 3). La pagina di destinazione deve essere ancora visibile nel viewport — NON deve tornare a pagina 1.` | Double→Triple |
| B2 | `Come B1 ma parti da Single e passa a Triple.` | Single→Triple |
| B3 | `Come B1 ma parti da Double e passa a Single.` | Double→Single |
| B4 | `Come B1 ma parti da Triple e passa a Double.` | Triple→Double |

---

## 🔹 Gruppo C — Ancoraggio cambio layout (grid)

| # | Prompt | Verifica |
|---|--------|----------|
| C1 | `Naviga via TOC a una pagina specifica in layout Double. Cambia layout a Grid (icona griglia). La pagina di destinazione deve essere visibile — NON deve resettare a pagina 1.` | Icon→Grid |
| C2 | `In Grid a 5 colonne, naviga via TOC a una pagina. Cambia a 3 colonne. La pagina deve restare visibile.` | Grid interno |
| C3 | `In Grid, naviga via TOC a una pagina. Torna a layout Double. La pagina deve restare visibile.` | Grid→Icon |
| C4 | `In Grid, naviga via TOC a una pagina lontana (es. ultimo capitolo). Cambia colonne velocemente: 3→4→5→6. La pagina deve restare visibile a ogni cambio.` | Grid stress test |

---

## 🔹 Gruppo D — Edge case

| # | Prompt | Verifica |
|---|--------|----------|
| D1 | `Naviga via TOC a pagina 1. Cambia layout Double→Triple. Nessun crash, pagina 1 visibile.` | Pagina 1 |
| D2 | `Naviga via TOC all'ultima pagina del documento. Cambia layout. Ultima pagina visibile.` | Ultima pagina |
| D3 | `Naviga via TOC a pagina X. Cambia layout velocemente 5 volte (Double→Triple→Grid→Double→Triple). La pagina originale deve essere ancora visibile alla fine.` | Click veloci |
| D4 | `Apri TOC, NON navigare (non cliccare nessuna voce). Chiudi TOC cliccando fuori. Cambia layout. Il viewer non deve crashare.` | TOC aperto senza navigazione |

---

## 🔹 Gruppo E — Console errors

| # | Prompt | Verifica |
|---|--------|----------|
| E1 | `Carica il PDF con ?debug=1. Apri la console del browser (F12). Naviga via TOC a una pagina. Cambia layout. Controlla che non ci siano errori React: cerca "Rules of Hooks", "rendered more hooks", "Uncaught Error".` | Nessun errore hook |
| E2 | `Apri/chiudi TOC 3 volte di fila. Cambia layout Double→Triple→Grid. Controlla la console per errori o warning.` | Nessun memory leak |

---

## 🔹 Gruppo F — Renderizzazione pagina dopo navigazione TOC

> **Bug osservato:** a volte la pagina puntata dal TOC non viene renderizzata (area bianca/vuota nel viewer).

| # | Prompt | Verifica |
|---|--------|----------|
| F1 | `Naviga via TOC a una pagina con contenuto visibile (es. inizio sezione). Layout Single. Aspetta 2 secondi. La pagina deve essere completamente renderizzata — niente area bianca. Screenshot.` | Single: render OK |
| F2 | `Come F1 ma in layout Double. Entrambe le pagine visibili devono essere renderizzate.` | Double: render OK |
| F3 | `Come F1 ma in layout Triple. Tutte e 3 le pagine visibili devono essere renderizzate.` | Triple: render OK |
| F4 | `Come F1 ma in layout Grid (5 colonne). Tutte le miniature visibili devono essere renderizzate.` | Grid: render OK |
| F5 | `Naviga via TOC in Double. La pagina target è visibile. Cambia a Triple. La pagina target deve essere ancora renderizzata (non bianca).` | Cambio layout: render OK |
| F6 | `Naviga via TOC a una pagina lontana (salto >50 pagine). Aspetta 3 secondi. La pagina deve essere completamente renderizzata in tutti i layout provati in sequenza (Single, Double, Triple, Grid).` | Salto lungo: render OK |

---

## 🔹 Gruppo G — Orientamento pagine (anti-capovolgimento)

> **Bug osservato:** a volte le 4-5 pagine prima e dopo la pagina puntata dal TOC venivano renderizzate capovolte (testo a testa in giù).

| # | Prompt | Verifica |
|---|--------|----------|
| G1 | `Naviga via TOC a una pagina a metà documento in layout Single. Scorri lentamente 5 pagine avanti e 5 indietro. Controlla che NESSUNA pagina sia ruotata di 180° (testo capovolto). Screenshot della pagina target e di quelle adiacenti.` | Single: nessuna pagina ruotata |
| G2 | `Come G1 ma in layout Double. Controlla che tutte le pagine visibili (coppie) abbiano l'orientamento corretto.` | Double: nessuna pagina ruotata |
| G3 | `Naviga via TOC in Grid. Scorri su e giù. Verifica che tutte le miniature abbiano l'orientamento corretto — nessuna miniatura a testa in giù.` | Grid: nessuna miniatura ruotata |
| G4 | `Naviga via TOC a pagina X in Double. Cambia layout a Triple. Scorri 3 pagine avanti e indietro. Nessuna pagina deve apparire ruotata dopo il cambio layout.` | Cambio layout: orientamento OK |
| G5 | `Controlla il valore della rotazione nella toolbar (dovrebbe essere 0°). Naviga via TOC. La rotazione deve restare 0°. Premi Rotate 4 volte (360°). La rotazione deve tornare a 0°.` | Rotazione toolbar sincronizzata |

---

## 📊 Riepilogo

| Gruppo | Test | Copre |
|--------|------|-------|
| A | 4 | Navigazione TOC base, overlay, chiusura |
| B | 4 | Ancoraggio Single↔Double↔Triple |
| C | 4 | Ancoraggio Icon↔Grid, colonne |
| D | 4 | Edge case: pagina 1, ultima, click veloci |
| E | 2 | Console errors, Rules of Hooks |
| F | 6 | Renderizzazione pagina TOC in tutti i layout |
| G | 5 | Orientamento pagine (anti-capovolgimento) |
| **Totale** | **29** | |

---

## ⚠️ Note

- **browser-use**: se l'agente fallisce con `upload_file`, usa `?debug=1` per bypassare l'upload.
- **Service Worker**: se vedi codice vecchio, apri il sito in finestra anonima/incognito.
- **Debug mode**: il codice `?debug=1` è solo per sviluppo. In produzione non si attiva.
