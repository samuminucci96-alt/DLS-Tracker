import fs from 'node:fs';
import vm from 'node:vm';

function loadConst(filePath, constName) {
  const src = fs.readFileSync(filePath, 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`${src}\nglobalThis.__out = ${constName};`, ctx);
  return ctx.__out || [];
}

function norm(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const sets = loadConst('pokemon-sets.js', 'POKEMON_SETS');
const sealedSets = loadConst('pokemon-sealed-sets.js', 'POKEMON_SEALED_SETS');

const knownCtCodes = new Set(
  (sealedSets || [])
    .map((s) => norm(s?.code || s?.id || ''))
    .filter(Boolean)
);

const baseIds = new Set(sets.map((s) => norm(s.id)));
const virtualJp = [...knownCtCodes]
  .filter((code) => !baseIds.has(code))
  .map((code) => ({ id: code, text: `JP Expansion (${code})`, _virtualJp: true }));

const all = [...sets, ...virtualJp];

const idCount = new Map();
for (const row of all) {
  const k = norm(row.id);
  idCount.set(k, (idCount.get(k) || 0) + 1);
}
const duplicateIds = [...idCount.entries()]
  .filter(([, count]) => count > 1)
  .map(([id, count]) => ({ id, count }));

const missingText = all.filter((row) => !String(row.text || '').trim()).map((row) => row.id);
const invalidIds = all
  .filter((row) => !/^[a-z0-9.\-]+$/i.test(String(row.id || '')))
  .map((row) => row.id);

const codeBuckets = new Map();
for (const row of all) {
  const txt = String(row.text || '');
  const match = txt.match(/\(([a-z0-9.\-]+)\)/i);
  const code = (match?.[1] || row.id || '').toLowerCase();
  if (!codeBuckets.has(code)) codeBuckets.set(code, []);
  codeBuckets.get(code).push(row.id);
}

const siglaCollisions = [...codeBuckets.entries()]
  .filter(([, ids]) => new Set(ids.map(norm)).size > 1)
  .slice(0, 25)
  .map(([code, ids]) => ({ code, ids }));

const report = {
  baseSets: sets.length,
  virtualJpAdded: virtualJp.length,
  totalCatalog: all.length,
  duplicateIds,
  missingTextCount: missingText.length,
  invalidIdCount: invalidIds.length,
  siglaCollisions,
};

console.log(JSON.stringify(report, null, 2));
if (duplicateIds.length || missingText.length || invalidIds.length) {
  process.exitCode = 1;
}
