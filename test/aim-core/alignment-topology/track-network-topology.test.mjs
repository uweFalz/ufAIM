import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const moduleUrl = new URL(
	"../../../src/aim-core/alignment/topology/TrackNetworkTopology.js",
	import.meta.url
);
const {
	TRACK_NETWORK_TOPOLOGY_VERSION,
	TrackNetworkTopologyError,
	isTrackNetworkTopology,
	createTrackNetworkTopology,
	addTopologyNode,
	connectAlignmentEdge,
	removeAlignmentEdge,
	removeTopologyNode,
	getIncidentAlignmentEdges,
	getTraversableAlignmentEdges,
} = await import(moduleUrl);

function expectCode(code, operation) {
	assert.throws(operation, (error) => {
		assert.equal(error instanceof TrackNetworkTopologyError, true);
		assert.equal(error.code, code);
		return true;
	});
}

function makeNodes(...ids) {
	let topology = createTrackNetworkTopology({ id: "network-A" });
	for (const nodeId of ids) {
		topology = addTopologyNode(topology, { nodeId });
	}
	return topology;
}

function connect(
	topology,
	edgeId,
	alignmentId,
	fromNodeId,
	toNodeId,
	orientation = "forward"
) {
	return connectAlignmentEdge(topology, {
		edgeId,
		alignmentId,
		fromNodeId,
		toNodeId,
		orientation,
	});
}

test("creates an empty valid topology with stable identity", () => {
	const topology = createTrackNetworkTopology({ id: "network-A" });
	assert.equal(topology.contractVersion, TRACK_NETWORK_TOPOLOGY_VERSION);
	assert.equal(topology.type, "TrackNetworkTopology");
	assert.equal(topology.id, "network-A");
	assert.deepEqual(topology.nodes, []);
	assert.deepEqual(topology.edges, []);
	assert.equal(isTrackNetworkTopology(topology), true);
	assert.equal(Object.isFrozen(topology), true);
	assert.equal(Object.isFrozen(topology.nodes), true);
	assert.equal(Object.isFrozen(topology.edges), true);
});

test("adds nodes immutably and preserves unknown members", () => {
	const base = {
		...createTrackNetworkTopology({ id: "network-A" }),
		extension: { zero: 0, false: false },
	};
	const before = structuredClone(base);
	const added = addTopologyNode(base, { nodeId: "N1" });
	assert.deepEqual(base, before);
	assert.notEqual(added, base);
	assert.notEqual(added.nodes, base.nodes);
	assert.equal(added.edges, base.edges);
	assert.equal(added.extension, base.extension);
	assert.deepEqual(added.nodes, [{ id: "N1" }]);
	assert.equal(Object.isFrozen(added.nodes[0]), true);
});

test("rejects duplicate node identity without mutation", () => {
	const topology = makeNodes("N1");
	const before = structuredClone(topology);
	expectCode("NODE_ALREADY_EXISTS", () =>
		addTopologyNode(topology, { nodeId: "N1" })
	);
	assert.deepEqual(topology, before);
});

test("connects one Alignment by explicit edge and endpoint identities", () => {
	const topology = makeNodes("N1", "N2");
	const connected = connect(topology, "E1", "alignment-A", "N1", "N2");
	assert.deepEqual(connected.edges, [
		{
			id: "E1",
			alignmentId: "alignment-A",
			fromNodeId: "N1",
			toNodeId: "N2",
			orientation: "forward",
		},
	]);
	assert.equal(connected.nodes, topology.nodes);
	assert.equal(topology.edges.length, 0);
	assert.equal(Object.isFrozen(connected.edges[0]), true);
});

test("supports multiple Alignments sharing one explicit node", () => {
	let topology = makeNodes("N1", "N2", "N3");
	topology = connect(topology, "E1", "alignment-A", "N1", "N2");
	topology = connect(topology, "E2", "alignment-B", "N1", "N3");
	assert.deepEqual(
		getIncidentAlignmentEdges(topology, { nodeId: "N1" }).map(
			(edge) => edge.id
		),
		["E1", "E2"]
	);
});

test("preserves explicit reverse orientation", () => {
	const topology = connect(
		makeNodes("N1", "N2"),
		"E1",
		"alignment-A",
		"N1",
		"N2",
		"reverse"
	);
	assert.equal(topology.edges[0].orientation, "reverse");
});

test("permits an explicitly declared self-loop", () => {
	const topology = connect(
		makeNodes("N1"),
		"E1",
		"alignment-A",
		"N1",
		"N1"
	);
	assert.equal(isTrackNetworkTopology(topology), true);
	assert.equal(
		getIncidentAlignmentEdges(topology, { nodeId: "N1" }).length,
		1
	);
});

test("rejects missing endpoint nodes", () => {
	const topology = makeNodes("N1");
	const before = structuredClone(topology);
	expectCode("NODE_NOT_FOUND", () =>
		connect(topology, "E1", "alignment-A", "N1", "missing")
	);
	assert.deepEqual(topology, before);
});

test("rejects duplicate edge identity", () => {
	let topology = makeNodes("N1", "N2", "N3");
	topology = connect(topology, "E1", "alignment-A", "N1", "N2");
	const before = structuredClone(topology);
	expectCode("EDGE_ALREADY_EXISTS", () =>
		connect(topology, "E1", "alignment-B", "N2", "N3")
	);
	assert.deepEqual(topology, before);
});

test("rejects duplicate Alignment incidence", () => {
	let topology = makeNodes("N1", "N2", "N3");
	topology = connect(topology, "E1", "alignment-A", "N1", "N2");
	const before = structuredClone(topology);
	expectCode("ALIGNMENT_ALREADY_CONNECTED", () =>
		connect(topology, "E2", "alignment-A", "N2", "N3")
	);
	assert.deepEqual(topology, before);
});

test("geometrically coincident extension data creates no incidence", () => {
	let topology = createTrackNetworkTopology({ id: "network-A" });
	topology = addTopologyNode(topology, { nodeId: "N1" });
	topology = addTopologyNode(topology, { nodeId: "N2" });
	const extended = {
		...topology,
		nodes: [
			{ ...topology.nodes[0], position: { x: 10, y: 20 } },
			{ ...topology.nodes[1], position: { x: 10, y: 20 } },
		],
	};
	assert.equal(isTrackNetworkTopology(extended), true);
	assert.deepEqual(
		getIncidentAlignmentEdges(extended, { nodeId: "N1" }),
		[]
	);
	assert.deepEqual(
		getIncidentAlignmentEdges(extended, { nodeId: "N2" }),
		[]
	);
});

test("geometrically distinct extension data does not prevent explicit incidence", () => {
	let topology = createTrackNetworkTopology({ id: "network-A" });
	topology = addTopologyNode(topology, { nodeId: "N1" });
	topology = addTopologyNode(topology, { nodeId: "N2" });
	topology = {
		...topology,
		nodes: [
			{ ...topology.nodes[0], position: { x: 0, y: 0 } },
			{ ...topology.nodes[1], position: { x: 999, y: -500 } },
		],
	};
	topology = connect(topology, "E1", "alignment-A", "N1", "N2");
	assert.equal(
		getIncidentAlignmentEdges(topology, { nodeId: "N1" }).length,
		1
	);
});

test("returns incident edges in serialization order", () => {
	let topology = makeNodes("N1", "N2", "N3", "N4");
	topology = connect(topology, "E2", "alignment-B", "N3", "N1");
	topology = connect(topology, "E1", "alignment-A", "N1", "N2");
	topology = connect(topology, "E3", "alignment-C", "N4", "N1");
	assert.deepEqual(
		getIncidentAlignmentEdges(topology, { nodeId: "N1" }).map(
			(edge) => edge.id
		),
		["E2", "E1", "E3"]
	);
});

test("returns incoming outgoing and both traversals without loading geometry", () => {
	let topology = makeNodes("N1", "N2", "N3");
	topology = connect(topology, "E-in", "alignment-in", "N2", "N1");
	topology = connect(
		topology,
		"E-out",
		"alignment-out",
		"N1",
		"N3",
		"reverse"
	);
	const incoming = getTraversableAlignmentEdges(topology, {
		nodeId: "N1",
		direction: "incoming",
	});
	const outgoing = getTraversableAlignmentEdges(topology, {
		nodeId: "N1",
	});
	const both = getTraversableAlignmentEdges(topology, {
		nodeId: "N1",
		direction: "both",
	});
	assert.deepEqual(incoming.map((edge) => edge.edgeId), ["E-in"]);
	assert.deepEqual(outgoing.map((edge) => edge.edgeId), ["E-out"]);
	assert.deepEqual(both.map((edge) => edge.edgeId), ["E-in", "E-out"]);
	assert.deepEqual(Object.keys(outgoing[0]), [
		"edgeId",
		"alignmentId",
		"fromNodeId",
		"toNodeId",
		"orientation",
	]);
});

test("removes an edge immutably", () => {
	const topology = connect(
		makeNodes("N1", "N2"),
		"E1",
		"alignment-A",
		"N1",
		"N2"
	);
	const before = structuredClone(topology);
	const removed = removeAlignmentEdge(topology, { edgeId: "E1" });
	assert.deepEqual(topology, before);
	assert.deepEqual(removed.edges, []);
	assert.equal(removed.nodes, topology.nodes);
});

test("rejects removal of a node with incident edges and never cascades", () => {
	const topology = connect(
		makeNodes("N1", "N2"),
		"E1",
		"alignment-A",
		"N1",
		"N2"
	);
	const before = structuredClone(topology);
	expectCode("NODE_HAS_INCIDENT_EDGES", () =>
		removeTopologyNode(topology, { nodeId: "N1" })
	);
	assert.deepEqual(topology, before);
	assert.equal(topology.edges.length, 1);
});

test("removes an isolated node immutably", () => {
	const topology = makeNodes("N1", "N2");
	const before = structuredClone(topology);
	const removed = removeTopologyNode(topology, { nodeId: "N2" });
	assert.deepEqual(topology, before);
	assert.deepEqual(removed.nodes, [{ id: "N1" }]);
	assert.equal(removed.edges, topology.edges);
});

test("module has no browser App SPOT GND selection persistence geometry or UI dependency", async () => {
	const source = await readFile(moduleUrl, "utf8");
	assert.equal(
		/^\s*import\s/m.test(source),
		false,
		"topology module must have zero imports"
	);
	for (const forbidden of [
		"app/",
		"window",
		"document",
		"Worker",
		"Messaging",
		"SPOT",
		"GND",
		"MDB",
		"XLSX",
		"LandXML",
		"workspaceSelection",
		"persistence",
		"MapLibre",
		"buildSparse",
		"projection",
		"coordinate",
		"tolerance",
		"CRS",
		"AXTRAN",
		"transitionDB",
	]) {
		assert.equal(
			source.includes(forbidden),
			false,
			`forbidden dependency: ${forbidden}`
		);
	}
});
