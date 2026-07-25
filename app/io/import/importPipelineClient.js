// app/io/import/importPipelineClient.js
//
// ImportPipelineClient
//
// Thin app-side facade around the canonical import pipeline.
//
// Role:
// - isolate app/controllers from src/import/runImportPipeline.js
// - normalize import result access
// - provide batch stats helpers
// - provide preview candidate creation
//
// NOT:
// - no DOM
// - no store mutation
// - no messaging
// - no UI updates
// - no SPOT promotion
//
// Rule:
// Controller orchestrates.
// ImportPipelineClient runs/classifies/summarizes import results.

import { runImportPipeline } from "@src/import/runImportPipeline.js";
import { createImportResultEvidencePublication } from "@src/import/evidence/importResultEvidence.js";

// ------------------------------------------------------------
// pipeline
// ------------------------------------------------------------

export async function importOneFile(file, { log, onImportPhase } = {}) {
	return await runImportPipeline(file, { log, onImportPhase });
}

export function makeImportResultEvidencePublication(result, { fileName, parserId, completedAt } = {}) {
	return createImportResultEvidencePublication({ result, fileName, parserId, completedAt });
}

// ------------------------------------------------------------
// result accessors
// ------------------------------------------------------------

export function getResultItems(result) {
	return Array.isArray(result?.items) ? result.items : [];
}

export function getRejectedItems(result) {
	return Array.isArray(result?.rejected) ? result.rejected : [];
}

export function getRelationCandidates(result) {
	return Array.isArray(result?.relationCandidates) ? result.relationCandidates : [];
}

export function getPromotableAlignmentItems(items = []) {
	return items.filter((item) =>
		item?.kind === "alignment" &&
		item?.status?.valid === true &&
		item?.status?.promotable === true &&
		item?.derived?.sparseAlignment
	);
}

// ------------------------------------------------------------
// preview
// ------------------------------------------------------------

export function makePreviewCandidate(item, { source = null } = {}) {
	const kernel = item?.derived?.sparseAlignment ?? null;
	if (!kernel) return null;

	const name =
		item?.payload?.name ??
		item?.payload?.id ??
		item?.source?.objectName ??
		item?.id ??
		"preview";

	const crsId = derivePreviewCrsId(item);

	return {
		id: item.id ?? item?.payload?.id ?? item?.payload?.name ?? "preview_alignment",
		evidenceId: item.evidenceId ?? null,
		kind: item.kind ?? "alignment",
		name,
		kernel,
		crsId,

		source: {
			fileName: source?.fileName ?? item?.source?.fileName ?? null,
			parserId: source?.parserId ?? item?.source?.parserId ?? null,
			objectName: item?.source?.objectName ?? null,
		},
	};
}

export function derivePreviewCrsId(item) {
	const sr = item?.derived?.spatialRef ?? null;

	return (
		sr?.crsId ??
		sr?.horizontalCrsId ??
		sr?.horizontal ??
		sr?.horizontalCoordinateSystemName ??
		null
	);
}

// ------------------------------------------------------------
// batch stats
// ------------------------------------------------------------

export function makeBatchStats(totalFiles) {
	return {
		totalFiles,
		ignored: 0,
		empty: 0,
		processed: 0,
		unknown: 0,
		failed: 0,

		itemCount: 0,
		rejectedCount: 0,
		relationCandidateCount: 0,

		promotableCount: 0,
		acceptedCount: 0,
		alignmentCount: 0,
		profileCount: 0,
		cantCount: 0,
		staEqCount: 0,
		relationCount: 0,
	};
}

export function accountResult(stats, result) {
	if (!stats) return stats;

	const items = getResultItems(result);
	const rejected = getRejectedItems(result);
	const relationCandidates = getRelationCandidates(result);

	stats.itemCount += items.length;
	stats.rejectedCount += rejected.length;
	stats.relationCandidateCount += relationCandidates.length;

	for (const item of items) {
		switch (item?.kind) {
			case "alignment":
				stats.alignmentCount += 1;
				break;
			case "profile":
				stats.profileCount += 1;
				break;
			case "cant":
				stats.cantCount += 1;
				break;
			case "staEq":
				stats.staEqCount += 1;
				break;
			case "relation":
				stats.relationCount += 1;
				break;
			default:
				break;
		}

		if (item?.status?.promotable === true) stats.promotableCount += 1;
		if (item?.status?.accepted === true) stats.acceptedCount += 1;
	}

	switch (result?.status ?? null) {
		case "ignored":
			stats.ignored += 1;
			break;

		case "no-items":
		case "empty":
		case "rejected":
		case "invalid":
			stats.empty += 1;
			break;

		case "ok":
		case "processed":
			stats.processed += 1;
			break;

		case "unknown":
		default:
			stats.unknown += 1;
			break;
	}

	return stats;
}

export function makeBatchSummaryLine(stats) {
	return (
		`import batch: ${stats.totalFiles} files / ` +
		`${stats.ignored} ignored / ` +
		`${stats.empty} empty / ` +
		`${stats.processed} processed / ` +
		`${stats.unknown} unknown / ` +
		`${stats.failed} failed / ` +
		`${stats.itemCount} items / ` +
		`${stats.rejectedCount} rejected / ` +
		`${stats.relationCandidateCount} relationCandidates / ` +
		`${stats.promotableCount} promotable / ` +
		`${stats.acceptedCount} accepted / ` +
		`${stats.alignmentCount} alignments / ` +
		`${stats.profileCount} profiles / ` +
		`${stats.cantCount} cants / ` +
		`${stats.staEqCount} staEq / ` +
		`${stats.relationCount} relations`
	);
}

// ------------------------------------------------------------
// debug summaries
// ------------------------------------------------------------

export function summarizeImportResultForLog(fileName, result) {
	const items = getResultItems(result);
	const rejected = getRejectedItems(result);

	return {
		fileName,
		status: result?.status ?? "unknown",
		items: items.map((item) => ({
			id: item?.id,
			kind: item?.kind,
			name: item?.payload?.name ?? item?.payload?.id ?? null,
			promotable: item?.status?.promotable,
			stage: item?.status?.stage,
			reason: item?.status?.reason ?? null,
			hasSparse: Boolean(item?.derived?.sparseAlignment),
			interpretation: item?.derived?.interpretation ?? null,
			meta: item?.meta ?? null,
		})),
		rejected: rejected.map((item) => ({
			id: item?.id,
			kind: item?.kind,
			reason: item?.status?.reason ?? item?.reason ?? null,
			meta: item?.meta ?? null,
		})),
	};
}

export function summarizeRelationCandidatesForLog(fileName, relationCandidates = []) {
	const list = Array.isArray(relationCandidates) ? relationCandidates : [];

	return {
		fileName,
		count: list.length,
		relationCandidates: list.map((rel) => ({
			type: rel?.type ?? null,
			from: rel?.from ?? null,
			to: rel?.to ?? null,
			confidence: rel?.confidence ?? null,
			reasons: Array.isArray(rel?.reasons) ? rel.reasons : [],
		})),
	};
}

export function summarizeItemsForMasterLog(items = []) {
	return items.map((item) => ({
		id: item?.id,
		kind: item?.kind,
		promotable: item?.status?.promotable,
		stage: item?.status?.stage,
		reason: item?.status?.reason ?? null,
		hasSparse: Boolean(item?.derived?.sparseAlignment),
		interpretation: item?.derived?.interpretation ?? null,
		meta: item?.meta ?? null,
		name: item?.payload?.name ?? item?.payload?.id ?? null,
	}));
}
