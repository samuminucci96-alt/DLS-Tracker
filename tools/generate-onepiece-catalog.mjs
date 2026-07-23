/**
 * Genera onepiece-sets.js + onepiece-cards.js da CardTrader.
 * - Tutte le espansioni OP (game_id=15), inclusi promo/magazine
 * - Solo carte con collector number (niente booster/box)
 * - Prezzi snapshot per lingua (en/jp/it/fr/…) + min globale NM
 *
 * Uso: node tools/generate-onepiece-catalog.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PROXY = process.env.CT_PROXY || 'https://dlstracker.netlify.app/api/cardtrader?path=';
const OUT_CARDS = path.join(root, 'onepiece-cards.js');
const OUT_SETS = path.join(root, 'onepiece-sets.js');
const GAME_ID = 15;
const CONCURRENCY = 3;
const DELAY_MS = 200;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function ctGet(apiPath) {
  const url = PROXY + encodeURIComponent(apiPath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${apiPath} → ${res.status}`);
  return res.json();
}

function ctList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.array)) return data.array;
  return [];
}

function normLang(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return '';
  if (['ja', 'jp', 'jpn', 'japanese'].includes(s)) return 'jp';
  if (['en', 'eng', 'english'].includes(s)) return 'en';
  if (['it', 'ita', 'italian'].includes(s)) return 'it';
  if (['fr', 'fra', 'french'].includes(s)) return 'fr';
  if (['de', 'deu', 'german'].includes(s)) return 'de';
  if (['es', 'spa', 'spanish'].includes(s)) return 'es';
  if (['zh', 'zh-cn', 'zh-tw', 'cn', 'chinese'].includes(s) || s.startsWith('zh')) return 'zh';
  if (['ko', 'kr', 'kor', 'korean'].includes(s)) return 'ko';
  return s.slice(0, 5);
}

function bpNumber(bp) {
  return String(bp?.fixed_properties?.collector_number || bp?.collector_number || bp?.version || '')
    .split('/')[0]
    .trim();
}

function isRealCardNumber(num) {
  if (!num) return false;
  // Tipici OP: OP01-001, ST21-014, EB02-010a, P-001, etc.
  return /^[A-Z]{1,4}\d{0,3}[-_]?\d{1,4}[A-Z0-9]*$/i.test(num) || /^P-\d+/i.test(num);
}

function bpImage(bp) {
  const img = bp?.image;
  if (bp?.image_url && /^https?:/i.test(bp.image_url)) {
    return bp.image_url.replace('https://cardtrader.com', 'https://www.cardtrader.com');
  }
  if (!img || typeof img !== 'object') return '';
  const pick = img.preview?.url || img.show?.url || img.url || '';
  if (!pick) return '';
  if (/^https?:/i.test(pick)) return pick.replace('https://cardtrader.com', 'https://www.cardtrader.com');
  return 'https://www.cardtrader.com' + (pick.startsWith('/') ? pick : `/${pick}`);
}

function listingPriceEur(listing) {
  const cents = Number(listing?.price_cents ?? listing?.price?.cents);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  const cur = String(listing?.price_currency || listing?.price?.currency || 'EUR').toUpperCase();
  if (cur && cur !== 'EUR') return null;
  return cents / 100;
}

function isNearMint(listing) {
  const cond = String(listing?.properties_hash?.condition || '').toLowerCase();
  return cond === 'near mint' || cond === 'mint' || cond.startsWith('near mint');
}

function listingLang(listing) {
  const ph = listing?.properties_hash || {};
  return normLang(ph.onepiece_language || ph.language || '');
}

function pricesFromMarketplace(mktByBp, blueprintId) {
  const raw = mktByBp?.[blueprintId] || mktByBp?.[String(blueprintId)] || [];
  const listings = Array.isArray(raw) ? raw : [];
  const byLang = {};
  let nmMin = null;
  let minAny = null;
  let anyCount = 0;

  for (const l of listings) {
    const p = listingPriceEur(l);
    if (p == null) continue;
    anyCount++;
    minAny = minAny == null ? p : Math.min(minAny, p);
    const lang = listingLang(l) || 'unk';
    if (!byLang[lang]) byLang[lang] = { nm: null, min: null, n: 0, nNm: 0 };
    const row = byLang[lang];
    row.n++;
    row.min = row.min == null ? p : Math.min(row.min, p);
    if (isNearMint(l)) {
      row.nNm++;
      row.nm = row.nm == null ? p : Math.min(row.nm, p);
      nmMin = nmMin == null ? p : Math.min(nmMin, p);
    }
  }

  // Arrotonda
  for (const row of Object.values(byLang)) {
    if (row.nm != null) row.nm = Number(row.nm.toFixed(2));
    if (row.min != null) row.min = Number(row.min.toFixed(2));
  }

  return {
    priceNm: nmMin != null ? Number(nmMin.toFixed(2)) : null,
    priceMin: minAny != null ? Number(minAny.toFixed(2)) : null,
    listings: anyCount,
    pricesByLang: Object.keys(byLang).length ? byLang : null,
  };
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function shouldSkipExpansion(exp) {
  const code = String(exp.code || '').toLowerCase();
  const name = String(exp.name || '');
  // Prodotti accessori senza carte numerate tipiche
  if (code === 'bandai' || code === 'oppr') return true;
  if (/premium bandai products|one piece products$/i.test(name)) return true;
  return false;
}

async function loadOpSets() {
  const raw = ctList(await ctGet(`/expansions?game_id=${GAME_ID}`))
    .filter(e => e.game_id === GAME_ID && !shouldSkipExpansion(e));

  const seen = new Set();
  const sets = [];
  for (const exp of raw) {
    const id = String(exp.code || exp.id).toLowerCase();
    const name = exp.name || exp.name_en || exp.code;
    const dedupeKey = `${id}|${name}`.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    sets.push({
      id,
      ctId: exp.id,
      text: `${name} (${exp.code})`,
      code: exp.code,
    });
  }
  sets.sort((a, b) => a.text.localeCompare(b.text, 'it'));
  return sets;
}

async function importSet(set, index, total) {
  const expId = set.ctId;
  console.log(`[${index + 1}/${total}] ${set.code || set.id} (ctId=${expId})…`);
  const [bpsRaw, mktRaw] = await Promise.all([
    ctGet(`/blueprints/export?expansion_id=${expId}`),
    ctGet(`/marketplace/products?expansion_id=${expId}`).catch(err => {
      console.warn(`  marketplace skip: ${err.message}`);
      return {};
    }),
  ]);
  const bps = ctList(bpsRaw).filter(bp => bp?.id && bp?.name);
  const mktByBp = (mktRaw && typeof mktRaw === 'object' && !Array.isArray(mktRaw)) ? mktRaw : {};
  const cards = [];
  let skipped = 0;
  for (const bp of bps) {
    const num = bpNumber(bp);
    const name = String(bp.name || '').trim();
    if (!name) continue;
    if (!isRealCardNumber(num)) {
      skipped++;
      continue;
    }
    const prices = pricesFromMarketplace(mktByBp, bp.id);
    cards.push({
      id: bp.id,
      name,
      number: num,
      rarity: bp.fixed_properties?.onepiece_rarity || bp.fixed_properties?.rarity || bp.category_name || '',
      setId: set.id,
      setCode: set.code || set.id,
      setName: (set.text || '').replace(/\s*\([^)]*\)\s*$/, '').trim() || set.code || set.id,
      setCtId: expId,
      img: bpImage(bp) || '',
      priceNm: prices.priceNm,
      priceMin: prices.priceMin,
      listings: prices.listings,
      pricesByLang: prices.pricesByLang,
    });
  }
  const withLang = cards.filter(c => c.pricesByLang).length;
  console.log(`  → ${cards.length} carte (skip ${skipped}) · prezzo ${cards.filter(c => c.priceNm != null).length} · con lingue ${withLang}`);
  await sleep(DELAY_MS);
  return cards;
}

async function main() {
  console.log('Scoperta espansioni One Piece…');
  const sets = await loadOpSets();
  if (!sets.length) throw new Error('Nessuna espansione OP trovata');
  console.log(`Espansioni: ${sets.length}`);

  const setsBody = `// Auto-generated from CardTrader (game_id=${GAME_ID}) — ${new Date().toISOString()}\n`
    + `const ONE_PIECE_SETS = ${JSON.stringify(sets, null, 2)};\n`;
  fs.writeFileSync(OUT_SETS, setsBody, 'utf8');
  console.log(`Scritto ${OUT_SETS}`);

  const chunks = await mapPool(sets, CONCURRENCY, (set, idx) => importSet(set, idx, sets.length));
  const all = chunks.flat();

  const seen = new Set();
  const cards = [];
  for (const c of all) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    cards.push(c);
  }
  cards.sort((a, b) =>
    String(a.setCode).localeCompare(String(b.setCode))
    || String(a.number).localeCompare(String(b.number), undefined, { numeric: true })
    || a.name.localeCompare(b.name)
  );

  const withPrice = cards.filter(c => c.priceNm != null || c.priceMin != null).length;
  const langKeys = new Set();
  for (const c of cards) {
    if (c.pricesByLang) Object.keys(c.pricesByLang).forEach(k => langKeys.add(k));
  }
  const generatedAt = new Date().toISOString();
  const header = `// Auto-generated One Piece catalog from CardTrader — ${generatedAt}\n`
    + `// sets=${sets.length} cards=${cards.length} withPrice=${withPrice} langs=${[...langKeys].sort().join(',')}\n`
    + `// priceNm/priceMin = min globale; pricesByLang = { en|jp|it|…: { nm, min, n, nNm } }\n`
    + `// Aggiorna con: node tools/generate-onepiece-catalog.mjs\n`;
  fs.writeFileSync(OUT_CARDS, header + `const ONE_PIECE_CARDS = ${JSON.stringify(cards)};\n`, 'utf8');
  console.log(`\nScritto ${OUT_CARDS}`);
  console.log(`Carte: ${cards.length} · con prezzo: ${withPrice} · lingue: ${[...langKeys].sort().join(', ')}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
