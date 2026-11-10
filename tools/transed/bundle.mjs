#!/usr/bin/env node
// tools/transed/bundle.mjs
//
// The single-file TransEd playground: transed/index.html, app.js and every
// module they reach under src/ folded into one HTML file that runs from a
// double-click, file:// included. It uses the module registry of the AXTRAN2
// bundle (tools/axtran2/bundle.mjs); there is no worker here.
//
//   node tools/transed/bundle.mjs [--out dist/transed.html]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

import { escapeForHtml, graph, idOf, registry } from "../axtran2/bundle.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCRIPT_TAG = '<script type="module" src="./app.js"></script>';

export async function bundleTransEd({ out = join(ROOT, "dist/transed.html") } = {}) {
	const entry = join(ROOT, "transed/app.js");
	const page = await readFile(join(ROOT, "transed/index.html"), "utf8");
	if (!page.includes(SCRIPT_TAG)) throw new Error("the page's script tag was not found");
	const app = await graph([entry]);
	const script = `${registry(app.modules, app.order)}\n__require(${JSON.stringify(idOf(entry))});`;
	const html = page
		.replace(SCRIPT_TAG, () => `<script>\n${escapeForHtml(script)}\n</script>`)
		.replace("<title>TransEd</title>", "<title>TransEd</title>\n<!-- single-file build of transed/ on the alignment-os package; tools/transed/bundle.mjs -->");
	await mkdir(dirname(out), { recursive: true });
	await writeFile(out, html);
	return Object.freeze({ out, modules: app.order.length, bytes: Buffer.byteLength(html) });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	const outArg = process.argv.indexOf("--out");
	bundleTransEd(outArg > 0 ? { out: resolve(process.argv[outArg + 1]) } : {})
		.then((r) => console.log(`${relative(process.cwd(), r.out)}: ${r.modules} modules, ${(r.bytes / 1024).toFixed(0)} KB`))
		.catch((e) => { console.error(e.message); process.exit(1); });
}
