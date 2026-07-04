import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const token = html.match(/id="ctApiKey"[^>]*value="([^"]+)"/)?.[1];
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

function list(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.array)) return data.array;
  return Object.values(data || {});
}

async function probe(label, expansionId) {
  const res = await fetch(`https://api.cardtrader.com/api/v2/blueprints/export?expansion_id=${expansionId}`, { headers });
  const data = await res.json();
  const bps = list(data);
  const withImg = bps.filter(b => b.image?.url || b.image_url || b.image?.show?.url || b.images);
  console.log(`\n${label} expansion ${expansionId}: ${bps.length} blueprints, ${withImg.length} with some image field`);
  const sample = bps.find(b => /luffy/i.test(b.name)) || bps[0];
  console.log('Sample keys:', Object.keys(sample).sort().join(', '));
  console.log('Sample image field:', JSON.stringify({
    image: sample.image,
    image_url: sample.image_url,
    images: sample.images,
    image_show: sample.image?.show,
  }, null, 2));
  if (sample.id) {
    const prod = await fetch(`https://api.cardtrader.com/api/v2/marketplace/products?blueprint_id=${sample.id}`, { headers });
    const pd = await prod.json();
    const listings = list(pd).flat?.() || Object.values(pd).flat();
    const first = listings[0];
    console.log('Product listing keys:', first ? Object.keys(first).sort().join(', ') : 'none');
    console.log('Product image:', JSON.stringify({
      image: first?.image,
      blueprint_image: first?.blueprint_image,
      properties_hash: first?.properties_hash,
    }, null, 2).slice(0, 800));
  }
}

await probe('One Piece OP01', 3332);
await probe('Riftbound Origins', 4166);
