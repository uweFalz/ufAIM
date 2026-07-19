export function createGeoreferenceContract({ horizontal = null, vertical = null, coordinateProvenance = null, coordinatesAreAbsolute = false, transformationAvailable = false, validationStatus = null, warnings = [] } = {}) {
	const supported = horizontal?.supportState === "geographic-supported" && horizontal?.status === "resolved";
	const geographic = supported && coordinatesAreAbsolute && transformationAvailable && validationStatus === "valid";
	const resolutionState = geographic
		? "geographic-supported"
		: operatingState(horizontal, validationStatus);
	return {
		mode: geographic ? "geographic" : "local-cartesian",
		resolutionState,
		sourceCrs: horizontal?.sourceIdentifier ?? null, resolvedEpsg: supported ? horizontal.resolvedEpsg : null,
		horizontal, vertical, coordinateProvenance, coordinatesAreAbsolute: Boolean(coordinatesAreAbsolute), transformationAvailable: Boolean(transformationAvailable),
		validationStatus: validationStatus ?? (supported ? "unvalidated" : horizontal?.status ?? "missing"),
		fallbackReason: geographic ? null : (horizontal?.fallbackReason ?? validationStatus ?? "missing-crs"),
		verticalReferenceStatus: vertical?.status ?? horizontal?.verticalReferenceStatus ?? "unresolved",
		warnings: [...new Set([...(horizontal?.warnings ?? []), ...(vertical?.warnings ?? []), ...warnings].filter(Boolean))],
	};
}

function operatingState(horizontal, validationStatus) {
	switch (validationStatus) {
		case "outside-validity": return "local-outside-validity";
		case "transformation-failed": return "local-transformation-failed";
		case "implausible": return "local-outside-validity";
		default: return horizontal?.supportState ?? "local-missing-crs";
	}
}
