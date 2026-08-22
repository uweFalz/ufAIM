const FIELD_ORDER = Object.freeze([
	["chainage", "Kilometrierung / Adresse"],
	["horizontal", "Krümmung / Tangente"],
	["vertical", "Höhe / Gradiente"],
	["cant", "Überhöhung / Twist"],
]);

export function buildQLokEngineeringViewModel({ intelligence = {}, profileProjection = null } = {}) {
	const context = intelligence?.context ?? {};
	const s = Number(context?.s);
	const exactObjectProjection = Boolean(context?.objectId) && String(profileProjection?.alignmentId ?? "") === String(context.objectId);
	const exactCursorProjection = exactObjectProjection && profileProjection?.cursor?.parameterKind === "intrinsic-s" && Object.is(profileProjection?.cursor?.s, s);
	const fields = FIELD_ORDER.map(([id, label]) => {
		const capability = intelligence?.capabilities?.[id] ?? {};
		if (["chainage", "vertical", "cant"].includes(id) && !exactCursorProjection) return Object.freeze({ id, label, status: "not-covered", value: null, reason: "canonical profile projection is updating", provenancePresent: false });
		return Object.freeze({ id, label, status: capability.status ?? "missing", value: capability.value ?? null, reason: capability.reason ?? capability.code ?? null, provenancePresent: Boolean(capability.provenancePresent || capability.evidenceId || capability.sourceRefs?.length) });
	});
	return Object.freeze({
		visible: intelligence?.mode === "q" && Boolean(context?.objectId),
		context: Object.freeze({ objectId: context?.objectId ?? null, s: Number.isFinite(s) ? s : null, route: context?.route ?? null, sourceRole: context?.sourceRole ?? null, cameraMode: "local-engineering" }),
		fields: Object.freeze(fields),
		ahead: nextExistingBoundary(exactObjectProjection ? profileProjection : null, s),
	});
}

function nextExistingBoundary(projection, s) {
	if (!Number.isFinite(s)) return null;
	const supplied = [];
	for (const [lane, value] of [["vertical", projection?.vertical], ["cant", projection?.cant], ["chainage", projection?.chainage]]) {
		for (const boundary of value?.boundaries ?? []) if (Number.isFinite(boundary) && boundary > s) supplied.push({ lane, s: boundary });
		const endS = value?.domain?.endS;
		if (Number.isFinite(endS) && endS > s) supplied.push({ lane, s: endS });
	}
	if (!supplied.length) return null;
	let next = supplied[0];
	for (const candidate of supplied.slice(1)) if (candidate.s < next.s) next = candidate;
	const lanes = supplied.filter((candidate) => Object.is(candidate.s, next.s)).map((candidate) => candidate.lane);
	return Object.freeze({ s: next.s, lanes: Object.freeze([...new Set(lanes)]), status: "existing-boundary" });
}

export default buildQLokEngineeringViewModel;
