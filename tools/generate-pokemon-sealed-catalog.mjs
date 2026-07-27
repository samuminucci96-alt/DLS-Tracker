/**
 * Genera pokemon-sealed-cards.js + pokemon-sealed-sets.js da CardTrader.
 * Prodotti sealed Pokémon (game_id=5): Box, ETB/Bundle, Blister, Box set, Bustine.
 *
 * Uso: node tools/generate-pokemon-sealed-catalog.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PROXY = process.env.CT_PROXY || 'https://dlstracker.netlify.app/api/cardtrader?path=';
const OUT_CARDS = path.join(root, 'pokemon-sealed-cards.js');
const OUT_SETS = path.join(root, 'pokemon-sealed-sets.js');
const GAME_ID = 5;
const CONCURRENCY = 4;
const DELAY_MS = 180;

/** CT category_id → tipo collezionismo Sealed */
const CAT_HINT = {
  66: 'pack',     // booster / sleeved
  67: 'box',      // booster box
  68: 'etb',      // ETB / bundle / B&B (raffinato per nome)
  190: 'blister',
  60: 'boxset',   // collections / premium / UPC
  59: 'boxset',   // tin / mini tin
  69: 'boxset',   // theme / battle decks as box-set-like
};

const SEALED_CATS = new Set(Object.keys(CAT_HINT).map(Number));

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

function listingLang(listing) {
  const ph = listing?.properties_hash || {};
  return normLang(ph.pokemon_language || ph.language || '');
}

function classifySealed(bp) {
  const cat = Number(bp.category_id);
  if (!SEALED_CATS.has(cat)) return null;
  const name = String(bp.name || '');

  // Escludi accessori / vuoti / display case puri
  if (/empty |sleeve|binder|deck box|dice|coin|playmat|toploader|protector/i.test(name)) return null;
  if (/\bCase\b/i.test(name) && !/showcase|collector'?s? case/i.test(name) && cat === 67) {
    // Booster Box Case → resta box (multi-box), ok
  }

  if (cat === 66) return 'pack';
  if (cat === 67) return 'box';
  if (cat === 190) return 'blister';
  if (cat === 59 || cat === 60 || cat === 69) return 'boxset';

  if (cat === 68) {
    if (/booster bundle/i.test(name)) return 'etb';
    if (/elite trainer|\bETB\b|trainer box/i.test(name)) return 'etb';
    if (/build & battle|battle stadium|league battle/i.test(name)) return 'boxset';
    return 'etb';
  }
  return CAT_HINT[cat] || null;
}

function pricesFromMarketplace(mktByBp, blueprintId) {
  const raw = mktByBp?.[blueprintId] || mktByBp?.[String(blueprintId)] || [];
  const listings = Array.isArray(raw) ? raw : [];
  const byLang = {};
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
    // Per sealed spesso non c'è condition: tratta min come nm
    row.nNm++;
    row.nm = row.nm == null ? p : Math.min(row.nm, p);
  }

  for (const row of Object.values(byLang)) {
    if (row.nm != null) row.nm = Number(row.nm.toFixed(2));
    if (row.min != null) row.min = Number(row.min.toFixed(2));
  }

  return {
    priceNm: minAny != null ? Number(minAny.toFixed(2)) : null,
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

async function loadExpansions() {
  const raw = ctList(await ctGet(`/expansions?game_id=${GAME_ID}`))
    .filter(e => e.game_id === GAME_ID);
  const seen = new Set();
  const sets = [];
  for (const exp of raw) {
    const id = String(exp.code || exp.id).toLowerCase();
    const name = exp.name || exp.name_en || exp.code;
    const key = `${id}|${name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    sets.push({
      id,
      ctId: exp.id,
      text: `${name} (${exp.code})`,
      code: exp.code,
      name,
    });
  }
  sets.sort((a, b) => a.text.localeCompare(b.text, 'it'));
  return sets;
}

async function importExpansion(set, index, total) {
  const expId = set.ctId;
  process.stdout.write(`[${index + 1}/${total}] ${set.code || set.id}… `);
  let bpsRaw;
  try {
    bpsRaw = await ctGet(`/blueprints/export?expansion_id=${expId}`);
  } catch (err) {
    console.log(`skip blueprints (${err.message})`);
    return [];
  }
  const bps = ctList(bpsRaw).filter(bp => bp?.id && bp?.name && classifySealed(bp));
  if (!bps.length) {
    console.log('0 sealed');
    await sleep(DELAY_MS);
    return [];
  }

  let mktByBp = {};
  try {
    const mktRaw = await ctGet(`/marketplace/products?expansion_id=${expId}`);
    if (mktRaw && typeof mktRaw === 'object' && !Array.isArray(mktRaw)) mktByBp = mktRaw;
  } catch (err) {
    console.warn(`marketplace skip: ${err.message}`);
  }

  const cards = bps.map(bp => {
    const type = classifySealed(bp);
    const prices = pricesFromMarketplace(mktByBp, bp.id);
    return {
      id: bp.id,
      name: String(bp.name).trim(),
      type,
      categoryId: bp.category_id || null,
      number: '',
      rarity: '',
      setId: set.id,
      setCode: set.code || set.id,
      setName: set.name || set.code || set.id,
      setCtId: expId,
      img: bpImage(bp) || '',
      priceNm: prices.priceNm,
      priceMin: prices.priceMin,
      listings: prices.listings,
      pricesByLang: prices.pricesByLang,
    };
  });

  const withPrice = cards.filter(c => c.priceNm != null).length;
  console.log(`${cards.length} sealed · prezzo ${withPrice}`);
  await sleep(DELAY_MS);
  return cards;
}

async function main() {
  console.log('Scoperta espansioni Pokémon…');
  const expansions = await loadExpansions();
  console.log(`Espansioni: ${expansions.length}`);

  const chunks = await mapPool(expansions, CONCURRENCY, (set, idx) => importExpansion(set, idx, expansions.length));
  const all = chunks.flat();

  const seen = new Set();
  const cards = [];
  for (const c of all) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    cards.push(c);
  }

  cards.sort((a, b) =>
    String(a.type).localeCompare(String(b.type))
    || String(a.setCode).localeCompare(String(b.setCode))
    || a.name.localeCompare(b.name)
  );

  // Solo set che hanno almeno un prodotto sealed
  const usedCt = new Set(cards.map(c => String(c.setCtId)));
  const sealedSets = expansions
    .filter(s => usedCt.has(String(s.ctId)))
    .map(({ id, ctId, text, code }) => ({ id, ctId, text, code }));

  const byType = {};
  for (const c of cards) byType[c.type] = (byType[c.type] || 0) + 1;
  const withPrice = cards.filter(c => c.priceNm != null || c.priceMin != null).length;
  const langKeys = new Set();
  for (const c of cards) {
    if (c.pricesByLang) Object.keys(c.pricesByLang).forEach(k => langKeys.add(k));
  }

  const generatedAt = new Date().toISOString();
  fs.writeFileSync(
    OUT_SETS,
    `// Auto-generated Pokémon Sealed sets from CardTrader — ${generatedAt}\n`
    + `const POKEMON_SEALED_SETS = ${JSON.stringify(sealedSets, null, 2)};\n`,
    'utf8'
  );

  const header = `// Auto-generated Pokémon Sealed catalog from CardTrader — ${generatedAt}\n`
    + `// sets=${sealedSets.length} products=${cards.length} withPrice=${withPrice} types=${JSON.stringify(byType)} langs=${[...langKeys].sort().join(',')}\n`
    + `// type: box | etb | blister | boxset | pack\n`
    + `// Aggiorna con: node tools/generate-pokemon-sealed-catalog.mjs\n`;
  fs.writeFileSync(OUT_CARDS, header + `const POKEMON_SEALED_CARDS = ${JSON.stringify(cards)};\n`, 'utf8');

  console.log(`\nScritto ${OUT_SETS} (${sealedSets.length} set)`);
  console.log(`Scritto ${OUT_CARDS}`);
  console.log(`Prodotti: ${cards.length} · con prezzo: ${withPrice}`);
  console.log('Per tipo:', byType);
  console.log('Lingue:', [...langKeys].sort().join(', '));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
