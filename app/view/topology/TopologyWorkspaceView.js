function field(documentRef, labelText, name, value = "") {
	const label = documentRef.createElement("label");
	label.textContent = labelText;
	const input = documentRef.createElement("input");
	input.name = name;
	input.value = value;
	label.append(input);
	return { label, input };
}

function button(documentRef, text, action) {
	const element = documentRef.createElement("button");
	element.type = "button";
	element.textContent = text;
	element.dataset.topologyAction = action;
	return element;
}

function selectOrientation(documentRef) {
	const label = documentRef.createElement("label");
	label.textContent = "Orientation";
	const select = documentRef.createElement("select");
	select.name = "orientation";
	for (const value of ["forward", "reverse"]) {
		const option = documentRef.createElement("option");
		option.value = value;
		option.textContent = value;
		select.append(option);
	}
	label.append(select);
	return { label, select };
}

function createWorkspace(documentRef) {
	const root = documentRef.createElement("section");
	root.dataset.topologyWorkspace = "";
	root.setAttribute("aria-label", "Topology workspace");

	const heading = documentRef.createElement("h2");
	heading.textContent = "Topology Workspace";
	const warning = documentRef.createElement("strong");
	warning.dataset.topologyPersistence = "";
	warning.textContent = "SESSION-ONLY / NICHT PERSISTIERT";
	const status = documentRef.createElement("p");
	status.dataset.topologyStatus = "";
	status.setAttribute("role", "status");
	status.textContent = "absent";
	const active = documentRef.createElement("pre");
	active.dataset.topologyActiveAlignment = "";

	const topology = field(
		documentRef,
		"Topology ID",
		"topologyId",
		"session-topology"
	);
	const createButton = button(documentRef, "Create topology", "create");
	const node = field(documentRef, "Node ID", "nodeId");
	const addButton = button(documentRef, "Add node", "add-node");
	const from = field(documentRef, "From node", "fromNodeId", "N1");
	const to = field(documentRef, "To node", "toNodeId", "N2");
	const edge = field(documentRef, "Edge ID", "edgeId", "E1");
	const orientation = selectOrientation(documentRef);
	const connectButton = button(
		documentRef,
		"Connect active Alignment",
		"connect"
	);
	const output = documentRef.createElement("pre");
	output.dataset.topologyOutput = "";

	root.append(
		heading,
		warning,
		status,
		active,
		topology.label,
		createButton,
		node.label,
		addButton,
		from.label,
		to.label,
		edge.label,
		orientation.label,
		connectButton,
		output
	);
	return {
		root,
		status,
		active,
		output,
		inputs: {
			topologyId: topology.input,
			nodeId: node.input,
			fromNodeId: from.input,
			toNodeId: to.input,
			edgeId: edge.input,
			orientation: orientation.select,
		},
		buttons: {
			create: createButton,
			addNode: addButton,
			connect: connectButton,
		},
	};
}

export class TopologyWorkspaceView {
	constructor({ host, documentRef = host?.ownerDocument } = {}) {
		if (!host || !documentRef) {
			throw new TypeError(
				"TopologyWorkspaceView requires a host"
			);
		}
		this.nodes = createWorkspace(documentRef);
		host.append(this.nodes.root);
	}

	bind({ onCreate, onAddNode, onConnect } = {}) {
		if (
			typeof onCreate !== "function" ||
			typeof onAddNode !== "function" ||
			typeof onConnect !== "function"
		) {
			throw new TypeError(
				"TopologyWorkspaceView.bind requires all actions"
			);
		}
		this.nodes.buttons.create.addEventListener("click", () => {
			void onCreate({
				topologyId: this.nodes.inputs.topologyId.value,
			});
		});
		this.nodes.buttons.addNode.addEventListener("click", () => {
			void onAddNode({
				nodeId: this.nodes.inputs.nodeId.value,
			});
		});
		this.nodes.buttons.connect.addEventListener("click", () => {
			void onConnect({
				edgeId: this.nodes.inputs.edgeId.value,
				fromNodeId: this.nodes.inputs.fromNodeId.value,
				toNodeId: this.nodes.inputs.toNodeId.value,
				orientation: this.nodes.inputs.orientation.value,
			});
		});
	}

	renderActiveAlignment({ alignmentId, revision } = {}) {
		this.nodes.active.textContent = JSON.stringify(
			{
				alignmentId: alignmentId ?? null,
				revision: revision ?? null,
			},
			null,
			2
		);
	}

	render(projection) {
		this.nodes.status.dataset.topologyState =
			projection?.status ?? "absent";
		this.nodes.status.textContent =
			projection?.status ?? "absent";
		this.nodes.output.textContent = JSON.stringify(
			projection ?? {
				status: "absent",
				persistence: "not-persisted",
			},
			null,
			2
		);
	}

	renderError(error) {
		this.nodes.status.dataset.topologyState = "error";
		this.nodes.status.textContent = "error";
		this.nodes.output.textContent = JSON.stringify(
			{
				status: "error",
				persistence: "not-persisted",
				code: String(error?.code ?? "TOPOLOGY_WORKSPACE_ERROR"),
				message: String(error?.message ?? error),
			},
			null,
			2
		);
	}

	getRoot() {
		return this.nodes.root;
	}
}

export default TopologyWorkspaceView;
