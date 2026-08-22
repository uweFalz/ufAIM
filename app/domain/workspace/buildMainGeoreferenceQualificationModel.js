const QUALIFIED = new Set(["qualified", "valid"]);

export function buildMainGeoreferenceQualificationModel({ mode = "main", context = {}, debugObjectId = null, georeference = null, cursor = null } = {}) {
	const objectId = String(context?.objectId ?? "").trim();
	const exactDebugObject = Boolean(objectId) && String(debugObjectId ?? "").trim() === objectId;
	const source = exactDebugObject && georeference && typeof georeference === "object" ? georeference : {};
	const activeCursor = exactDebugObject ? cursor : null;
	const horizontal = source.horizontal && typeof source.horizontal === "object" ? source.horizontal : {};
	const validationStatus = String(source.validationStatus ?? horizontal.status ?? "missing");
	const resolvedEpsg = source.resolvedEpsg ?? horizontal.resolvedEpsg ?? null;
	const transformationAvailable = source.transformationAvailable === true;
	const qualified = QUALIFIED.has(validationStatus) && Boolean(resolvedEpsg) && transformationAvailable;
	const sampledCursorAvailable = Number.isFinite(activeCursor?.x) && Number.isFinite(activeCursor?.y);
	const coordinateMode = qualified ? "qualified" : "local-cartesian";
	const warnings = Object.freeze([...(source.warnings ?? horizontal.warnings ?? [])].map(String));
	const fallbackReason = exactDebugObject ? source.fallbackReason ?? horizontal.fallbackReason ?? (qualified ? null : validationStatus) : "active projection is not yet available for this object";
	return Object.freeze({
		visible: mode === "main" && Boolean(context?.objectId),
		objectId: objectId || null,
		s: Number.isFinite(Number(context?.s)) ? Number(context.s) : null,
		coordinateMode,
		validationStatus,
		sourceCrs: source.sourceCrs ?? horizontal.sourceIdentifier ?? null,
		resolvedEpsg: qualified ? resolvedEpsg : null,
		transformationAvailable,
		coordinateProvenance: source.coordinateProvenance ?? horizontal.coordinateProvenance ?? null,
		provenancePresent: Boolean(source.coordinateProvenance || horizontal.transformationProvenance || horizontal.sourceIdentifier),
		warnings,
		mapReady: qualified,
		markerReady: qualified && sampledCursorAvailable,
		reason: qualified ? null : String(fallbackReason ?? "CRS nicht qualifiziert"),
		actions: Object.freeze({ showOnMap: qualified, openObjects: true, openImport: !qualified, openReview: !qualified && validationStatus !== "missing" }),
	});
}

export default buildMainGeoreferenceQualificationModel;
