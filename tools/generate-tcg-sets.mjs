import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const root = path.resolve('.');
const token = process.env.CARDTRADER_API_TOKEN;
if (!token) throw new Error('CARDTRADER_API_TOKEN missing — set it in .env');

const CT = 'https://api.cardtrader.com/api/v2';
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

async function get(urlPath) {
  const res = await fetch(`${CT}${urlPath}`, { headers });
  if (!res.ok) throw new Error(`${urlPath} ${res.status}`);
  return res.json();
}

function ctList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.array)) return data.array;
  return Object.values(data || {});
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
}

const SKIP_PATTERNS = [
  /promo/i, /winner pack/i, /tournament/i, /judge/i, /championship/i,
  /magazine/i, /errata/i, /reprint/i, /premium card collection/i,
  /organized play/i, /release event/i, /nexus night/i, /champ/i,
  /products$/i, /exclusives/i, /anniversary/i, /revision pack/i,
  /bandai/i, /unnumbered/i, /store tournaments/i, /learn together/i,
];

function shouldInclude(exp, game) {
  const label = `${exp.code} ${exp.name}`;
  if (SKIP_PATTERNS.some(p => p.test(label))) return false;
  if (game === 'onepiece') {
    return /^(op|st|eb|prb|ld)[-\d]/i.test(exp.code) || /^op\d/i.test(exp.code);
  }
  if (game === 'riftbound') {
    return /^(ogn|ogs|arc|sfd|unl|ven|rad)$/i.test(exp.code);
  }
  return true;
}

async function main() {
  const games = ctList(await get('/games'));
  const configs = [
    { key: 'onepiece', id: 15, file: 'onepiece-sets.js', var: 'ONE_PIECE_SETS' },
    { key: 'riftbound', id: 22, file: 'riftbound-sets.js', var: 'RIFTBOUND_SETS' },
  ];

  for (const cfg of configs) {
    const raw = ctList(await get(`/expansions?game_id=${cfg.id}`))
      .filter(e => e.game_id === cfg.id && shouldInclude(e, cfg.key));

    const seen = new Set();
    const sets = [];
    for (const exp of raw) {
      const id = String(exp.code || exp.id).toLowerCase();
      const name = exp.name || exp.name_en || exp.code;
      const dedupeKey = norm(name);
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
    const content = `// Auto-generated from CardTrader (game_id=${cfg.id})\nconst ${cfg.var} = ${JSON.stringify(sets, null, 2)};\n`;
    fs.writeFileSync(path.join(root, cfg.file), content);
    console.log(`wrote ${cfg.file} (${sets.length} sets)`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
