function requireService(service) {
	const methods = [
		"createTopology",
		"addNode",
		"connectAlignment",
		"getIncidentEdges",
		"getTraversableEdges",
	];
	if (
		!service ||
		methods.some((name) => typeof service[name] !== "function")
	) {
		throw new TypeError(
			"createTopologyWorkspaceController: invalid topology service"
		);
	}
	return service;
}

function sessionProjection(record, details = {}) {
	return Object.freeze({
		status: "session-only",
		persistence: "not-persisted",
		topologyId: record.topology.id,
		revision: record.revision,
		nodes: record.topology.nodes,
		edges: record.topology.edges,
		...details,
	});
}

export function createTopologyWorkspaceController({
	topologyApplicationService,
} = {}) {
	const service = requireService(topologyApplicationService);
	let current = null;
	let projection = Object.freeze({
		status: "absent",
		persistence: "not-persisted",
		topologyId: null,
		revision: null,
		nodes: Object.freeze([]),
		edges: Object.freeze([]),
	});

	async function create({ topologyId } = {}) {
		const record = await service.createTopology({ topologyId });
		current = record;
		projection = sessionProjection(record);
		return projection;
	}

	async function addNode({ nodeId } = {}) {
		if (!current) {
			throw new Error("create a session topology before adding nodes");
		}
		const record = await service.addNode({
			topologyId: current.topology.id,
			nodeId,
			expectedRevision: current.revision,
		});
		current = record;
		projection = sessionProjection(record);
		return projection;
	}

	async function connectActiveAlignment({
		edgeId,
		alignmentId,
		fromNodeId,
		toNodeId,
		orientation,
	} = {}) {
		if (!current) {
			throw new Error(
				"create a session topology before connecting an Alignment"
			);
		}
		const record = await service.connectAlignment({
			topologyId: current.topology.id,
			edgeId,
			alignmentId,
			fromNodeId,
			toNodeId,
			orientation,
			expectedRevision: current.revision,
		});
		const direction =
			orientation === "reverse" ? "incoming" : "outgoing";
		const traversalNodeId =
			orientation === "reverse" ? toNodeId : fromNodeId;
		const [fromIncident, toIncident, traversable] =
			await Promise.all([
				service.getIncidentEdges({
					topologyId: record.topology.id,
					nodeId: fromNodeId,
				}),
				service.getIncidentEdges({
					topologyId: record.topology.id,
					nodeId: toNodeId,
				}),
				service.getTraversableEdges({
					topologyId: record.topology.id,
					nodeId: traversalNodeId,
					direction,
				}),
			]);
		if (
			fromIncident.revision !== record.revision ||
			toIncident.revision !== record.revision ||
			traversable.revision !== record.revision
		) {
			throw new Error(
				"topology query revision does not match connected topology"
			);
		}
		current = record;
		projection = sessionProjection(record, {
			connectedAlignmentId: alignmentId,
			incident: Object.freeze({
				[fromNodeId]: fromIncident.edges,
				[toNodeId]: toIncident.edges,
			}),
			traversable: Object.freeze({
				nodeId: traversalNodeId,
				direction,
				orientation,
				edges: traversable.edges,
			}),
		});
		return projection;
	}

	return Object.freeze({
		create,
		addNode,
		connectActiveAlignment,
		getProjection() {
			return projection;
		},
	});
}

export default createTopologyWorkspaceController;
