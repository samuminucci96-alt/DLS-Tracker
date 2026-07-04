import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('<select id="cardSet">');
const end = html.indexOf('</select>', start);
const chunk = start >= 0 ? html.slice(start, end) : html;
const re = /<option value="([^"]*)">([^<]+)<\/option>/g;
const sets = [];
let m;
while ((m = re.exec(chunk)) !== null) {
  if (!m[1]) continue;
  sets.push({ id: m[1], text: m[2].replace(/&amp;/g, '&') });
}
if (!sets.find(s => s.id === 'me4')) {
  sets.unshift({ id: 'me4', text: 'Chaos Rising – Caos Ascendente (me4) · 2026' });
}
const out = `// Auto-generated from index.html set list\nconst POKEMON_SETS = ${JSON.stringify(sets, null, 2)};\n`;
fs.writeFileSync('pokemon-sets.js', out, { encoding: 'utf8' });
console.log('sets', sets.length);
