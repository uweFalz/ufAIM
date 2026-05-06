// app/domain/cockpit/scoreImportRow.js
//
// Cockpit import-row scoring.
//
// Role:
// - rank import rows for user-facing cockpit display
// - deterministic
// - no DOM
// - no store
// - no messaging

export function compareImportRows(a, b) {
	const scoreDelta = scoreImportRow(b) - scoreImportRow(a);
	if (scoreDelta !== 0) return scoreDelta;

	const kindDelta = String(a?.kind ?? "").localeCompare(String(b?.kind ?? ""));
	if (kindDelta !== 0) return kindDelta;

	return String(a?.label ?? a?.itemId ?? "").localeCompare(
		String(b?.label ?? b?.itemId ?? "")
	);
}

export function scoreImportRow(row) {
	let score = 0;

	if (row?.isPreviewActive) score += 1000;
	if (row?.accepted) score += 650;
	if (row?.promotable) score += 500;
	if (row?.hasSparse) score += 250;
	if (row?.crsId) score += 150;

	score += scoreKind(row?.kind);
	score += scoreLength(row?.lengthHint);
	score += scoreRelationCount(row?.relationCount);
	score += scoreQualityFlags(row?.qualityFlags);

	return score;
}

function scoreKind(kind) {
	switch (kind) {
		case "alignment":
			return 120;

		case "profile":
			return 50;

		case "cant":
			return 40;

		case "staEq":
			return 25;

		case "relation":
			return 15;

		default:
			return 0;
	}
}

function scoreLength(lengthHint) {
	const len = Number(lengthHint);

	if (!Number.isFinite(len) || len <= 0) return 0;

	return Math.min(120, Math.log10(len + 1) * 35);
}

function scoreRelationCount(relationCount) {
	const count = Number(relationCount);

	if (!Number.isFinite(count) || count <= 0) return 0;

	return Math.min(80, count * 20);
}

function scoreQualityFlags(flags) {
	return Array.isArray(flags) ? flags.length * 5 : 0;
}
