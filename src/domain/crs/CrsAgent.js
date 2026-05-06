// src/domain/crs/CrsAgent.js

export function inspectCrsContext({
	sceneCrsId = null,
	projectCrsId = null,
	importCrsIds = [],
	spotCrsIds = [],
} = {}) {
	const crsIds = unique([
		projectCrsId,
		sceneCrsId,
		...importCrsIds,
		...spotCrsIds,
	].map(normalizeCrsId).filter(Boolean));

	const normalizedSceneCrsId = normalizeCrsId(sceneCrsId);
	const normalizedProjectCrsId = normalizeCrsId(projectCrsId);

	const hasSceneCrs = Boolean(normalizedSceneCrsId);
	const hasProjectCrs = Boolean(normalizedProjectCrsId);
	const hasConflict = crsIds.length > 1;

	return {
		ok: hasSceneCrs && !hasConflict,
		sceneCrsId: normalizedSceneCrsId,
		projectCrsId: normalizedProjectCrsId,
		crsIds,
		hasSceneCrs,
		hasProjectCrs,
		hasConflict,
		severity: deriveSeverity({ hasSceneCrs, hasProjectCrs, hasConflict }),
		message: buildMessage({ hasSceneCrs, hasProjectCrs, hasConflict, crsIds }),
		actions: buildActions({ hasSceneCrs, hasProjectCrs, hasConflict }),
	};
}

export function normalizeCrsId(value) {
	const s = String(value ?? "").trim();
	if (!s) return null;

	if (/^EPSG:/i.test(s)) return `EPSG:${s.split(":")[1]}`;
	if (/^DB:/i.test(s)) return `DB:${s.split(":")[1].toUpperCase()}`;

	if (/^[A-Z]{2}\d$/i.test(s)) {
		return `DB:${s.toUpperCase()}`;
	}

	return s;
}

function deriveSeverity({ hasSceneCrs, hasProjectCrs, hasConflict }) {
	if (!hasSceneCrs) return "warning";
	if (hasConflict) return "warning";
	if (!hasProjectCrs) return "info";
	return "ok";
}

function buildMessage({ hasSceneCrs, hasProjectCrs, hasConflict, crsIds }) {
	if (!hasSceneCrs) {
		return "Dieses Objekt hat noch kein explizites Bezugssystem.";
	}

	if (hasConflict) {
		return `Mehrere Bezugssysteme erkannt: ${crsIds.join(", ")}. Anzeigen ist möglich, Zusammenführen braucht Klärung.`;
	}

	if (!hasProjectCrs) {
		return `Bezugssystem erkannt: ${crsIds[0]}. Ein Projekt-CRS ist noch nicht festgelegt.`;
	}

	return `Bezugssystem konsistent: ${crsIds[0]}.`;
}

function buildActions({ hasSceneCrs, hasProjectCrs, hasConflict }) {
	const actions = [];

	if (hasSceneCrs && !hasProjectCrs) {
		actions.push("set_project_crs_from_scene");
	}

	if (hasConflict) {
		actions.push("inspect_crs");
		actions.push("define_crs_transform");
	}

	if (!hasSceneCrs) {
		actions.push("assign_crs");
	}

	return actions;
}

function unique(values) {
	return [...new Set(values)];
}
