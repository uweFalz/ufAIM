import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("station decoder profile catalogue uses browser-compatible Web Crypto only", () => {
	const source = fs.readFileSync(new URL("../src/import/evidence/gndStationDecoderProfileCatalogue.js", import.meta.url), "utf8");
	assert.doesNotMatch(source, /from\s+["']node:|require\s*\(/);
	assert.match(source, /globalThis\.crypto\?\.subtle\?\.digest/);
	assert.doesNotMatch(source, /signature/);
});
