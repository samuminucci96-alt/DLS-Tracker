import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const token = html.match(/id="ctApiKey"[^>]*value="([^"]+)"/)?.[1];
const CT = 'https://api.cardtrader.com/api/v2';
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

const CT_SET_CODE_MAP = {
  me025: 'asc', me02pt5: 'asc', me02_5: 'asc', 'me02.5': 'asc',
  me02: 'msh', me02p: 'msh',
  ascesaeroica: 'asc', ascendedheroes: 'asc',
};

function norm(v) {
  return String(v || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function ctList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.array)) return data.array;
  if (data && typeof data === 'object') return Object.values(data);
  return [];
}

async function get(path) {
  const res = await fetch(`${CT}${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const card = {
  name: 'Pikachu ex',
  number: '276/217',
  set: { id: 'me02.5', name: 'Ascended Heroes' }
};

const gameId = ctList(await get('/games')).find(g => norm(g.name).includes('pokemon'))?.id;
const expansions = ctList(await get(`/expansions?game_id=${gameId}`)).filter(e => e.game_id === gameId);
const setId = card.set.id.toLowerCase().replace(/[\.\-\s]/g, '');
const mappedCode = CT_SET_CODE_MAP[setId];
const exp = expansions.find(e => (e.code || '').toLowerCase() === mappedCode);
console.log('expansion', exp?.code, exp?.name);

const bps = ctList(await get(`/blueprints/export?expansion_id=${exp.id}`));
const rawNum = card.number.split('/')[0].replace(/^0+/, '');
const bp = bps.find(b => norm(b.name) === norm(card.name) && String(b.fixed_properties?.collector_number || '').replace(/^0+/, '') === rawNum);
console.log('blueprint', bp?.id, bp?.name);

const data = await get(`/marketplace/products?blueprint_id=${bp.id}`);
const listings = Object.values(data).flat();
const prices = listings.map(l => l.price_cents / 100).filter(p => p > 0);
console.log('listings', listings.length, 'min', Math.min(...prices), 'avg', (prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(2));
