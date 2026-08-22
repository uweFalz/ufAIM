import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../", import.meta.url);
const FILES = [
	"app/controllers/topology/createTopologyWorkspaceController.js",
	"app/controllers/topology/wireTopologyWorkspaceView.js",
	"app/view/topology/TopologyWorkspaceView.js",
];

async function source(path) {
	return readFile(new URL(path, ROOT), "utf8");
}

test("Topology workspace owns no persistence, Core, or mutation dependency", async () => {
	for (const path of FILES) {
		const text = await source(path);
		assert.doesNotMatch(
			text,
			/from\s+["'][^"']*(?:aim-core|IndexedDb|SpotGateway|Repository|AlignmentApplicationService|saveProfileState|AlignmentEdit|transition|axtran|profile|import)[^"']*["']/i,
			path
		);
		assert.doesNotMatch(
			text,
			/sendCmdAwait\s*\(\s*["']Spot\.(?:Add|Remove|Rename)/,
			path
		);
	}
});

test("runtime uses only committed Topology service and in-memory repository", async () => {
	const text = await source("app/runtime/init/initFeatures.js");
	assert.match(
		text,
		/import \{ TrackNetworkTopologyApplicationService \} from "@src\/services\/topology\/TrackNetworkTopologyApplicationService\.js"/
	);
	assert.match(
		text,
		/import \{ InMemoryTrackNetworkTopologyRepositoryAdapter \} from "@src\/services\/topology\/InMemoryTrackNetworkTopologyRepositoryAdapter\.js"/
	);
	assert.match(
		text,
		/new InMemoryTrackNetworkTopologyRepositoryAdapter\(\)/
	);
	assert.doesNotMatch(
		text,
		/topology[\s\S]{0,120}(?:IndexedDb|saveById|Spot\.AddObjects)/i
	);
});

test("visible contract labels the state as non-persisted and exposes explicit inputs", async () => {
	const text = await source(
		"app/view/topology/TopologyWorkspaceView.js"
	);
	assert.match(text, /SESSION-ONLY \/ NICHT PERSISTIERT/);
	for (const field of [
		"topologyId",
		"nodeId",
		"fromNodeId",
		"toNodeId",
		"edgeId",
		"orientation",
	]) {
		assert.match(text, new RegExp(`["']${field}["']`));
	}
	assert.match(text, /Connect active Alignment/);
});
