import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const token = html.match(/id="ctApiKey"[^>]*value="([^"]+)"/)?.[1];
const CT = 'https://api.cardtrader.com/api/v2';
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

async function get(path) {
  const res = await fetch(`${CT}${path}`, { headers });
  return res.json();
}

function list(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.array)) return data.array;
  if (data && typeof data === 'object') return Object.values(data);
  return [];
}

const exps = list(await get('/expansions?game_id=5')).filter(e => e.game_id === 5);
const hits = exps.filter(e => /chaos|risin|me4/i.test(`${e.code} ${e.name}`));
console.log('expansions', hits.map(e => ({ id: e.id, code: e.code, name: e.name })));

for (const exp of hits.filter(e => /chaos/i.test(e.name))) {
  const bps = list(await get(`/blueprints/export?expansion_id=${exp.id}`));
  const g = bps.filter(b => /greninja/i.test(b.name));
  console.log(exp.code, 'greninja count', g.length);
  for (const bp of g) {
    const data = await get(`/marketplace/products?blueprint_id=${bp.id}`);
    const listings = Object.values(data).flat();
    const prices = listings.map(l => l.price_cents / 100).filter(p => p > 0);
    console.log(' ', bp.id, bp.name, '#', bp.fixed_properties?.collector_number, 'min', Math.min(...prices));
  }
}
