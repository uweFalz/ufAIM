const PRIORITY = Object.freeze({
	main: ["spatial", "horizontal", "chainage", "vertical", "cant", "speed", "section"],
	q: ["horizontal", "vertical", "cant", "speed", "chainage", "section", "spatial"],
	l: ["chainage", "horizontal", "vertical", "cant", "speed", "section", "spatial"],
});

export function buildAlignmentEngineeringHudModel(intelligence) {
	const mode = ["main", "q", "l"].includes(intelligence?.mode) ? intelligence.mode : "main";
	const capabilities = intelligence?.capabilities ?? {};
	const fields = {
		spatial: field("Raum / CRS", capabilities.crs),
		horizontal: field("Krümmung / Tangente", capabilities.horizontal),
		chainage: field("Kilometrierung", capabilities.chainage),
		vertical: field("Gradiente", capabilities.vertical),
		cant: field("Überhöhung / Twist", capabilities.cant),
		speed: field("Speed-qualified State", capabilities.speed),
		section: field("Gauge / initialer Querschnitt", capabilities.section),
	};
	return Object.freeze({
		mode,
		context: intelligence?.context ?? {},
		fields: Object.freeze(PRIORITY[mode].map((id) => Object.freeze({ id, ...fields[id] }))),
		actions: Object.freeze({
			openObjects: Boolean(intelligence?.context?.objectId),
			openImport: Object.values(capabilities).some((entry) => entry?.status === "missing"),
			openReview: Object.values(capabilities).some((entry) => entry?.status === "review-required" || entry?.relationStatus === "open-candidates"),
		}),
	});
}

function field(label, capability = {}) {
	return {
		label,
		status: capability?.status ?? "missing",
		value: capability?.value ?? null,
		reason: capability?.reason ?? capability?.code ?? null,
		provenancePresent: Boolean(capability?.provenancePresent || capability?.evidenceId || capability?.sourceRefs?.length),
	};
}

export default buildAlignmentEngineeringHudModel;
