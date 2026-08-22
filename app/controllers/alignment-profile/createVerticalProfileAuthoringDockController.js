import { buildVerticalProfileAuthoringDockModel } from "../../domain/workspace/buildVerticalProfileAuthoringDockModel.js";
import { createAuthoringDraftStore, isConfirmedAuthoringSaveResult } from "../../domain/workspace/createAuthoringDraftStore.js";

export function createVerticalProfileAuthoringDockController({ store, profileSource, view, ui } = {}) {
	if (!store?.getState || !profileSource?.getCurrentProjection || !view?.render) throw new TypeError("Vertical authoring dock requires store, profile source and view");
	let request = null; let busy = false; let unsubscribe = null;
	const drafts = createAuthoringDraftStore();
	const context = () => ({ activeObjectId: store.getState()?.workspace_selection?.primaryId ?? null, projection: profileSource.getCurrentProjection(), ...request });
	const model = () => buildVerticalProfileAuthoringDockModel(context());
	const identity = (action, current = model()) => ({ objectId: current.objectId, discipline: "vertical", action, elementId: current.elementId });
	const render = (status, error = null) => { const current = model(); view.render(current, { status, busy, error, readDraft: action => drafts.read(identity(action, current)) }); };
	async function run(action, payload) {
		const current = model();
		const allowed = action === "submitBasicVerticalProfile" ? current.canCreateInitial
			: action === "appendParabolicGradientChange" ? current.canAppendParabolic
				: action === "updateTerminalParabolicComposite" ? current.canEdit && String(payload?.elementId ?? "").trim() === current.elementId
					: false;
		if (busy || !allowed || typeof profileSource[action] !== "function") { render(current.status === "target-missing" ? "target-missing" : "unavailable"); return false; }
		drafts.write(identity(action, current), payload); busy = true; render("saving"); try { const result = await profileSource[action](payload); const saved=isConfirmedAuthoringSaveResult(result);busy = false; if (saved) drafts.clear(identity(action, current)); render(saved ? "saved" : "error", result?.reason ?? result?.code ?? null); return saved; } catch (error) { busy = false; render("error", String(error?.message ?? error)); return false; }
	}
	view.setHandlers?.({
		close: () => { ui?.closeVerticalProfileAuthoring?.(); request = null; },
		createInitial: input => run("submitBasicVerticalProfile", input),
		appendParabolic: input => run("appendParabolicGradientChange", input),
		editTerminal: input => run("updateTerminalParabolicComposite", input),
		draftChanged: (action, values) => drafts.write(identity(action), values),
	});
	return Object.freeze({
		open({ objectId = null, elementId = null } = {}) { request = { requestedObjectId: objectId, requestedElementId: elementId }; ui?.openVerticalProfileAuthoring?.(); render("ready"); unsubscribe ??= profileSource.subscribeProjection?.(() => render("ready")); return ["active", "selected"].includes(model().status); },
		close() { ui?.closeVerticalProfileAuthoring?.(); request = null; },
		stop() { unsubscribe?.(); unsubscribe = null; drafts.clearAll(); },
	});
}

export default createVerticalProfileAuthoringDockController;
