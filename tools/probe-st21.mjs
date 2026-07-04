import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const token = html.match(/id="ctApiKey"[^>]*value="([^"]+)"/)?.[1];
const CT = 'https://api.cardtrader.com/api/v2';
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

async function get(path) {
  const res = await fetch(`${CT}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

function ctList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.array)) return data.array;
  return Object.values(data || {});
}

const exps = ctList(await get('/expansions?game_id=15')).filter(e => e.game_id === 15);
console.log('OP expansions', exps.length);
const matches = exps.filter(e => /magazine|vol|promo|st21/i.test(`${e.name} ${e.code}`));
console.log(matches.map(e => ({ id: e.id, name: e.name, code: e.code })));

for (const exp of matches) {
  await new Promise(r => setTimeout(r, 600));
  const bps = ctList(await get(`/blueprints/export?expansion_id=${exp.id}`));
  const hit = bps.filter(b => /luffy/i.test(b.name || '') && /ST21/i.test(String(b.fixed_properties?.collector_number || b.collector_number || '')));
  if (hit.length) {
    console.log('FOUND in', exp.name);
    hit.forEach(b => console.log(' ', b.name, b.fixed_properties?.collector_number, b.id));
  }
}
