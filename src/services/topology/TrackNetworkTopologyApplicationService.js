import {
	addTopologyNode,
	assertTrackNetworkTopology,
	connectAlignmentEdge,
	createTrackNetworkTopology,
	getIncidentAlignmentEdges,
	getTraversableAlignmentEdges,
	removeAlignmentEdge,
	removeTopologyNode,
} from "../../aim-core/alignment/topology/TrackNetworkTopology.js";

import {
	assertTrackNetworkTopologyRepositoryPort,
	TrackNetworkTopologyRepositoryConflictError,
} from "./TrackNetworkTopologyRepositoryPort.js";

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) throw new TypeError(`${label} must be a non-empty string`);
	return id;
}

function requireRevision(value) {
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new TypeError("expectedRevision must be a positive safe integer");
	}
	return value;
}

function requireLoaded(record, topologyId) {
	if (!record) {
		throw new Error(`TrackNetworkTopology ${topologyId} was not found`);
	}
	assertTrackNetworkTopology(record.topology, "repository topology");
	requireRevision(record.revision);
	return record;
}

export class TrackNetworkTopologyApplicationService {
	constructor({ repository } = {}) {
		this.repository = assertTrackNetworkTopologyRepositoryPort(repository);
	}

	async createTopology({ topologyId } = {}) {
		const id = requireId(topologyId, "topologyId");
		const topology = createTrackNetworkTopology({ id });
		return this.repository.saveById({
			topologyId: id,
			topology,
			expectedRevision: null,
		});
	}

	async loadTopology({ topologyId } = {}) {
		const id = requireId(topologyId, "topologyId");
		return requireLoaded(
			await this.repository.loadById({ topologyId: id }),
			id
		);
	}

	async addNode({ topologyId, nodeId, expectedRevision } = {}) {
		return this.#change(
			topologyId,
			expectedRevision,
			(topology) => addTopologyNode(topology, { nodeId })
		);
	}

	async connectAlignment({
		topologyId,
		edgeId,
		alignmentId,
		fromNodeId,
		toNodeId,
		orientation = "forward",
		expectedRevision,
	} = {}) {
		return this.#change(
			topologyId,
			expectedRevision,
			(topology) => connectAlignmentEdge(topology, {
				edgeId,
				alignmentId,
				fromNodeId,
				toNodeId,
				orientation,
			})
		);
	}

	async removeEdge({ topologyId, edgeId, expectedRevision } = {}) {
		return this.#change(
			topologyId,
			expectedRevision,
			(topology) => removeAlignmentEdge(topology, { edgeId })
		);
	}

	async removeNode({ topologyId, nodeId, expectedRevision } = {}) {
		return this.#change(
			topologyId,
			expectedRevision,
			(topology) => removeTopologyNode(topology, { nodeId })
		);
	}

	async getIncidentEdges({ topologyId, nodeId } = {}) {
		const record = await this.loadTopology({ topologyId });
		return {
			topologyId: record.topology.id,
			revision: record.revision,
			edges: getIncidentAlignmentEdges(record.topology, { nodeId }),
		};
	}

	async getTraversableEdges({
		topologyId,
		nodeId,
		direction = "outgoing",
	} = {}) {
		const record = await this.loadTopology({ topologyId });
		return {
			topologyId: record.topology.id,
			revision: record.revision,
			edges: getTraversableAlignmentEdges(record.topology, {
				nodeId,
				direction,
			}),
		};
	}

	async #change(topologyId, expectedRevision, change) {
		const id = requireId(topologyId, "topologyId");
		const revision = requireRevision(expectedRevision);
		const current = requireLoaded(
			await this.repository.loadById({ topologyId: id }),
			id
		);
		if (current.revision !== revision) {
			throw new TrackNetworkTopologyRepositoryConflictError({
				topologyId: id,
				expectedRevision: revision,
				actualRevision: current.revision,
			});
		}
		const topology = change(current.topology);
		assertTrackNetworkTopology(topology);
		return this.repository.saveById({
			topologyId: id,
			topology,
			expectedRevision: revision,
		});
	}
}
