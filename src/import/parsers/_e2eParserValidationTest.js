// src/import/parsers/_e2eParserValidationTest.js

import { getParserIds, loadParserModule } from "./parserRegistry.js";
import { validateParserModule } from "./validateParserModule.js";
import { runImportPipeline } from "@src/import/runImportPipeline.js";
import { parseGND_XLSX } from "./technet/gndEdit/parseGND_XLSX.js";
import * as XLSX from "sheetjs";

function assert(condition, message) {
	if (!condition) {
		throw new Error(`ParserValidation E2E FAIL: ${message}`);
	}
}

function expectFail(fn, expectedCode) {
	let didFail = false;

	try {
		fn();
	} catch (err) {
		didFail = true;
		if (expectedCode) {
			assert(err?.code === expectedCode, `expected code ${expectedCode}, got ${String(err?.code)}`);
		}
		assert(
			err?.kind === "structural" || err?.kind === "runtime",
			`expected structured kind for ${expectedCode ?? "failure"}`
		);
	}

	assert(didFail, `expected failure${expectedCode ? ` (${expectedCode})` : ""}`);
}

function makeValidModule(id) {
	return {
		meta: { id, label: `Parser ${id}` },
		sniff: {
			extensions: ["abc"],
			looksLike: async () => true,
		},
		parse: async () => ({ ok: true }),
	};
}

function runContractUnitChecks() {
	expectFail(() => validateParserModule("x", null), "PARSER_MODULE_INVALID");
	expectFail(() => validateParserModule("x", {}), "PARSER_META_MISSING");
	expectFail(
		() =>
			validateParserModule("x", {
				meta: {},
				sniff: { extensions: ["x"] },
				parse: async () => ({}),
			}),
		"PARSER_META_ID_MISSING"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "other" },
				sniff: { extensions: ["x"] },
				parse: async () => ({}),
			}),
		"PARSER_META_ID_MISMATCH"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "x", label: 123 },
				sniff: { extensions: ["x"] },
				parse: async () => ({}),
			}),
		"PARSER_META_LABEL_INVALID"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "x" },
				sniff: { extensions: ["x"], looksLike: true },
				parse: async () => ({}),
			}),
		"PARSER_SNIFF_LOOKSLIKE_INVALID"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "x" },
				sniff: { extensions: ["", "ok"] },
				parse: async () => ({}),
			}),
		"PARSER_SNIFF_EXTENSION_INVALID"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "x" },
				sniff: { extensions: ["x"] },
			}),
		"PARSER_PARSE_MISSING"
	);
	expectFail(
		() =>
			validateParserModule("x", {
				meta: { id: "x" },
				sniff: { extensions: ["x"] },
				parse: 1,
			}),
		"PARSER_PARSE_NON_CALLABLE"
	);
	expectFail(
		() =>
			validateParserModule("stubber", {
				meta: { id: "stubber", status: "stub" },
				sniff: { extensions: ["x"] },
				parse: async () => ({}),
			}),
		"PARSER_META_STUB_REASON_MISSING"
	);

	validateParserModule("stubber", {
		meta: {
			id: "stubber",
			status: "incomplete",
			stubReason: "planned parser",
			label: "Stub Parser",
		},
		sniff: { extensions: ["stub"] },
		parse: async () => ({ ok: true }),
	});

	expectFail(
		() =>
			validateParserModule("x", {
				...makeValidModule("x"),
				semanticMap: {
					formatId: "f",
					fileType: "t",
					fieldMap: {
						K: { defaultTarget: "!!!invalid-target!!!" },
					},
				},
			}),
		"PARSER_SEMANTIC_TARGET_UNKNOWN"
	);

	expectFail(
		() =>
			validateParserModule("x", {
				...makeValidModule("x"),
				transTypeMap: {
					foo: "unknownTransition",
				},
			}),
		"PARSER_TRANSITION_TYPE_UNKNOWN"
	);

	validateParserModule("x", {
		...makeValidModule("x"),
		semanticMap: {
			formatId: "landfat",
			fileType: "alignment",
			fieldMap: {
				staStart: { defaultTarget: "staStart" },
				nested: { defaultTarget: "Alignment.coordGeom.elements[*].length" },
			},
			specialCases: {
				semanticOverrides: [
					{
						when: { field: "kind" },
						override: { field: "kind", target: "radius" },
					},
				],
				semanticAlerts: {},
			},
		},
		transTypeMap: {
			clothoidRaw: "clothoid",
		},
	});
}

async function runRegistryChecks() {
	const parserIds = getParserIds();
	assert(Array.isArray(parserIds) && parserIds.length > 0, "registry parser ids missing");

	for (const parserId of parserIds) {
		const mod = await loadParserModule(parserId);
		validateParserModule(parserId, mod);
	}
}

function makeWorkbookBytesBySheet(rowsBySheet) {
	const wb = XLSX.utils.book_new();

	for (const [sheetName, rows] of Object.entries(rowsBySheet ?? {})) {
		const ws = XLSX.utils.json_to_sheet(Array.isArray(rows) ? rows : []);
		XLSX.utils.book_append_sheet(wb, ws, sheetName);
	}

	return XLSX.write(wb, {
		type: "array",
		bookType: "xlsx",
	});
}

function makeGndFile(name, rowsBySheet) {
	return new File([makeWorkbookBytesBySheet(rowsBySheet)], name, {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});
}

function countKinds(items = []) {
	const out = {
		alignment: 0,
		profile: 0,
		cant: 0,
		staEq: 0,
		relation: 0,
		other: 0,
	};

	for (const item of Array.isArray(items) ? items : []) {
		const kind = String(item?.kind ?? "other");
		if (Object.prototype.hasOwnProperty.call(out, kind)) out[kind] += 1;
		else out.other += 1;
	}

	return out;
}

function digestResult(result) {
	return JSON.stringify({
		status: result?.status ?? null,
		reason: result?.reason ?? null,
		items: (result?.items ?? []).map((x) => x?.id ?? null),
		rejected: (result?.rejected ?? []).map((x) => x?.id ?? null),
		relations: (result?.relationCandidates ?? []).map((x) => x?.id ?? null),
	});
}

async function runGndSyntheticRegressionChecks() {
	const fullFlowRows = {
		X_ASC11_PP: [
			{ PAD: "P1", STRECKE: "R1", STRRIKZ: "1", STATION: "0" },
			{ PAD: "P2", STRECKE: "R1", STRRIKZ: "1", STATION: "100" },
		],
		X_ASC12_PL: [
			{ PAD: "P1", LSYS: "L1", Y: "0", X: "0" },
			{ PAD: "P1", LSYS: "L2", Y: "0", X: "0" },
			{ PAD: "P2", LSYS: "L1", Y: "100", X: "0" },
			{ PAD: "P2", LSYS: "L2", Y: "100", X: "0" },
		],
		X_ASC13_PH: [
			{ PAD: "P1", HSYS: "H1", H: "10" },
			{ PAD: "P2", HSYS: "H1", H: "11" },
		],
		X_ASC21_EL: [
			{ PAD1: "P1", PAD2: "P2", ELSYS: "L1", ELTYP: "0", ELPAR2: "0", ELPAR3: "0", ELPAR4: "5" },
		],
		X_ASC22_EH: [
			{ PAD1: "P1", PAD2: "P2", EHSYS: "H1", EHTYP: "0", EHPAR1: "100", EHPAR2: "0", EHPAR3: "0" },
		],
		X_ASC23_EU: [
			{ PAD1: "P1", PAD2: "P2", EUTYP: "0", EUPAR1: "100", EUPAR2: "0", EUPAR3: "0.12", EUPAR4: "3" },
		],
		X_ASC24_EK: [],
	};

	const fullFlowFile = makeGndFile("synthetic_GND_fullflow.xlsx", fullFlowRows);
	const first = await runImportPipeline(fullFlowFile, { log: () => {} });
	const second = await runImportPipeline(fullFlowFile, { log: () => {} });
	const firstKinds = countKinds(first?.items);

	assert(first?.status === "ok", `full flow should be ok, got ${String(first?.status)}`);
	assert(firstKinds.alignment === 1, `full flow should yield one alignment, got ${firstKinds.alignment}`);
	assert(digestResult(first) === digestResult(second), "full flow import should be deterministic");

	const parsedFull = await parseGND_XLSX({ file: fullFlowFile, context: {} });
	assert(parsedFull?.meta?.analysis?.coordGeomSequenceCount === 1, "full flow should build one coordGeom sequence");
	assert(parsedFull?.meta?.analysis?.cantSequenceCount === 1, "full flow should retain one supplied cant evidence sequence");
	assert(parsedFull?.meta?.analysis?.uniquelyAttachableCantSequenceCount === 0, "ambiguous EU must not be classified as uniquely attachable");
	assert(parsedFull?.meta?.analysis?.ambiguousCantSequenceCount === 1, "ambiguous EU must be counted as unattached evidence");
	assert((parsedFull?.profiles?.length ?? 0) === 0, "incomplete EH must not become a constructed profile");
	assert(parsedFull?.alignments?.[0]?.profile == null, "safe horizontal alignment must not attach an incomplete profile");
	assert(parsedFull?.alignments?.[0]?.cant == null, "unresolved cant must not become a constructed zero cant");
	const unresolvedCant = parsedFull?.extras?.unresolvedAttachments?.find((x) => x?.kind === "cant");
	const ambiguousProfile = parsedFull?.extras?.unresolvedAttachments?.find((x) => x?.kind === "profile");
	assert(ambiguousProfile?.evidenceClass === "ambiguous-unattached-source-evidence", "multi-LSYS EH must remain ambiguous unattached evidence");
	assert(JSON.stringify(ambiguousProfile?.candidateHorizontalReferenceSystems) === JSON.stringify(["L1", "L2"]), "ambiguous EH must preserve all horizontal candidates");
	assert(JSON.stringify(ambiguousProfile?.candidateVerticalReferenceSystems) === JSON.stringify(["H1"]), "ambiguous EH must preserve vertical candidates");
	assert(ambiguousProfile?.sourceElements?.[0]?.padStart === "P1" && ambiguousProfile?.sourceElements?.[0]?.padEnd === "P2", "EH source element must preserve PAD endpoints");
	assert(parsedFull?.meta?.diagnostics?.some((d) => d?.code === "eh-evidence-ambiguous"), "ambiguous EH must emit a structured diagnostic");
	assert(unresolvedCant?.status === "ambiguous", "multi-LSYS EU evidence must be explicitly ambiguous");
	assert(unresolvedCant?.evidenceClass === "ambiguous-unattached-source-evidence", "ambiguous EU must be distinguishable from uniquely attachable evidence");
	assert(unresolvedCant?.interpretationStatus === "not-interpreted", "ambiguous EU must not be presented as interpreted");
	assert(unresolvedCant?.attachmentStatus === "ambiguous-unattached", "ambiguous EU must remain unattached");
	assert(unresolvedCant?.attachmentKey == null, "ambiguous EU must not receive an arbitrary attachment key");
	assert(unresolvedCant?.ambiguityReason === "multiple-coordinate-reference-candidates", "ambiguous EU must identify the ambiguity reason");
	assert(JSON.stringify(unresolvedCant?.candidateReferenceSystems) === JSON.stringify(["L1", "L2"]), "ambiguous EU must preserve all candidate LSYS values");
	assert(unresolvedCant?.padStart === "P1" && unresolvedCant?.padEnd === "P2", "ambiguous EU must preserve PAD endpoints");
	assert(unresolvedCant?.sourceElements?.[0]?.typeCode === 0, "ambiguous EU must preserve its source type code");
	assert(unresolvedCant?.sourceElements?.[0]?.valueOrigins?.type?.origin === "source", "explicit EUTYP zero must retain source origin");
	assert(unresolvedCant?.sourceElements?.[0]?.valueOrigins?.type?.sourceField === "EUTYP", "EU type identity must retain EUTYP provenance");
	assert(unresolvedCant?.sourceElements?.[0]?.rowRef === "X_ASC23_EU:2", "EU type identity must retain row provenance");
	assert(JSON.stringify(Object.keys(unresolvedCant?.sourceElements?.[0]?.parameters ?? {})) === JSON.stringify(["EUPAR1", "EUPAR2", "EUPAR3", "EUPAR4"]), "EU parameters must remain separate from the single typeCode identity");
	assert(unresolvedCant?.sourceElements?.[0]?.parameters?.EUPAR2 === 0, "explicit source zero must remain source evidence");
	assert(unresolvedCant?.sourceElements?.[0]?.valueOrigins?.par2?.origin === "source", "explicit source zero must retain source origin");
	assert(unresolvedCant?.sourceElements?.[0]?.parameters?.EUPAR3 === 0.12, "nonzero unresolved cant must remain evidence");
	const firstElement = parsedFull?.alignments?.[0]?.coordGeom?.elements?.[0];
	assert(Math.abs((firstElement?.direction?.value ?? NaN) - 100) < 1e-9, "derived atan2 direction must be converted to gon");
	assert(firstElement?.extras?.valueOrigins?.direction?.origin === "derived", "derived direction must carry origin");
	assert(firstElement?.extras?.valueOrigins?.length?.origin === "derived", "station-derived length must carry origin");
	assert(parsedFull?.meta?.diagnostics?.some((d) => d?.field === "EUPAR3" && d?.geometryUsable === true), "ignored nonzero EU evidence must produce a structured diagnostic");
	assert(parsedFull?.meta?.diagnostics?.some((d) => d?.code === "cant-context-ambiguous-unattached" && d?.geometryUsable === true), "ambiguous EU retention must produce a structured diagnostic");
	assert(parsedFull?.meta?.diagnostics?.some((d) => d?.field === "EHPAR1"), "incomplete EH evidence must produce a structured diagnostic");

	const uniqueCantRows = {
		...fullFlowRows,
		X_ASC12_PL: fullFlowRows.X_ASC12_PL.filter((row) => row.LSYS === "L1"),
	};
	const parsedUniqueCant = await parseGND_XLSX({ file: makeGndFile("synthetic_GND_unique_cant_context.xlsx", uniqueCantRows), context: {} });
	const uniqueCant = parsedUniqueCant?.extras?.unresolvedAttachments?.find((x) => x?.kind === "cant");
	assert(uniqueCant?.evidenceClass === "unresolved-uniquely-attachable-evidence", "unique EU context must remain distinguishable from ambiguous evidence");
	assert(uniqueCant?.attachmentStatus === "uniquely-attachable" && uniqueCant?.attachmentKey, "unique unresolved EU may carry an attachment key");
	assert(parsedUniqueCant?.alignments?.[0]?.cant == null, "unique unresolved EU still must not construct cant");
	const uniqueProfile = parsedUniqueCant?.extras?.unresolvedAttachments?.find((x) => x?.kind === "profile");
	assert(uniqueProfile?.evidenceClass === "unresolved-uniquely-attachable-evidence", "unique EH must remain unresolved but uniquely attachable");
	assert(parsedUniqueCant?.alignments?.[0]?.profile == null, "unique incomplete EH still must not construct profile");

	const rejectedAttachmentRows = {
		X_ASC11_PP: [
			{ PAD: "A1", STRECKE: "R1", STRRIKZ: "1", STATION: "0" },
			{ PAD: "A2", STRECKE: "R1", STRRIKZ: "1", STATION: "100" },
			{ PAD: "R1", STRECKE: "R2", STRRIKZ: "1", STATION: "0" },
			{ PAD: "R2", STRECKE: "R2", STRRIKZ: "1", STATION: "100" },
		],
		X_ASC12_PL: [
			{ PAD: "A1", LSYS: "L1", Y: "0", X: "0" },
			{ PAD: "A2", LSYS: "L1", Y: "100", X: "0" },
		],
		X_ASC13_PH: [
			{ PAD: "R1", HSYS: "H1", H: "10" },
			{ PAD: "R2", HSYS: "H1", H: "11" },
			{ PAD: "R1", HSYS: "H2", H: "20" },
			{ PAD: "R2", HSYS: "H2", H: "21" },
		],
		X_ASC21_EL: [
			{ PAD1: "A1", PAD2: "A2", ELSYS: "L1", ELTYP: "0", ELPAR1: "100", ELARIWI: "100" },
		],
		X_ASC22_EH: [
			{ PAD1: "R1", PAD2: "R2", EHTYP: "0", EHPAR1: "100", EHPAR2: "0", EHPAR3: "0", EHPAR4: "0" },
		],
		X_ASC23_EU: [
			{ PAD1: "R1", PAD2: "R2", EUTYP: "0", EUPAR1: "100", EUPAR2: "0", EUPAR3: "0", EUPAR4: "0" },
		],
		X_ASC24_EK: [],
	};
	const parsedRejectedAttachments = await parseGND_XLSX({ file: makeGndFile("synthetic_GND_rejected_attachments.xlsx", rejectedAttachmentRows), context: {} });
	const rejectedProfile = parsedRejectedAttachments?.extras?.unresolvedAttachments?.find((x) => x?.kind === "profile");
	const rejectedCant = parsedRejectedAttachments?.extras?.unresolvedAttachments?.find((x) => x?.kind === "cant");
	assert(rejectedProfile?.evidenceClass === "rejected-unattached-source-evidence", "rejected EH seed must remain inspectable");
	assert(rejectedProfile?.rejectionReason === "missing-required-vertical-system-identifier", "rejected EH must retain the actual seed-validation reason");
	assert(JSON.stringify(rejectedProfile?.candidateVerticalReferenceSystems) === JSON.stringify(["H1", "H2"]), "rejected EH must preserve multiple PH candidates");
	assert(rejectedCant?.evidenceClass === "rejected-unattached-source-evidence", "rejected EU seed must remain inspectable");
	assert(rejectedCant?.sourceElements?.[0]?.typeCode === 0 && rejectedCant?.sourceElements?.[0]?.parameters?.EUPAR2 === 0, "rejected EU must preserve explicit zero source values");
	assert(rejectedProfile?.attachmentKey == null && rejectedCant?.attachmentKey == null, "rejected attachments must not acquire attachment keys");
	assert(parsedRejectedAttachments?.alignments?.length === 1, "safe horizontal geometry must survive rejected EH/EU evidence");
	assert(parsedRejectedAttachments?.alignments?.[0]?.profile == null && parsedRejectedAttachments?.alignments?.[0]?.cant == null, "rejected attachment evidence must not construct profile or cant");
	assert(parsedRejectedAttachments?.meta?.diagnostics?.some((d) => d?.code === "eh-evidence-rejected"), "rejected EH must emit a diagnostic");
	assert(parsedRejectedAttachments?.meta?.diagnostics?.some((d) => d?.code === "eu-evidence-rejected"), "rejected EU must emit a diagnostic");

	const permutedAttachmentRows = Object.fromEntries(Object.entries(rejectedAttachmentRows).map(([sheet, rows]) => [sheet, [...rows].reverse()]));
	const parsedPermutedAttachments = await parseGND_XLSX({ file: makeGndFile("synthetic_GND_rejected_attachments_permuted.xlsx", permutedAttachmentRows), context: {} });
	const attachmentDigest = (doc) => JSON.stringify((doc?.extras?.unresolvedAttachments ?? []).map((evidence) => ({ kind: evidence.kind, evidenceClass: evidence.evidenceClass, padStart: evidence.padStart, padEnd: evidence.padEnd, horizontal: evidence.candidateHorizontalReferenceSystems, vertical: evidence.candidateVerticalReferenceSystems, station: evidence.candidateStationContexts, reason: evidence.ambiguityReason ?? evidence.rejectionReason, elements: evidence.sourceElements.map((element) => ({ family: element.family, padStart: element.padStart, padEnd: element.padEnd, typeCode: element.typeCode, parameters: element.parameters })) })));
	assert(attachmentDigest(parsedRejectedAttachments) === attachmentDigest(parsedPermutedAttachments), "EH/EU evidence must be deterministic under source-row permutation");

	const unknownTypeRows = {
		...fullFlowRows,
		X_ASC21_EL: [{ PAD1: "P1", PAD2: "P2", ELSYS: "L1", ELTYP: "99", ELPAR1: "100", ELPAR2: "0", ELPAR3: "0" }],
		X_ASC22_EH: [],
		X_ASC23_EU: [],
	};
	const parsedUnknown = await parseGND_XLSX({ file: makeGndFile("synthetic_GND_unknown_type.xlsx", unknownTypeRows), context: {} });
	assert(parsedUnknown?.alignments?.length === 0, "unknown constructive type must not enter geometry");
	assert(parsedUnknown?.extras?.unresolvedSourceElements?.[0]?.typeCode === 99, "unknown source type must remain unresolved evidence");

	const equalRadiusRows = {
		...unknownTypeRows,
		X_ASC21_EL: [{ PAD1: "P1", PAD2: "P2", ELSYS: "L1", ELTYP: "2", ELPAR1: "100", ELPAR2: "500", ELPAR3: "500" }],
	};
	const parsedEqualRadius = await parseGND_XLSX({ file: makeGndFile("synthetic_GND_equal_radius.xlsx", equalRadiusRows), context: {} });
	assert(parsedEqualRadius?.alignments?.length === 0, "equal-radius transition must not be coerced to Curve");
	assert(parsedEqualRadius?.meta?.diagnostics?.some((d) => d?.code === "equal-radius-transition-unresolved"), "equal-radius rejection must be diagnosed");

	const partialEhRows = {
		X_ASC11_PP: [
			{ PAD: "Q1", STRECKE: "R3", STRRIKZ: "1", STATION: "0" },
			{ PAD: "Q2", STRECKE: "R3", STRRIKZ: "1", STATION: "50" },
		],
		X_ASC12_PL: [
			{ PAD: "Q1", LSYS: "L3", Y: "0", X: "0" },
			{ PAD: "Q2", LSYS: "L3", Y: "50", X: "0" },
		],
		X_ASC13_PH: [
			{ PAD: "Q1", HSYS: "H3", H: "20" },
			{ PAD: "Q2", HSYS: "H3", H: "21" },
		],
		X_ASC21_EL: [
			{ PAD1: "Q1", PAD2: "Q2", ELSYS: "L3", ELTYP: "0", ELPAR1: "50", ELPAR2: "0", ELPAR3: "0", ELARIWI: "0" },
		],
		X_ASC22_EH: [
			{ PAD1: "Q1", PAD2: "Q2", EHSYS: "H3", EHTYP: "0", EHPAR1: "50", EHPAR2: "0", EHPAR3: "0" },
		],
		X_ASC23_EU: [],
		X_ASC24_EK: [],
	};

	const partialEhFile = makeGndFile("synthetic_GND_partial_eh.xlsx", partialEhRows);
	const parsedPartialEh = await parseGND_XLSX({ file: partialEhFile, context: {} });
	assert(parsedPartialEh?.meta?.analysis?.profileSequenceCount === 1, "partial EH case should detect one profile sequence");
	assert(parsedPartialEh?.meta?.analysis?.cantSequenceCount === 0, "partial EH case should keep cant sequence count at zero");

	const conflictingCrsRows = {
		X_ASC11_PP: [
			{ PAD: "P1", STRECKE: "R1", STRRIKZ: "1", STATION: "0" },
			{ PAD: "P2", STRECKE: "R1", STRRIKZ: "1", STATION: "100" },
			{ PAD: "P3", STRECKE: "R2", STRRIKZ: "1", STATION: "0" },
			{ PAD: "P4", STRECKE: "R2", STRRIKZ: "1", STATION: "100" },
		],
		X_ASC12_PL: [
			{ PAD: "P1", LSYS: "L1", Y: "0", X: "0" },
			{ PAD: "P2", LSYS: "L1", Y: "100", X: "0" },
			{ PAD: "P3", LSYS: "L2", Y: "0", X: "50" },
			{ PAD: "P4", LSYS: "L2", Y: "100", X: "50" },
		],
		X_ASC13_PH: [],
		X_ASC21_EL: [
			{ PAD1: "P1", PAD2: "P2", ELSYS: "L1", ELTYP: "0", ELPAR1: "100", ELPAR2: "0", ELPAR3: "0", ELARIWI: "0" },
			{ PAD1: "P3", PAD2: "P4", ELSYS: "L2", ELTYP: "0", ELPAR1: "100", ELPAR2: "0", ELPAR3: "0", ELARIWI: "0" },
		],
		X_ASC22_EH: [],
		X_ASC23_EU: [],
		X_ASC24_EK: [],
	};

	const conflictingCrsFile = makeGndFile("synthetic_GND_conflicting_crs.xlsx", conflictingCrsRows);
	const conflicting = await runImportPipeline(conflictingCrsFile, { log: () => {} });
	const crsSet = new Set(
		(conflicting?.items ?? [])
			.map((it) => it?.derived?.spatialRef?.horizontalCrsId ?? it?.payload?.spatialRef?.horizontalCrsId ?? null)
			.filter(Boolean)
	);
	assert(crsSet.size === 2, `conflicting CRS should preserve two LSYS values, got ${crsSet.size}`);

	const missingPadRows = {
		X_ASC11_PP: [
			{ PAD: "P1", STRECKE: "R1", STRRIKZ: "1", STATION: "0" },
		],
		X_ASC12_PL: [
			{ PAD: "P1", LSYS: "L1", Y: "0", X: "0" },
		],
		X_ASC13_PH: [],
		X_ASC21_EL: [
			{ PAD1: "P1", PAD2: "P2", ELSYS: "L1", ELTYP: "0", ELPAR1: "100", ELPAR2: "0", ELPAR3: "0", ELARIWI: "0" },
		],
		X_ASC22_EH: [],
		X_ASC23_EU: [],
		X_ASC24_EK: [],
	};

	const missingPadFile = makeGndFile("synthetic_GND_missing_refs.xlsx", missingPadRows);
	const parsedMissing = await parseGND_XLSX({ file: missingPadFile, context: {} });
	assert(parsedMissing?.meta?.analysis?.rejectedSeedCount > 0, "missing PAD reference should increase rejected seed count");
	const missingPipeline = await runImportPipeline(missingPadFile, { log: () => {} });
	assert(missingPipeline?.status === "no-items", `missing PAD should produce no-items, got ${String(missingPipeline?.status)}`);

	const fakeMdb = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], "synthetic_GND.MDB", {
		type: "application/octet-stream",
	});
	const mdbResult = await runImportPipeline(fakeMdb, { log: () => {} });
	assert(mdbResult?.status === "unknown", `GND MDB should be unsupported/unknown, got ${String(mdbResult?.status)}`);

	const fakeTxt = new File(["PAD;STRECKE"], "X_ASC11_PP.txt", { type: "text/plain" });
	const txtResult = await runImportPipeline(fakeTxt, { log: () => {} });
	assert(
		txtResult?.status === "invalid" || txtResult?.status === "unknown",
		`ASCII standalone import should classify as invalid/unknown, got ${String(txtResult?.status)}`
	);
}

async function runOptionalLegacyCorpusProbe({ candidatesOverride = null } = {}) {
	const probe = {
		run: false,
		skipped: false,
		reason: null,
		results: [],
	};

	const candidates = Array.isArray(candidatesOverride) && candidatesOverride.length
		? candidatesOverride
		: [
		"_legacy/ufMisc/data/gndEdit/STR_1720_GND.xlsx",
		"_legacy/ufMisc/data/gndEdit/STR_1720_KM_211-273_GND.xlsx",
		"_legacy/ufMisc/data/gndEdit/STR_1720_KM_211-273_GND.MDB",
	];

	async function fetchAsFile(relPath) {
		const response = await fetch(`/${relPath}`, { cache: "no-store" });
		if (!response.ok) return null;
		const bytes = await response.arrayBuffer();
		const name = relPath.split("/").pop() ?? "local.dat";
		return new File([bytes], name);
	}

	const first = await fetchAsFile(candidates[0]);
	if (!first) {
		probe.skipped = true;
		probe.reason = "local legacy corpus unavailable";
		if (typeof window !== "undefined") window.__gndLegacyCorpusProbe = probe;
		return probe;
	}

	probe.run = true;

	for (const relPath of candidates) {
		const file = await fetchAsFile(relPath);
		if (!file) {
			probe.results.push({ id: relPath, status: "missing" });
			continue;
		}

		const firstRun = await runImportPipeline(file, { log: () => {} });
		const secondRun = await runImportPipeline(file, { log: () => {} });

		probe.results.push({
			id: relPath,
			status: firstRun?.status ?? null,
			reason: firstRun?.reason ?? null,
			items: Array.isArray(firstRun?.items) ? firstRun.items.length : 0,
			relations: Array.isArray(firstRun?.relationCandidates) ? firstRun.relationCandidates.length : 0,
			deterministic: digestResult(firstRun) === digestResult(secondRun),
		});
	}

	if (typeof window !== "undefined") window.__gndLegacyCorpusProbe = probe;
	return probe;
}

(async function runParserValidationE2E() {
	console.log("ParserValidation E2E starting...");

	runContractUnitChecks();
	await runRegistryChecks();
	await runGndSyntheticRegressionChecks();
	await runOptionalLegacyCorpusProbe();

	const skipProbe = await runOptionalLegacyCorpusProbe({
		candidatesOverride: ["_legacy/__missing__/gnd_corpus_placeholder.xlsx"],
	});
	assert(skipProbe?.skipped === true, "legacy probe should skip cleanly when local corpus is unavailable");

	if (typeof window !== "undefined") {
		window.__parserValidationE2E = {
			passed: true,
			ts: Date.now(),
		};
	}

	console.log("ParserValidation E2E PASSED");
})();
