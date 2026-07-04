# DLS Tracker — TCG Card Tracker

App per tracciare il valore della propria collezione di carte Pokémon TCG (e presto One Piece TCG) con prezzi in tempo reale da CardTrader.

---

## Come usare

1. Apri `index.html` in un browser moderno (Chrome, Edge, Firefox, Brave).
2. Inserisci il nome del Pokémon e/o il numero della carta.
3. Seleziona l'espansione dal menu a tendina (opzionale ma consigliato per velocità).
4. Premi **Cerca Carta**.
5. Se vengono trovate più carte, scegli la carta corretta dall'elenco.
6. Seleziona la condizione della carta.
7. Premi **Aggiungi alla lista** per inserirla nella collezione.
8. Esporta in CSV o JSON.

---

## Metti online (hosting gratuito)

### Opzione 1 — Netlify Drop (più veloce, nessun account richiesto)
1. Vai su **[netlify.app/drop](https://app.netlify.com/drop)**
2. Trascina l'intera cartella `PokèSearch` sulla pagina
3. Netlify ti darà un URL pubblico in 30 secondi (es. `https://dls-tracker-abc123.netlify.app`)

### Opzione 2 — GitHub Pages (URL fisso, aggiornamenti facili)
1. Crea un repository su [github.com](https://github.com) (es. `dls-tracker`)
2. Carica tutti i file (`index.html`, `logo.png`, `manifest.json`, `sw.js`)
3. Vai su **Settings → Pages → Source: main branch / root**
4. L'app sarà disponibile su `https://tuousername.github.io/dls-tracker/`

> **Nota CORS CardTrader:** Il token CardTrader è già pre-compilato nell'app.
> Se ospitata su un dominio HTTPS, i prezzi dovrebbero funzionare correttamente.

---

## Installazione su telefono (PWA)

L'app è una **Progressive Web App** — si installa come un'app nativa, senza App Store.

### Android (Chrome)
1. Apri l'URL dell'app in Chrome
2. Apparirà un banner **"Installa DLS Tracker"** in basso → clicca **Installa**
3. Oppure: menu ⋮ → **Aggiungi a schermata Home**

### iPhone/iPad (Safari)
1. Apri l'URL dell'app in Safari
2. Tocca il pulsante **Condividi** (quadrato con freccia verso l'alto)
3. Scorri e tocca **Aggiungi a schermata Home**
4. Conferma con **Aggiungi**

L'app si aprirà in modalità schermo intero senza la barra del browser.

---

## Funzionalità

- Ricerca carte Pokémon TCG con autocomplete sul nome
- Prezzi in tempo reale da **CardTrader** (token pre-inserito)
- Selezione condizione (NM, EX, GOOD, PLAYED, POOR) con calcolo automatico del valore
- Collezione con statistiche (totale, set unici, prezzo medio)
- Esportazione in **CSV** e **JSON**
- Background animato con tema TCG
- Funziona offline (Service Worker)

---

## Chiavi API

Il token CardTrader è già pre-compilato. Puoi modificarlo nelle **Impostazioni avanzate**.

Per la chiave PokéTCG (opzionale, aumenta il rate limit):
1. Registrati su [dev.pokemontcg.io](https://dev.pokemontcg.io/)
2. Copia la tua `X-Api-Key`
3. Incollala in **Impostazioni avanzate → API Key PokéTCG**

---

## Sviluppo locale

```bash
# Avvia un server locale (necessario per Service Worker)
python -m http.server 8000
# oppure
npx serve .
```

Poi apri `http://localhost:8000` nel browser.

> ⚠️ Il Service Worker **non funziona** aprendo `index.html` direttamente come file (protocollo `file://`).
> Per testare la PWA e l'installazione mobile è necessario un URL `http://` o `https://`.
