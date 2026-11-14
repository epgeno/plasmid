import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
const workspaceRoot = resolve(webRoot, '../..');
const outDir = resolve(webRoot, 'src/wasm');

const metaRaw = execFileSync(
  'cargo',
  ['metadata', '--format-version', '1', '--no-deps'],
  { cwd: workspaceRoot, encoding: 'utf8' }
);
const { target_directory: targetDir } = JSON.parse(metaRaw);

console.log('[build:wasm] Compiling plasmid-core (wasm32-unknown-unknown)...');
execFileSync(
  'cargo',
  [
    'build',
    '-p',
    'plasmid-core',
    '--target',
    'wasm32-unknown-unknown',
    '--release',
    '--features',
    'wasm',
    '--locked',
  ],
  { cwd: workspaceRoot, stdio: 'inherit' }
);

const wasmBinary = resolve(
  targetDir,
  'wasm32-unknown-unknown/release/plasmid_core.wasm'
);

console.log('[build:wasm] Generating wasm-bindgen ES module bindings...');
execFileSync(
  'wasm-bindgen',
  ['--target', 'web', '--out-dir', outDir, wasmBinary],
  { cwd: workspaceRoot, stdio: 'inherit' }
);

console.log(`[build:wasm] Output written to ${outDir}`);
