import assert from "node:assert/strict";
import test from "node:test";

const legacy = await import("../../../src/domain/alignment/topology/TrackNetworkTopology.js");
const canonical = await import("../../../src/aim-core/alignment/topology/TrackNetworkTopology.js");

test("legacy topology facade has the canonical named export set", () => {
	assert.deepEqual(Object.keys(legacy).sort(), Object.keys(canonical).sort());
});

test("every legacy topology export is reference-identical to the canonical export", () => {
	for (const name of Object.keys(canonical)) {
		assert.strictEqual(legacy[name], canonical[name], name);
	}
});

test("legacy topology path remains importable with shared Error-class identity", () => {
	assert.equal(typeof legacy.createTrackNetworkTopology, "function");
	assert.strictEqual(legacy.TrackNetworkTopologyError, canonical.TrackNetworkTopologyError);
	assert.throws(
		() => legacy.addTopologyNode(legacy.createTrackNetworkTopology({ id: "N" }), { nodeId: "" }),
		(error) => error instanceof canonical.TrackNetworkTopologyError && error.code === "INVALID_ID"
	);
});

test("legacy and canonical immutable topology construction and traversal are identical", () => {
	let topology = legacy.createTrackNetworkTopology({ id: "network-A" });
	topology = legacy.addTopologyNode(topology, { nodeId: "N1" });
	topology = canonical.addTopologyNode(topology, { nodeId: "N2" });
	topology = legacy.connectAlignmentEdge(topology, {
		edgeId: "E1",
		alignmentId: "alignment-A",
		fromNodeId: "N1",
		toNodeId: "N2",
		orientation: "reverse",
	});
	assert.equal(Object.isFrozen(topology), true);
	assert.deepEqual(
		legacy.getTraversableAlignmentEdges(topology, { nodeId: "N1", direction: "outgoing" }),
		canonical.getTraversableAlignmentEdges(topology, { nodeId: "N1", direction: "outgoing" })
	);
	assert.deepEqual(legacy.getIncidentAlignmentEdges(topology, { nodeId: "N2" }), topology.edges);
});

test("legacy facade and canonical module share one topology authority", () => {
	assert.strictEqual(legacy.createTrackNetworkTopology, canonical.createTrackNetworkTopology);
	assert.strictEqual(legacy.connectAlignmentEdge, canonical.connectAlignmentEdge);
	assert.strictEqual(legacy.isTrackNetworkTopology, canonical.isTrackNetworkTopology);
});
