// tools/axtran2/nodeAliases.mjs
//
// The production importers address each other by the aliases the browser's
// import map provides (app/bootstrap/loadImportMaps.js); Node needs the same
// map. Import this module first in any Node entry that reaches the parsers.
// The corpus loader (test/axtran2/corpus/loadTraAlignment.mjs) registers the
// same hook; registering twice is harmless, the first match resolves.

import { registerHooks } from "node:module";

const ROOT = new URL("../../", import.meta.url);

export const ALIASES = Object.freeze({
	"@src/": "src/", "@kimport/": "src/import/", "@spot/": "src/model/spot/",
	"@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/",
});

registerHooks({
	resolve(specifier, context, next) {
		for (const [prefix, target] of Object.entries(ALIASES)) {
			if (specifier.startsWith(prefix)) return next(new URL(target + specifier.slice(prefix.length), ROOT).href, context);
		}
		return next(specifier, context);
	},
});

/** a TRA file by path, as the reader in src sees it; the one place the adapter touches the file system for a TRA */
export async function readTraFile(file) {
	const { readFile } = await import("node:fs/promises");
	const { basename } = await import("node:path");
	const { traAlignmentFromBytes } = await import(new URL("src/import/parsers/technet/vermEsn/traAlignment.js", ROOT));
	const bytes = await readFile(file);
	return { bytes, loaded: await traAlignmentFromBytes(bytes, basename(String(file))) };
}
