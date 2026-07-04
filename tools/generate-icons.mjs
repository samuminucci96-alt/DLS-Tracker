import sharp from 'sharp';
import path from 'path';

const root = path.resolve('.');
const logoPath = path.join(root, 'logo.png');
const BG = { r: 232, g: 244, b: 252, alpha: 1 };

async function buildIcon(size, outName, scale = 0.84) {
  const inner = Math.max(1, Math.round(size * scale));
  const logo = await sharp(logoPath)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, outName));

  console.log('wrote', outName, `(logo ${Math.round(scale * 100)}%)`);
}

// purpose "any" — logo grande per home screen / drawer
await buildIcon(512, 'icon-512.png', 0.88);
await buildIcon(192, 'icon-192.png', 0.88);
await buildIcon(180, 'apple-touch-icon.png', 0.9);

// purpose "maskable" — safe zone ~80%, logo comunque più grande del precedente
await buildIcon(512, 'icon-512-maskable.png', 0.72);
await buildIcon(192, 'icon-192-maskable.png', 0.72);
