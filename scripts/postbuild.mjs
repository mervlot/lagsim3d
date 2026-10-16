/* Post-build checks: verify the dist bundle and manifest exist. */
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
if (!existsSync(dist)) {
  console.error('dist/ missing — vite build did not run?');
  process.exit(1);
}
const required = ['index.html', 'sw.js', 'manifest.webmanifest', 'sw-manifest.json', 'icon-192.png'];
for (const file of required) {
  if (!existsSync(join(dist, file))) {
    console.error('Missing from dist/:', file);
    process.exit(1);
  }
}

let total = 0;
let files = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else {
      total += statSync(full).size;
      files++;
    }
  }
};
walk(dist);
const manifest = JSON.parse(readFileSync(join(dist, 'sw-manifest.json'), 'utf8'));
console.log(`Build OK: ${files} files, ${(total / 1024).toFixed(1)} KB total, precache manifest v${manifest.version} (${manifest.files.length} entries)`);
