/* Generates simple PNG app icons (solid background + house silhouette) without native deps. */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makeIcon(size, path) {
  const bg = [27, 39, 51];
  const wall = [222, 196, 148];
  const roof = [178, 74, 54];
  const pixels = Buffer.alloc(size * size * 4);
  const roofTop = Math.floor(size * 0.22);
  const roofBase = Math.floor(size * 0.45);
  const wallBase = Math.floor(size * 0.78);
  const wallLeft = Math.floor(size * 0.3);
  const wallRight = Math.floor(size * 0.7);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let col = bg;
      const inRoofSpan = x >= size * 0.2 && x <= size * 0.8;
      if (inRoofSpan && y >= roofTop && y <= roofBase) {
        const t = (y - roofTop) / (roofBase - roofTop);
        const half = (size * 0.3 * (1 - t));
        if (Math.abs(x - size / 2) <= half) col = roof;
      }
      if (x >= wallLeft && x <= wallRight && y > roofBase && y <= wallBase) col = wall;
      const doorW = size * 0.1;
      if (Math.abs(x - size / 2) < doorW / 2 && y > wallBase - size * 0.18 && y <= wallBase) col = bg;
      const i = (y * size + x) * 4;
      pixels[i] = col[0];
      pixels[i + 1] = col[1];
      pixels[i + 2] = col[2];
      pixels[i + 3] = 255;
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.log('wrote', path);
}

mkdirSync(join(process.cwd(), 'public'), { recursive: true });
makeIcon(192, join(process.cwd(), 'public', 'icon-192.png'));
makeIcon(512, join(process.cwd(), 'public', 'icon-512.png'));
