import assert from "node:assert/strict";
import test from "node:test";

import {
	AIM_CORE_PUBLIC_API_GROUPS,
	AIM_CORE_PUBLIC_API_NAMES,
} from "../../../src/aim-core/public-api-manifest.js";

const ROOT_URL = new URL("../../../src/aim-core/index.js", import.meta.url);
const AREA_URLS = Object.freeze([
	new URL("../../../src/aim-core/alignment/profile/index.js", import.meta.url),
	new URL("../../../src/aim-core/alignment/topology/index.js", import.meta.url),
	new URL("../../../src/aim-core/alignment/authoring/index.js", import.meta.url),
	new URL("../../../src/aim-core/alignment/aggregate/index.js", import.meta.url),
	new URL("../../../src/aim-core/transition/index.js", import.meta.url),
	new URL("../../../src/aim-core/geometry/index.js", import.meta.url),
]);

test("public API manifest is deeply frozen grouped unique and exhaustive", () => {
	assert.equal(Object.isFrozen(AIM_CORE_PUBLIC_API_GROUPS), true);
	assert.equal(Object.isFrozen(AIM_CORE_PUBLIC_API_NAMES), true);
	for (const names of Object.values(AIM_CORE_PUBLIC_API_GROUPS)) {
		assert.equal(Object.isFrozen(names), true);
	}
	assert.equal(AIM_CORE_PUBLIC_API_NAMES.length, 141);
	assert.equal(new Set(AIM_CORE_PUBLIC_API_NAMES).size, 141);
	assert.deepEqual(
		[...Object.values(AIM_CORE_PUBLIC_API_GROUPS).flat()].sort(),
		AIM_CORE_PUBLIC_API_NAMES
	);
});

test("Root namespace is exactly the deliberate 141-export manifest", async () => {
	const root = await import(`${ROOT_URL.href}?root-freeze=${Date.now()}`);
	assert.deepEqual(Object.keys(root).sort(), AIM_CORE_PUBLIC_API_NAMES);
	assert.equal(Object.keys(root).length, 141);
	assert.equal("AIM_CORE_PUBLIC_API_GROUPS" in root, false);
	assert.equal("AIM_CORE_PUBLIC_API_NAMES" in root, false);
});

test("every contributing area export is present at Root by reference identity", async () => {
	const root = await import(ROOT_URL);
	const seen = new Set();
	for (const areaUrl of AREA_URLS) {
		const area = await import(areaUrl);
		for (const [name, value] of Object.entries(area)) {
			assert.equal(seen.has(name), false, `star-export collision: ${name}`);
			seen.add(name);
			assert.equal(name in root, true, `Root omission: ${name}`);
			assert.strictEqual(root[name], value, `Root identity: ${name}`);
		}
	}
	assert.deepEqual([...seen].sort(), AIM_CORE_PUBLIC_API_NAMES);
});

test("fresh area and Root imports preserve the same identities", async () => {
	const stamp = Date.now();
	const root = await import(`${ROOT_URL.href}?fresh=${stamp}`);
	for (const areaUrl of AREA_URLS) {
		const area = await import(`${areaUrl.href}?fresh=${stamp}`);
		for (const [name, value] of Object.entries(area)) {
			assert.strictEqual(root[name], value, name);
		}
	}
});
