import { defineConfig, type Plugin } from 'vite';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Writes dist/sw-manifest.json listing every built file so the service worker can precache them. */
function precacheManifestPlugin(): Plugin {
  return {
    name: 'lagos-precache-manifest',
    apply: 'build',
    closeBundle() {
      const outDir = join(process.cwd(), 'dist');
      const files: string[] = [];
      const walk = (dir: string): void => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else files.push('./' + relative(outDir, full).split('\\').join('/'));
        }
      };
      walk(outDir);
      // The manifest itself must not try to precache itself recursively at a stale version.
      const filtered = files.filter((f) => f !== './sw-manifest.json');
      filtered.sort();
      writeFileSync(join(outDir, 'sw-manifest.json'), JSON.stringify({ version: Date.now(), files: filtered }, null, 2));
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  plugins: [precacheManifestPlugin()],
  server: {
    host: true,
    port: 5173,
  },
});
