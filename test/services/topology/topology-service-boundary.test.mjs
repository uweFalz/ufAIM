import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const SERVICE_URL = new URL(
	"../../../src/services/topology/TrackNetworkTopologyApplicationService.js",
	import.meta.url
);
const PORT_URL = new URL(
	"../../../src/services/topology/TrackNetworkTopologyRepositoryPort.js",
	import.meta.url
);
const ADAPTER_URL = new URL(
	"../../../src/services/topology/InMemoryTrackNetworkTopologyRepositoryAdapter.js",
	import.meta.url
);

function specifiers(source) {
	return [...source.matchAll(
		/(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g
	)].map((match) => match[1]).sort();
}

test("service depends only on Topology Core and its local repository port", async () => {
	const source = await readFile(SERVICE_URL, "utf8");
	assert.deepEqual(specifiers(source), [
		"../../aim-core/alignment/topology/TrackNetworkTopology.js",
		"./TrackNetworkTopologyRepositoryPort.js",
	]);
});

test("repository port has zero dependencies and adapter stays in its boundary", async () => {
	const portSource = await readFile(PORT_URL, "utf8");
	const adapterSource = await readFile(ADAPTER_URL, "utf8");
	assert.deepEqual(specifiers(portSource), []);
	assert.deepEqual(specifiers(adapterSource), [
		"../../aim-core/alignment/topology/TrackNetworkTopology.js",
		"./TrackNetworkTopologyRepositoryPort.js",
	]);
});

test("Topology service surface contains no forbidden coupling or inference", async () => {
	for (const url of [SERVICE_URL, PORT_URL, ADAPTER_URL]) {
		const source = await readFile(url, "utf8");
		for (const forbidden of [
			"app/",
			"src/import",
			"GND",
			"MapLibre",
			"THREE",
			"Worker",
			"Messaging",
			"localStorage",
			"indexedDB",
			"position.x",
			"position.y",
			"distance",
			"coincident",
		]) {
			assert.equal(source.includes(forbidden), false, `${url}: ${forbidden}`);
		}
	}
});

test("all three modules import in a fresh browser-independent Node process", async () => {
	for (const url of [SERVICE_URL, PORT_URL, ADAPTER_URL]) {
		const module = await import(`${url.href}?fresh=${Date.now()}`);
		assert.equal(Object.keys(module).length > 0, true);
	}
});
