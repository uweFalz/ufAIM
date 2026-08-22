function buttonFor(documentRef, mode) {
	return documentRef.querySelector(`[data-workspace-view-mode="${mode}"]`);
}

export function createAlignmentBimWorkspaceController({
	documentRef = globalThis.document,
	threeViewer,
	store,
	openImport = () => documentRef.getElementById("btnImport")?.click(),
	createAlignment = () => documentRef.getElementById("btnGndImportWorkbench")?.click(),
	openObjects = () => documentRef.getElementById("btnSpot")?.click(),
} = {}) {
	if (!documentRef || typeof threeViewer?.setWorkspaceViewMode !== "function") {
		throw new TypeError("createAlignmentBimWorkspaceController: incomplete dependencies");
	}

	const shell = documentRef.getElementById("ufShell");
	const status = documentRef.querySelector("[data-workspace-view-status]");
	if (!shell || !status) {
		throw new Error("createAlignmentBimWorkspaceController: workspace shell missing");
	}

	let activeMode = "main";
	let unavailableMessage = null;
	let unsubscribe = null;
	let cameraCoordinator = null;
	let lastObjectId = null;
	const handlers = new Map();
	const startSurface = documentRef.querySelector("[data-workspace-start-surface]");
	const readState = () => store?.getState?.() ?? {};

	function render(mode, message = null) {
		activeMode = mode;
		unavailableMessage = message;
		shell.dataset.workspaceView = mode;
		for (const candidate of ["main", "q", "l"]) {
			const button = buttonFor(documentRef, candidate);
			const selected = candidate === mode;
			button?.classList.toggle("is-active", selected);
			button?.setAttribute("aria-pressed", selected ? "true" : "false");
		}
		status.dataset.workspaceViewStatus = message ? "unavailable" : "ready";
		const state = readState();
		const objectId = String(state?.workspace_selection?.primaryId ?? "").trim();
		shell.dataset.workspaceEmpty = objectId ? "false" : "true";
		startSurface?.classList.toggle("hidden", Boolean(objectId));
		const s = Number(state?.cursor?.s);
		const label = ({
			main: "World / Map",
			q: "Alignment / Lok-View",
			l: "Intrinsic alignment bands",
		}[mode]);
		status.dataset.workspaceCameraContext = cameraContext(mode).replace(/^ · /, "");
		status.textContent = message ?? (objectId && Number.isFinite(s)
			? `${label} · ${objectId} · s ${String(s)}`
			: label);
		globalThis.requestAnimationFrame?.(() => threeViewer.scheduleResize?.());
	}

	function cameraContext(mode) {
		const debug = cameraCoordinator?.getDebugState?.() ?? {};
		const qualified = debug?.georeference?.validationStatus === "qualified" || debug?.georeference?.validationStatus === "valid";
		const epsg = debug?.georeference?.resolvedEpsg ?? debug?.georeference?.horizontal?.resolvedEpsg ?? null;
		if (mode === "main") return qualified && epsg ? ` · MAP ${epsg}` : " · LOCAL map";
		if (mode === "q") return qualified && epsg ? ` · LOCAL camera · qualified ${epsg}` : " · LOCAL camera";
		return " · intrinsic s";
	}

	function synchronizeCamera(mode, { fit = false } = {}) {
		if (mode === "main" && fit) void cameraCoordinator?.fitActive?.({ includePins: false, includeChunks: false, includeContext: false });
		if (mode === "q") globalThis.requestAnimationFrame?.(() => threeViewer.setWorkspaceViewMode("q"));
	}

	function activate(mode) {
		if (!["main", "q", "l"].includes(mode)) return false;
		if (mode === "q" && threeViewer.setWorkspaceViewMode("q") === false) {
			render(activeMode, "Lok-View benötigt eine aktive Alignment-Geometrie");
			return false;
		}
		if (mode === "main") threeViewer.setWorkspaceViewMode("main");
		render(mode);
		synchronizeCamera(mode, { fit: mode === "main" });
		return true;
	}

	function start() {
		for (const mode of ["main", "q", "l"]) {
			const button = buttonFor(documentRef, mode);
			if (!button) continue;
			const handler = () => activate(mode);
			handlers.set(button, handler);
			button.addEventListener("click", handler);
		}
		wireAction("[data-workspace-import]", openImport);
		wireAction("[data-workspace-create]", createAlignment);
		wireAction("[data-workspace-open]", openObjects);
		unsubscribe = store?.subscribe?.(() => {
			const objectId = String(readState()?.workspace_selection?.primaryId ?? "").trim() || null;
			const objectChanged = objectId !== lastObjectId;
			lastObjectId = objectId;
			render(activeMode, unavailableMessage);
			synchronizeCamera(activeMode, { fit: activeMode === "main" && objectChanged });
		}) ?? null;
		lastObjectId = String(readState()?.workspace_selection?.primaryId ?? "").trim() || null;
		activate("main");
	}

	function wireAction(selector, action) {
		const button = documentRef.querySelector(selector);
		if (!button || typeof action !== "function") return;
		const handler = () => action();
		handlers.set(button, handler);
		button.addEventListener("click", handler);
	}

	function dispose() {
		for (const [button, handler] of handlers) button.removeEventListener("click", handler);
		handlers.clear();
		unsubscribe?.();
		unsubscribe = null;
	}

	return { start, dispose, activate, setCameraCoordinator(value) { cameraCoordinator = value ?? null; render(activeMode, unavailableMessage); }, getActiveMode: () => activeMode };
}

export default createAlignmentBimWorkspaceController;
