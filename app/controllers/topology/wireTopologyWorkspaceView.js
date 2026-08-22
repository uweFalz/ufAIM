function unwrap(raw) {
	return raw?.state ?? raw?.payload ?? raw ?? null;
}

function objects(state) {
	return Array.isArray(state?.objects)
		? state.objects
		: Object.values(state?.objects ?? {});
}

function readSelection(store) {
	const value = store.getState()?.workspace_selection?.primaryId;
	const alignmentId = String(value ?? "").trim();
	return alignmentId || null;
}

function canonicalAlignment(state, alignmentId) {
	const object =
		objects(state).find(
			(entry) => String(entry?.id ?? "") === alignmentId
		) ?? null;
	const alignmentData =
		object?.type === "alignment"
			? object?.data?.alignmentData ?? null
			: null;
	if (
		!alignmentData ||
		String(alignmentData.id ?? "") !== alignmentId
	) {
		return null;
	}
	return {
		alignmentId,
		revision: Object.prototype.hasOwnProperty.call(
			alignmentData,
			"revision"
		)
			? alignmentData.revision
			: null,
	};
}

function createHost(documentRef) {
	const panel = documentRef.getElementById("cockpitPanel");
	if (!panel) {
		throw new Error(
			"wireTopologyWorkspaceView: missing #cockpitPanel"
		);
	}
	const existing = panel.querySelector("[data-topology-workspace-host]");
	if (existing) return existing;
	const host = documentRef.createElement("div");
	host.dataset.topologyWorkspaceHost = "";
	panel.append(host);
	return host;
}

export function wireTopologyWorkspaceView({
	store,
	messaging,
	controller,
	View,
	documentRef = globalThis.document,
} = {}) {
	if (
		!store?.getState ||
		typeof store?.subscribe !== "function" ||
		typeof messaging?.sendCmdAwait !== "function" ||
		typeof controller?.create !== "function" ||
		typeof controller?.addNode !== "function" ||
		typeof controller?.connectActiveAlignment !== "function" ||
		typeof View !== "function" ||
		!documentRef
	) {
		throw new TypeError(
			"wireTopologyWorkspaceView: incomplete dependencies"
		);
	}

	const view = new View({
		host: createHost(documentRef),
		documentRef,
	});
	let active = { alignmentId: null, revision: null };
	let stopped = false;
	let selectionToken = 0;

	async function refreshActiveAlignment() {
		const token = ++selectionToken;
		const selectedId = readSelection(store);
		if (!selectedId) {
			active = { alignmentId: null, revision: null };
			view.renderActiveAlignment(active);
			return active;
		}
		try {
			const state = unwrap(
				await messaging.sendCmdAwait("Spot.GetState", {})
			);
			const canonical = canonicalAlignment(state, selectedId);
			if (!canonical) {
				throw Object.assign(
					new Error(
						"active Alignment is unavailable in canonical SPOT state"
					),
					{ code: "ACTIVE_ALIGNMENT_UNAVAILABLE" }
				);
			}
			if (stopped || token !== selectionToken) return active;
			active = canonical;
			view.renderActiveAlignment(active);
			return active;
		} catch (error) {
			if (stopped || token !== selectionToken) return active;
			active = { alignmentId: null, revision: null };
			view.renderActiveAlignment(active);
			view.renderError(error);
			return active;
		}
	}

	async function perform(action) {
		try {
			const result = await action();
			view.render(result);
			return result;
		} catch (error) {
			view.renderError(error);
			return null;
		}
	}

	view.bind({
		onCreate: (value) => perform(() => controller.create(value)),
		onAddNode: (value) => perform(() => controller.addNode(value)),
		onConnect: (value) =>
			perform(async () => {
				const selectedId = readSelection(store);
				const canonical = await refreshActiveAlignment();
				if (
					!selectedId ||
					canonical.alignmentId !== selectedId
				) {
					throw Object.assign(
						new Error(
							"connect requires the canonical active Alignment"
						),
						{ code: "ACTIVE_ALIGNMENT_REQUIRED" }
					);
				}
				return controller.connectActiveAlignment({
					...value,
					alignmentId: canonical.alignmentId,
				});
			}),
	});

	view.render(controller.getProjection());
	const unsubscribe = store.subscribe(() => {
		void refreshActiveAlignment();
	});
	void refreshActiveAlignment();

	return Object.freeze({
		refreshActiveAlignment,
		stop() {
			stopped = true;
			selectionToken += 1;
			unsubscribe?.();
		},
		getView() {
			return view;
		},
	});
}

export default wireTopologyWorkspaceView;
