/**
 * Converte un CSV ScanTrader Inventario in un CSV pronto per CardTrader product_imports.
 *
 * ScanTrader (senza header):
 *   scryfall_id,nome_locale,expansion_code,collector_number,quantity,language,condition,foil,price_cents
 *
 * CardTrader identifica le carte MTG via scryfall_id (evita "No item found" sui nomi IT).
 *
 * Uso:
 *   node tools/scantrader-to-cardtrader-csv.mjs "path/ScanTrader Inventario.csv"
 *   node tools/scantrader-to-cardtrader-csv.mjs input.csv -o out.csv
 *   node tools/scantrader-to-cardtrader-csv.mjs input.csv --default-price-cents 5
 *
 * Upload (API / Postman):
 *   POST https://api.cardtrader.com/api/v2/product_imports
 *   game_id=1
 *   replace_stock_or_add_to_stock=add_to_stock
 *   column_names=scryfall_id|name|expansion_code|collector_number|quantity|language|condition|foil|price_cents
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRYFALL_COLLECTION = 'https://api.scryfall.com/cards/collection';
const BATCH_SIZE = 75;
const DELAY_MS = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONDITION_MAP = {
  nm: 'Near Mint',
  'near mint': 'Near Mint',
  nearmint: 'Near Mint',
  mint: 'Mint',
  sp: 'Slightly Played',
  'slightly played': 'Slightly Played',
  mp: 'Moderately Played',
  'moderately played': 'Moderately Played',
  played: 'Played',
  lp: 'Played',
  'lightly played': 'Slightly Played',
  hp: 'Heavily Played',
  'heavily played': 'Heavily Played',
  poor: 'Poor',
  damaged: 'Poor',
};

const LANG_MAP = {
  en: 'en', eng: 'en', english: 'en', inglese: 'en',
  it: 'it', ita: 'it', italian: 'it', italiano: 'it',
  fr: 'fr', fra: 'fr', french: 'fr', francese: 'fr',
  de: 'de', deu: 'de', german: 'de', tedesco: 'de',
  es: 'es', spa: 'es', spanish: 'es', spagnolo: 'es',
  pt: 'pt', por: 'pt', portuguese: 'pt', portoghese: 'pt',
  jp: 'jp', ja: 'jp', jpn: 'jp', japanese: 'jp', giapponese: 'jp',
  kr: 'kr', ko: 'kr', kor: 'kr', korean: 'kr', coreano: 'kr',
  'zh-cn': 'zh-CN', zhs: 'zh-CN', cn: 'zh-CN', chinese: 'zh-CN', cinese: 'zh-CN',
  'zh-tw': 'zh-TW', zht: 'zh-TW',
  ru: 'ru', russian: 'ru',
  nl: 'nl', dutch: 'nl',
  cz: 'cz', cs: 'cz',
  hu: 'hu',
  pl: 'pl',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function usage(exitCode = 1) {
  console.error(`Usage:
  node tools/scantrader-to-cardtrader-csv.mjs <input.csv> [-o out.csv] [--default-price-cents N]

CardTrader upload mapping:
  game_id=1
  column_names=scryfall_id|name|expansion_code|collector_number|quantity|language|condition|foil|price_cents
  replace_stock_or_add_to_stock=add_to_stock`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (!args.length || args.includes('-h') || args.includes('--help')) usage(args.length ? 0 : 1);

  let input = null;
  let output = null;
  let defaultPriceCents = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-o' || a === '--output') {
      output = args[++i];
      continue;
    }
    if (a === '--default-price-cents') {
      const n = Number(args[++i]);
      if (!Number.isFinite(n) || n < 0) {
        console.error('--default-price-cents deve essere un intero >= 0');
        process.exit(1);
      }
      defaultPriceCents = Math.round(n);
      continue;
    }
    if (a.startsWith('-')) {
      console.error(`Opzione sconosciuta: ${a}`);
      usage(1);
    }
    if (!input) input = a;
    else {
      console.error('Troppi argomenti posizionali');
      usage(1);
    }
  }

  if (!input) usage(1);
  return { input, output, defaultPriceCents };
}

/** Minimal CSV parser: commas, quoted fields, CRLF/LF. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (c === '\n') {
      row.push(field);
      field = '';
      if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    if (c === '\r') continue;
    field += c;
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
  }
  return rows;
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
}

function looksLikeHeader(row) {
  const first = String(row[0] || '').toLowerCase().trim();
  return first.includes('scryfall') || first === 'id' || first === 'uuid' || first === 'nome';
}

function normalizeLanguage(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return 'en';
  return LANG_MAP[key] || key;
}

function normalizeCondition(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return 'Near Mint';
  return CONDITION_MAP[key] || String(raw).trim();
}

function normalizeFoil(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'foil'].includes(s)) return 'true';
  return 'false';
}

function parsePriceCents(raw, defaultPriceCents) {
  const s = String(raw ?? '').trim();
  if (!s) {
    if (defaultPriceCents == null) return { ok: false, value: null };
    return { ok: true, value: defaultPriceCents };
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return { ok: false, value: null };
  return { ok: true, value: Math.round(n) };
}

function parseScanRow(cells, lineNo) {
  const scryfallId = String(cells[0] || '').trim();
  const localName = String(cells[1] || '').trim();
  const expansionCode = String(cells[2] || '').trim().toLowerCase();
  const collectorNumber = String(cells[3] || '').trim();
  const quantity = String(cells[4] || '').trim() || '1';
  const language = normalizeLanguage(cells[5]);
  const condition = normalizeCondition(cells[6]);
  const foil = normalizeFoil(cells[7]);
  const priceRaw = cells[8];

  return {
    lineNo,
    scryfallId,
    localName,
    expansionCode,
    collectorNumber,
    quantity,
    language,
    condition,
    foil,
    priceRaw,
  };
}

async function fetchScryfallByIds(ids) {
  const unique = [...new Set(ids.filter((id) => UUID_RE.test(id)))];
  const map = new Map();

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const chunk = unique.slice(i, i + BATCH_SIZE);
    const body = { identifiers: chunk.map((id) => ({ id })) };
    const res = await fetch(SCRYFALL_COLLECTION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'DLS-Tracker/scantrader-to-cardtrader-csv',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Scryfall collection ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    for (const card of data.data || []) {
      if (card?.id) {
        map.set(card.id, {
          name: card.name || '',
          set: String(card.set || '').toLowerCase(),
          collector_number: String(card.collector_number || ''),
        });
      }
    }
    if (i + BATCH_SIZE < unique.length) await sleep(DELAY_MS);
  }

  return map;
}

async function main() {
  const { input, output, defaultPriceCents } = parseArgs(process.argv);
  const inputPath = path.resolve(input);
  if (!fs.existsSync(inputPath)) {
    console.error(`File non trovato: ${inputPath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(inputPath, 'utf8');
  const rawRows = parseCsv(text);
  if (!rawRows.length) {
    console.error('CSV vuoto');
    process.exit(1);
  }

  let start = 0;
  if (looksLikeHeader(rawRows[0])) start = 1;

  const parsed = [];
  for (let i = start; i < rawRows.length; i++) {
    parsed.push(parseScanRow(rawRows[i], i + 1));
  }

  console.log(`Righe ScanTrader: ${parsed.length}`);
  const scryMap = await fetchScryfallByIds(parsed.map((r) => r.scryfallId));
  console.log(`Scryfall risolti: ${scryMap.size}`);

  const header = [
    'scryfall_id',
    'name',
    'expansion_code',
    'collector_number',
    'quantity',
    'language',
    'condition',
    'foil',
    'price_cents',
  ];
  const outRows = [header];
  const unmatched = [['line', 'scryfall_id', 'local_name', 'expansion_code', 'collector_number', 'reason']];
  const skippedPrice = [['line', 'scryfall_id', 'name', 'reason']];

  let ok = 0;
  let unmatchedCount = 0;
  let noPriceCount = 0;

  for (const row of parsed) {
    if (!UUID_RE.test(row.scryfallId)) {
      unmatchedCount++;
      unmatched.push([
        row.lineNo,
        row.scryfallId,
        row.localName,
        row.expansionCode,
        row.collectorNumber,
        'invalid_scryfall_id',
      ]);
      continue;
    }

    const card = scryMap.get(row.scryfallId);
    if (!card) {
      unmatchedCount++;
      unmatched.push([
        row.lineNo,
        row.scryfallId,
        row.localName,
        row.expansionCode,
        row.collectorNumber,
        'scryfall_not_found',
      ]);
      continue;
    }

    const price = parsePriceCents(row.priceRaw, defaultPriceCents);
    if (!price.ok) {
      noPriceCount++;
      skippedPrice.push([row.lineNo, row.scryfallId, card.name, 'missing_or_invalid_price_cents']);
      continue;
    }

    const expansion = row.expansionCode || card.set;
    const collector = row.collectorNumber || card.collector_number;

    outRows.push([
      row.scryfallId,
      card.name,
      expansion,
      collector,
      row.quantity,
      row.language,
      row.condition,
      row.foil,
      price.value,
    ]);
    ok++;
  }

  const baseOut = output
    ? path.resolve(output)
    : path.join(
        path.dirname(inputPath),
        `${path.basename(inputPath, path.extname(inputPath))}.cardtrader.csv`,
      );
  const unmatchedPath = baseOut.replace(/\.csv$/i, '') + '.unmatched.csv';
  const skippedPath = baseOut.replace(/\.csv$/i, '') + '.skipped-price.csv';

  fs.writeFileSync(baseOut, toCsv(outRows), 'utf8');
  console.log(`Scritto: ${baseOut} (${ok} prodotti)`);

  if (unmatchedCount > 0) {
    fs.writeFileSync(unmatchedPath, toCsv(unmatched), 'utf8');
    console.log(`Unmatched: ${unmatchedPath} (${unmatchedCount})`);
  }
  if (noPriceCount > 0) {
    fs.writeFileSync(skippedPath, toCsv(skippedPrice), 'utf8');
    console.log(`Senza prezzo (skip): ${skippedPath} (${noPriceCount}) — usa --default-price-cents N per includerle`);
  }

  console.log(`Report: ok=${ok} unmatched=${unmatchedCount} no_price=${noPriceCount}`);
  console.log(`column_names=scryfall_id|name|expansion_code|collector_number|quantity|language|condition|foil|price_cents`);
  console.log('game_id=1  replace_stock_or_add_to_stock=add_to_stock');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
