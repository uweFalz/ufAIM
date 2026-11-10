// Reproduce the standalone delivery from repository-owned sources.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { renderDbbBlock, renderGraBlock } from './technet-shared-blocks.mjs';
const root = new URL('../', import.meta.url);
const inputs = {};
const read = async p => { const b = await fs.readFile(new URL(p, root)); inputs[p] = createHash('sha256').update(b).digest('hex'); return b.toString(); };
let html = await read('viewer/index.html.in');
for (const p of ['src/viewer.css','vendor/maplibre.css','src/insecure-context-shim.js','vendor/maplibre.js']) { const body = await read(`viewer/${p}`); html = html.replace(`@@${p}@@`, () => body); }
const gra = await renderGraBlock(read), dbb = await renderDbbBlock(read);
const importer = (await read('viewer/src/import-legacy.js.in')).replace('@@GRA@@', () => gra).replace('@@DBB@@', () => dbb);
const view = await read('viewer/src/viewer.js');
html = html.replace('@@IMPORT@@', () => importer).replace('@@VIEWER@@', () => view);
if (/@@(?:IMPORT|VIEWER|GRA|DBB|src\/|vendor\/)/.test(html)) throw Error('Unresolved Viewer source placeholder');
for (const p of ['tools/build-technet-viewer.mjs','tools/technet-shared-blocks.mjs']) await read(p);
const manifest = JSON.stringify({version:1,inputs,output:{path:'technetViewer.html',sha256:createHash('sha256').update(html).digest('hex')}},null,2)+'\n';
if (process.argv.includes('--write')) {
 await fs.writeFile(new URL('technetViewer.html',root),html);
 await fs.writeFile(new URL('viewer/source-manifest.json',root),manifest);
 console.log('Viewer generated from repository sources.');
} else {
 if (await fs.readFile(new URL('technetViewer.html',root),'utf8') !== html) throw Error('Viewer stale: node tools/build-technet-viewer.mjs --write');
 if (await fs.readFile(new URL('viewer/source-manifest.json',root),'utf8') !== manifest) throw Error('Viewer source manifest stale');
 console.log('Viewer and SHA256 source manifest match.');
}
