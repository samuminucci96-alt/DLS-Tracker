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
8. (Opzionale) Inserisci un **prezzo manuale** se vuoi sovrascrivere il prezzo live/stimato
9. Premi **Aggiungi alla collezione**

### 1.b Prezzo manuale: quando usarlo

Usa il prezzo manuale quando:
- il prezzo live non è disponibile (API temporaneamente non raggiungibile)
- vuoi allineare il valore alla tua valutazione reale (carta gradita, comprata in blocco, promozione)
- desideri mantenere coerenza con un marketplace specifico non coperto

Comportamento in app:
- Il prezzo manuale ha priorità sul prezzo live e sulla stima
- Puoi rimuoverlo in qualsiasi momento con **Reset**
- Nella conferma di aggiunta viene indicato se il prezzo usato è manuale

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
✅ **Override prezzo manuale** prima dell'aggiunta in collezione  
✅ **Valutazione condizioni** (NM, EX, GOOD, PLAYED, POOR)  
✅ **Gestione collezione** (add/edit/delete)  
✅ **Statistiche** (totale, valore, prezzo medio)  
✅ **Esportazione** (CSV, JSON)  
✅ **Funzionamento offline** (Service Worker + IndexedDB)  
✅ **PWA installabile** (Android + iOS)  
✅ **Responsive design** (mobile-first)  
✅ **Sincronizzazione cloud** (Netlify Blobs con auth)  
✅ **Autocomplete ricerca** con history  
✅ **Modifica in-place dalla collezione** (click riga -> modalita modifica)  
✅ **Badge edit + highlight riga in modifica**  
✅ **Prezzo manuale protetto** (Aggiorna prezzi non sovrascrive i manuali)  
✅ **Azioni prezzo per riga** (modifica manuale / reset al mercato)  
✅ **Forse cercavi evoluto** con ranking migliorato  
✅ **Suggerimenti numeri adiacenti** (es. 036 -> 035/037)  
✅ **Stop ricerca** con AbortController  
✅ **Mitigazione loop fallback** su ricerche nome+numero  
✅ **Preview immagini fullscreen** (risultato + suggerimenti, chiusura X/Esc/backdrop)  
✅ **Dark mode ready** (variabili CSS)  

---

## 🐛 Known Issues & Limitations

- ⚠️ **CORS CardTrader**: Se self-hosted senza Netlify Functions, i prezzi richiederanno un proxy
- ⚠️ **Rate limiting**: PokéTCG ha limite di 100 req/s (può bloccare in caso di spike)
- ⚠️ **Prezzi non real-time**: CardTrader aggiorna ogni ~5-10 min, non al millisecondo
- ⚠️ **Cache Service Worker**: Aggiornamenti del dataset delle espansioni richiedono cache bust manuale (v32, v33, ecc.)
- ⚠️ **Timeout locali su query specifiche**: in sviluppo alcune chiamate proxy possono arrivare a timeout; la UI ora evita loop e prova un fallback rapido con suggerimenti

### Troubleshooting rapido: errore "Pokémon TCG (403)"

Significato:
- Il server ha rifiutato la richiesta (Forbidden)

Cause più comuni:
- Variabile ambiente `POKEMON_TCG_API_KEY` assente, non valida o revocata su Netlify
- Limitazioni temporanee lato provider API

Cosa verificare:
1. Netlify → Site settings → Environment variables → `POKEMON_TCG_API_KEY`
2. Function logs della route `/api/pokemontcg`
3. Riprova la ricerca: se necessario usa il prezzo manuale per non bloccare l'inserimento

---

## 👩‍💻 Note per Sviluppatori

### Prezzo manuale: regole tecniche

- Il prezzo manuale è un override esplicito lato UI prima del salvataggio in collezione
- Se presente, viene usato come `price` finale dell'item
- L'item salva anche `manualPrice: true` per distinguere i record non derivati da feed live
- Se non presente, il flusso mantiene priorità: annuncio CT selezionato → minimo condizione → stima

### Impatto su data model collezione

Campi coinvolti per riga:
- `price`: valore finale usato nei totali
- `ctPrice`: valorizzato solo quando il prezzo deriva da CardTrader live
- `manualPrice`: booleano per audit e UI futura
- `basePrice`: riferimento NM usato per calcoli/stime di condizione

### Suggerimenti di manutenzione

- Quando modifichi il pricing, valida sempre i casi:
    - prezzo live disponibile
    - prezzo live mancante
    - prezzo manuale inserito e poi resettato
- Mantieni coerenti i messaggi utente (live/stima/manuale) tra schermata risultato e conferma aggiunta
- In test E2E, copri almeno un flusso con override manuale attivo

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
