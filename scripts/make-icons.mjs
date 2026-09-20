#!/usr/bin/env node
/**
 * Génère les icônes PWA (PNG) sans dépendance : fond émeraude et croissant crème.
 * iOS n'accepte pas le SVG pour l'icône d'écran d'accueil, d'où le PNG.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** maskable : le motif reste dans la zone sûre (80 %) ; `rounded` : coins arrondis pour l'icône « any ». */
function png(size, { rounded }) {
  const BG = [15, 118, 110]; // #0f766e
  const FG = [253, 246, 227]; // crème
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const R = size * 0.5;
  const c1 = { x: size * 0.5, y: size * 0.5, r: size * 0.27 }; // disque
  const c2 = { x: size * 0.6, y: size * 0.45, r: size * 0.23 }; // disque retranché → croissant
  const star = { x: size * 0.66, y: size * 0.34, r: size * 0.045 };
  const cr = size * 0.22;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      let a = 255;
      if (rounded) {
        const dx = Math.max(cr - px, 0, px - (size - cr)), dy = Math.max(cr - py, 0, py - (size - cr));
        if (dx * dx + dy * dy > cr * cr) a = 0;
      }
      const inC1 = (px - c1.x) ** 2 + (py - c1.y) ** 2 <= c1.r ** 2;
      const inC2 = (px - c2.x) ** 2 + (py - c2.y) ** 2 <= c2.r ** 2;
      const inStar = (px - star.x) ** 2 + (py - star.y) ** 2 <= star.r ** 2;
      const fg = (inC1 && !inC2) || inStar;
      const [r, g, b] = fg ? FG : BG;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = [
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
  ['icon-maskable-512.png', 512, false],
  ['apple-touch-icon.png', 180, false], // iOS applique lui-même les coins arrondis
];
for (const [name, size, rounded] of files) writeFileSync(new URL(name, OUT), png(size, { rounded }));
console.log('✔ icônes générées :', files.map((f) => f[0]).join(', '));
