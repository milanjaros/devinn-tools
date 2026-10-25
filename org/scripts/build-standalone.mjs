import { build } from 'vite';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';

// A classic inline script also works on file:// without module/CORS requests.
const fromEsbuild = process.argv.includes('--from-esbuild');
const result = fromEsbuild ? { output: [
  { type: 'asset', fileName: 'index.html', source: (await readFile('index.html', 'utf8')).replace('<script type="module" src="/src/main.tsx"></script>', '<link rel="stylesheet" href="./standalone.css"><script src="./standalone.js"></script>') },
  { type: 'chunk', fileName: 'standalone.js', code: await readFile('dist/standalone.js', 'utf8') },
  { type: 'asset', fileName: 'standalone.css', source: await readFile('dist/standalone.css', 'utf8') },
] } : await build({
  base: './',
  build: {
    write: false,
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
if (Array.isArray(result) || !('output' in result)) throw new Error('Unexpected build output');
const files = result.output;
const entry = files.find(file => file.fileName === 'index.html');
if (!entry || entry.type !== 'asset') throw new Error('Missing index.html');
let html = String(entry.source);
const consumed = new Set(['index.html']);
html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  const name = src.replace(/^\.\//, '');
  const chunk = files.find(file => file.fileName === name);
  if (!chunk || chunk.type !== 'chunk') throw new Error(`Missing script: ${src}`);
  consumed.add(name);
  return `<script>${chunk.code.replace(/<\/script/gi, '<\\/script')}</script>`;
});
html = html.replace(/<link\b[^>]*\bhref="([^"]+)"[^>]*>/g, (tag, href) => {
  if (!/rel="stylesheet"/.test(tag)) throw new Error(`Unexpected external link: ${tag}`);
  const name = href.replace(/^\.\//, '');
  const asset = files.find(file => file.fileName === name);
  if (!asset || asset.type !== 'asset') throw new Error(`Missing stylesheet: ${href}`);
  consumed.add(name);
  return `<style>${String(asset.source).replace(/<\/style/gi, '<\\/style')}</style>`;
});
const remaining = files.filter(file => !consumed.has(file.fileName));
if (remaining.length) throw new Error(`Unbundled assets: ${remaining.map(file => file.fileName).join(', ')}`);
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html);
if (fromEsbuild) await Promise.all(['dist/standalone.js', 'dist/standalone.css'].map(path => unlink(path)));
console.log(`Standalone HTML: dist/index.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
