import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const token = html.match(/id="ctApiKey"[^>]*value="([^"]+)"/)?.[1];
const CT = 'https://api.cardtrader.com/api/v2';
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

async function get(path) {
  const res = await fetch(`${CT}${path}`, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function ctList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.array)) return data.array;
  if (data && typeof data === 'object') return Object.values(data);
  return [];
}

const expsRaw = await get('/expansions?game_id=5');
const exps = ctList(expsRaw).filter(e => e.game_id === 5);
console.log('poke exps', exps.length);
const hits = exps.filter(e => /asces|ascend|hero|me02|msh|asc/i.test(JSON.stringify(e)));
console.log('hits', hits.map(e => ({ id: e.id, code: e.code, name: e.name })));

for (const exp of hits.filter(e => /asces|ascend|hero|msh|asc/i.test(`${e.code} ${e.name}`))) {
  const bps = ctList(await get(`/blueprints/export?expansion_id=${exp.id}`));
  const pika = bps.filter(b => /pikachu/i.test(b.name));
  const num276 = pika.filter(b => String(b.fixed_properties?.collector_number || '').replace(/^0+/, '') === '276');
  console.log('exp', exp.code, exp.name, 'pika', pika.length, '276', num276.map(b => ({ id: b.id, name: b.name, num: b.fixed_properties?.collector_number })));
  if (num276[0]) {
    const data = await get(`/marketplace/products?blueprint_id=${num276[0].id}`);
    const listings = Object.values(data).flat();
    console.log('  listings', listings.length, 'min', Math.min(...listings.map(l => l.price_cents)) / 100);
  }
}
