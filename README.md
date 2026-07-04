# DLS Tracker — TCG Card Collection Tracker

**Traccia il valore della tua collezione di carte TCG (Pokémon, One Piece, Riftbound) con prezzi in tempo reale da CardTrader.**

Una **Progressive Web App** (PWA) moderna, installabile su smartphone senza App Store, con supporto offline e sincronizzazione cloud.

---

## 📖 Guida Rapida

### 1. Cercare e aggiungere carte
1. Apri l'app in un browser moderno (Chrome, Edge, Firefox, Safari, Brave)
2. Seleziona il gioco (Pokémon TCG, One Piece TCG, Riftbound)
3. Inserisci il nome del Pokémon / personaggio e/o il numero della carta
4. Seleziona l'espansione dal menu (facoltativo ma consigliato)
5. Premi **Cerca Carta**
6. Seleziona la carta corretta dall'elenco
7. Scegli la **condizione** (NM, EX, GOOD, PLAYED, POOR)
8. Premi **Aggiungi alla collezione**

### 2. Gestire la collezione
- **Visualizza statistiche**: totale carte, valore stimato, prezzo medio
- **Modifica quantità/condizione**: clicca sulla carta per editare
- **Cancella carte**: scorri o clicca il tasto elimina
- **Esporta i dati**: CSV (Excel) o JSON (backup completo)

### 3. Installare come app (PWA)

#### ✅ Android (Chrome)
1. Apri l'URL dell'app in Chrome
2. Tocca il banner **"Installa DLS Tracker"** (in basso)
3. Oppure: menu ⋮ → **Aggiungi a schermata Home**

#### ✅ iPhone/iPad (Safari)
1. Apri l'URL in Safari
2. Tocca **Condividi** (quadrato con freccia)
3. Scorri e tocca **Aggiungi a schermata Home**
4. Conferma con **Aggiungi**

L'app si aprirà **a schermo intero** come un'app nativa.

---

## 🌐 Deploy (Hosting Gratuito)

### Opzione 1: Netlify Drop (più facile, nessun account)
1. Vai su **[app.netlify.com/drop](https://app.netlify.com/drop)**
2. Trascina questa cartella sulla pagina
3. In 30 secondi avrai un URL pubblico (es. `https://dls-tracker-abc123.netlify.app`)

### Opzione 2: Netlify (con Netlify Functions per backend)
```bash
npm install -g netlify-cli
netlify init
netlify deploy
```
- Sincronizzazione automatica della collezione
- Autenticazione con email
- Backend per gestire le API

### Opzione 3: GitHub Pages
1. Crea un repository su GitHub (es. `dls-tracker`)
2. Carica tutti i file del progetto
3. Vai a **Settings → Pages → Source: main branch / root**
4. L'app sarà su `https://tuousername.github.io/dls-tracker/`

---

## ⚙️ Architettura Tecnica

### Frontend (Progressive Web App)
```
index.html                  → Shell HTML + DOM
sw.js                       → Service Worker (offline, cache)
pokemon-sets.js             → Dataset espansioni Pokémon
onepiece-sets.js            → Dataset espansioni One Piece
riftbound-sets.js           → Dataset espansioni Riftbound
manifest.json               → PWA metadata (icone, display)
```

**Stack Frontend:**
- **HTML5 + Vanilla JavaScript** (no framework per performance)
- **CSS3** con design system tokenizzato (variabili CSS)
- **Service Worker** (Cache-first per static assets, Network-only per API)
- **IndexedDB/LocalStorage** per persistenza offline
- **Responsive Design** con safe-area-inset (notch/isola support)

### Backend (Netlify Functions)
```
netlify/functions/
├── pokemontcg.mjs          → Proxy per PokéTCG API
├── cardtrader.mjs          → Proxy per CardTrader API
├── collection.mjs          → CRUD collezione (Netlify Blobs)
├── auth.mjs                → Autenticazione JWT
├── profile.mjs             → Profilo utente
└── _lib/jwt.mjs            → Utilities JWT e CORS
```

**Stack Backend:**
- **Netlify Functions** (serverless Node.js)
- **Netlify Blobs** (key-value store per collezioni)
- **JWT** per autenticazione stateless
- **CORS headers** per sicurezza

### Integrazione API
| API | Uso | Rate Limit | Auth |
|-----|-----|-----------|------|
| **PokéTCG** | Metadata carte + ricerca | 100 req/s | X-Api-Key (opzionale) |
| **CardTrader** | Prezzi in tempo reale | 300 req/min | Bearer token |
| **Netlify Blobs** | Salva collezione cloud | Unlimited | JWT |

### Flusso dati
```
┌─────────────────┐
│  Frontend (PWA) │
│ IndexedDB cache │
└────────┬────────┘
         │
    ┌────▼─────┐
    │ Netlify  │
    │Functions │
    └────┬─────┘
    ┌────▼──────────┐
    │ PokéTCG API   │
    │ CardTrader    │
    │ Netlify Blobs │
    └───────────────┘
```

---

## 🔐 API Keys & Configurazione

### CardTrader API (Pre-compilata)
Il token CardTrader è già incluso. Se necessario aggiornare:
1. Registrati su [cardtrader.com/api](https://cardtrader.com/api)
2. Crea una chiave API
3. Su Netlify: **Settings → Environment variables → `CARDTRADER_API_TOKEN`**

### PokéTCG API (Opzionale)
Aumenta il rate limit e il numero di risultati:
1. Registrati su [dev.pokemontcg.io](https://dev.pokemontcg.io/)
2. Copia la chiave `X-Api-Key`
3. Su Netlify: **Settings → Environment variables → `POKEMON_TCG_API_KEY`**
4. In app: **Impostazioni avanzate → API Key PokéTCG**

### Netlify Auth
Per abilitare sincronizzazione cloud:
1. Vai su **Netlify Site Settings → Authentication**
2. Abilita **Email + Password** o **OAuth** (GitHub, Google)

---

## 🛠️ Sviluppo Locale

### Setup
```bash
# Installa dipendenze
npm install

# Avvia server locale (necessario per Service Worker)
python -m http.server 8000
# oppure
npx serve .
```

Apri `http://localhost:8000` (non `file://`)

### Testare Netlify Functions
```bash
netlify dev
# La funzione sarà su http://localhost:8888/.netlify/functions/pokemontcg
```

### Debug Service Worker
- **DevTools → Application → Service Workers** per vedere stato
- **Storage → Cache Storage** per vedere cache del SW
- **Network** con throttling per testare offline

### Build & Deploy
```bash
# Netlify deploy automatico su push (GitHub + Netlify)
# Oppure deploy manuale:
netlify deploy --prod
```

---

## 📊 Funzionalità Attuali

✅ **Ricerca carte** (Pokémon, One Piece, Riftbound)  
✅ **Prezzi in tempo reale** da CardTrader  
✅ **Valutazione condizioni** (NM, EX, GOOD, PLAYED, POOR)  
✅ **Gestione collezione** (add/edit/delete)  
✅ **Statistiche** (totale, valore, prezzo medio)  
✅ **Esportazione** (CSV, JSON)  
✅ **Funzionamento offline** (Service Worker + IndexedDB)  
✅ **PWA installabile** (Android + iOS)  
✅ **Responsive design** (mobile-first)  
✅ **Sincronizzazione cloud** (Netlify Blobs con auth)  
✅ **Autocomplete ricerca** con history  
✅ **Dark mode ready** (variabili CSS)  

---

## 📝 TODO & Roadmap

### 🔴 Priorità Alta
- [ ] **Magic TCG support** – Aggiungere Magic: The Gathering con API Scryfall
- [ ] **Scanlation prices** – Integrare Cardmarket e altre fonti di prezzi oltre CardTrader
- [ ] **Collection sharing** – Link pubblici per condividere collezione (read-only)
- [ ] **Image preview** – Mostrare l'immagine della carta nella modal di ricerca
- [ ] **Batch import** – Caricare CSV/JSON di carte in bulk
- [ ] **Collezione per user** – Login e sincronizzazione automatica tra dispositivi

### 🟡 Priorità Media
- [ ] **Statistics dashboard** – Grafici andamento valore nel tempo (Time Series)
- [ ] **Wishlist** – Elenco carte desiderate con notifica di prezzo
- [ ] **Set filters** – Filtrare per set, tipo, rarity, colore
- [ ] **Grading integration** – Connessione con PSA/BGS per carte gradite
- [ ] **Barcode scanner** – QR/Code128 per aggiungere carte via fotocamera
- [ ] **Competitive pricing** – Mostrare prezzi da più rivenditori a confronto
- [ ] **PWA icon cache** – Ottimizzare icone per offline con versioning migliorato
- [ ] **Language switching** – Multi-lingua (EN, IT, ES, FR)

### 🟢 Priorità Bassa (Polish)
- [ ] **Dark mode** – Tema scuro con toggle
- [ ] **Animations** – Transizioni smooth per add/remove carte
- [ ] **Notifications** – Toast notifiche per azioni (importate, prezzo cambiato)
- [ ] **Favourites** – Segnare carte preferite
- [ ] **Duplicate detection** – Avviso quando aggiungi una carta già in collezione
- [ ] **Offline sync queue** – Coda di azioni offline, sync al ritorno online
- [ ] **Advanced filters** – Ricerca avanzata (multi-criteria)
- [ ] **Performance audit** – Lighthouse optimization
- [ ] **Unit tests** – Test suite per funzioni critiche
- [ ] **E2E tests** – Test Playwright per flussi utente

### 🎯 Espansioni Future (Post-MVP)
- [ ] **TCG World Tracker** – Database mondiale di prezzi storici
- [ ] **Community ratings** – Sistema di valutazione carte da community
- [ ] **Trading marketplace** – Borsa per scambi (peer-to-peer)
- [ ] **Mobile app nativa** – React Native per iOS/Android con app store
- [ ] **Telegram/Discord bot** – Comandi per ricerca carte via bot
- [ ] **Browser extension** – Integrazione prezzi su siti di vendita
- [ ] **Admin panel** – Dashboard per gestire espansioni e prezzari

---

## 🐛 Known Issues & Limitations

- ⚠️ **CORS CardTrader**: Se self-hosted senza Netlify Functions, i prezzi richiederanno un proxy
- ⚠️ **Rate limiting**: PokéTCG ha limite di 100 req/s (può bloccare in caso di spike)
- ⚠️ **Prezzi non real-time**: CardTrader aggiorna ogni ~5-10 min, non al millisecondo
- ⚠️ **Cache Service Worker**: Aggiornamenti del dataset delle espansioni richiedono cache bust manuale (v32, v33, ecc.)

---

## 🤝 Contribution

Per contribuire:
1. Fork il repository
2. Crea un branch `feature/descrizione`
3. Commit con messaggi chiari
4. Invia una PR

---

## 📄 Licenza

MIT License – usa liberamente per usi commerciali e personali.

---

## 📞 Support

- 🐛 Segnala bug su GitHub Issues
- 💬 Feedback? Apri una Discussion
- 💡 Feature request? Aggiungi una Issue con il tag `enhancement`
