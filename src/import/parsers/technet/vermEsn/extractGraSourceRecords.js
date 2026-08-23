export const GRA_COUPLED_CANT_GRADIENT_EVIDENCE_VERSION =
	"source-evidence/gra-coupled-cant-gradient/0.1";

function finite(value) {
	return Number.isFinite(Number(value));
}

function nonNegativeInteger(value) {
	const numeric = Number(value);
	return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function freeze(value) {
	if (Array.isArray(value)) {
		value.forEach(freeze);
		return Object.freeze(value);
	}
	if (value && typeof value === "object") {
		Object.values(value).forEach(freeze);
		return Object.freeze(value);
	}
	return value;
}

function sourceCell(cycle, field, rawValue) {
	return {
		locator: { cycle, field },
		state: finite(rawValue) ? "value" : "unreadable",
		rawValue,
	};
}

function decodePackedRampAndCant(rawValue) {
	if (!finite(rawValue)) {
		return { rampCode: null, cantMillimetres: null };
	}

	const value = Number(rawValue);
	const rampCode = Math.round(value / 1000);
	return {
		rampCode,
		cantMillimetres: value - rampCode * 1000,
	};
}

function buildTrackScissorClaim(row, dataIndex, gradeBreakCount) {
	const cycle = dataIndex + 1;
	const packed = decodePackedRampAndCant(row?.tangentL);
	const secondCant = finite(row?.pointNumber)
		? Number(row.pointNumber) / 10
		: null;

	return freeze({
		contractVersion: GRA_COUPLED_CANT_GRADIENT_EVIDENCE_VERSION,
		kind: "track-scissor-source-claim",
		sourceIndex: dataIndex,
		sourceCycle: cycle,
		construction: {
			rampEnd1Station: finite(row?.station) ? Number(row.station) : null,
			rampIntersectionStation: finite(row?.height) ? Number(row.height) : null,
			rampEnd2Station: finite(row?.radius) ? Number(row.radius) : null,
			rampCode: packed.rampCode,
			cant1Millimetres: packed.cantMillimetres,
			cant2Millimetres: secondCant,
		},
		coupling: {
			curvatureTransitionBinding: "not-established",
			gradientCarrierTransfer: "source-claimed-not-evaluated",
			railHeightConstruction: "not-evaluated",
			profileAdmission: "prohibited-without-tra-binding",
		},
		provenance: {
			headerGradeBreakCount: gradeBreakCount,
			sourceCells: {
				RE1: sourceCell(cycle, "S", row?.station),
				RA: sourceCell(cycle, "H", row?.height),
				RE2: sourceCell(cycle, "R", row?.radius),
				packedRampAndCant1: sourceCell(cycle, "T", row?.tangentL),
				packedCant2: sourceCell(cycle, "Pkt", row?.pointNumber),
			},
		},
	});
}

/**
 * Splits the overloaded GRA record stream according to its header counts.
 * Track-scissor rows are preserved as coupled source claims and never exposed
 * as ordinary vertical-profile points.
 */
export function extractGraSourceRecords(header, rows = []) {
	const gradeBreakCount = nonNegativeInteger(header?.station);
	const trackScissorCount = nonNegativeInteger(header?.pointNumber);
	const diagnostics = [];

	if (gradeBreakCount === null || trackScissorCount === null) {
		diagnostics.push({
			code: "GRA_HEADER_COUNTS_INVALID",
			reason: "GRA header must provide non-negative integer grade-break and track-scissor counts",
		});
		return freeze({
			gradeBreakCount: null,
			trackScissorCount: null,
			profileRows: [],
			trackScissorClaims: [],
			unclassifiedRows: rows.map((row, index) => ({ row, sourceIndex: index, sourceCycle: index + 1 })),
			diagnostics,
		});
	}

	const expected = gradeBreakCount + trackScissorCount;
	if (rows.length !== expected) {
		diagnostics.push({
			code: "GRA_HEADER_DATA_COUNT_MISMATCH",
			reason: `header declares ${expected} data records, file contains ${rows.length}`,
			expected,
			actual: rows.length,
		});
		return freeze({
			gradeBreakCount,
			trackScissorCount,
			profileRows: [],
			trackScissorClaims: [],
			unclassifiedRows: rows.map((row, index) => ({ row, sourceIndex: index, sourceCycle: index + 1 })),
			diagnostics,
		});
	}

	const profileRows = rows.slice(0, Math.min(gradeBreakCount, rows.length));
	const scissorStart = gradeBreakCount;
	const scissorEnd = Math.min(expected, rows.length);
	const trackScissorClaims = rows
		.slice(scissorStart, scissorEnd)
		.map((row, index) => buildTrackScissorClaim(row, scissorStart + index, gradeBreakCount));
	const unclassifiedRows = rows
		.slice(expected)
		.map((row, index) => ({ row, sourceIndex: expected + index, sourceCycle: expected + index + 1 }));

	return freeze({
		gradeBreakCount,
		trackScissorCount,
		profileRows,
		trackScissorClaims,
		unclassifiedRows,
		diagnostics,
	});
}
