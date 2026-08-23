import { normalizeGndCellValue } from "../parsers/technet/gndEdit/gnd/normalizeGndRows.js";

export const GND_CONSTRUCTIVE_STATION_FRAME_SCHEMA =
	"ufAIM.gnd-constructive-station-frame-evidence";
export const GND_CONSTRUCTIVE_STATION_FRAME_VERSION = 1;

const REQUIRED_BLOCKERS = Object.freeze([
	"GND_STATION_ENCODING_PROFILE_REQUIRED",
	"INTRINSIC_S_BINDING_NOT_ESTABLISHED",
]);

export function buildGndConstructiveStationFrameEvidence({
	sourceEnvelope,
	evidenceId = null,
} = {}) {
	if (!sourceEnvelope || typeof sourceEnvelope !== "object") return null;
	const ekTable = table(sourceEnvelope, "X_ASC24_EK");
	if (!ekTable) return null;

	const ppByPad = buildPpIndex(table(sourceEnvelope, "X_ASC11_PP"));
	const claims = (ekTable.rows ?? []).map((row) => buildClaim({
		row,
		fingerprint: text(sourceEnvelope?.source?.sha256) || null,
		ppByPad,
	}));
	const diagnostics = unique(claims.flatMap((claim) => claim.blockers));

	return deepFreeze({
		schema: GND_CONSTRUCTIVE_STATION_FRAME_SCHEMA,
		version: GND_CONSTRUCTIVE_STATION_FRAME_VERSION,
		evidenceId,
		family: "EK",
		status: claims.length ? "evidence-only" : "missing",
		constructiveAdmission: "not-performed",
		addressEncoding: "gnd-opaque-until-decoder-profile",
		intrinsicBinding: "not-established",
		source: {
			fingerprint: text(sourceEnvelope?.source?.sha256) || null,
			fileName: text(sourceEnvelope?.source?.fileName) || null,
			format: text(sourceEnvelope?.source?.format) || null,
		},
		claims,
		diagnostics,
		provenance: {
			claims: "GND X_ASC24_EK rows with exact table/row/cell locators",
			stationContexts: "GND X_ASC11_PP observations joined by PAD without winner selection",
			interpretation: "type code 6 identifies a kilometre-jump candidate; numeric address decoding is not performed",
		},
	});
}

function buildClaim({ row, fingerprint, ppByPad }) {
	const values = normalizedRow(row);
	const padStart = value(values, "PAD1");
	const padEnd = value(values, "PAD2");
	const typeCode = finite(value(values, "EKTYP"));
	const startAddressClaim = value(values, "EKAKM");
	const endAddressClaim = value(values, "EKEKM");
	const contexts = {
		start: uniqueObjects(ppByPad.get(text(padStart)) ?? []),
		end: uniqueObjects(ppByPad.get(text(padEnd)) ?? []),
	};
	const blockers = [...REQUIRED_BLOCKERS];
	if (!text(padStart) || !text(padEnd)) blockers.push("EK_ENDPOINT_PAD_MISSING");
	if (!text(value(values, "EKSYS"))) blockers.push("EK_REFERENCE_SYSTEM_MISSING");
	if (typeCode == null) blockers.push("EK_TYPE_MISSING");
	if (contexts.start.length === 0 || contexts.end.length === 0) blockers.push("PP_STATION_CONTEXT_MISSING");
	if (contextConflict(contexts.start) || contextConflict(contexts.end)) blockers.push("PP_STATION_CONTEXT_AMBIGUOUS");
	if (typeCode === 6 && (startAddressClaim == null || endAddressClaim == null)) blockers.push("EK_JUMP_ADDRESS_CLAIM_INCOMPLETE");

	return {
		claimId: [fingerprint ?? "no-fingerprint", "X_ASC24_EK", row?.ordinal ?? "no-row"].join(":"),
		rowRef: `X_ASC24_EK:${row?.ordinal ?? "?"}`,
		directedEndpoints: { padStart: nullable(padStart), padEnd: nullable(padEnd) },
		referenceSystem: nullable(value(values, "EKSYS")),
		typeCode,
		claimKind: typeCode === 6 ? "kilometre-jump-candidate" : "kilometre-reference-line-element",
		parameters: {
			EKPAR1: nullable(value(values, "EKPAR1")),
			EKPAR2: nullable(value(values, "EKPAR2")),
			EKPAR3: nullable(value(values, "EKPAR3")),
			EKPAR4: nullable(value(values, "EKPAR4")),
			EKARIWI: nullable(value(values, "EKARIWI")),
		},
		externalAddressClaims: {
			start: nullable(startAddressClaim),
			end: nullable(endAddressClaim),
			encoding: "source-value-uninterpreted",
		},
		stationContexts: contexts,
		sourceCells: compactSourceCells(values),
		admission: "evidence-only",
		blockers: unique(blockers),
		provenance: Object.fromEntries([...values.entries()].map(([name, cell]) => [name, cell.locator])),
	};
}

function buildPpIndex(ppTable) {
	const index = new Map();
	for (const row of ppTable?.rows ?? []) {
		const values = normalizedRow(row);
		const pad = text(value(values, "PAD"));
		if (!pad) continue;
		const context = {
			pad,
			route: nullable(value(values, "STRECKE") ?? value(values, "PSTRECKE")),
			directionCode: nullable(value(values, "STRRIKZ") ?? value(values, "PSTRRIKZ")),
			stationClaim: nullable(value(values, "STATION")),
			encoding: "source-value-uninterpreted",
			rowRef: `X_ASC11_PP:${row?.ordinal ?? "?"}`,
			sourceCells: compactPpSourceCells(values),
		};
		index.set(pad, [...(index.get(pad) ?? []), context]);
	}
	return index;
}

function normalizedRow(row) {
	const result = new Map();
	for (const [cellOrdinal, cell] of (row?.cells ?? []).entries()) {
		const name = text(cell?.columnName).replace(/\s+/g, "").toUpperCase();
		if (!name) continue;
		result.set(name, {
			value: cell?.state === "absent" || cell?.state === "unreadable" ? null : normalizeGndCellValue(cell?.value),
			rawValue: cloneScalar(cell?.value),
			state: text(cell?.state) || "unknown",
			locator: { table: row?.tableName ?? null, row: row?.ordinal ?? null, column: text(cell?.columnName), cellOrdinal },
		});
	}
	return result;
}

function table(envelope, name) {
	const found = (envelope?.tables ?? []).find((entry) => text(entry?.name) === name) ?? null;
	if (!found) return null;
	return { ...found, rows: (found.rows ?? []).map((row) => ({ ...row, tableName: name })) };
}

function value(values, name) { return values.get(name)?.value ?? null; }
function finite(input) { const number = Number(input); return Number.isFinite(number) ? number : null; }
function nullable(input) { return input == null || input === "" ? null : input; }
function text(input) { return String(input ?? "").trim(); }
function unique(values) { return [...new Set(values)]; }
function uniqueObjects(values) {
	const seen = new Set();
	return values.filter((entry) => { const key = JSON.stringify(entry); if (seen.has(key)) return false; seen.add(key); return true; });
}
function contextConflict(contexts) {
	return ["route", "directionCode", "stationClaim"].some((field) => new Set(contexts.map((entry) => JSON.stringify(entry[field]))).size > 1);
}
function compactSourceCells(values) {
	const permitted = new Set(["PAD1", "PAD2", "EKSYS", "EKTYP", "EKPAR1", "EKPAR2", "EKPAR3", "EKPAR4", "EKARIWI", "EKAKM", "EKEKM"]);
	return Object.fromEntries([...values.entries()].filter(([name]) => permitted.has(name)).map(([name, cell]) => [name, {
		state: cell.state,
		rawValue: cell.rawValue,
		normalizedValue: cell.value,
		locator: cell.locator,
	}]));
}
function compactPpSourceCells(values) {
	const permitted = new Set(["PAD", "STRECKE", "PSTRECKE", "STRRIKZ", "PSTRRIKZ", "STATION"]);
	return Object.fromEntries([...values.entries()].filter(([name]) => permitted.has(name)).map(([name, cell]) => [name, {
		state: cell.state,
		rawValue: cell.rawValue,
		normalizedValue: cell.value,
		locator: cell.locator,
	}]));
}
function cloneScalar(value) {
	if (value == null || ["string", "number", "boolean"].includes(typeof value)) return value ?? null;
	return String(value);
}
function deepFreeze(value) {
	if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
	for (const child of Object.values(value)) deepFreeze(child);
	return Object.freeze(value);
}

export default buildGndConstructiveStationFrameEvidence;
