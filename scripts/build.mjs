import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'lib')
await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

execFileSync(resolve(root, 'node_modules/.bin/tsc'), [
  '--project', resolve(root, 'tsconfig.json'),
  '--declaration', '--emitDeclarationOnly', '--noEmit', 'false',
  '--outDir', resolve(out, 'types'),
], { cwd: root, stdio: 'inherit' })

await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  outfile: resolve(out, 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  external: ['@deepseek-ai/cordis'],
})

await build({
  entryPoints: [resolve(root, 'src/client/index.ts')],
  outfile: resolve(out, 'client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  external: [
    'react', 'react/jsx-runtime', 'react-dom',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-layout/client',
    '@deepseek-ai/dsh-client-ui-renderer/client',
  ],
  banner: { js: 'window.__ModuleLoader__.load({ id: "@llq/dsh-output-outline", factory: (require) => { var module = { exports: {} }; var exports = module.exports;' },
  footer: { js: 'return module.exports; } });' },
})
