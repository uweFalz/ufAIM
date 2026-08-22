// src/import/parsers/technet/gndEdit/parseGND_XLSX.js
//
// GND Edit XLSX -> landFAT (Analyse-Stufe / SequenceBuilder)

import * as fat from "@kimport/landfat/landFatWriter.js";

import { readGndXlsxTables } from "./gnd/readGndXlsxTables.js";
import { envelopeToGndTables } from "./gnd/gndSourceEnvelope.js";
import { normalizeGndRow } from "./gnd/normalizeGndRows.js";
import { createGndDataset } from "./gnd/createGndDataset.js";
import { createGndPadIndex } from "./gnd/createGndPadIndex.js";
import { createGndEdgeIndex } from "./gnd/createGndEdgeIndex.js";
import { buildGndSequences } from "./gnd/buildGndSequences.js";
import { buildGndNormalizedSourceLayer } from "./gnd/buildGndNormalizedSourceLayer.js";

import {
	buildCoordGeomFromTraLikeRecords,
} from "../shared/traLikeCoordGeom.js";

import {
	getTraLikeSemanticMapForGND,
} from "../shared/traLikeSemanticMaps.js";
import { resolveGndType7TransitionId } from "./gnd/resolveGndType7TransitionId.js";

import {
	TECHNET_SHEET_NAMES as SHEET_NAMES,
	TECHNET_EDGE_FAMILIES as EDGE_FAMILIES,
} from "../sharedTechnet.js";
import { resolveGndCrsIdentifier } from "@src/domain/crs/GndCrsResolver.js";

const DEBUG_GND_ANALYSIS_DEFAULT = false;

const FAMILY_CONFIG = {
	EL: {
		requiredKeys: ["requiredLsys"],
		candidateKeys: ["ppKeys", "plKeys"],
	},
	EK: {
		requiredKeys: ["requiredLsys"],
		candidateKeys: ["ppKeys", "plKeys"],
	},
	EU: {
		requiredKeys: [],
		candidateKeys: ["ppKeys", "plKeys"],
	},
	EH: {
		requiredKeys: ["requiredHsys"],
		candidateKeys: ["ppKeys", "plKeys", "phKeys"],
	},
};

// -----------------------------------------------------------------------------
// entry
// -----------------------------------------------------------------------------

export async function parseGND_XLSX({ file, bytes, context = {} } = {}) {
	const fileName = file?.name ?? "unknown.xlsx";

	const { envelope } = await readGndXlsxTables({
		file,
		bytes,
		sheetNames: SHEET_NAMES,
	});

	return parseGNDSourceEnvelope({ envelope, context });
}

export function parseGNDSourceEnvelope({ envelope, context = {} } = {}) {
	const fileName = envelope?.source?.fileName ?? "unknown";
	const workbookInfo = {
		sheetNames: (envelope?.inventory ?? []).map((table) => table.name),
		sheetCount: envelope?.inventory?.length ?? 0,
	};
	const rawTables = envelopeToGndTables(envelope);
	const normalizedSourceLayer = buildGndNormalizedSourceLayer(envelope);
	const tables = Object.fromEntries(Object.entries(rawTables).map(([name, rows]) => [name, rows.map((row) => normalizeGndRow(row, { sheetName: name, rowIndex: row.__rowIndex }))]));
	const dataset = createGndDataset({
		source: {
			parserId: "gndEdit",
			backend: envelope?.source?.format?.includes("Jet") ? "mdb" : "xlsx",
			fileName,
		},
		workbookInfo,
		tables,
	});

	const debugGndAnalysis =
		context?.debugGndAnalysis === true ||
		context?.debugImport === true ||
		DEBUG_GND_ANALYSIS_DEFAULT;

	if (debugGndAnalysis) {
		console.groupCollapsed(`[GND] source :: ${fileName}`);
		console.log("sheetNames:", workbookInfo.sheetNames);
		console.log("sheetCount:", workbookInfo.sheetCount);
		console.groupEnd();
	}

	const model = buildAnalysisModel({ dataset });

	if (debugGndAnalysis) {
		logAnalysisToConsole(model, { fileName });
	}

	return makeAnalysisLandFAT({
		fileName,
		workbookInfo,
		model,
		metaExtra: {
			parserId: "gndEdit",
			sourceBackend: dataset.source.backend,
			stage: "landFAT-with-gnd-attachments",
			sourceEnvelope: envelope,
			normalizedSourceLayer,
			sheetNames: workbookInfo.sheetNames,
			analysis: {
				padCount: model.stats.padCount,
				edgeCount: model.stats.edgeCount,
				sequenceSeedCount: model.stats.sequenceSeedCount,
				validSeedCount: model.stats.validSeedCount,
				rejectedSeedCount: model.stats.rejectedSeedCount,
				missingPlPadCount: model.stats.missingPlPadCount,
				coordGeomSequenceCount: model.stats.coordGeomSequenceCount,

				elCoordGeomCandidateCount: model.stats.elCoordGeomCandidateCount,
				elRejectedForCoordGeomCount: model.stats.elRejectedForCoordGeomCount,

				profileSequenceCount: model.stats.profileSequenceCount,
				uniquelyAttachableProfileSequenceCount: model.stats.uniquelyAttachableProfileSequenceCount,
				ambiguousProfileSequenceCount: model.stats.ambiguousProfileSequenceCount,
				rejectedProfileSeedCount: model.stats.rejectedProfileSeedCount,
				cantSequenceCount: model.stats.cantSequenceCount,
				uniquelyAttachableCantSequenceCount: model.stats.uniquelyAttachableCantSequenceCount,
				ambiguousCantSequenceCount: model.stats.ambiguousCantSequenceCount,
				rejectedCantSeedCount: model.stats.rejectedCantSeedCount,
				ekCoordGeomCandidateCount: model.stats.ekCoordGeomCandidateCount,
				ekRejectedForCoordGeomCount: model.stats.ekRejectedForCoordGeomCount,
			},
		},
	});
}

// -----------------------------------------------------------------------------
// analysis model
// -----------------------------------------------------------------------------

function buildAnalysisModel({ dataset }) {
	const sheets = dataset?.tables ?? {};

	const ppRows = arr(sheets[SHEET_NAMES.PP]);
	const plRows = arr(sheets[SHEET_NAMES.PL]);
	const phRows = arr(sheets[SHEET_NAMES.PH]);

	const elRows = arr(sheets[SHEET_NAMES.EL]);
	const ehRows = arr(sheets[SHEET_NAMES.EH]);
	const euRows = arr(sheets[SHEET_NAMES.EU]);
	const ekRows = arr(sheets[SHEET_NAMES.EK]);

	const padIndex = createGndPadIndex({ ppRows, plRows, phRows });

	const edgesByFamily = createGndEdgeIndex({
		elRows,
		ehRows,
		euRows,
		ekRows,
	});

	const {
		sequenceSeedsByFamily,
		validSequenceSeedsByFamily,
		rejectedSequenceSeedsByFamily,
		sequencesByFamily,
	} = buildGndSequences({
		edgesByFamily,
		padIndex,
		edgeFamilies: EDGE_FAMILIES,
		helpers: {
			buildSequenceSeed,
			isValidSeedForFamily,
			finalizeMergedSequence,
		},
	});

	const missingPlPads = collectMissingPlPads({ padIndex, edgesByFamily });

	const elCoordGeomCandidates = arr(sequencesByFamily.EL)
		.filter((seq) => isValidTypedSequence(seq, "coordGeom"))
		.map((seq) => {
			const typed = finalizeTypedSequence(seq, "coordGeom");
			const quality = assessCoordGeomSequenceQuality(typed);
			return { ...typed, quality };
		});

	const elCoordGeomSequences = elCoordGeomCandidates
		.filter((seq) => seq?.quality?.level !== "reject");

	const elRejectedForCoordGeom = elCoordGeomCandidates
		.filter((seq) => seq?.quality?.level === "reject");

	const ekCoordGeomCandidates = arr(sequencesByFamily.EK)
		.filter((seq) => isValidTypedSequence(seq, "coordGeom"))
		.map((seq) => {
			const typed = finalizeTypedSequence(seq, "coordGeom");
			const quality = assessCoordGeomSequenceQuality(typed);
			return { ...typed, quality };
		});

	const ekCoordGeomSequences = ekCoordGeomCandidates
		.filter(isLikelyCoordGeomEkSequence)
		.filter((seq) => seq?.quality?.level !== "reject");

	const ekRejectedForCoordGeom = ekCoordGeomCandidates
		.filter((seq) => !isLikelyCoordGeomEkSequence(seq) || seq?.quality?.level === "reject");

	const profileEvidenceGroups = classifyAttachmentEvidence({
		sequences: sequencesByFamily.EH,
		rejectedSeeds: rejectedSequenceSeedsByFamily.EH,
		type: "profile",
		family: "EH",
	});
	const cantEvidenceGroups = classifyAttachmentEvidence({
		sequences: sequencesByFamily.EU,
		rejectedSeeds: rejectedSequenceSeedsByFamily.EU,
		type: "cant",
		family: "EU",
	});
	const profileSequences = profileEvidenceGroups.unique;
	const cantSequences = cantEvidenceGroups.unique;

	const coordGeomSequences = [
		...elCoordGeomSequences,
		...ekCoordGeomSequences,
	].sort(compareTypedSequences);

	return {
		padIndex,

		rejectedSequenceSeedsByFamily,
		missingPlPads,

		coordGeomSequences,

		elRejectedForCoordGeom,
		ekRejectedForCoordGeom,

		profileSequences,
		cantSequences,
		ambiguousProfileSequences: profileEvidenceGroups.ambiguous,
		rejectedProfileSeeds: profileEvidenceGroups.rejected,
		ambiguousCantSequences: cantEvidenceGroups.ambiguous,
		rejectedCantSeeds: cantEvidenceGroups.rejected,

		stats: {
			padCount: Object.keys(padIndex).length,
			edgeCount: EDGE_FAMILIES.reduce((sum, f) => sum + arr(edgesByFamily[f]).length, 0),
			sequenceSeedCount: EDGE_FAMILIES.reduce((sum, f) => sum + arr(sequenceSeedsByFamily[f]).length, 0),
			validSeedCount: EDGE_FAMILIES.reduce((sum, f) => sum + arr(validSequenceSeedsByFamily[f]).length, 0),
			rejectedSeedCount: EDGE_FAMILIES.reduce((sum, f) => sum + arr(rejectedSequenceSeedsByFamily[f]).length, 0),

			ppCount: ppRows.length,
			plCount: plRows.length,
			phCount: phRows.length,
			elCount: elRows.length,
			ehCount: ehRows.length,
			euCount: euRows.length,
			ekCount: ekRows.length,

			missingPlPadCount: missingPlPads.length,

			coordGeomSequenceCount: coordGeomSequences.length,
			profileSequenceCount: profileEvidenceGroups.total,
			uniquelyAttachableProfileSequenceCount: profileSequences.length,
			ambiguousProfileSequenceCount: profileEvidenceGroups.ambiguous.length,
			rejectedProfileSeedCount: profileEvidenceGroups.rejected.length,
			cantSequenceCount: cantEvidenceGroups.total,
			uniquelyAttachableCantSequenceCount: cantSequences.length,
			ambiguousCantSequenceCount: cantEvidenceGroups.ambiguous.length,
			rejectedCantSeedCount: cantEvidenceGroups.rejected.length,

			elCoordGeomCandidateCount: elCoordGeomCandidates.length,
			elRejectedForCoordGeomCount: elRejectedForCoordGeom.length,

			ekCoordGeomCandidateCount: ekCoordGeomCandidates.length,
			ekRejectedForCoordGeomCount: ekRejectedForCoordGeom.length,
		},
	};
}

function classifyAttachmentEvidence({ sequences, rejectedSeeds, type, family }) {
	const unique = arr(sequences)
		.filter((seq) => isValidTypedSequence(seq, type))
		.map((seq) => finalizeTypedSequence(seq, type))
		.sort(compareTypedSequences);
	const ambiguous = arr(sequences)
		.filter((seq) => !isValidTypedSequence(seq, type))
		.map((seq) => finalizeTypedSequence(seq, type))
		.sort(compareTypedSequences);
	const rejected = arr(rejectedSeeds)
		.map((seed) => finalizeRejectedAttachmentSeed(seed, type, family))
		.sort(compareTypedSequences);
	return { unique, ambiguous, rejected, total: unique.length + ambiguous.length + rejected.length };
}

function finalizeRejectedAttachmentSeed(seed, type, family) {
	return {
		type,
		family,
		lsys: null,
		hsys: null,
		strecke: null,
		strRikz: null,
		stationStart: null,
		stationEnd: null,
		padStart: seed?.startPad ?? null,
		padEnd: seed?.endPad ?? null,
		seedCount: 1,
		seedIds: [seed?.id ?? null],
		edgeChain: arr(seed?.edgeChain),
		required: cloneRequiredMap(seed?.required),
		plKeys: Array.from(normalizeSet(seed?.candidates?.plKeys)).sort(),
		ppKeys: Array.from(normalizeSet(seed?.candidates?.ppKeys)).sort(),
		phKeys: Array.from(normalizeSet(seed?.candidates?.phKeys)).sort(),
		rejectionReason: getRejectedAttachmentReason(seed, family),
	};
}

function getRejectedAttachmentReason(seed, family) {
	if (family === "EH" && !asTrimmedString(seed?.required?.requiredHsys)) {
		return "missing-required-vertical-system-identifier";
	}
	return getAttachmentContextReason(seed?.candidates, family);
}

function getAttachmentContextReason(candidates, family) {
	const plCount = normalizeSet(candidates?.plKeys).size;
	const ppCount = normalizeSet(candidates?.ppKeys).size;
	if (plCount > 1) return "multiple-coordinate-reference-candidates";
	if (plCount === 0) return "no-coordinate-reference-candidate";
	if (ppCount > 1) return "multiple-station-reference-candidates";
	if (ppCount === 0) return "no-station-reference-candidate";
	if (family === "EH") {
		const phCount = normalizeSet(candidates?.phKeys).size;
		if (phCount > 1) return "multiple-vertical-reference-candidates";
		if (phCount === 0) return "no-vertical-reference-candidate";
	}
	return "no-unique-attachment-context";
}

// -----------------------------------------------------------------------------
// sequence seeds
// -----------------------------------------------------------------------------

function buildSequenceSeed(edge, padIndex) {
	const a = padIndex?.[edge.padA] ?? null;
	const b = padIndex?.[edge.padB] ?? null;

	const requiredLsys = asTrimmedString(edge?.required?.requiredLsys);
	const requiredHsys = asTrimmedString(edge?.required?.requiredHsys);

	return {
		id: `seq_${edge.id}`,
		edgeId: edge.id,
		family: edge.family,
		startPad: edge.padA,
		endPad: edge.padB,
		required: {
			requiredLsys,
			requiredHsys,
		},
		candidates: {
			ppKeys: intersectPpKeys(a, b),
			plKeys: intersectPlKeysByRequiredLsys(a, b, requiredLsys),
			phKeys: intersectPhKeysByRequiredHsys(a, b, requiredHsys),
		},
		edgeChain: [edge],
	};
}

// -----------------------------------------------------------------------------
// diagnostics
// -----------------------------------------------------------------------------

function collectMissingPlPads({ padIndex, edgesByFamily }) {
	const usedPads = new Map();

	for (const [family, edges] of Object.entries(edgesByFamily ?? {})) {
		for (const edge of arr(edges)) {
			for (const pad of [edge?.padA, edge?.padB]) {
				if (!pad) continue;

				if (!usedPads.has(pad)) {
					usedPads.set(pad, {
						pad,
						families: new Set(),
						edgeIds: new Set(),
						hasPL: false,
					});
				}

				const rec = usedPads.get(pad);
				rec.families.add(family);
				rec.edgeIds.add(edge?.id ?? null);

				const entry = padIndex?.[pad] ?? null;
				if ((entry?.refs?.PL?.length ?? 0) > 0) {
					rec.hasPL = true;
				}
			}
		}
	}

	return Array.from(usedPads.values())
		.filter((x) => !x.hasPL)
		.map((x) => ({
			pad: x.pad,
			families: Array.from(x.families).sort().join("+"),
			edgeCount: x.edgeIds.size,
		}))
		.sort((a, b) => a.pad.localeCompare(b.pad));
}

// -----------------------------------------------------------------------------
// seed validity
// -----------------------------------------------------------------------------

function isValidSeedForFamily(seed) {
	if (!seed?.family) return false;

	const cfg = getFamilyConfig(seed.family);

	for (const key of cfg.requiredKeys) {
		if (!asTrimmedString(seed?.required?.[key])) return false;
	}

	return hasAllFamilyCandidateKeys(seed?.candidates, seed.family);
}

function hasAllFamilyCandidateKeys(candidates, family) {
	const cfg = getFamilyConfig(family);

	for (const key of cfg.candidateKeys) {
		if (normalizeSet(candidates?.[key]).size === 0) return false;
	}

	return true;
}

function finalizeMergedSequence(seq, padIndex) {
	const ppTuple = pickSingleTuple(seq?.candidates?.ppKeys);
	const plLsys = pickSingleTuple(seq?.candidates?.plKeys);
	const phHsys = pickSingleTuple(seq?.candidates?.phKeys);

	const startNode = padIndex?.[seq?.startPad] ?? null;
	const endNode = padIndex?.[seq?.endPad] ?? null;

	const stationStartInfo = resolveStationFromPadNode(startNode, seq?.candidates?.ppKeys);
	const stationEndInfo = resolveStationFromPadNode(endNode, seq?.candidates?.ppKeys);

	return {
		family: seq?.family ?? null,
		required: cloneRequiredMap(seq?.required),
		candidates: cloneCandidateMap(seq?.candidates, seq?.family),

		lsys: plLsys?.lsys ?? null,
		hsys: phHsys?.hsys ?? null,
		strecke: ppTuple?.strecke ?? null,
		strRikz: ppTuple?.strRikz ?? null,

		stationStart: stationStartInfo.value,
		stationEnd: stationEndInfo.value,
		stationStartCount: stationStartInfo.count,
		stationEndCount: stationEndInfo.count,
		stationStartValues: stationStartInfo.values,
		stationEndValues: stationEndInfo.values,
		stationStartRefs: stationStartInfo.refs,
		stationEndRefs: stationEndInfo.refs,

		padStart: seq?.startPad ?? null,
		padEnd: seq?.endPad ?? null,

		seedCount: arr(seq?.seedIds).length,
		seedIds: arr(seq?.seedIds),
		edgeChain: arr(seq?.edgeChain),
	};
}

function cloneRequiredMap(required) {
	return {
		requiredLsys: asTrimmedString(required?.requiredLsys),
		requiredHsys: asTrimmedString(required?.requiredHsys),
	};
}

function cloneCandidateMap(candidates, family) {
	const out = {};
	const cfg = getFamilyConfig(family);

	for (const key of cfg.candidateKeys) {
		out[key] = normalizeSet(candidates?.[key]);
	}

	return out;
}

// -----------------------------------------------------------------------------
// typed sequence views
// -----------------------------------------------------------------------------

function isValidTypedSequence(seq, type) {
	if (!seq) return false;

	if (type === "coordGeom") {
		return (
			getCandidateCardinality(seq, "ppKeys") === 1 &&
			getCandidateCardinality(seq, "plKeys") === 1 &&
			seq.stationStartCount === 1 &&
			seq.stationEndCount === 1
		);
	}

	if (type === "profile") {
		return (
			getCandidateCardinality(seq, "ppKeys") === 1 &&
			getCandidateCardinality(seq, "plKeys") === 1 &&
			getCandidateCardinality(seq, "phKeys") === 1 &&
			seq.stationStartCount === 1 &&
			seq.stationEndCount === 1
		);
	}

	if (type === "cant") {
		return (
			getCandidateCardinality(seq, "ppKeys") === 1 &&
			getCandidateCardinality(seq, "plKeys") === 1 &&
			seq.stationStartCount === 1 &&
			seq.stationEndCount === 1
		);
	}

	return false;
}

function getCandidateCardinality(seq, key) {
	return normalizeSet(seq?.candidates?.[key]).size;
}

function finalizeTypedSequence(seq, type) {
	return {
		type,
		family: seq?.family ?? null,
		required: cloneRequiredMap(seq?.required),
		lsys: seq?.lsys ?? null,
		hsys: seq?.hsys ?? null,
		strecke: seq?.strecke ?? null,
		strRikz: seq?.strRikz ?? null,

		stationStart: toFiniteNumber(seq?.stationStart),
		stationEnd: toFiniteNumber(seq?.stationEnd),
		stationStartCount: Number(seq?.stationStartCount ?? 0),
		stationEndCount: Number(seq?.stationEndCount ?? 0),
		stationStartValues: arr(seq?.stationStartValues),
		stationEndValues: arr(seq?.stationEndValues),
		stationStartRefs: arr(seq?.stationStartRefs),
		stationEndRefs: arr(seq?.stationEndRefs),

		padStart: seq?.padStart ?? null,
		padEnd: seq?.padEnd ?? null,
		seedCount: Number(seq?.seedCount ?? 0),
		seedIds: arr(seq?.seedIds),

		edgeChain: arr(seq?.edgeChain),

		plKeys: Array.from(normalizeSet(seq?.candidates?.plKeys)).sort(),
		ppKeys: Array.from(normalizeSet(seq?.candidates?.ppKeys)).sort(),
		phKeys: Array.from(normalizeSet(seq?.candidates?.phKeys)).sort(),
	};
}

function compareTypedSequences(a, b) {
	const sequenceKey = (seq) => [
		String(seq?.type ?? ""),
		String(seq?.family ?? ""),
		String(seq?.lsys ?? ""),
		String(seq?.hsys ?? ""),
		String(seq?.strecke ?? ""),
		String(seq?.strRikz ?? ""),
		String(seq?.stationStart ?? ""),
		String(seq?.padStart ?? ""),
		String(seq?.padEnd ?? ""),
		arr(seq?.edgeChain).map((edge) => edge?.extras?.rowRef ?? edge?.id ?? "").sort().join(","),
	].join("|");
	return sequenceKey(a).localeCompare(sequenceKey(b));
}

// -----------------------------------------------------------------------------
// quality gate
// -----------------------------------------------------------------------------

function assessCoordGeomSequenceQuality(seq) {
	const issues = [];

	if (!seq?.lsys) issues.push("missing_lsys");

	if (!Number.isFinite(seq?.stationStart)) issues.push("bad_station_start");
	if (!Number.isFinite(seq?.stationEnd)) issues.push("bad_station_end");

	if (
		Number.isFinite(seq?.stationStart) &&
		Number.isFinite(seq?.stationEnd) &&
		seq.stationStart === seq.stationEnd
	) {
		issues.push("zero_station_span");
	}

	if (!seq?.strecke) {
		issues.push("missing_strecke");
	} else if (String(seq.strecke).trim() === "0") {
		issues.push("weak_strecke_zero");
	}

	if (!seq?.strRikz) issues.push("missing_strRikz");

	let level = "good";

	if (
		issues.includes("bad_station_start") ||
		issues.includes("bad_station_end") ||
		issues.includes("zero_station_span") ||
		issues.includes("missing_lsys")
	) {
		level = "reject";
	} else if (issues.length) {
		level = "weak";
	}

	return {
		ok: level === "good",
		level,
		issues,
	};
}

function isLikelyCoordGeomEkSequence(seq) {
	return !!seq &&
		seq.family === "EK" &&
		!!seq.lsys &&
		seq.stationStartCount === 1 &&
		seq.stationEndCount === 1 &&
		!arr(seq.edgeChain).some((edge) => Number(edge?.typeCode) === 6);
}

// -----------------------------------------------------------------------------
// console analysis
// -----------------------------------------------------------------------------

function logAnalysisToConsole(model, { fileName }) {
	console.group(`[GND/XLSX] analysis :: ${fileName}`);

	console.table([{
		padCount: model.stats.padCount,
		edgeCount: model.stats.edgeCount,
		sequenceSeedCount: model.stats.sequenceSeedCount,
		validSeedCount: model.stats.validSeedCount,
		rejectedSeedCount: model.stats.rejectedSeedCount,
		missingPlPadCount: model.stats.missingPlPadCount,
		coordGeomSequenceCount: model.stats.coordGeomSequenceCount,
		elCoordGeomCandidateCount: model.stats.elCoordGeomCandidateCount,
		elRejectedForCoordGeomCount: model.stats.elRejectedForCoordGeomCount,
		profileSequenceCount: model.stats.profileSequenceCount,
		cantSequenceCount: model.stats.cantSequenceCount,
		ekCoordGeomCandidateCount: model.stats.ekCoordGeomCandidateCount,
		ekRejectedForCoordGeomCount: model.stats.ekRejectedForCoordGeomCount,
	}]);

	if (model.missingPlPads?.length) {
		console.groupCollapsed("missing PL for used PADs");
		console.table(model.missingPlPads);
		console.groupEnd();
	}

	console.groupCollapsed("coordGeom sequences");
	console.table(model.coordGeomSequences);
	console.groupEnd();

	if (model.elRejectedForCoordGeom?.length) {
		console.groupCollapsed("EL rejected for coordGeom");
		console.table(model.elRejectedForCoordGeom.map((seq) => ({
			name: makeSequenceName(seq),
			level: seq?.quality?.level ?? null,
			issues: arr(seq?.quality?.issues).join(", "),
		})));
		console.groupEnd();
	}

	if (model.ekRejectedForCoordGeom?.length) {
		console.groupCollapsed("EK rejected for coordGeom");
		console.table(model.ekRejectedForCoordGeom.map((seq) => ({
			name: makeSequenceName(seq),
			level: seq?.quality?.level ?? null,
			issues: arr(seq?.quality?.issues).join(", "),
		})));
		console.groupEnd();
	}

	if (model.profileSequences?.length) {
		console.groupCollapsed("profile sequences");
		console.table(model.profileSequences);
		console.groupEnd();
	}

	if (model.cantSequences?.length) {
		console.groupCollapsed("cant sequences");
		console.table(model.cantSequences);
		console.groupEnd();
	}

	console.groupEnd();
}

// -----------------------------------------------------------------------------
// landFAT result
// -----------------------------------------------------------------------------

function makeSequenceName(seq) {
	return [
		seq?.strecke ?? "unknown",
		seq?.strRikz ?? "unknown",
		seq?.family ?? "EL",
		seq?.stationStart ?? "na",
		seq?.stationEnd ?? "na",
	].join("_");
}

const SUPPORTED_CONSTRUCTIVE_TYPES = new Set([0, 1, 2, 3, 4, 5, 7, 8]);
const TRANSITION_TYPES = new Set([2, 3, 4, 7, 8]);

function makeValueOrigin(origin, sourceField, extra = {}) {
	return { origin, sourceField, ...extra };
}

function makeDiagnostic({ severity = "warning", family, rowRef = null, field, value, decision, geometryUsable, code }) {
	return {
		code,
		severity,
		family,
		sheet: family ? `X_ASC${family === "EL" ? "21_EL" : family === "EH" ? "22_EH" : family === "EU" ? "23_EU" : "24_EK"}` : null,
		rowRef,
		field,
		value,
		decision,
		geometryUsable: geometryUsable === true,
	};
}

function assessConstructiveEdge(edge) {
	const family = edge?.family ?? "EL";
	const rowRef = edge?.extras?.rowRef ?? null;
	const typeCode = Number.isFinite(edge?.typeCode) ? Number(edge.typeCode) : null;
	if (!SUPPORTED_CONSTRUCTIVE_TYPES.has(typeCode)) {
		return makeDiagnostic({ severity: "error", family, rowRef, field: `${family}TYP`, value: typeCode, code: "unsupported-constructive-type", decision: "retain-unresolved-source-element", geometryUsable: false });
	}
	if (typeCode === 7 && !resolveGndType7TransitionId(edge)) {
		return makeDiagnostic({ severity: "error", family, rowRef, field: `${family}PAR2/${family}PAR3`, value: [edge?.radiusA ?? null, edge?.radiusE ?? null], code: "type7-halfwave-direction-unresolved", decision: "retain-unresolved-source-element; do-not-construct", geometryUsable: false });
	}
	if (TRANSITION_TYPES.has(typeCode) && Number.isFinite(edge?.radiusA) && Number.isFinite(edge?.radiusE) && Number(edge.radiusA) === Number(edge.radiusE)) {
		return makeDiagnostic({ severity: "error", family, rowRef, field: `${family}PAR2/${family}PAR3`, value: [Number(edge.radiusA), Number(edge.radiusE)], code: "equal-radius-transition-unresolved", decision: "retain-unresolved-source-element; do-not-coerce-to-curve", geometryUsable: false });
	}
	return null;
}

export function convertSequenceToTraLikeRecords(seq, padIndex) {
	const edges = arr(seq?.edgeChain);
	if (!edges.length) return [];

	const plKeys = seq?.plKeys ?? seq?.candidates?.plKeys;
	const ppKeys = seq?.ppKeys ?? seq?.candidates?.ppKeys;

	const records = [];

	for (const edge of edges) {
		const startPadNode = padIndex?.[edge?.padA] ?? null;
		const endPadNode = padIndex?.[edge?.padB] ?? null;

		const startCoord = resolvePadCoordFromPadNode(startPadNode, plKeys);
		const endCoord = resolvePadCoordFromPadNode(endPadNode, plKeys);

		const startStationInfo = resolveStationFromPadNode(startPadNode, ppKeys);
		const endStationInfo = resolveStationFromPadNode(endPadNode, ppKeys);

		const s0 = toFiniteNumber(startStationInfo?.value);
		const s1 = toFiniteNumber(endStationInfo?.value);

		if (!startCoord || !endCoord) {
			throw new Error(`edge ${edge?.id ?? "?"}: missing PL coordinates`);
		}

		if (!Number.isFinite(s0) || !Number.isFinite(s1)) {
			throw new Error(`edge ${edge?.id ?? "?"}: missing PP station`);
		}

		const hasSourceDirection = Number.isFinite(edge?.direction);
		const deltaEasting = endCoord.easting - startCoord.easting;
		const deltaNorthing = endCoord.northing - startCoord.northing;
		if (!hasSourceDirection && deltaEasting === 0 && deltaNorthing === 0) {
			throw new Error(`edge ${edge?.id ?? "?"}: direction cannot be derived from coincident endpoints`);
		}
		const direction =
			hasSourceDirection
				? Number(edge.direction)
				: (Math.atan2(deltaEasting, deltaNorthing) * 200 / Math.PI + 400) % 400;
		const hasSourceLength = Number.isFinite(edge?.arcLength);

		records.push({
			station: s0,
			easting: startCoord.easting,
			northing: startCoord.northing,
			direction,
			arcLength: hasSourceLength
				? Number(edge.arcLength)
				: s1 - s0,
			kindCode: Number.isFinite(edge?.typeCode) ? Number(edge.typeCode) : null,
			transitionType: Number(edge?.typeCode) === 7 ? resolveGndType7TransitionId(edge) : null,
			radiusA: Number.isFinite(edge?.radiusA) ? Number(edge.radiusA) : null,
			radiusE: Number.isFinite(edge?.radiusE) ? Number(edge.radiusE) : null,
			valueOrigins: {
				direction: hasSourceDirection
					? makeValueOrigin("source", `${edge.family}ARIWI`, { unit: "gon" })
					: makeValueOrigin("derived", "PL.Y/PL.X", { unit: "gon", rule: "normalize(atan2(deltaEasting, deltaNorthing) * 200 / PI, 0..400)" }),
				length: hasSourceLength
					? makeValueOrigin("source", `${edge.family}PAR1`, { unit: "meter" })
					: makeValueOrigin("derived", "PP.STATION", { unit: "meter", rule: "endStation - startStation" }),
				type: makeValueOrigin("source", `${edge.family}TYP`),
				radiusStart: makeValueOrigin(Number.isFinite(edge?.radiusA) ? "source" : "unresolved", `${edge.family}PAR2`, { unit: "meter" }),
				radiusEnd: makeValueOrigin(Number.isFinite(edge?.radiusE) ? "source" : "unresolved", `${edge.family}PAR3`, { unit: "meter" }),
			},
		});
	}

	const lastEdge = edges[edges.length - 1];
	const lastEndPadNode = padIndex?.[lastEdge?.padB] ?? null;
	const lastEndCoord = resolvePadCoordFromPadNode(lastEndPadNode, plKeys);
	const lastEndStationInfo = resolveStationFromPadNode(lastEndPadNode, ppKeys);
	const sEnd = toFiniteNumber(lastEndStationInfo?.value);

	if (!lastEndCoord) {
		throw new Error(`edge ${lastEdge?.id ?? "?"}: missing final PL coordinate`);
	}

	if (!Number.isFinite(sEnd)) {
		throw new Error(`edge ${lastEdge?.id ?? "?"}: missing final PP station`);
	}

	records.push({
		station: sEnd,
		easting: lastEndCoord.easting,
		northing: lastEndCoord.northing,
	});

	return records;
}

function buildCoordGeomAlignmentFromSequence({
	seq,
	index,
	fileName,
	padIndex,
	attachmentsByKey,
}) {
	const family = seq?.family ?? "EL";
	const strecke = seq?.strecke ?? "unknown";
	const strRikz = seq?.strRikz ?? "unknown";
	const lsys = seq?.lsys ?? null;
	const horizontalResolution = resolveGndCrsIdentifier(lsys);
	const stationStart = seq?.stationStart ?? null;
	const stationEnd = seq?.stationEnd ?? null;

	const name = makeSequenceName(seq);
	const attachmentKey = makeGndAttachmentKey(seq);

	const records = convertSequenceToTraLikeRecords(seq, padIndex);
	const gndSemanticMap = getTraLikeSemanticMapForGND();

	const coordGeom =
		records.length >= 2
			? buildCoordGeomFromTraLikeRecords(records, gndSemanticMap)
			: fat.createCoordGeom({ elements: [] });

	const attachments = attachmentsByKey?.get?.(attachmentKey) ?? null;

	return fat.createAlignment({
		id: `gnd.coordGeom.${index + 1}`,
		name,
		spatialRef: {
				status: horizontalResolution.status,
				crsId: horizontalResolution.resolvedEpsg ?? lsys ?? null,
				horizontalCrsId: horizontalResolution.resolvedEpsg ?? lsys ?? null,
				horizontalCoordinateSystemName: lsys,
				horizontal: lsys,
				source: "GND.LSYS",
				resolution: horizontalResolution,
				coordinateProvenance: "GND.PL:Y(easting),X(northing)",
				coordinatesAreAbsolute: true,
			},
		coordGeom,
		staEquations: null,
		profile: null,
		cant: null,
		extras: {
			source: {
				fileName: fileName ?? "",
				format: "gndEdit",
				sourceBackend: "xlsx",
			},
			sourceSemantics: {
				stage: "landFAT-with-gnd-attachments",
				note: "Safe horizontal GND sequence lifted into coordGeom. EH/EU source evidence remains non-constructive until completely decoded.",
			},
			gndTrust: {
				kind: "authoritative-context",
				crs: lsys ? "declared-from-LSYS" : "missing",
				attachments: {
					profile: attachments?.profile ? "unresolved" : "missing",
					cant: attachments?.cant ? "unresolved" : "missing",
				},
			},
			unresolvedAttachments: attachments,
			gndSequence: {
				type: "coordGeom",
				family,
				lsys,
				hsys: seq?.hsys ?? null,
				strecke,
				strRikz,
				stationStart,
				stationEnd,
				stationStartCount: seq?.stationStartCount ?? 0,
				stationEndCount: seq?.stationEndCount ?? 0,
				stationStartValues: arr(seq?.stationStartValues),
				stationEndValues: arr(seq?.stationEndValues),
				stationStartRefs: arr(seq?.stationStartRefs),
				stationEndRefs: arr(seq?.stationEndRefs),
				padStart: seq?.padStart ?? null,
				padEnd: seq?.padEnd ?? null,
				seedCount: seq?.seedCount ?? 0,
				seedIds: arr(seq?.seedIds),
				stationReferenceConfidence: Number(seq?.seedCount) === 1 ? "single-edge-unverified" : "multi-edge-cross-checked",
				recordCount: records.length,
				edgeChain: arr(seq?.edgeChain),
				quality: seq?.quality ?? null,
				attachmentKey,
			},
		},
	});
}

function buildUnresolvedAttachmentEvidence(seq, kind, fileName, { evidenceState = "unique", reason = null } = {}) {
	const family = kind === "profile" ? "EH" : "EU";
	const prefix = kind === "profile" ? "EHPAR" : "EUPAR";
	const candidateHorizontalReferenceSystems = arr(seq?.plKeys)
		.map(parseTupleKey)
		.map((tuple) => asTrimmedString(tuple?.lsys))
		.filter(Boolean)
		.sort();
	const candidateVerticalReferenceSystems = arr(seq?.phKeys)
		.map(parseTupleKey)
		.map((tuple) => asTrimmedString(tuple?.hsys))
		.filter(Boolean)
		.sort();
	const candidateStationContexts = arr(seq?.ppKeys)
		.map(parseTupleKey)
		.filter(Boolean)
		.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
	const isAmbiguous = evidenceState === "ambiguous";
	const isRejected = evidenceState === "rejected";
	const attachmentStatus = evidenceState === "unique" ? "uniquely-attachable" : `${evidenceState}-unattached`;
	const evidenceClass = evidenceState === "unique"
		? "unresolved-uniquely-attachable-evidence"
		: evidenceState === "ambiguous"
			? "ambiguous-unattached-source-evidence"
			: "rejected-unattached-source-evidence";
	return {
		kind,
		status: isRejected ? "rejected" : isAmbiguous ? "ambiguous" : "unresolved",
		evidenceClass,
		attachmentStatus,
		interpretationStatus: "not-interpreted",
		complete: false,
		constructive: false,
		message: isRejected
			? `${family} evidence was supplied but lacks the required reference candidates. It was preserved, not interpreted, and not attached.`
			: isAmbiguous
			? `${family} evidence was supplied. Its context is ambiguous. It was preserved, not interpreted, not attached, and not discarded.`
			: kind === "cant"
			? "Cant information is present but not decoded."
			: "Profile information is present but not completely decoded.",
		source: { fileName: fileName ?? "", family, format: "gndEdit" },
		sourceReferenceRequirements: cloneRequiredMap(seq?.required),
		padStart: seq?.padStart ?? null,
		padEnd: seq?.padEnd ?? null,
		candidateHorizontalReferenceSystems,
		candidateReferenceSystems: candidateHorizontalReferenceSystems,
		candidateVerticalReferenceSystems,
		candidateStationContexts,
		candidateReferenceKeys: {
			horizontal: arr(seq?.plKeys),
			vertical: arr(seq?.phKeys),
			station: arr(seq?.ppKeys),
		},
		ambiguityReason: isAmbiguous ? (reason ?? getAttachmentContextReason({ plKeys: seq?.plKeys, ppKeys: seq?.ppKeys, phKeys: seq?.phKeys }, family)) : null,
		rejectionReason: isRejected ? (reason ?? "missing-required-reference-candidates") : null,
		attachmentKey: evidenceState === "unique" ? makeGndAttachmentKey(seq) : null,
		sourceElements: arr(seq?.edgeChain).map((edge) => ({
			family,
			rowRef: edge?.extras?.rowRef ?? null,
			padStart: edge?.padA ?? null,
			padEnd: edge?.padB ?? null,
			typeCode: edge?.typeCode ?? null,
			parameters: {
				[`${prefix}1`]: edge?.parameters?.par1 ?? null,
				[`${prefix}2`]: edge?.parameters?.par2 ?? null,
				[`${prefix}3`]: edge?.parameters?.par3 ?? null,
				[`${prefix}4`]: edge?.parameters?.par4 ?? null,
			},
			valueOrigins: {
				type: makeValueOrigin(edge?.typeCode == null ? "unresolved" : "source", `${family}TYP`),
				par1: makeValueOrigin(edge?.parameters?.par1 == null ? "unresolved" : "source", `${prefix}1`),
				par2: makeValueOrigin(edge?.parameters?.par2 == null ? "unresolved" : "source", `${prefix}2`),
				par3: makeValueOrigin(edge?.parameters?.par3 == null ? "unresolved" : "source", `${prefix}3`),
				par4: makeValueOrigin(edge?.parameters?.par4 == null ? "unresolved" : "source", `${prefix}4`),
			},
		})),
	};
}

function diagnosticsForAttachment(evidence) {
	const diagnostics = [];
	for (const element of arr(evidence?.sourceElements)) {
		for (const [field, value] of Object.entries(element?.parameters ?? {})) {
			if (!Number.isFinite(value) || value === 0) continue;
			diagnostics.push(makeDiagnostic({ severity: "warning", family: element.family, rowRef: element.rowRef, field, value, code: "nonzero-source-field-not-decoded", decision: "retain-as-unresolved-evidence; do-not-construct", geometryUsable: true }));
		}
	}
	const state = evidence?.status ?? "unresolved";
	const family = evidence?.source?.family ?? "attachment";
	const diagnosticCode = family === "EU" && state === "ambiguous"
		? "cant-context-ambiguous-unattached"
		: `${String(family).toLowerCase()}-evidence-${state}`;
	diagnostics.push(makeDiagnostic({ severity: "warning", family, rowRef: evidence?.sourceElements?.[0]?.rowRef ?? null, field: evidence?.kind, value: { horizontal: evidence?.candidateHorizontalReferenceSystems ?? [], vertical: evidence?.candidateVerticalReferenceSystems ?? [], station: evidence?.candidateStationContexts ?? [] }, code: diagnosticCode, decision: evidence?.message, geometryUsable: true }));
	return diagnostics;
}

function makeGndAttachmentKey(seq) {
	return [
		seq?.strecke ?? "unknown",
		seq?.strRikz ?? "unknown",
		seq?.lsys ?? "unknown",
		stationKey(seq?.stationStart),
		stationKey(seq?.stationEnd),
	].join("|");
}

function stationKey(value) {
	const n = toFiniteNumber(value);
	if (!Number.isFinite(n)) return "na";
	return String(Number(n.toFixed(3)));
}

function makeAnalysisLandFAT({
	fileName,
	workbookInfo = null,
	model = null,
	metaExtra = {},
} = {}) {
	const diagnostics = [];
	const unresolvedAttachments = [
		...arr(model?.profileSequences).map((seq) => buildUnresolvedAttachmentEvidence(seq, "profile", fileName)),
		...arr(model?.cantSequences).map((seq) => buildUnresolvedAttachmentEvidence(seq, "cant", fileName)),
		...arr(model?.ambiguousProfileSequences).map((seq) => buildUnresolvedAttachmentEvidence(seq, "profile", fileName, {
			evidenceState: "ambiguous",
			reason: getAttachmentContextReason({ plKeys: seq?.plKeys, ppKeys: seq?.ppKeys, phKeys: seq?.phKeys }, "EH"),
		})),
		...arr(model?.rejectedProfileSeeds).map((seq) => buildUnresolvedAttachmentEvidence(seq, "profile", fileName, {
			evidenceState: "rejected",
			reason: seq?.rejectionReason ?? "missing-required-reference-candidates",
		})),
		...arr(model?.ambiguousCantSequences).map((seq) => buildUnresolvedAttachmentEvidence(seq, "cant", fileName, {
			evidenceState: "ambiguous",
			reason: getAttachmentContextReason({ plKeys: seq?.plKeys, ppKeys: seq?.ppKeys }, "EU"),
		})),
		...arr(model?.rejectedCantSeeds).map((seq) => buildUnresolvedAttachmentEvidence(seq, "cant", fileName, {
			evidenceState: "rejected",
			reason: seq?.rejectionReason ?? "missing-required-reference-candidates",
		})),
	];
	for (const evidence of unresolvedAttachments) diagnostics.push(...diagnosticsForAttachment(evidence));

	const attachmentsByKey = new Map();
	for (const evidence of unresolvedAttachments) {
		if (evidence?.attachmentStatus !== "uniquely-attachable" || !evidence?.attachmentKey) continue;
		const current = attachmentsByKey.get(evidence.attachmentKey) ?? {};
		const prior = current[evidence.kind];
		current[evidence.kind] = prior == null
			? evidence
			: Array.isArray(prior)
				? [...prior, evidence]
				: [prior, evidence];
		attachmentsByKey.set(evidence.attachmentKey, current);
	}

	const unresolvedSourceElements = [];
	const alignments = [];
	for (const [index, seq] of arr(model?.coordGeomSequences).entries()) {
		const edgeDiagnostics = arr(seq?.edgeChain).map(assessConstructiveEdge).filter(Boolean);
		if ((seq?.family === "EL" || seq?.family === "EK") && Number(seq?.seedCount) === 1) {
			diagnostics.push(makeDiagnostic({ severity: "warning", family: seq.family, rowRef: seq?.edgeChain?.[0]?.extras?.rowRef ?? null, field: "PP.STRECKE/PP.STRRIKZ", value: seq?.strRikz ?? null, code: "single-edge-station-reference-unverified", decision: "retain-and-construct; line identity (strRikz) rests on one PAD-node-pair match, never cross-checked by a second chained edge", geometryUsable: true }));
		}
		for (const edge of arr(seq?.edgeChain)) {
			const par4 = edge?.parameters?.par4;
			if (Number.isFinite(par4) && par4 !== 0) diagnostics.push(makeDiagnostic({ severity: "warning", family: edge.family, rowRef: edge?.extras?.rowRef ?? null, field: `${edge.family}PAR4`, value: par4, code: "nonzero-source-field-not-decoded", decision: "retain-as-source-evidence", geometryUsable: edgeDiagnostics.length === 0 }));
		}
		if (edgeDiagnostics.length) {
			diagnostics.push(...edgeDiagnostics);
			unresolvedSourceElements.push(...arr(seq?.edgeChain).map((edge) => ({ family: edge.family, rowRef: edge?.extras?.rowRef ?? null, typeCode: edge.typeCode, parameters: edge.parameters, decision: "not-constructed" })));
			continue;
		}
		try {
			alignments.push(buildCoordGeomAlignmentFromSequence({ seq, index, fileName, padIndex: model?.padIndex ?? null, attachmentsByKey }));
		} catch (error) {
			diagnostics.push(makeDiagnostic({ severity: "error", family: seq?.family ?? null, field: "coordGeom", value: String(error?.message ?? error), code: "constructive-interpretation-rejected", decision: "retain-source-sequence; do-not-construct", geometryUsable: false }));
			unresolvedSourceElements.push(...arr(seq?.edgeChain).map((edge) => ({ family: edge.family, rowRef: edge?.extras?.rowRef ?? null, typeCode: edge.typeCode, parameters: edge.parameters, decision: "not-constructed" })));
		}
	}

	const gndCrs = buildGndCoordinateSystem(model);

	return fat.createDocument({
		meta: {
			sourceFile: fileName ?? "",
			format: "gndEdit",
			parserId: "gndEdit",
			sourceBackend: "xlsx",
			stage: "landFAT-with-truthfulness-gate",
			sheetNames: workbookInfo?.sheetNames ?? [],
			diagnostics,
			...metaExtra,
		},
		units: {
			linearUnit: "meter",
			elevationUnit: "meter",
			angularUnit: "gon",
		},
		coordinateSystem: gndCrs.coordinateSystem,
		alignments,
		profiles: [],
		extras: {
			sourceSemantics: {
				format: "gndEdit",
				note: "Only safely interpreted horizontal GND sequences enter constructive geometry. Incomplete EH/EU and ambiguous horizontal elements remain unresolved source evidence.",
			},
			diagnostics,
			unresolvedAttachments,
			unresolvedSourceElements,
			gndCrs: gndCrs.extras,
			analysisModel: {
				stats: model?.stats ?? {},
				missingPlPads: model?.missingPlPads ?? [],
				rejectedSeedsByFamily: model?.rejectedSequenceSeedsByFamily ?? {},
				elRejectedForCoordGeom: model?.elRejectedForCoordGeom ?? [],
				ekRejectedForCoordGeom: model?.ekRejectedForCoordGeom ?? [],
			},
		},
	});
}

function buildGndCoordinateSystem(model) {
	const lsysValues = new Set();
	const hsysValues = new Set();

	for (const seq of [
		...arr(model?.coordGeomSequences),
		...arr(model?.profileSequences),
		...arr(model?.cantSequences),
	]) {
		const lsys = asTrimmedString(seq?.lsys);
		const hsys = asTrimmedString(seq?.hsys);
		if (lsys) lsysValues.add(lsys);
		if (hsys) hsysValues.add(hsys);
	}

	return {
		coordinateSystem: {
			horizontalCoordinateSystemName:
				lsysValues.size === 1 ? Array.from(lsysValues)[0] : null,
			verticalCoordinateSystemName:
				hsysValues.size === 1 ? Array.from(hsysValues)[0] : null,
		},
		extras: {
			status: lsysValues.size === 1 ? "declared" : "ambiguous_or_missing",
			horizontalCandidates: Array.from(lsysValues).sort(),
			verticalCandidates: Array.from(hsysValues).sort(),
			source: "GND.LSYS/HSYS",
		},
	};
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function getFamilyConfig(family) {
	return FAMILY_CONFIG[family] ?? { requiredKeys: [], candidateKeys: [] };
}

function arr(x) {
	return Array.isArray(x) ? x : [];
}

function asTrimmedString(v) {
	if (v == null) return null;
	const s = String(v).trim();
	return s || null;
}

function normalizeSet(x) {
	if (x instanceof Set) return new Set(Array.from(x).map(normalizeToken).filter(Boolean));
	if (Array.isArray(x)) return new Set(x.map(normalizeToken).filter(Boolean));
	return new Set();
}

function intersectSets(a, b) {
	const aa = normalizeSet(a);
	const bb = normalizeSet(b);

	if (!aa.size || !bb.size) return new Set();

	const out = new Set();

	for (const x of aa) {
		if (bb.has(x)) out.add(x);
	}

	return out;
}

function normalizeToken(v) {
	return asTrimmedString(v);
}

function makeTupleKey(obj) {
	return JSON.stringify(obj);
}

function parseTupleKey(v) {
	try {
		return JSON.parse(v);
	} catch {
		return null;
	}
}

function pickSingleTuple(setOrArray) {
	const s = normalizeSet(setOrArray);
	if (s.size !== 1) return null;
	return parseTupleKey(Array.from(s)[0]);
}

function toFiniteNumber(v) {
	if (typeof v === "number" && Number.isFinite(v)) return v;

	if (typeof v === "string") {
		const n = Number(v.replace(",", "."));
		if (Number.isFinite(n)) return n;
	}

	return null;
}

function compareStationStrings(a, b) {
	const na = toFiniteNumber(a);
	const nb = toFiniteNumber(b);

	if (Number.isFinite(na) && Number.isFinite(nb)) {
		return na - nb;
	}

	return String(a).localeCompare(String(b));
}

// -----------------------------------------------------------------------------
// tuple candidate builders
// -----------------------------------------------------------------------------

function getPadPpTupleSet(entry) {
	const out = new Set();

	for (const rec of arr(entry?.ppRecords)) {
		const strecke = asTrimmedString(rec?.strecke);
		const strRikz = asTrimmedString(rec?.strRikz);

		if (!strecke || !strRikz) continue;

		out.add(makeTupleKey({ strecke, strRikz }));
	}

	return out;
}

function getPadPlTupleSet(entry) {
	const out = new Set();

	for (const rec of arr(entry?.plRecords)) {
		const lsys = asTrimmedString(rec?.lsys);
		if (!lsys) continue;

		out.add(makeTupleKey({ lsys }));
	}

	return out;
}

function getPadPhTupleSet(entry) {
	const out = new Set();

	for (const rec of arr(entry?.phRecords)) {
		const hsys = asTrimmedString(rec?.hsys);
		if (!hsys) continue;

		out.add(makeTupleKey({ hsys }));
	}

	return out;
}

function intersectPpKeys(a, b) {
	return intersectSets(getPadPpTupleSet(a), getPadPpTupleSet(b));
}

function intersectPlKeysByRequiredLsys(a, b, requiredLsys) {
	const base = intersectSets(getPadPlTupleSet(a), getPadPlTupleSet(b));
	const req = asTrimmedString(requiredLsys);

	if (!req) return base;

	const out = new Set();

	for (const key of base) {
		const tuple = parseTupleKey(key);
		if (tuple?.lsys === req) out.add(key);
	}

	return out;
}

function intersectPhKeysByRequiredHsys(a, b, requiredHsys) {
	const base = intersectSets(getPadPhTupleSet(a), getPadPhTupleSet(b));
	const req = asTrimmedString(requiredHsys);

	if (!req) return base;

	const out = new Set();

	for (const key of base) {
		const tuple = parseTupleKey(key);
		if (tuple?.hsys === req) out.add(key);
	}

	return out;
}

// -----------------------------------------------------------------------------
// station / coord resolution from real records
// -----------------------------------------------------------------------------

function resolveStationFromPadNode(padNode, ppKeys) {
	const tuples = normalizeSet(ppKeys);
	const tupleList = Array.from(tuples)
		.map(parseTupleKey)
		.filter(Boolean);

	const stationMap = new Map();

	for (const rec of arr(padNode?.ppRecords)) {
		const recStrecke = asTrimmedString(rec?.strecke);
		const recStrRikz = asTrimmedString(rec?.strRikz);
		const recStation = asTrimmedString(rec?.station);
		const recRef = asTrimmedString(rec?.ref);

		if (recStation == null) continue;

		for (const tuple of tupleList) {
			if (
				recStrecke === asTrimmedString(tuple?.strecke) &&
				recStrRikz === asTrimmedString(tuple?.strRikz)
			) {
				if (!stationMap.has(recStation)) {
					stationMap.set(recStation, []);
				}
				stationMap.get(recStation).push(recRef);
			}
		}
	}

	const orderedStations = Array.from(stationMap.keys()).sort(compareStationStrings);

	const refs = orderedStations.flatMap((station) =>
		arr(stationMap.get(station)).map((ref) => ({
			station,
			ref,
		}))
	);

	return {
		count: orderedStations.length,
		values: orderedStations,
		value: orderedStations.length === 1 ? orderedStations[0] : null,
		refs,
	};
}

function resolvePadCoordFromPadNode(padNode, plKeys) {
	const tuples = normalizeSet(plKeys);
	const tupleList = Array.from(tuples)
		.map(parseTupleKey)
		.filter(Boolean);

	for (const rec of arr(padNode?.plRecords)) {
		const recLsys = asTrimmedString(rec?.lsys);

		for (const tuple of tupleList) {
			if (recLsys === asTrimmedString(tuple?.lsys)) {
				if (
					Number.isFinite(rec?.easting) &&
					Number.isFinite(rec?.northing)
				) {
					return {
						easting: rec.easting,
						northing: rec.northing,
						lsys: recLsys,
						ref: rec.ref ?? null,
					};
				}
			}
		}
	}

	return null;
}
