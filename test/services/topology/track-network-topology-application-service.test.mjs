import assert from "node:assert/strict";
import test from "node:test";

import {
	TrackNetworkTopologyApplicationService,
} from "../../../src/services/topology/TrackNetworkTopologyApplicationService.js";
import {
	InMemoryTrackNetworkTopologyRepositoryAdapter,
} from "../../../src/services/topology/InMemoryTrackNetworkTopologyRepositoryAdapter.js";
import {
	TrackNetworkTopologyRepositoryConflictError,
} from "../../../src/services/topology/TrackNetworkTopologyRepositoryPort.js";

function setup() {
	const repository = new InMemoryTrackNetworkTopologyRepositoryAdapter();
	return {
		repository,
		service: new TrackNetworkTopologyApplicationService({ repository }),
	};
}

async function createNodes(service, ...nodeIds) {
	let record = await service.createTopology({ topologyId: "network-A" });
	for (const nodeId of nodeIds) {
		record = await service.addNode({
			topologyId: "network-A",
			nodeId,
			expectedRevision: record.revision,
		});
	}
	return record;
}

test("creates loads and reopens one explicit topology losslessly", async () => {
	const { repository, service } = setup();
	let record = await createNodes(service, "N1", "N2");
	record = await service.connectAlignment({
		topologyId: "network-A",
		edgeId: "E1",
		alignmentId: "alignment-A",
		fromNodeId: "N1",
		toNodeId: "N2",
		orientation: "reverse",
		expectedRevision: record.revision,
	});

	const reopenedService = new TrackNetworkTopologyApplicationService({
		repository: new InMemoryTrackNetworkTopologyRepositoryAdapter({
			records: repository.exportRecords(),
		}),
	});
	const reopened = await reopenedService.loadTopology({
		topologyId: "network-A",
	});

	assert.deepEqual(reopened, record);
	assert.equal(reopened.revision, 4);
	assert.deepEqual(reopened.topology.edges, [{
		id: "E1",
		alignmentId: "alignment-A",
		fromNodeId: "N1",
		toNodeId: "N2",
		orientation: "reverse",
	}]);
});

test("exposes directed traversal without loading or comparing geometry", async () => {
	const { service } = setup();
	let record = await createNodes(service, "N1", "N2", "N3");
	record = await service.connectAlignment({
		topologyId: "network-A",
		edgeId: "E-in",
		alignmentId: "alignment-in",
		fromNodeId: "N2",
		toNodeId: "N1",
		expectedRevision: record.revision,
	});
	record = await service.connectAlignment({
		topologyId: "network-A",
		edgeId: "E-out",
		alignmentId: "alignment-out",
		fromNodeId: "N1",
		toNodeId: "N3",
		expectedRevision: record.revision,
	});

	const outgoing = await service.getTraversableEdges({
		topologyId: "network-A",
		nodeId: "N1",
	});
	const incoming = await service.getTraversableEdges({
		topologyId: "network-A",
		nodeId: "N1",
		direction: "incoming",
	});

	assert.deepEqual(outgoing.edges.map((edge) => edge.edgeId), ["E-out"]);
	assert.deepEqual(incoming.edges.map((edge) => edge.edgeId), ["E-in"]);
	assert.equal(outgoing.revision, record.revision);
});

test("supports explicit edge and isolated-node removal", async () => {
	const { service } = setup();
	let record = await createNodes(service, "N1", "N2", "N3");
	record = await service.connectAlignment({
		topologyId: "network-A",
		edgeId: "E1",
		alignmentId: "alignment-A",
		fromNodeId: "N1",
		toNodeId: "N2",
		expectedRevision: record.revision,
	});
	record = await service.removeEdge({
		topologyId: "network-A",
		edgeId: "E1",
		expectedRevision: record.revision,
	});
	record = await service.removeNode({
		topologyId: "network-A",
		nodeId: "N3",
		expectedRevision: record.revision,
	});

	assert.deepEqual(record.topology.edges, []);
	assert.deepEqual(record.topology.nodes, [{ id: "N1" }, { id: "N2" }]);
});

test("rejects a stale service mutation and preserves the current record", async () => {
	const { service } = setup();
	const created = await service.createTopology({ topologyId: "network-A" });
	const current = await service.addNode({
		topologyId: "network-A",
		nodeId: "N1",
		expectedRevision: created.revision,
	});

	await assert.rejects(
		() => service.addNode({
			topologyId: "network-A",
			nodeId: "N2",
			expectedRevision: created.revision,
		}),
		(error) => {
			assert.equal(
				error instanceof TrackNetworkTopologyRepositoryConflictError,
				true
			);
			assert.equal(error.code, "TOPOLOGY_REVISION_CONFLICT");
			assert.equal(error.actualRevision, current.revision);
			return true;
		}
	);
	assert.deepEqual(
		await service.loadTopology({ topologyId: "network-A" }),
		current
	);
});
