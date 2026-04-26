// src/import/parsers/technet/gndEdit/parseGND_XLSX.js
//
// GND Edit XLSX -> landFAT (Analyse-Stufe / SequenceBuilder)
//
// PHASE
// - XLSX via SheetJS lesen
// - relevante Satzarten-Sheets normalisieren
// - PAD-Kandidaten aus PP / PL / PH aufbauen
// - PAD-Index hält echte pp/pl/ph-Records als Mini-Datenbank
// - EL / EH / EU / EK als gerichtete Kanten lesen
// - jede Kante zunächst als Mini-Sequenz behandeln
// - Merge-Analyse nur innerhalb derselben Kantenfamilie
// - family-spezifische requiredKeys / candidateKeys
// - ungültige Seeds werden vor dem SequenceBuilder ausgesiebt
// - Sequenzen schrumpfen Kandidatenmengen nur nach "kleiner/gleich"
// - typed outputs nur bei eindeutiger Semantik
// - STATION wird direkt aus PP-Records per gefilterten ppKeys bestimmt
//
// Rückgabe an Pipeline:
// - gültiges landFAT
// - coordGeom-relevante Sequenzen aus EL und qualifiziertem EK
// - profile-Sequenzen aus EH als landFAT.profile
// - cant-Sequenzen aus EU als landFAT.cant
// - GND-Herkunft / CRS-Hinweise in extras, damit SPOT-Aufnahme entscheiden kann
//
// @baustelle [SEQUENCE-BUILDER]
// Noch keine echte topologische Netzmodellierung.
// Der Parser arbeitet weiterhin nur mit family-reinen Ketten.
//
// @baustelle [GND-COMPLETE-LANDFAT]
// profile / cant werden jetzt als landFAT-Anhängsel ausgegeben.
// Sparse/SPOT dürfen sie erst übernehmen, wenn die jeweilige Admission-Regel
// sie als vollständig / vertrauenswürdig bewertet.
//
// @baustelle [EK-QUALIFY]
// EK ist fachlich gemischt. Aktuell werden nur jene EK-Sequenzen weitergegeben,
// die dieselbe Mindeststruktur wie coordGeom-Kandidaten tragen UND nicht als
// Kilometer-Sprung (typeCode 6) erkannt werden.
//
// @baustelle [DIRECTED-GRAPH]
// Kanten werden als gerichtet behandelt. Keine Orientierungsnormalisierung.
//
// @baustelle [PL-PFLICHT]
// LSYS ist dominantes CRS. Fehlender PAD-Eintrag in PL macht eine Kante aktuell
// fachlich unbrauchbar. Dies wird implizit über leere plKeys => invalid seed erzwungen.
//
// @baustelle [SOURCE-BACKEND]
// Die fachliche Analyse arbeitet möglichst backend-neutral auf normalisierten
// Satzart-Records. Aktuell ist nur XLSX als physische Quelle angeschlossen.
// Später sollen dieselben Satzarten auch aus MDB / DBB o. ä. eingespeist werden,
// ohne die Kernlogik unten grundlegend umzubauen.
//
// @baustelle [RELATIONS]
// RouteProject / 7-Linien / Relations / Topology werden hier NICHT modelliert.
// Dieser Parser liefert nur importnahe landFAT-Hüllen für coordGeom-relevante Daten.
//
// @baustelle [TRA-LIKE-BRIDGE]
// EL/EK + PL + PP werden als verteilter TRA-like-Datensatz gelesen.
// Die eigentliche coordGeom-Erzeugung läuft deshalb bewusst über den gemeinsamen
// Helper buildCoordGeomFromTraLikeRecords().
//
// @baustelle [QUALITY-GATE]
// Formal coordGeom-fähige Sequenzen werden zusätzlich fachlich grob bewertet.
// Nur "good" wird direkt als landFAT.coordGeom-Alignment ausgegeben.
// "weak" / "reject" bleiben diagnostisch sichtbar.

import * as XLSX from "sheetjs";
import * as fat from "@kimport/landfat/landFatWriter.js";

import {
	buildCoordGeomFromTraLikeRecords,
} from "../shared/traLikeCoordGeom.js";
import {
	getTraLikeSemanticMapForGND,
} from "../shared/traLikeSemanticMaps.js";

import {
	TECHNET_SHEET_NAMES as SHEET_NAMES,
	TECHNET_EDGE_FAMILIES as EDGE_FAMILIES,
} from "../sharedTechnet.js";

const DEBUG_GND_ANALYSIS_DEFAULT = false;

// -----------------------------------------------------------------------------
// family config
// -----------------------------------------------------------------------------

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

	const arrayBuffer =
	bytes instanceof Uint8Array
	? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
	: bytes instanceof ArrayBuffer
	? bytes
	: file
	? await file.arrayBuffer()
	: null;

	if (!arrayBuffer) {
		throw new Error("parseGND_XLSX: missing bytes/arrayBuffer");
	}

	const wb = XLSX.read(arrayBuffer, {
		type: "array",
		cellDates: false,
		raw: false,
	});

	const workbookInfo = summarizeWorkbook(wb);

	const debugGndAnalysis =
	context?.debugGndAnalysis === true ||
	context?.debugImport === true ||
	DEBUG_GND_ANALYSIS_DEFAULT;

	if (debugGndAnalysis) {
		console.groupCollapsed(`[GND/XLSX] workbook :: ${fileName}`);
		console.log("sheetNames:", workbookInfo.sheetNames);
		console.log("sheetCount:", workbookInfo.sheetCount);
		console.groupEnd();
	}

	const sheets = readRelevantSheets(wb);
	const model = buildAnalysisModel({ sheets });

	if (debugGndAnalysis) {
		logAnalysisToConsole(model, { fileName });
	}

	return makeAnalysisLandFAT({
		fileName,
		workbookInfo,
		model,
		metaExtra: {
			parserId: "gndEdit",
			sourceBackend: "xlsx",
			stage: "landFAT-with-gnd-attachments",
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
				cantSequenceCount: model.stats.cantSequenceCount,
				ekCoordGeomCandidateCount: model.stats.ekCoordGeomCandidateCount,
				ekRejectedForCoordGeomCount: model.stats.ekRejectedForCoordGeomCount,
			},
		},
	});
}

// -----------------------------------------------------------------------------
// workbook / sheet loading
// -----------------------------------------------------------------------------

function summarizeWorkbook(wb) {
	const sheetNames = Array.isArray(wb?.SheetNames) ? wb.SheetNames.slice() : [];
	return { sheetNames, sheetCount: sheetNames.length };
}

function readRelevantSheets(wb) {
	const out = {};
	for (const name of Object.values(SHEET_NAMES)) {
		const ws = wb?.Sheets?.[name] ?? null;
		out[name] = ws ? sheetToObjects(ws, name) : [];
	}
	return out;
}

function sheetToObjects(ws, sheetName) {
	const rows = XLSX.utils.sheet_to_json(ws, {
		defval: null,
		raw: false,
		blankrows: false,
	});

	return rows.map((row, index) =>
	normalizeRow(row, { sheetName, rowIndex: index + 2 })
	);
}

function normalizeRow(row, { sheetName, rowIndex }) {
	const out = {};
	for (const [k, v] of Object.entries(row ?? {})) {
		out[String(k ?? "").trim()] = normalizeCellValue(v);
	}
	out.__sheet = sheetName;
	out.__rowIndex = rowIndex;
	return out;
}

function normalizeCellValue(v) {
	if (v == null) return null;

	if (typeof v === "string") {
		const s = v.trim();
		if (!s) return null;

		if (/^[+-]?\d+(?:[.,]\d+)?$/.test(s)) {
			const n = Number(s.replace(",", "."));
			if (Number.isFinite(n)) return n;
		}

		return s;
	}

	if (typeof v === "number") return Number.isFinite(v) ? v : null;
	if (typeof v === "boolean") return v;

	return v;
}

// -----------------------------------------------------------------------------
// analysis model
// -----------------------------------------------------------------------------

function buildAnalysisModel({ sheets }) {
	const ppRows = arr(sheets[SHEET_NAMES.PP]);
	const plRows = arr(sheets[SHEET_NAMES.PL]);
	const phRows = arr(sheets[SHEET_NAMES.PH]);

	const elRows = arr(sheets[SHEET_NAMES.EL]);
	const ehRows = arr(sheets[SHEET_NAMES.EH]);
	const euRows = arr(sheets[SHEET_NAMES.EU]);
	const ekRows = arr(sheets[SHEET_NAMES.EK]);

	const padIndex = buildPadCandidateIndex({ ppRows, plRows, phRows });

	const edgesByFamily = {
		EL: buildEdgesFromSheet(elRows, "EL"),
		EH: buildEdgesFromSheet(ehRows, "EH"),
		EU: buildEdgesFromSheet(euRows, "EU"),
		EK: buildEdgesFromSheet(ekRows, "EK"),
	};

	const sequenceSeedsByFamily = Object.fromEntries(
	EDGE_FAMILIES.map((family) => [
	family,
	arr(edgesByFamily[family]).map((edge) => buildSequenceSeed(edge, padIndex)),
	])
	);

	const validSequenceSeedsByFamily = Object.fromEntries(
	EDGE_FAMILIES.map((family) => [
	family,
	arr(sequenceSeedsByFamily[family]).filter(isValidSeedForFamily),
	])
	);

	const rejectedSequenceSeedsByFamily = Object.fromEntries(
	EDGE_FAMILIES.map((family) => [
	family,
	arr(sequenceSeedsByFamily[family]).filter((seed) => !isValidSeedForFamily(seed)),
	])
	);

	const missingPlPads = collectMissingPlPads({ padIndex, edgesByFamily });
	const sequencesByFamily = buildMergedSequences(validSequenceSeedsByFamily, padIndex);

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

	// EH wird als Höhen-/Profilebene in landFAT.profile ausgegeben.
	const profileSequences = arr(sequencesByFamily.EH)
		.filter((seq) => isValidTypedSequence(seq, "profile"))
		.map((seq) => finalizeTypedSequence(seq, "profile"))
		.sort(compareTypedSequences);

	// EU wird als Querneigungs-/Cant-Ebene in landFAT.cant ausgegeben.
	const cantSequences = arr(sequencesByFamily.EU)
		.filter((seq) => isValidTypedSequence(seq, "cant"))
		.map((seq) => finalizeTypedSequence(seq, "cant"))
		.sort(compareTypedSequences);

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
			profileSequenceCount: profileSequences.length,
			cantSequenceCount: cantSequences.length,

			elCoordGeomCandidateCount: elCoordGeomCandidates.length,
			elRejectedForCoordGeomCount: elRejectedForCoordGeom.length,

			ekCoordGeomCandidateCount: ekCoordGeomCandidates.length,
			ekRejectedForCoordGeomCount: ekRejectedForCoordGeom.length,
		},
	};
}

// -----------------------------------------------------------------------------
// PAD candidate index / mini database
// -----------------------------------------------------------------------------

function buildPadCandidateIndex({ ppRows, plRows, phRows }) {
	const index = Object.create(null);

	for (const row of ppRows) {
		const pad = readPad(row, "PAD");
		if (!pad) continue;

		const entry = ensurePadEntry(index, pad);

		entry.ppRecords.push({
			strecke: asTrimmedString(row.STRECKE ?? row.PSTRECKE),
			strRikz: asTrimmedString(row.STRRIKZ ?? row.PSTRRIKZ),
			station: asTrimmedString(row.STATION),
			ref: refOf(row),
		});

		entry.refs.PP.push(refOf(row));
	}

	for (const row of plRows) {
		const pad = readPad(row, "PAD");
		if (!pad) continue;

		const entry = ensurePadEntry(index, pad);

		entry.plRecords.push({
			lsys: asTrimmedString(row.LSYS),

			// @baustelle [SURVEY-AXES]
			// Vermessungswelt / Technet:
			// Y = Easting / Rechtswert
			// X = Northing / Hochwert
			easting: toFiniteNumber(row.Y),
			northing: toFiniteNumber(row.X),

			ref: refOf(row),
		});

		entry.refs.PL.push(refOf(row));
	}

	for (const row of phRows) {
		const pad = readPad(row, "PAD");
		if (!pad) continue;

		const entry = ensurePadEntry(index, pad);

		entry.phRecords.push({
			hsys: asTrimmedString(row.HSYS),
			elevation: toFiniteNumber(row.H),
			ref: refOf(row),
		});

		entry.refs.PH.push(refOf(row));
	}

	return index;
}

function ensurePadEntry(index, pad) {
	if (!index[pad]) {
		index[pad] = {
			pad,
			ppRecords: [],
			plRecords: [],
			phRecords: [],
			refs: { PP: [], PL: [], PH: [] },
		};
	}
	return index[pad];
}

// -----------------------------------------------------------------------------
// edges / seeds
// -----------------------------------------------------------------------------

function buildEdgesFromSheet(rows, family) {
	return arr(rows)
	.map((row, i) => buildEdge(row, family, i))
	.filter(Boolean);
}

function buildEdge(row, family, rowIndex) {
	const padA = readPad(row, "PAD1");
	const padB = readPad(row, "PAD2");

	if (!padA || !padB) return null;

	return {
		id: `${family}_${rowIndex + 1}`,
		family,
		padA,
		padB,
		required: {
			requiredLsys:
			family === "EL" ? valOrNull(row.ELSYS)
			: family === "EK" ? valOrNull(row.EKSYS)
			: null,

			requiredHsys:
			family === "EH" ? valOrNull(row.EHSYS)
			: null,
		},

		// @baustelle [TRA-LIKE-FIELDS]
		// Diese Felder bilden den verteilten TRA-like-Kern von EL/EK.
		typeCode:
		family === "EL" ? toFiniteNumber(row.ELTYP)
		: family === "EK" ? toFiniteNumber(row.EKTYP)
		: null,

		arcLength:
		family === "EL" ? toFiniteNumber(row.ELPAR1)
		: family === "EK" ? toFiniteNumber(row.EKPAR1)
		: null,

		radiusA:
		family === "EL" ? toFiniteNumber(row.ELPAR2)
		: family === "EK" ? toFiniteNumber(row.EKPAR2)
		: null,

		radiusE:
		family === "EL" ? toFiniteNumber(row.ELPAR3)
		: family === "EK" ? toFiniteNumber(row.EKPAR3)
		: null,

		direction:
		family === "EL" ? toFiniteNumber(row.ELARIWI)
		: family === "EK" ? toFiniteNumber(row.EKARIWI)
		: null,

		extras: {
			rowRef: refOf(row),

			// @baustelle [EK-KM-FIELDS]
			// Für coordGeom aktuell noch nicht genutzt.
			// Für spätere staEquation-/kmLine-Auswertung aber ausdrücklich mitgeführt.
			kmStart: family === "EK" ? toFiniteNumber(row.EKAKM) : null,
			kmEnd: family === "EK" ? toFiniteNumber(row.EKEKM) : null,
		},
	};
}

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

		// @baustelle [EDGE-CHAIN]
		// SequenceBuilder trägt jetzt die fachlich relevanten Edge-Rohdaten mit,
		// damit später echte TRA-like Records gebaut werden können.
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

// -----------------------------------------------------------------------------
// merged sequences
// -----------------------------------------------------------------------------

function buildMergedSequences(validSequenceSeedsByFamily, padIndex) {
	const out = {};

	for (const family of EDGE_FAMILIES) {
		out[family] = mergeSeedsWithinFamily(
		arr(validSequenceSeedsByFamily?.[family]),
		family,
		padIndex
		);
	}

	return out;
}

function mergeSeedsWithinFamily(seeds, family, padIndex) {
	const remaining = seeds.slice();
	const merged = [];

	while (remaining.length) {
		const start = remaining.shift();
		const seq = makeGrowingSequence(start, family);

		let changed = true;

		while (changed) {
			changed = false;

			for (let i = 0; i < remaining.length; i++) {
				const cand = remaining[i];

				const appendProbe = canAppendSeedToSequence(seq, cand);
				if (appendProbe.ok) {
					applyAppendSeedToSequence(seq, cand, appendProbe);
					remaining.splice(i, 1);
					changed = true;
					break;
				}

				const prependProbe = canPrependSeedToSequence(seq, cand);
				if (prependProbe.ok) {
					applyPrependSeedToSequence(seq, cand, prependProbe);
					remaining.splice(i, 1);
					changed = true;
					break;
				}
			}
		}

		merged.push(finalizeMergedSequence(seq, padIndex));
	}

	return merged.sort(compareMergedSequences);
}

function makeGrowingSequence(seed, family) {
	return {
		family,
		seedIds: [seed?.id ?? null],
		startPad: seed?.startPad ?? null,
		endPad: seed?.endPad ?? null,
		required: cloneRequiredMap(seed?.required),
		candidates: cloneCandidateMap(seed?.candidates, family),
		edgeChain: arr(seed?.edgeChain),
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

function mergeSequenceCandidates(seqCandidates, seedCandidates, family) {
	const out = {};
	const cfg = getFamilyConfig(family);

	for (const key of cfg.candidateKeys) {
		out[key] = intersectSets(seqCandidates?.[key], seedCandidates?.[key]);
	}

	return out;
}

function mergeRequired(seqRequired, seedRequired, family) {
	const cfg = getFamilyConfig(family);
	const out = cloneRequiredMap(seqRequired);

	for (const key of cfg.requiredKeys) {
		const a = asTrimmedString(seqRequired?.[key]);
		const b = asTrimmedString(seedRequired?.[key]);

		if (a !== b) return null;
		out[key] = a;
	}

	return out;
}

function canAppendSeedToSequence(seq, seed) {
	if (!seq || !seed) return { ok: false };
	if (seq.family !== seed.family) return { ok: false };
	if (seq.endPad !== seed.startPad) return { ok: false };

	const mergedRequired = mergeRequired(seq.required, seed.required, seq.family);
	if (!mergedRequired) return { ok: false };

	const mergedCandidates = mergeSequenceCandidates(seq.candidates, seed.candidates, seq.family);
	if (!hasAllFamilyCandidateKeys(mergedCandidates, seq.family)) return { ok: false };

	return {
		ok: true,
		required: mergedRequired,
		candidates: mergedCandidates,
	};
}

function canPrependSeedToSequence(seq, seed) {
	if (!seq || !seed) return { ok: false };
	if (seq.family !== seed.family) return { ok: false };
	if (seed.endPad !== seq.startPad) return { ok: false };

	const mergedRequired = mergeRequired(seq.required, seed.required, seq.family);
	if (!mergedRequired) return { ok: false };

	const mergedCandidates = mergeSequenceCandidates(seq.candidates, seed.candidates, seq.family);
	if (!hasAllFamilyCandidateKeys(mergedCandidates, seq.family)) return { ok: false };

	return {
		ok: true,
		required: mergedRequired,
		candidates: mergedCandidates,
	};
}

function applyAppendSeedToSequence(seq, seed, probe) {
	seq.seedIds.push(seed?.id ?? null);
	seq.endPad = seed?.endPad ?? seq.endPad;
	seq.required = probe.required;
	seq.candidates = probe.candidates;
	seq.edgeChain.push(...arr(seed?.edgeChain));
}

function applyPrependSeedToSequence(seq, seed, probe) {
	seq.seedIds.unshift(seed?.id ?? null);
	seq.startPad = seed?.startPad ?? seq.startPad;
	seq.required = probe.required;
	seq.candidates = probe.candidates;
	seq.edgeChain.unshift(...arr(seed?.edgeChain));
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

function compareMergedSequences(a, b) {
	return [
	String(a?.family ?? ""),
	String(a?.lsys ?? ""),
	String(a?.hsys ?? ""),
	String(a?.strecke ?? ""),
	String(a?.strRikz ?? ""),
	String(a?.stationStart ?? ""),
	].join("|").localeCompare([
	String(b?.family ?? ""),
	String(b?.lsys ?? ""),
	String(b?.hsys ?? ""),
	String(b?.strecke ?? ""),
	String(b?.strRikz ?? ""),
	String(b?.stationStart ?? ""),
	].join("|"));
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

		// @baustelle [EDGE-CHAIN]
		// Typed sequence bleibt weiterhin diagnosefreundlich.
		edgeChain: arr(seq?.edgeChain),

		plKeys: Array.from(normalizeSet(seq?.candidates?.plKeys)),
		ppKeys: Array.from(normalizeSet(seq?.candidates?.ppKeys)),
		phKeys: Array.from(normalizeSet(seq?.candidates?.phKeys)),
	};
}

function compareTypedSequences(a, b) {
	return [
	String(a?.type ?? ""),
	String(a?.family ?? ""),
	String(a?.lsys ?? ""),
	String(a?.hsys ?? ""),
	String(a?.strecke ?? ""),
	String(a?.strRikz ?? ""),
	String(a?.stationStart ?? ""),
	].join("|").localeCompare([
	String(b?.type ?? ""),
	String(b?.family ?? ""),
	String(b?.lsys ?? ""),
	String(b?.hsys ?? ""),
	String(b?.strecke ?? ""),
	String(b?.strRikz ?? ""),
	String(b?.stationStart ?? ""),
	].join("|"));
}

// -----------------------------------------------------------------------------
// quality gate
// -----------------------------------------------------------------------------

function assessCoordGeomSequenceQuality(seq) {
	const issues = [];

	if (!seq?.lsys) {
		issues.push("missing_lsys");
	}

	if (!Number.isFinite(seq?.stationStart)) {
		issues.push("bad_station_start");
	}

	if (!Number.isFinite(seq?.stationEnd)) {
		issues.push("bad_station_end");
	}

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

	if (!seq?.strRikz) {
		issues.push("missing_strRikz");
	}

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
	// @baustelle [EK-QUALIFY]
	// Vorläufig konservativ:
	// - EK nur weiterreichen, wenn LSYS eindeutig ist
	// - Start/End-Station jeweils eindeutig
	// - dieselbe Grundstruktur wie coordGeom-Kandidaten
	// - keine offensichtliche staEquation-Kette (typeCode 6)
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

	// @baustelle [DIAGNOSTIC-ONLY]
	// EH / EU aktuell nur zum Überblick.
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

function convertSequenceToTraLikeRecords(seq, padIndex) {
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

		const direction =
			Number.isFinite(edge?.direction)
				? Number(edge.direction)
				: Math.atan2(
					endCoord.easting - startCoord.easting,
					endCoord.northing - startCoord.northing
				);

		records.push({
			station: s0,
			easting: startCoord.easting,
			northing: startCoord.northing,
			direction,
			arcLength: Number.isFinite(edge?.arcLength)
				? Number(edge.arcLength)
				: (s1 - s0),
			kindCode: Number.isFinite(edge?.typeCode) ? Number(edge.typeCode) : null,
			radiusA: Number.isFinite(edge?.radiusA) ? Number(edge.radiusA) : null,
			radiusE: Number.isFinite(edge?.radiusE) ? Number(edge.radiusE) : null,
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

function buildCoordGeomAlignmentFromSequence({ seq, index, fileName, padIndex, profilesByKey, cantsByKey }) {
	const family = seq?.family ?? "EL";
	const strecke = seq?.strecke ?? "unknown";
	const strRikz = seq?.strRikz ?? "unknown";
	const lsys = seq?.lsys ?? null;
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

	const profile = profilesByKey?.get?.(attachmentKey) ?? null;
	const cant = cantsByKey?.get?.(attachmentKey) ?? null;

	return fat.createAlignment({
		id: `gnd.coordGeom.${index + 1}`,
		name,
	spatialRef: lsys

	? {
		status: "declared",
		horizontalCrsId: lsys,
		horizontalCoordinateSystemName: lsys,
		horizontal: lsys,
		source: "GND.LSYS",
	}
	: null,
	coordGeom,
		staEquations: null,
		profile,
		cant: cant ? cant.entries : null,
		extras: {
			source: {
				fileName: fileName ?? "",
				format: "gndEdit",
				sourceBackend: "xlsx",
			},
			sourceSemantics: {
				stage: "landFAT-with-gnd-attachments",
				note: "Sequence was derived from GND edge families and lifted through TRA-like record synthesis into coordGeom. Matching EH/EU sequences are attached when unambiguous.",
			},
			gndTrust: {
				kind: "authoritative-context",
				crs: lsys ? "declared-from-LSYS" : "missing",
				attachments: {
					profile: profile ? "declared" : "missing",
					cant: cant ? "declared" : "missing",
				},
			},
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
				recordCount: records.length,
				edgeChain: arr(seq?.edgeChain),
				quality: seq?.quality ?? null,
				attachmentKey,
			},
		},
	});
}

function buildProfileFromSequence(seq, index, fileName, padIndex) {
	const name = makeSequenceName(seq);
	const attachmentKey = makeGndAttachmentKey(seq);
	const pvis = convertProfileSequenceToPvis(seq, padIndex);

	return {
		id: `gnd.profile.${index + 1}`,
		type: "Profile",
		name: `${name}_PROFILE`,
		desc: "Profile derived from GND EH sequence",
		profAlign: {
			id: `gnd.profAlign.${index + 1}`,
			type: "ProfAlign",
			name: `${name}_PROFALIGN`,
			desc: "Generated from GND EH + PP/PH records",
			pvis,
			paraCurves: [],
		},
		extras: {
			source: {
				fileName: fileName ?? "",
				format: "gndEdit",
				sourceBackend: "xlsx",
			},
			gndSequence: {
				type: "profile",
				family: seq?.family ?? null,
				lsys: seq?.lsys ?? null,
				hsys: seq?.hsys ?? null,
				strecke: seq?.strecke ?? null,
				strRikz: seq?.strRikz ?? null,
				stationStart: seq?.stationStart ?? null,
				stationEnd: seq?.stationEnd ?? null,
				padStart: seq?.padStart ?? null,
				padEnd: seq?.padEnd ?? null,
				seedCount: seq?.seedCount ?? 0,
				seedIds: arr(seq?.seedIds),
				edgeChain: arr(seq?.edgeChain),
				attachmentKey,
			},
		},
	};
}

function buildCantFromSequence(seq, index, fileName) {
	const name = makeSequenceName(seq);
	const attachmentKey = makeGndAttachmentKey(seq);
	const entries = convertCantSequenceToEntries(seq);

	return {
		id: `gnd.cant.${index + 1}`,
		type: "Cant",
		name: `${name}_CANT`,
		entries,
		extras: {
			source: {
				fileName: fileName ?? "",
				format: "gndEdit",
				sourceBackend: "xlsx",
			},
			gndSequence: {
				type: "cant",
				family: seq?.family ?? null,
				lsys: seq?.lsys ?? null,
				strecke: seq?.strecke ?? null,
				strRikz: seq?.strRikz ?? null,
				stationStart: seq?.stationStart ?? null,
				stationEnd: seq?.stationEnd ?? null,
				padStart: seq?.padStart ?? null,
				padEnd: seq?.padEnd ?? null,
				seedCount: seq?.seedCount ?? 0,
				seedIds: arr(seq?.seedIds),
				edgeChain: arr(seq?.edgeChain),
				attachmentKey,
			},
		},
	};
}

function convertProfileSequenceToPvis(seq, padIndex) {
	const phKeys = seq?.phKeys ?? seq?.candidates?.phKeys;
	const startNode = padIndex?.[seq?.padStart] ?? null;
	const endNode = padIndex?.[seq?.padEnd] ?? null;

	const startElevation = resolveElevationFromPadNode(startNode, phKeys);
	const endElevation = resolveElevationFromPadNode(endNode, phKeys);

	return [
		makePvi(seq?.stationStart, startElevation?.value, startElevation?.ref),
		makePvi(seq?.stationEnd, endElevation?.value, endElevation?.ref),
	].filter(Boolean);
}

function makePvi(station, elevation, ref) {
	const s = makeMeasure(station, "meter");
	const h = makeMeasure(elevation, "meter");

	if (!s || !h) return null;

	return {
		station: s,
		elevation: h,
		extras: {
			rowRef: ref ?? null,
		},
	};
}

function convertCantSequenceToEntries(seq) {
	return [
		makeCantStation(seq?.stationStart, seq, "start"),
		makeCantStation(seq?.stationEnd, seq, "end"),
	].filter(Boolean);
}

function makeCantStation(station, seq, position) {
	const s = makeMeasure(station, "meter");
	if (!s) return null;

	return {
		type: "CantStation",
		station: s,
		appliedCant: makeMeasure(0, "meter"),
		transitionType: null,
		curvature: null,
		extras: {
			position,
			note: "GND EU sequence identified; appliedCant value is currently a neutral placeholder until EU parameter decoding is completed.",
			family: seq?.family ?? null,
			edgeChain: arr(seq?.edgeChain),
		},
	};
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

function makeSequenceMapByAttachmentKey(list) {
	const map = new Map();

	for (const item of arr(list)) {
		const key = item?.extras?.gndSequence?.attachmentKey ?? null;
		if (!key) continue;
		if (!map.has(key)) map.set(key, item);
	}

	return map;
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
	const profiles = arr(model?.profileSequences).map((seq, index) =>
		buildProfileFromSequence(seq, index, fileName, model?.padIndex ?? null)
	);

	const cants = arr(model?.cantSequences).map((seq, index) =>
		buildCantFromSequence(seq, index, fileName)
	);

	const profilesByKey = makeSequenceMapByAttachmentKey(profiles);
	const cantsByKey = makeSequenceMapByAttachmentKey(cants);

	const alignments = arr(model?.coordGeomSequences).map((seq, index) =>
		buildCoordGeomAlignmentFromSequence({
			seq,
			index,
			fileName,
			padIndex: model?.padIndex ?? null,
			profilesByKey,
			cantsByKey,
		})
	);

	const gndCrs = buildGndCoordinateSystem(model);

	return fat.createDocument({
		meta: {
			sourceFile: fileName ?? "",
			format: "gndEdit",
			parserId: "gndEdit",
			sourceBackend: "xlsx",

			// @baustelle [SOURCE-BACKEND]
			// Fachlich sollte der Parser später auch mit MDB / DBB-backed Satzartdaten
			// arbeiten können. Der aktuelle Einstiegspunkt bleibt physisch XLSX.

			stage: "landFAT-with-gnd-attachments",
			sheetNames: workbookInfo?.sheetNames ?? [],
			...metaExtra,
		},
		units: {
			linearUnit: "meter",
			elevationUnit: "meter",
			angularUnit: "radian",
		},
		coordinateSystem: gndCrs.coordinateSystem,
		alignments,
		profiles,
		// cants,
		extras: {
			sourceSemantics: {
				format: "gndEdit",
				note: "Qualified GND import: coordGeom, profile and cant candidate sequences are lifted to landFAT. CRS is declared from LSYS/HSYS but remains GND-source-trust scoped.",
			},
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
	horizontalCoordinateSystemName:
		lsysValues.size === 1 ? Array.from(lsysValues)[0] : null,
	verticalCoordinateSystemName:
		hsysValues.size === 1 ? Array.from(hsysValues)[0] : null,
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

function valOrNull(v) {
	return v == null || v === "" ? null : v;
}

function asTrimmedString(v) {
	if (v == null) return null;
	const s = String(v).trim();
	return s || null;
}

function readPad(row, key) {
	return asTrimmedString(row?.[key]);
}

function refOf(row) {
	return `${row?.__sheet ?? "?"}:${row?.__rowIndex ?? "?"}`;
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

function makeMeasure(value, unit = "meter") {
	const n = toFiniteNumber(value);
	if (!Number.isFinite(n)) return null;

	return {
		value: n,
		unit,
	};
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

function resolveElevationFromPadNode(padNode, phKeys) {
	const tuples = normalizeSet(phKeys);
	const tupleList = Array.from(tuples)
		.map(parseTupleKey)
		.filter(Boolean);

	for (const rec of arr(padNode?.phRecords)) {
		const recHsys = asTrimmedString(rec?.hsys);

		for (const tuple of tupleList) {
			if (recHsys === asTrimmedString(tuple?.hsys)) {
				if (Number.isFinite(rec?.elevation)) {
					return {
						value: rec.elevation,
						hsys: recHsys,
						ref: rec.ref ?? null,
					};
				}
			}
		}
	}

	return null;
}

function mapFamilyToKz(family) {
	if (family === "EL") return 0; // konservativer fallback
	if (family === "EK") return 0; // EK-geom vorerst ebenfalls Gerade fallback
	return 0;
}
