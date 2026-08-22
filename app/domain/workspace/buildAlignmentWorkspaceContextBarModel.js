const MODES = Object.freeze(["main", "q", "l"]);

export function buildAlignmentWorkspaceContextBarModel({ intelligence = {}, georeferenceQualification = null } = {}) {
	const mode = MODES.includes(intelligence?.mode) ? intelligence.mode : "main";
	const context = intelligence?.context ?? {};
	const objectId = String(context?.objectId ?? "").trim() || null;
	const s = Number(context?.s);
	const coordinateMode = !objectId ? null : georeferenceQualification?.coordinateMode === "qualified" && georeferenceQualification?.resolvedEpsg
		? `QUALIFIED · ${georeferenceQualification.resolvedEpsg}`
		: "LOCAL · engineering";
	return Object.freeze({
		status: objectId ? (Number.isFinite(s) ? "active" : "context-incomplete") : "absent",
		mode,
		context: Object.freeze({ objectId, route: objectId ? context?.route ?? null : null, sourceRole: objectId ? context?.sourceRole ?? null : null, s: objectId && Number.isFinite(s) ? s : null, coordinateMode }),
		actions: Object.freeze({ modes: MODES, openWorkbench: true, openObjects: true, openTaskRail: Boolean(objectId) }),
	});
}

export default buildAlignmentWorkspaceContextBarModel;
