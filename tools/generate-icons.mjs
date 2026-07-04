import sharp from 'sharp';
import path from 'path';

const root = path.resolve('.');
const logoPath = path.join(root, 'logo.png');
const BG = { r: 232, g: 244, b: 252, alpha: 1 };

/** Logo quadrato: crop centrato + flatten su sfondo chiaro (niente trasparenze nere). */
async function squareLogoBuffer(targetSize) {
  const meta = await sharp(logoPath).metadata();
  const side = Math.min(meta.width, meta.height);
  const left = Math.max(0, Math.round((meta.width - side) / 2));
  const top = Math.max(0, Math.round((meta.height - side) / 2));

  return sharp(logoPath)
    .extract({ left, top, width: side, height: side })
    .flatten({ background: BG })
    .resize(targetSize, targetSize, {
      fit: 'contain',
      background: BG,
    })
    .png()
    .toBuffer();
}

async function buildIcon(size, outName, inset = 0) {
  const inner = Math.max(1, Math.round(size * (1 - inset * 2)));
  const logo = await squareLogoBuffer(inner);
  const offset = Math.round((size - inner) / 2);

  await sharp({
    create: { width: size, height: size, channels: 3, background: BG },
  })
    .composite([{ input: logo, left: offset, top: offset }])
    .flatten({ background: BG })
    .png({ compressionLevel: 9, force: true })
    .toFile(path.join(root, outName));

  console.log('wrote', outName, `(${size}px, inset ${Math.round(inset * 100)}%)`);
}

// purpose "any" — logo a tutto schermo, sfondo #e8f4fc
await buildIcon(512, 'icon-512.png', 0);
await buildIcon(192, 'icon-192.png', 0);
await buildIcon(180, 'apple-touch-icon.png', 0);

// purpose "maskable" — safe zone ~80% (Android/iOS adaptive icon)
await buildIcon(512, 'icon-512-maskable.png', 0.1);
await buildIcon(192, 'icon-192-maskable.png', 0.1);
