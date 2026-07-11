# DLS Tracker — Development Roadmap

## ✅ Completato (Aggiornamento 2026-07-12)

### Prezzi e Inserimento carte
- [x] **Prezzo manuale prima dell'aggiunta in collezione**
  - Campo prezzo manuale in schermata risultato per Pokémon, One Piece e Riftbound
  - Pulsanti Applica/Reset con validazione importo (> 0)
  - Override del prezzo live quando richiesto dall'utente
  - Salvataggio flag `manualPrice` nell'item collezione
  - Messaggistica UI: distinzione tra prezzo live, stima e manuale

### Ricerca e UX
- [x] **Autocomplete ricerca** per Pokémon e TCG basati su CardTrader
- [x] **Fallback locale catalogo** quando API non disponibile
- [x] **Forse cercavi evoluto**
  - Ranking suggerimenti migliorato con scoring nome/numero
  - Supporto numeri adiacenti (es. 036 -> 035/037)
  - Priorita ai match adiacenti quando presenti
- [x] **Stop ricerca e anti-loop**
  - Pulsante stop con AbortController
  - Mitigazione fallback pesanti su ricerche nome+numero
  - Timeout rapidi su fetch suggerimenti per evitare blocchi UI
- [x] **Preview immagine fullscreen**
  - Apertura fullscreen da carta selezionata e liste suggerimenti
  - Chiusura via backdrop, pulsante X, tasto Esc
  - Correzione CSS overlay e binding click stabile

### Collezione e Prezzi
- [x] **Edit in-place dalla collezione**
  - Click su riga apre modalita modifica invece di aggiunta
  - Badge visivo edit e highlight riga attiva
- [x] **Prezzo manuale lock + reset mercato**
  - Aggiorna prezzi non sovrascrive valori manuali
  - Azioni per riga: modifica prezzo manuale e reset al prezzo di mercato

### Account e Sync
- [x] **Autenticazione email/password** via Netlify Functions
- [x] **Sincronizzazione cloud base** con storage locale + pending queue

## 🔴 Priorità Alta (MVP Completamento)

### Ricerca e Prezzi
- [ ] **Magic TCG support**
  - Aggiungere Magic: The Gathering con API Scryfall
  - Nuova scheda nel selector giochi
  - Dataset espansioni Magic
  - Mockup: `magic-sets.js` + Magic blueprint search
  - Effort: 1-2 giorni

- [ ] **Multi-source pricing**
  - Integrare Cardmarket API (alternativa/complementare a CardTrader)
  - Integrare TCGPlayer (USA)
  - Modal comparativo con prezzo più basso
  - Grafici prezzo min/max/avg tra platform
  - Effort: 2-3 giorni

### UX Miglioramenti
- [ ] **Hardening timeout proxy ricerca**
  - Timeout configurabili per route PokéTCG/CardTrader
  - Retry con backoff su errori transitori
  - Messaggistica utente uniforme su timeout vs no-results
  - Effort: 0.5-1 giorno

- [ ] **Batch import CSV/JSON**
  - Form drag-and-drop per upload file
  - Parser per CSV (name, set, condition, quantity)
  - Validazione e conflitto detection
  - Effort: 1-2 giorni

- [ ] **Hardening autenticazione e sync**
  - Retry/backoff su errori transitori API
  - Conflict resolution esplicita (merge per item, non solo last-write-wins)
  - Messaggi utente più dettagliati sui casi offline/online
  - Effort: 1-2 giorni

- [ ] **Storico modifiche prezzo**
  - Tracciare se il prezzo è live, stimato o manuale per ogni riga
  - Audit trail minimo (timestamp e valore precedente)
  - Effort: 1 giorno

---

## 🟡 Priorità Media (Crescita)

### Analytics & Insights
- [ ] **Statistics dashboard**
  - Grafici Time Series valore collezione
  - Andamento mensile/annuale
  - Breakdown per gioco/set/condizione
  - Predictive trend (semplice regressione lineare)
  - Chart library: Chart.js o Recharts
  - Effort: 2-3 giorni

- [ ] **Wishlist feature**
  - Elenco carte desiderate con prezzo target
  - Push notification quando prezzo scende
  - Sincronizzazione wishlist cloud
  - Effort: 1 giorno

- [ ] **Bulk edit collezione**
  - Modifica multipla di condizione/lingua/prezzo
  - Applicazione prezzo manuale su selezione multipla
  - Effort: 1-2 giorni

### Filtering & Search
- [ ] **Advanced filters**
  - Filtri per set, tipo, rarity, colore
  - Multi-select dropdown
  - Salva preset filtri
  - URL query params per share filtered view
  - Effort: 1 giorno

- [ ] **Full-text search**
  - Indicizzazione locale con fuse.js
  - Ricerca sul nome/numero/set
  - Evidenziazione risultati match
  - Effort: 0.5 giorni

### Integrazione Esterno
- [ ] **Grading integration**
  - Connessione PSA/BGS API
  - Mostra certificati carte gradite
  - Impatto nel calcolo valore
  - Effort: 1-2 giorni

- [ ] **Barcode scanner**
  - QR/Code128 scanning via webcam
  - Library: jsQR o ZXing
  - Riduce manualità di input
  - Effort: 1 giorno

- [ ] **Competitive pricing alerts**
  - Notifica quando prezzo su platform A batte platform B
  - Email digest giornaliero
  - Effort: 1 giorno

---

## 🟢 Priorità Bassa (Polish & UX)

### UI/UX Miglioramenti
- [ ] **Dark mode**
  - Toggle theme scuro/chiaro
  - Persist su localStorage
  - CSS variable override
  - Effort: 0.5 giorni

- [ ] **Smooth animations**
  - Transizioni add/remove carte
  - Page transitions
  - Loading skeletons
  - Effort: 1 giorno

- [ ] **Toast notifications**
  - Feedback per azioni (carte aggiunte, esportate, sincronizzate)
  - Auto-dismiss dopo 3 sec
  - Success/error/info estados
  - Effort: 0.5 giorni

- [ ] **Favourite cards**
  - Star icon per segnare carte preferite
  - Salva preferiti su IndexedDB
  - Filter "Solo preferiti"
  - Effort: 0.5 giorni

### Funzionalità Minori
- [ ] **Duplicate detection**
  - Avviso se aggiungi una carta già in collezione
  - Suggerisci di incrementare quantity
  - Effort: 0.5 giorni

- [ ] **Badge origine prezzo in tabella**
  - Mostrare etichetta LIVE/STIMA/MANUALE per ogni riga
  - Colori e tooltip coerenti con UI risultato
  - Effort: 0.5 giorni

- [ ] **Offline sync queue**
  - Coda azioni offline (add/edit/delete)
  - Sync automatico al ritorno online
  - Retry logic per failed requests
  - Effort: 1-2 giorni

- [ ] **Multi-language support**
  - i18n framework (i18next o simple object)
  - Lingue: EN, IT, ES, FR, DE
  - Language picker in settings
  - Effort: 2 giorni

- [ ] **Collection sharing**
  - Link pubblico per condividere collezione (read-only)
  - Genera short URL (bit.ly-style)
  - View-only mode con statistiche
  - Effort: 1-2 giorni

---

## 🧪 Quality Assurance

- [ ] **Performance audit**
  - Lighthouse score >= 90
  - Optimize bundle size
  - Lazy load images
  - Service Worker caching strategy review
  - Effort: 1-2 giorni

- [ ] **Unit tests**
  - Vitest per logica funzionale
  - Test API parsing
  - Test condizione → prezzo calculation
  - Coverage >= 70%
  - Effort: 2-3 giorni

- [ ] **E2E tests**
  - Playwright per flussi critici
  - Search → Add → Export flow
  - Login → Sync → Multi-device flow
  - Effort: 2-3 giorni

- [ ] **Accessibility (a11y)**
  - WCAG 2.1 AA compliance
  - Keyboard navigation
  - Screen reader testing
  - High contrast mode
  - Effort: 1-2 giorni

---

## 🚀 Expansion Ideas (Post-MVP)

### Ecosistema App
- [ ] **TCG World Tracker**
  - Database mondiale prezzi storici
  - Aggregazione dati multi-source
  - API pubblica per integrazione
  - Effort: 5-7 giorni

- [ ] **Community platform**
  - Sistema rating carte da community
  - Forum per discussioni per-set
  - User leaderboard (collezione più preziosa)
  - Effort: 3-5 giorni

- [ ] **Trading marketplace**
  - P2P trading (carta per carta)
  - Escrow system (custodia terza parte)
  - Rating seller/buyer
  - Effort: 5+ giorni

### Mobile & Desktop
- [ ] **Mobile app nativo**
  - React Native per iOS/Android
  - Feature parity con web
  - Push notification per prezzo alerts
  - Offline-first architecture
  - Effort: 1-2 settimane

- [ ] **Desktop app**
  - Electron wrapper
  - Local database SQLite
  - Advanced filters UI
  - Effort: 3-5 giorni

### Integrazioni Esterne
- [ ] **Telegram bot**
  - Comandi: `/search Pikachu`, `/collection stats`, `/export csv`
  - Riceve notifiche prezzo
  - Effort: 2-3 giorni

- [ ] **Discord bot**
  - Stessi comandi Telegram
  - Integrazione con server comunità
  - Effort: 2-3 giorni

- [ ] **Browser extension**
  - Mostra prezzo DLS Tracker su Cardmarket/eBay
  - Quick add to collection
  - Chrome + Firefox
  - Effort: 3-5 giorni

- [ ] **Admin panel**
  - Dashboard per gestire espansioni
  - Upload nuovi set
  - Manage API integrations
  - User management
  - Effort: 3-5 giorni

---

## 📊 Metriche & KPIs

- Monitorare performance:
  - Page load time < 1s
  - First Contentful Paint < 0.5s
  - Lighthouse score >= 90
  
- User engagement:
  - DAU (Daily Active Users)
  - Collections created per day
  - Average collection size
  - Export rate

- API health:
  - PokéTCG rate limit usage
  - CardTrader API response time
  - Error rate per endpoint
  - % prezzi manuali sul totale inserimenti
  - Cache hit ratio

---

## 🎯 Sprint Planning Example

### Sprint 1 (1 settimana)
1. Magic TCG support + dataset
2. Hardening timeout proxy ricerca
3. Batch import CSV

### Sprint 2 (1 settimana)
1. Multi-source pricing (Cardmarket)
2. Autenticazione full
3. Sincronizzazione collezione

### Sprint 3 (1 settimana)
1. Statistics dashboard
2. Dark mode + animations
3. Testing (unit + E2E)

---

## 📝 Notes

- **Tech debt**: Refactor `index.html` monolitico in moduli JS separati
- **Documentation**: Aggiungere JSDoc per funzioni critiche
- **Monitoring**: Setup Sentry per error tracking
- **Analytics**: Setup Plausible per privacy-respecting analytics
