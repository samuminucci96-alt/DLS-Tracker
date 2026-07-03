# DLS Tracker — TCG Card Tracker

Web app PWA per tracciare una collezione TCG con ricerca carte, stima/mercato prezzi e sincronizzazione locale/cloud.

Attualmente supporta:
- **Pokémon TCG** (PokémonTCG API + CardTrader)
- **One Piece TCG** (CardTrader)

---

## Panoramica tecnica

Il progetto è una **single-page app senza build step**:
- UI, logica e stato principali sono in `index.html` (HTML + CSS + JavaScript inline)
- dataset set Pokémon in `pokemon-sets.js`
- PWA/offline in `manifest.json` + `sw.js`
- configurazione hosting e header in `netlify.toml`

Non sono presenti framework frontend (React/Vue) né bundler (Vite/Webpack).

---

## Stack e dipendenze

- **Linguaggio**: JavaScript (vanilla)
- **Runtime client**: browser moderno
- **Package manager**: npm (`package-lock.json` presente)
- **Dipendenze npm**: `@netlify/blobs` (attualmente non usata lato client)
- **PWA**: Service Worker + Web App Manifest
- **Hosting target**: static hosting (Netlify / GitHub Pages)

---

## Struttura del repository

- `index.html` → app completa (UI + business logic)
- `sw.js` → cache strategy PWA
- `manifest.json` → metadati installazione mobile
- `pokemon-sets.js` → elenco set/autocomplete set Pokémon
- `netlify.toml` → publish dir, headers di sicurezza/cache e CORS per `/api/*`
- `test_api.py` → script di test manuale API PokéTCG

---

## Come eseguire in locale (sviluppo)

### Prerequisiti
- Node.js + npm (oppure Python se usi `http.server`)

### Avvio rapido
```bash
npx serve .
# oppure
python -m http.server 8000
```

Apri: `http://localhost:3000` (serve) oppure `http://localhost:8000` (python).

> ⚠️ Non aprire `index.html` via `file://`: Service Worker, alcune fetch e test PWA non funzionano correttamente.

---

## Architettura funzionale

### 1) Ricerca carte Pokémon
- Endpoint base: `https://api.pokemontcg.io/v2/cards`
- Query dinamica con filtri per nome/numero/set
- Fallback progressivi:
	1. query completa
	2. retry senza vincolo set
	3. fallback catalogo locale (`LOCAL_CATALOG`)
- Caching suggerimenti nome in-memory (`Map`)

### 2) Prezzi CardTrader
- Endpoint base: `https://api.cardtrader.com/api/v2`
- Flusso:
	1. risoluzione game (`/games`)
	2. mapping espansione (`/expansions` + euristiche)
	3. blueprint matching (`/blueprints/export`)
	4. prezzi live (`/marketplace/products`)
- Normalizzazione condizioni (NM/EX/GOOD/PLAYED/POOR)
- Cache runtime per gameId, espansioni, blueprint e prezzi scelta carta

### 3) Collezione
- Stato in memoria + persistenza in `localStorage` (`dls_collection`)
- Export in CSV/JSON
- Aggiornamento prezzi massivo (“Aggiorna prezzi”) con rate limiting leggero

### 4) One Piece
- Ricerca blueprint e prezzi direttamente su CardTrader
- Inserimento in collezione con stesso modello dati base

### 5) Auth + sync cloud (API interne)
Nel client sono previsti endpoint:
- `POST /api/auth`
- `GET/POST /api/collection`
- `GET/POST /api/profile`

Questi endpoint sono pensati per Netlify Functions (vedi `netlify.toml`), ma **nel repository corrente non esiste la cartella `netlify/functions`**.

Conseguenza pratica:
- modalità locale/offline via `localStorage` funziona
- login/sync cloud richiede implementazione backend delle API sopra

---

## PWA e cache strategy

`sw.js` usa una strategia ibrida:

- **Install**: pre-cache asset statici principali (`index.html`, manifest, icone, `pokemon-sets.js`)
- **Activate**: pulizia cache versioni precedenti
- **Fetch**:
	- API esterne (`pokemontcg.io`, `cardtrader.com`, `/api/*`) → **network-only**
	- navigazione HTML → **network-first**, fallback cache
	- static assets → **cache-first**, fallback network

Nota: la cache è versionata tramite costante `CACHE` in `sw.js`.

---

## Deploy

### Netlify
Il file `netlify.toml` configura:
- publish dir: `.`
- functions dir: `netlify/functions`
- header di sicurezza (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`)
- no-cache su `index.html`, `/`, `sw.js`
- CORS permissivo su `/api/*`

### GitHub Pages
Funziona per la parte statica/PWA.
Le API `/api/*` non saranno disponibili senza backend esterno.

---

## Configurazione chiavi API

- **CardTrader Bearer Token**: inseribile nelle impostazioni avanzate UI (`ctApiKey`), salvato in `localStorage` (`dls_ct_token`)
- **PokémonTCG API Key** (opzionale): `X-Api-Key`, salvata in `localStorage` (`dls_pt_token`)

> Evitare di hardcodare token sensibili nel codice sorgente prima del deploy pubblico.

---

## Modello dati collezione (semplificato)

Ogni entry contiene, tra gli altri:
- `name`, `set`, `setId`, `number`
- `quality` / `condition`
- `price`, `basePrice`, `ctPrice`
- `lang`
- `img` / `imgUrl`
- `addedAt`
- `card` (metadati per refresh prezzi)

---

## Limiti noti / note per sviluppatori

- `index.html` è molto grande (UI + logica + auth + rendering): manutenzione complessa.
- Mancano script npm (`start`, `dev`, `lint`, `test`) in `package.json`.
- Le API cloud (`/api/*`) sono referenziate ma non implementate in questo repository.
- Presente `test_api.py` per test manuali, ma non esiste suite test automatizzata JS.

---

## Roadmap tecnica consigliata

1. Estrarre JS inline in moduli (`/src`) per dominio (search, pricing, collection, auth, pwa).
2. Aggiungere script npm standard (`dev`, `serve`, `lint`, `format`).
3. Implementare `netlify/functions` per `auth`, `collection`, `profile`.
4. Gestire segreti via variabili ambiente (non in client).
5. Aggiungere test automatici (unit + integrazione API mocking).

---

## Uso utente (rapido)

1. Cerca carta (nome/numero/set)
2. Seleziona risultato corretto
3. Scegli condizione
4. Aggiungi alla lista
5. Esporta CSV/JSON o aggiorna prezzi
