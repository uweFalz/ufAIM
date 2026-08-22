import assert from "node:assert/strict";
import test from "node:test";

import {
	addTopologyNode,
	createTrackNetworkTopology,
} from "../../../src/aim-core/alignment/topology/TrackNetworkTopology.js";
import {
	InMemoryTrackNetworkTopologyRepositoryAdapter,
} from "../../../src/services/topology/InMemoryTrackNetworkTopologyRepositoryAdapter.js";
import {
	TrackNetworkTopologyRepositoryConflictError,
} from "../../../src/services/topology/TrackNetworkTopologyRepositoryPort.js";

test("stores defensive lossless records with monotonic explicit revisions", async () => {
	const repository = new InMemoryTrackNetworkTopologyRepositoryAdapter();
	const empty = createTrackNetworkTopology({ id: "network-A" });
	const created = await repository.saveById({
		topologyId: "network-A",
		topology: empty,
		expectedRevision: null,
	});
	const withNode = addTopologyNode(created.topology, { nodeId: "N1" });
	const updated = await repository.saveById({
		topologyId: "network-A",
		topology: withNode,
		expectedRevision: created.revision,
	});

	assert.equal(created.revision, 1);
	assert.equal(updated.revision, 2);
	assert.deepEqual(
		await repository.loadById({ topologyId: "network-A" }),
		updated
	);
	assert.notStrictEqual(
		(await repository.loadById({ topologyId: "network-A" })).topology,
		updated.topology
	);
});

test("exports and restores every topology member and revision", async () => {
	const extended = {
		...createTrackNetworkTopology({ id: "network-A" }),
		provenance: { source: "explicit-test" },
	};
	const first = new InMemoryTrackNetworkTopologyRepositoryAdapter();
	await first.saveById({
		topologyId: "network-A",
		topology: extended,
		expectedRevision: null,
	});
	const exported = first.exportRecords();
	const second = new InMemoryTrackNetworkTopologyRepositoryAdapter({
		records: exported,
	});

	assert.deepEqual(second.exportRecords(), exported);
	exported[0].topology.provenance.source = "changed outside";
	assert.equal(
		(await second.loadById({ topologyId: "network-A" }))
			.topology.provenance.source,
		"explicit-test"
	);
});

test("rejects create-overwrite and stale update without changing storage", async () => {
	const repository = new InMemoryTrackNetworkTopologyRepositoryAdapter();
	const topology = createTrackNetworkTopology({ id: "network-A" });
	const created = await repository.saveById({
		topologyId: "network-A",
		topology,
		expectedRevision: null,
	});

	for (const expectedRevision of [null, 99]) {
		await assert.rejects(
			() => repository.saveById({
				topologyId: "network-A",
				topology,
				expectedRevision,
			}),
			TrackNetworkTopologyRepositoryConflictError
		);
	}
	assert.deepEqual(
		await repository.loadById({ topologyId: "network-A" }),
		created
	);
});

test("does not create topology incidence from coordinate-like extensions", async () => {
	const repository = new InMemoryTrackNetworkTopologyRepositoryAdapter();
	const topology = {
		...createTrackNetworkTopology({ id: "network-A" }),
		nodes: [
			{ id: "N1", position: { x: 10, y: 20 } },
			{ id: "N2", position: { x: 10, y: 20 } },
		],
	};
	const saved = await repository.saveById({
		topologyId: "network-A",
		topology,
		expectedRevision: null,
	});

	assert.deepEqual(saved.topology.edges, []);
	assert.deepEqual(saved.topology.nodes, topology.nodes);
});
