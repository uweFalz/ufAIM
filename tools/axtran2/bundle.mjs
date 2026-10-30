#!/usr/bin/env node
// tools/axtran2/bundle.mjs
//
// The single-file AXTRAN2: axtran2/index.html, app.js, worker.js and every
// module they reach under src/ folded into one HTML file that runs from a
// double-click, file:// included. No bundler is installed in this
// repository and none is wanted as a dependency, so this is the smallest
// one that carries the code as it is written:
//
//   - the module graph is walked from app.js and worker.js over static
//     imports (the closure has no dynamic import and no top-level await,
//     and the bundle refuses both);
//   - each module becomes a function in a registry, its ESM import and
//     export statements rewritten to the registry's require; a JSON module
//     is its parsed value under `default`;
//   - the worker is a classic worker built from a Blob of the same
//     registry with worker.js as its entry, so the fit still runs off the
//     page; the page's app.js uses that Blob when the bundle offers it.
//
// Modules are evaluated in dependency order; a cycle is refused, because
// the registry has no live bindings. Output: dist/axtran2.html.
//
//   node tools/axtran2/bundle.mjs [--out dist/axtran2.html]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const IMPORT_RE = /^[ \t]*import\s+(?:(\{[^}]*\})|(\*\s+as\s+[A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*))?(?:\s*,\s*(?:(\{[^}]*\})|(\*\s+as\s+[A-Za-z_$][\w$]*)))?\s*from\s*["']([^"']+)["'](?:\s*with\s*\{[^}]*\})?\s*;?[ \t]*$/gm;
const SIDE_IMPORT_RE = /^[ \t]*import\s*["']([^"']+)["']\s*;?[ \t]*$/gm;
const EXPORT_FROM_RE = /^[ \t]*export\s+(?:(\*)|(\{[^}]*\}))\s*from\s*["']([^"']+)["']\s*;?[ \t]*$/gm;
const EXPORT_LIST_RE = /^[ \t]*export\s*(\{[^}]*\})\s*;?[ \t]*$/gm;
const EXPORT_DECL_RE = /^([ \t]*)export\s+(?:\/\*[^*]*\*\/\s*)?(const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_DEFAULT_RE = /^([ \t]*)export\s+default\s+/gm;

function names(list) {
	return list.replace(/[{}]/g, "").split(",").map((s) => s.trim()).filter(Boolean).map((entry) => {
		const [left, right] = entry.split(/\s+as\s+/).map((s) => s.trim());
		return { from: left, to: right ?? left };
	});
}

const ids = new Map();
const idOf = (file) => { const key = relative(ROOT, file).split("\\").join("/"); return key; };

/** one module: its source rewritten to the registry, and the files it depends on */
async function transform(file) {
	const source = await readFile(file, "utf8");
	if (file.endsWith(".json")) return { deps: [], body: `exports.default = ${source.trim()};` };
	if (/^\s*(?:const|let|var)?\s*[^\n]*\bawait\b[^\n]*$/m.test(source.replace(/\/\/.*$/gm, "")) && /^[^\n]*\bawait\s+import\(/m.test(source)) throw new Error(`${idOf(file)}: top-level await import cannot be bundled`);
	if (/\bimport\s*\(/.test(source.replace(/\/\/.*$/gm, ""))) throw new Error(`${idOf(file)}: dynamic import cannot be bundled`);
	if (/import\.meta/.test(source)) throw new Error(`${idOf(file)}: import.meta cannot be bundled`);
	const deps = [];
	const dep = (spec) => { const target = resolve(dirname(file), spec); deps.push(target); return JSON.stringify(idOf(target)); };
	const tail = [];
	let body = source
		.replace(IMPORT_RE, (_, named, star, def, named2, star2, spec) => {
			const key = dep(spec);
			const parts = [];
			if (def) parts.push(`const ${def} = __require(${key}).default;`);
			for (const n of [named, named2]) if (n) parts.push(`const { ${names(n).map((e) => (e.from === e.to ? e.from : `${e.from}: ${e.to}`)).join(", ")} } = __require(${key});`);
			for (const s of [star, star2]) if (s) parts.push(`const ${s.replace(/\*\s+as\s+/, "")} = __require(${key});`);
			return parts.join(" ");
		})
		.replace(SIDE_IMPORT_RE, (_, spec) => `__require(${dep(spec)});`)
		.replace(EXPORT_FROM_RE, (_, star, list, spec) => {
			const key = dep(spec);
			if (star) return `Object.assign(exports, __require(${key}));`;
			return names(list).map((e) => `exports.${e.to} = __require(${key}).${e.from};`).join(" ");
		})
		.replace(EXPORT_LIST_RE, (_, list) => { for (const e of names(list)) tail.push(`exports.${e.to} = ${e.from};`); return ""; })
		.replace(EXPORT_DECL_RE, (_, indent, kind, name) => { tail.push(`exports.${name} = ${name};`); return `${indent}${kind} ${name}`; })
		.replace(EXPORT_DEFAULT_RE, (_, indent) => `${indent}exports.default = `);
	if (/^[ \t]*(?:import|export)\b/m.test(body)) {
		const line = body.split("\n").find((l) => /^[ \t]*(?:import|export)\b/.test(l));
		throw new Error(`${idOf(file)}: an import or export the bundle does not understand: ${line.trim()}`);
	}
	return { deps, body: body + "\n" + tail.join("\n") };
}

/** every module reachable from the entries, in dependency order; a cycle is refused */
async function graph(entries) {
	const modules = new Map();
	const order = [];
	const visiting = new Set();
	async function visit(file, chain) {
		if (modules.has(file)) return;
		if (visiting.has(file)) throw new Error(`cycle: ${[...chain, file].map(idOf).join(" -> ")}`);
		visiting.add(file);
		const module = await transform(file);
		for (const d of module.deps) await visit(d, [...chain, file]);
		visiting.delete(file);
		modules.set(file, module);
		order.push(file);
	}
	for (const entry of entries) await visit(entry, []);
	return { modules, order };
}

function registry(modules, order) {
	const lines = ["const __modules = Object.create(null); const __cache = Object.create(null);",
		"function __require(id) { if (__cache[id]) return __cache[id]; const factory = __modules[id]; if (!factory) throw new Error('bundle: no module ' + id); const exports = {}; __cache[id] = exports; factory(exports, __require); return exports; }"];
	for (const file of order) {
		lines.push(`__modules[${JSON.stringify(idOf(file))}] = function (exports, __require) {\n${modules.get(file).body}\n};`);
	}
	return lines.join("\n");
}

const escapeForHtml = (js) => js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

export async function bundle({ out = join(ROOT, "dist/axtran2.html") } = {}) {
	const appEntry = join(ROOT, "axtran2/app.js");
	const workerEntry = join(ROOT, "axtran2/worker.js");
	const page = await readFile(join(ROOT, "axtran2/index.html"), "utf8");
	const worker = await graph([workerEntry]);
	const app = await graph([appEntry, workerEntry]);
	const workerScript = `${registry(worker.modules, worker.order)}\n__require(${JSON.stringify(idOf(workerEntry))});`;
	const appScript = `${registry(app.modules, app.order)}\nwindow.__AXTRAN2_WORKER_SOURCE = ${JSON.stringify(workerScript)};\n__require(${JSON.stringify(idOf(appEntry))});`;
	const html = page
		.replace('<script type="module" src="./app.js"></script>', `<script>\n${escapeForHtml(appScript)}\n</script>`)
		.replace("<title>AXTRAN2</title>", "<title>AXTRAN2</title>\n<!-- single-file build of axtran2/ on the alignment-os package; tools/axtran2/bundle.mjs -->");
	if (!html.includes("__AXTRAN2_WORKER_SOURCE")) throw new Error("the page's script tag was not found");
	await mkdir(dirname(out), { recursive: true });
	await writeFile(out, html);
	return Object.freeze({ out, modules: app.order.length, workerModules: worker.order.length, bytes: Buffer.byteLength(html) });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	const outArg = process.argv.indexOf("--out");
	bundle(outArg > 0 ? { out: resolve(process.argv[outArg + 1]) } : {})
		.then((r) => console.log(`${relative(process.cwd(), r.out)}: ${r.modules} modules (${r.workerModules} in the worker), ${(r.bytes / 1024).toFixed(0)} KB`))
		.catch((e) => { console.error(e.message); process.exit(1); });
}
