import sharp from 'sharp';
import path from 'path';

const root = path.resolve('.');
const logoPath = path.join(root, 'logo.png');
const BG = { r: 232, g: 244, b: 252, alpha: 1 };

async function buildIcon(size, outName) {
  await sharp(logoPath)
    .resize(size, size, {
      fit: 'contain',
      background: BG,
    })
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, outName));
  console.log('wrote', outName);
}

await buildIcon(512, 'icon-512.png');
await buildIcon(192, 'icon-192.png');
await buildIcon(180, 'apple-touch-icon.png');
