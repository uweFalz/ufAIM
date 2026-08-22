export const TRACK_NETWORK_TOPOLOGY_VERSION =
	"aim-core/track-network-topology/0.1";

export class TrackNetworkTopologyError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "TrackNetworkTopologyError";
		this.code = code;
	}
}

function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizedId(value) {
	return typeof value === "string" ? value.trim() : "";
}

function fail(code, message) {
	throw new TrackNetworkTopologyError(code, message);
}

function requireId(value, label) {
	const id = normalizedId(value);
	if (!id) fail("INVALID_ID", `${label} must be a non-empty string`);
	return id;
}

function requireTopology(topology) {
	if (!isTrackNetworkTopology(topology)) {
		fail("INVALID_TOPOLOGY", "invalid TrackNetworkTopology");
	}
	return topology;
}

function freezeRecord(record) {
	return Object.isFrozen(record)
		? record
		: Object.freeze({ ...record });
}

function frozenRecords(records) {
	if (
		Object.isFrozen(records) &&
		records.every((record) => Object.isFrozen(record))
	) {
		return records;
	}
	return Object.freeze(records.map(freezeRecord));
}

function freezeTopology(topology, { nodes, edges } = {}) {
	const nextNodes = nodes
		? Object.freeze(nodes.map(freezeRecord))
		: frozenRecords(topology.nodes);
	const nextEdges = edges
		? Object.freeze(edges.map(freezeRecord))
		: frozenRecords(topology.edges);
	return Object.freeze({
		...topology,
		nodes: nextNodes,
		edges: nextEdges,
	});
}

export function isTrackNetworkTopology(value) {
	if (
		!isObject(value) ||
		value.contractVersion !== TRACK_NETWORK_TOPOLOGY_VERSION ||
		value.type !== "TrackNetworkTopology" ||
		!normalizedId(value.id) ||
		!Array.isArray(value.nodes) ||
		!Array.isArray(value.edges)
	) {
		return false;
	}

	const nodeIds = new Set();
	for (const node of value.nodes) {
		const nodeId = normalizedId(node?.id);
		if (!isObject(node) || !nodeId || nodeIds.has(nodeId)) {
			return false;
		}
		nodeIds.add(nodeId);
	}

	const edgeIds = new Set();
	const alignmentIds = new Set();
	for (const edge of value.edges) {
		const edgeId = normalizedId(edge?.id);
		const alignmentId = normalizedId(edge?.alignmentId);
		const fromNodeId = normalizedId(edge?.fromNodeId);
		const toNodeId = normalizedId(edge?.toNodeId);
		if (
			!isObject(edge) ||
			!edgeId ||
			!alignmentId ||
			!fromNodeId ||
			!toNodeId ||
			!["forward", "reverse"].includes(edge.orientation) ||
			edgeIds.has(edgeId) ||
			alignmentIds.has(alignmentId) ||
			!nodeIds.has(fromNodeId) ||
			!nodeIds.has(toNodeId)
		) {
			return false;
		}
		edgeIds.add(edgeId);
		alignmentIds.add(alignmentId);
	}

	return true;
}

export function assertTrackNetworkTopology(
	value,
	context = "TrackNetworkTopology"
) {
	if (!isTrackNetworkTopology(value)) {
		throw new TypeError(`${context}: invalid TrackNetworkTopology`);
	}
	return value;
}

export function createTrackNetworkTopology({ id } = {}) {
	const topologyId = requireId(id, "topology id");
	return Object.freeze({
		contractVersion: TRACK_NETWORK_TOPOLOGY_VERSION,
		type: "TrackNetworkTopology",
		id: topologyId,
		nodes: Object.freeze([]),
		edges: Object.freeze([]),
	});
}

export function addTopologyNode(topology, { nodeId } = {}) {
	requireTopology(topology);
	const id = requireId(nodeId, "nodeId");
	if (topology.nodes.some((node) => node.id === id)) {
		fail("NODE_ALREADY_EXISTS", `topology node ${id} already exists`);
	}
	return freezeTopology(topology, {
		nodes: [...topology.nodes, { id }],
	});
}

export function connectAlignmentEdge(
	topology,
	{
		edgeId,
		alignmentId,
		fromNodeId,
		toNodeId,
		orientation = "forward",
	} = {}
) {
	requireTopology(topology);
	const id = requireId(edgeId, "edgeId");
	const alignment = requireId(alignmentId, "alignmentId");
	const from = requireId(fromNodeId, "fromNodeId");
	const to = requireId(toNodeId, "toNodeId");
	if (!["forward", "reverse"].includes(orientation)) {
		fail(
			"INVALID_ORIENTATION",
			"orientation must be forward or reverse"
		);
	}
	if (!topology.nodes.some((node) => node.id === from)) {
		fail("NODE_NOT_FOUND", `topology node ${from} was not found`);
	}
	if (!topology.nodes.some((node) => node.id === to)) {
		fail("NODE_NOT_FOUND", `topology node ${to} was not found`);
	}
	if (topology.edges.some((edge) => edge.id === id)) {
		fail("EDGE_ALREADY_EXISTS", `topology edge ${id} already exists`);
	}
	if (
		topology.edges.some(
			(edge) => edge.alignmentId === alignment
		)
	) {
		fail(
			"ALIGNMENT_ALREADY_CONNECTED",
			`Alignment ${alignment} is already connected`
		);
	}
	return freezeTopology(topology, {
		edges: [
			...topology.edges,
			{
				id,
				alignmentId: alignment,
				fromNodeId: from,
				toNodeId: to,
				orientation,
			},
		],
	});
}

export function removeAlignmentEdge(topology, { edgeId } = {}) {
	requireTopology(topology);
	const id = requireId(edgeId, "edgeId");
	const index = topology.edges.findIndex((edge) => edge.id === id);
	if (index < 0) {
		fail("EDGE_NOT_FOUND", `topology edge ${id} was not found`);
	}
	return freezeTopology(topology, {
		edges: topology.edges.filter((edge) => edge.id !== id),
	});
}

export function removeTopologyNode(topology, { nodeId } = {}) {
	requireTopology(topology);
	const id = requireId(nodeId, "nodeId");
	if (!topology.nodes.some((node) => node.id === id)) {
		fail("NODE_NOT_FOUND", `topology node ${id} was not found`);
	}
	if (
		topology.edges.some(
			(edge) =>
				edge.fromNodeId === id || edge.toNodeId === id
		)
	) {
		fail(
			"NODE_HAS_INCIDENT_EDGES",
			`topology node ${id} has incident edges`
		);
	}
	return freezeTopology(topology, {
		nodes: topology.nodes.filter((node) => node.id !== id),
	});
}

function requireExistingNode(topology, nodeId) {
	requireTopology(topology);
	const id = requireId(nodeId, "nodeId");
	if (!topology.nodes.some((node) => node.id === id)) {
		fail("NODE_NOT_FOUND", `topology node ${id} was not found`);
	}
	return id;
}

export function getIncidentAlignmentEdges(topology, { nodeId } = {}) {
	const id = requireExistingNode(topology, nodeId);
	return topology.edges.filter(
		(edge) =>
			edge.fromNodeId === id || edge.toNodeId === id
	);
}

export function getTraversableAlignmentEdges(
	topology,
	{ nodeId, direction = "outgoing" } = {}
) {
	const id = requireExistingNode(topology, nodeId);
	if (!["incoming", "outgoing", "both"].includes(direction)) {
		fail(
			"INVALID_DIRECTION",
			"direction must be incoming, outgoing, or both"
		);
	}
	return topology.edges
		.filter((edge) => {
			if (direction === "incoming") {
				return edge.toNodeId === id;
			}
			if (direction === "outgoing") {
				return edge.fromNodeId === id;
			}
			return edge.fromNodeId === id || edge.toNodeId === id;
		})
		.map((edge) => ({
			edgeId: edge.id,
			alignmentId: edge.alignmentId,
			fromNodeId: edge.fromNodeId,
			toNodeId: edge.toNodeId,
			orientation: edge.orientation,
		}));
}
