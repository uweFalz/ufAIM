import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("no production path imports or persists the unreviewed GND chainage candidate service", () => {
	const root = new URL("../../../", import.meta.url).pathname;
	const files = walk(root, ["app", "src"]).filter((file) => file.endsWith(".js") && !file.endsWith("GndStationFrameChainageCandidateService.js"));
	const consumers = files.filter((file) => fs.readFileSync(file, "utf8").includes("GndStationFrameChainageCandidateService"));
	assert.deepEqual(consumers, []);
});

function walk(root, names) {
	const result = [];
	for (const name of names) visit(path.join(root, name), result);
	return result;
}
function visit(target, result) {
	for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
		const file = path.join(target, entry.name);
		if (entry.isDirectory()) visit(file, result); else result.push(file);
	}
}
