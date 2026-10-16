/**
 * Bundles the node test suite with esbuild and runs it.
 * Avoids needing vitest/jsdom — world, collision, and input logic are DOM-free.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = '/tmp/lagsim-tests';
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [join(process.cwd(), 'src/tests/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: join(outDir, 'tests.mjs'),
  logLevel: 'warning',
  define: { 'import.meta.env.PROD': 'false' },
});

const result = spawnSync(process.execPath, ['--test', join(outDir, 'tests.mjs')], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
