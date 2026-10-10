// test/axtran2/corpus/loadTraAlignment.mjs
//
// The corpus's way to a TRA file: read it from disk and hand the bytes to
// the reader in src/import (traAlignment.js), with the Node alias hooks the
// production parsers need. The reader and the production geometry builder
// used to live here; they moved into src on 2026-10-12 and are re-exported
// so every corpus caller keeps its import.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { registerHooks } from "node:module";

const ROOT = new URL("../../../", import.meta.url);

// The importers address each other by the aliases the browser's import map
// provides; Node needs the same map.
const ALIASES = {
	"@src/": "src/", "@kimport/": "src/import/", "@spot/": "src/model/spot/",
	"@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/",
};
registerHooks({
	resolve(specifier, context, next) {
		for (const [prefix, target] of Object.entries(ALIASES)) {
			if (specifier.startsWith(prefix)) return next(new URL(target + specifier.slice(prefix.length), ROOT).href, context);
		}
		return next(specifier, context);
	},
});

const reader = await import(new URL("src/import/parsers/technet/vermEsn/traAlignment.js", ROOT));
export const { FAMILIES, kilometreJumpsOf, traAlignmentFromBytes, traAlignmentFromDocument } = reader;
export const { buildProductionAlignment } = await import(new URL("src/domain/optimization/alignment/ProductionAlignment.js", ROOT));

/**
 * @param {string|URL} file  a .TRA
 * @returns {Promise<object>} as traAlignmentFromBytes
 */
export async function loadTraAlignment(file) {
	const bytes = await readFile(file);
	const name = basename(typeof file === "string" ? file : file.pathname);
	return traAlignmentFromBytes(bytes, name);
}

/** every .TRA under a directory, sorted, as paths */
export async function listTraFiles(root) {
	const { readdir } = await import("node:fs/promises");
	const { join } = await import("node:path");
	const out = [];
	async function walk(dir) {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) await walk(path);
			else if (/\.tra$/i.test(entry.name)) out.push(path);
		}
	}
	await walk(root);
	return out.sort();
}

