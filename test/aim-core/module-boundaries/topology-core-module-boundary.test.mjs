import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const IMPLEMENTATION_URL = new URL(
	"src/aim-core/alignment/topology/TrackNetworkTopology.js",
	REPOSITORY_ROOT
);
const TOPOLOGY_API = [
	"TRACK_NETWORK_TOPOLOGY_VERSION",
	"TrackNetworkTopologyError",
	"addTopologyNode",
	"assertTrackNetworkTopology",
	"connectAlignmentEdge",
	"createTrackNetworkTopology",
	"getIncidentAlignmentEdges",
	"getTraversableAlignmentEdges",
	"isTrackNetworkTopology",
	"removeAlignmentEdge",
	"removeTopologyNode",
].sort();

function importSpecifiers(source) {
	return [...source.matchAll(/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g)]
		.map((match) => match[1]);
}

test("canonical topology implementation has zero imports", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.deepEqual(importSpecifiers(source), []);
});

test("canonical topology source has no forbidden dependency vocabulary", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	for (const forbidden of [
		"app/", "src/services/", "src/import/", "src/shared/", "src/model/spot/",
		"domain/alignment/topology", "window", "document", "Worker", "Messaging",
		"storage", "persistence", "GND", "IFC", "geometry", "projection", "CRS",
		"MapLibre", "THREE", "AXTRAN", "transitionDB", "speed", "profile", "UI", "node:",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});

test("canonical topology never imports the legacy facade", async () => {
	const source = await readFile(IMPLEMENTATION_URL, "utf8");
	assert.doesNotMatch(source, /src\/domain\/alignment\/topology|domain\/alignment\/topology/);
});

test("topology barrel and root Core barrel expose the complete topology API", async () => {
	const topology = await import("../../../src/aim-core/alignment/topology/index.js");
	const root = await import("../../../src/aim-core/index.js");
	assert.deepEqual(Object.keys(topology).sort(), TOPOLOGY_API);
	for (const name of TOPOLOGY_API) {
		assert.strictEqual(root[name], topology[name], name);
	}
});

test("fresh Core-barrel import retains Profile API and adds topology without replacement", () => {
	const rootUrl = new URL("src/aim-core/index.js", REPOSITORY_ROOT).href;
	const profileUrl = new URL("src/aim-core/alignment/profile/index.js", REPOSITORY_ROOT).href;
	const topologyUrl = new URL("src/aim-core/alignment/topology/index.js", REPOSITORY_ROOT).href;
	const script = `
		import * as root from ${JSON.stringify(rootUrl)};
		import * as profile from ${JSON.stringify(profileUrl)};
		import * as topology from ${JSON.stringify(topologyUrl)};
		const profileIdentity = Object.keys(profile).every((name) => root[name] === profile[name]);
		const topologyIdentity = Object.keys(topology).every((name) => root[name] === topology[name]);
		process.stdout.write(JSON.stringify({
			root: Object.keys(root).sort(),
			profile: Object.keys(profile).sort(),
			topology: Object.keys(topology).sort(),
			profileIdentity,
			topologyIdentity,
		}));
	`;
	const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
		cwd: REPOSITORY_ROOT,
		encoding: "utf8",
	}));
	assert.equal(result.profileIdentity, true);
	assert.equal(result.topologyIdentity, true);
	assert.deepEqual(result.topology, TOPOLOGY_API);
	for (const name of [...result.profile, ...result.topology]) {
		assert.equal(result.root.includes(name), true, name);
	}
});
