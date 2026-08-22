export const TRACK_NETWORK_TOPOLOGY_REPOSITORY_PORT_VERSION =
	"ufaim/track-network-topology-repository-port/0.1";

export class TrackNetworkTopologyRepositoryConflictError extends Error {
	constructor({ topologyId, expectedRevision, actualRevision } = {}) {
		super(
			`TrackNetworkTopology repository revision conflict for ${String(topologyId)}: ` +
			`expected ${String(expectedRevision)}, actual ${String(actualRevision)}`
		);
		this.name = "TrackNetworkTopologyRepositoryConflictError";
		this.code = "TOPOLOGY_REVISION_CONFLICT";
		this.topologyId = topologyId;
		this.expectedRevision = expectedRevision;
		this.actualRevision = actualRevision;
	}
}

export function assertTrackNetworkTopologyRepositoryPort(
	value,
	context = "TrackNetworkTopologyRepositoryPort"
) {
	if (
		!value ||
		typeof value !== "object" ||
		typeof value.loadById !== "function" ||
		typeof value.saveById !== "function"
	) {
		throw new TypeError(
			`${context} requires loadById() and saveById()`
		);
	}
	return value;
}
