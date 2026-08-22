export function buildCanonicalObjectQuickSwitcherModel({ uiState = null, activeObjectId = null, query = "", phase = "ready", error = null } = {}) {
	const needle = String(query ?? "").trim().toLocaleLowerCase();
	const source = Array.isArray(uiState?.rows) ? uiState.rows : [];
	const rows = source
		.map((row) => Object.freeze({
			objectId: String(row?.spotId ?? "").trim(),
			label: String(row?.label ?? row?.spotId ?? ""),
			route: row?.gndRoute?.route ?? null,
			role: row?.gndRoute?.role ?? null,
			reviewStatus: row?.gndRoute?.sourceAssociationStatus ?? null,
			spaceStatus: row?.spatialMode ?? null,
			sourceFingerprint: row?.gndNavigator?.sourceFingerprint ?? null,
		}))
		.filter((row) => row.objectId && (!needle || [row.objectId, row.label, row.route]
			.some((value) => String(value ?? "").toLocaleLowerCase().includes(needle))));
	return Object.freeze({
		phase,
		error: error ? String(error) : null,
		query: String(query ?? ""),
		activeObjectId: String(activeObjectId ?? "").trim() || null,
		total: source.length,
		rows: Object.freeze(rows),
	});
}
export default buildCanonicalObjectQuickSwitcherModel;
