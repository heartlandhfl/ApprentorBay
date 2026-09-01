import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cwd, command, args) {
  const dir = path.join(root, cwd);
  console.log(`$ ${command} ${args.join(' ')} (in ${cwd || '.'})`);
  const result = spawnSync(command, args, {
    cwd: dir,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd || '.'}`);
  }
}

run('client', 'npx', ['vite', 'build']);

const dist = path.join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'server/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(dist, 'server.js'),
  target: 'node20',
  sourcemap: true,
  logLevel: 'info',
  banner: {
    js: 'var import_meta_url = require("node:url").pathToFileURL(__filename).href;',
  },
  define: {
    'import.meta.url': 'import_meta_url',
  },
  alias: {
    '@apprentorbay/shared': path.join(root, 'shared/index.ts'),
  },
  external: [
    'firebase-admin',
    'firebase-admin/app',
    'firebase-admin/auth',
    'firebase-admin/firestore',
  ],
});

cpSync(path.join(root, 'client/dist'), path.join(dist, 'public'), { recursive: true });
console.log('Wrote dist/server.js and dist/public');
