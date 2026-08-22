import assert from "node:assert/strict";
import test from "node:test";

import {
	createTopologyWorkspaceController,
} from "../../../app/controllers/topology/createTopologyWorkspaceController.js";
import {
	wireTopologyWorkspaceView,
} from "../../../app/controllers/topology/wireTopologyWorkspaceView.js";
import {
	InMemoryTrackNetworkTopologyRepositoryAdapter,
} from "../../../src/services/topology/InMemoryTrackNetworkTopologyRepositoryAdapter.js";
import {
	TrackNetworkTopologyApplicationService,
} from "../../../src/services/topology/TrackNetworkTopologyApplicationService.js";

function makeController() {
	return createTopologyWorkspaceController({
		topologyApplicationService:
			new TrackNetworkTopologyApplicationService({
				repository:
					new InMemoryTrackNetworkTopologyRepositoryAdapter(),
			}),
	});
}

function canonicalState(alignmentId = "alignment-A", revision = 9) {
	return {
		objects: [{
			id: alignmentId,
			type: "alignment",
			data: {
				alignmentData: {
					id: alignmentId,
					revision,
				},
			},
		}],
	};
}

class FakeElement {
	constructor(ownerDocument) {
		this.ownerDocument = ownerDocument;
		this.children = [];
		this.dataset = {};
	}

	append(...children) {
		this.children.push(...children);
	}

	querySelector(selector) {
		if (selector !== "[data-topology-workspace-host]") return null;
		return this.children.find((child) =>
			Object.prototype.hasOwnProperty.call(
				child.dataset,
				"topologyWorkspaceHost"
			)
		) ?? null;
	}
}

class FakeDocument {
	constructor() {
		this.panel = new FakeElement(this);
	}

	getElementById(id) {
		return id === "cockpitPanel" ? this.panel : null;
	}

	createElement() {
		return new FakeElement(this);
	}
}

function makeStore() {
	let state = {
		workspace_selection: {
			primaryId: "alignment-A",
			elementId: "arc-A",
		},
	};
	const subscribers = new Set();
	return {
		getState() {
			return state;
		},
		subscribe(callback) {
			subscribers.add(callback);
			return () => subscribers.delete(callback);
		},
		setSelection(primaryId) {
			state = {
				...state,
				workspace_selection: {
					...state.workspace_selection,
					primaryId,
				},
			};
			for (const callback of subscribers) callback();
		},
	};
}

class RecordingView {
	constructor() {
		this.renders = [];
		this.errors = [];
		this.active = [];
	}

	bind(actions) {
		this.actions = actions;
	}

	renderActiveAlignment(value) {
		this.active.push(structuredClone(value));
	}

	render(value) {
		this.renders.push(structuredClone(value));
	}

	renderError(error) {
		this.errors.push({
			code: error?.code ?? null,
			message: error?.message ?? String(error),
		});
	}
}

test("explicit session workflow preserves IDs, revisions, incidence, and direction", async () => {
	const controller = makeController();
	const created = await controller.create({
		topologyId: "network-A",
	});
	assert.equal(created.status, "session-only");
	assert.equal(created.persistence, "not-persisted");
	assert.equal(created.revision, 1);

	const oneNode = await controller.addNode({ nodeId: "N1" });
	const twoNodes = await controller.addNode({ nodeId: "N2" });
	assert.equal(oneNode.revision, 2);
	assert.equal(twoNodes.revision, 3);
	assert.deepEqual(twoNodes.nodes, [{ id: "N1" }, { id: "N2" }]);

	const connected = await controller.connectActiveAlignment({
		edgeId: "E1",
		alignmentId: "alignment-A",
		fromNodeId: "N1",
		toNodeId: "N2",
		orientation: "forward",
	});
	assert.equal(connected.revision, 4);
	assert.deepEqual(connected.edges, [{
		id: "E1",
		alignmentId: "alignment-A",
		fromNodeId: "N1",
		toNodeId: "N2",
		orientation: "forward",
	}]);
	assert.deepEqual(connected.incident.N1, connected.edges);
	assert.deepEqual(connected.incident.N2, connected.edges);
	assert.deepEqual(connected.traversable, {
		nodeId: "N1",
		direction: "outgoing",
		orientation: "forward",
		edges: [{
			edgeId: "E1",
			alignmentId: "alignment-A",
			fromNodeId: "N1",
			toNodeId: "N2",
			orientation: "forward",
		}],
	});

	await assert.rejects(
		() => controller.addNode({ nodeId: "N2" }),
		/NODE_ALREADY_EXISTS|already exists/
	);
	assert.deepEqual(controller.getProjection(), connected);
});

test("wiring reads the canonical active Alignment and never rewrites an existing edge", async () => {
	const controller = makeController();
	const store = makeStore();
	const documentRef = new FakeDocument();
	const states = {
		"alignment-A": canonicalState("alignment-A", 9),
		"alignment-B": canonicalState("alignment-B", 11),
	};
	const wiring = wireTopologyWorkspaceView({
		store,
		messaging: {
			async sendCmdAwait(command) {
				assert.equal(command, "Spot.GetState");
				const id =
					store.getState().workspace_selection.primaryId;
				return states[id] ?? { objects: [] };
			},
		},
		controller,
		View: RecordingView,
		documentRef,
	});
	const view = wiring.getView();
	await wiring.refreshActiveAlignment();
	assert.deepEqual(view.active.at(-1), {
		alignmentId: "alignment-A",
		revision: 9,
	});

	await view.actions.onCreate({ topologyId: "network-A" });
	await view.actions.onAddNode({ nodeId: "N1" });
	await view.actions.onAddNode({ nodeId: "N2" });
	await view.actions.onConnect({
		edgeId: "E1",
		fromNodeId: "N1",
		toNodeId: "N2",
		orientation: "forward",
	});
	assert.equal(view.renders.at(-1).connectedAlignmentId, "alignment-A");

	store.setSelection("alignment-B");
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.deepEqual(view.active.at(-1), {
		alignmentId: "alignment-B",
		revision: 11,
	});
	assert.equal(
		controller.getProjection().edges[0].alignmentId,
		"alignment-A"
	);

	states["alignment-B"] = { objects: [] };
	await view.actions.onConnect({
		edgeId: "E2",
		fromNodeId: "N1",
		toNodeId: "N2",
		orientation: "reverse",
	});
	assert.equal(view.errors.at(-1).code, "ACTIVE_ALIGNMENT_REQUIRED");
	assert.equal(controller.getProjection().edges.length, 1);
	wiring.stop();
});

test("a new runtime controller begins absent and cannot reopen prior session state", async () => {
	const first = makeController();
	await first.create({ topologyId: "network-A" });
	await first.addNode({ nodeId: "N1" });

	const reloaded = makeController();
	assert.deepEqual(reloaded.getProjection(), {
		status: "absent",
		persistence: "not-persisted",
		topologyId: null,
		revision: null,
		nodes: [],
		edges: [],
	});
});
