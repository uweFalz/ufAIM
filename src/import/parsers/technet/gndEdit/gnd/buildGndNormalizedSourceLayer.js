import { GND_CELL_STATES } from "./gndSourceEnvelope.js";
import { normalizeGndCellValue } from "./normalizeGndRows.js";

const FAMILY_BY_TABLE = Object.freeze({
	X_ASC11_PP: "PP", X_ASC12_PL: "PL", X_ASC13_PH: "PH",
	X_ASC21_EL: "EL", X_ASC22_EH: "EH", X_ASC23_EU: "EU", X_ASC24_EK: "EK",
});

const HEADER_ALIASES = Object.freeze({ LSYST: "LSYS", HSYST: "HSYS" });

const OBSERVATION_SCHEMAS = Object.freeze({
	PP: Object.freeze({
		identity: Object.freeze([
			Object.freeze({ name: "PAD", fields: Object.freeze(["PAD"]) }),
			Object.freeze({ name: "STRECKE", fields: Object.freeze(["STRECKE", "PSTRECKE"]) }),
			Object.freeze({ name: "STRRIKZ", fields: Object.freeze(["STRRIKZ", "PSTRRIKZ"]) }),
		]),
		values: Object.freeze(["STATION"]),
	}),
	PL: Object.freeze({
		identity: Object.freeze([
			Object.freeze({ name: "PAD", fields: Object.freeze(["PAD"]) }),
			Object.freeze({ name: "LSYS", fields: Object.freeze(["LSYS"]) }),
		]),
		values: Object.freeze(["Y", "X"]),
	}),
	PH: Object.freeze({
		identity: Object.freeze([
			Object.freeze({ name: "PAD", fields: Object.freeze(["PAD"]) }),
			Object.freeze({ name: "HSYS", fields: Object.freeze(["HSYS"]) }),
		]),
		values: Object.freeze(["H"]),
	}),
});

export function buildGndNormalizedSourceLayer(envelope) {
	const fingerprint = text(envelope?.source?.sha256) || null;
	const records = [];
	const unsupported = [];
	const diagnostics = [];

	for (const table of envelope?.tables ?? []) {
		const tableName = text(table?.name);
		const family = FAMILY_BY_TABLE[tableName] ?? null;
		if (!family) {
			unsupported.push(Object.freeze({
				table: tableName,
				reason: "unsupported-source-table",
				inventoryOrdinal: finiteOrNull(table?.ordinal),
			}));
			continue;
		}

		for (const row of table?.rows ?? []) {
			records.push(normalizeRecord({ envelope, fingerprint, table, tableName, family, row, diagnostics }));
		}
	}

	for (const item of envelope?.inventory ?? []) {
		const tableName = text(item?.name);
		if (FAMILY_BY_TABLE[tableName] || (envelope?.tables ?? []).some((table) => text(table?.name) === tableName)) continue;
		unsupported.push(Object.freeze({ table: tableName, reason: "inventory-only-source-table", inventoryOrdinal: finiteOrNull(item?.ordinal) }));
	}

	return Object.freeze({
		type: "GndNormalizedSourceLayer",
		version: 1,
		sourceDocument: Object.freeze({
			fingerprint,
			fileName: text(envelope?.source?.fileName),
			byteSize: finiteOrNull(envelope?.source?.byteLength),
			containerType: text(envelope?.source?.container) || "unknown",
			format: text(envelope?.source?.format) || "unknown",
			parserId: text(envelope?.extractor?.id) || "unknown",
			parserVersion: text(envelope?.extractor?.version) || "unknown",
			schemaVariant: classifySchemaVariant(envelope),
			sheetInventory: Object.freeze((envelope?.inventory ?? []).map((item) => Object.freeze({
				name: text(item?.name), ordinal: finiteOrNull(item?.ordinal), interpreted: item?.interpreted === true,
			}))),
		}),
		records: Object.freeze(records),
		observationGroups: Object.freeze(buildObservationGroups(records)),
		diagnostics: Object.freeze([
			...(envelope?.diagnostics ?? []).map((entry) => Object.freeze({ ...entry, origin: entry?.origin ?? "source-envelope" })),
			...diagnostics,
		]),
		unsupported: Object.freeze(unsupported),
	});
}

function buildObservationGroups(records) {
	const groups = new Map();
	for (const record of records) {
		const schema = OBSERVATION_SCHEMAS[record.family];
		if (!schema) continue;
		const observation = makeObservation(record, schema);
		const identitySignature = exactSignature(observation.identity);
		const groupKey = `${record.family}:${identitySignature}`;
		const group = groups.get(groupKey) ?? {
			family: record.family,
			identity: observation.identity,
			observations: [],
			valueFields: schema.values,
		};
		group.observations.push(observation);
		groups.set(groupKey, group);
	}

	return [...groups.values()].map(finalizeObservationGroup);
}

function makeObservation(record, schema) {
	const identity = {};
	const values = {};
	const locators = {};
	for (const descriptor of schema.identity) {
		const field = firstPresentField(record, descriptor.fields);
		identity[descriptor.name] = field ? record.normalized[field] : null;
		locators[descriptor.name] = field ? record.provenance[field]?.locator ?? null : null;
	}
	for (const field of schema.values) {
		values[field] = Object.hasOwn(record.normalized, field) ? record.normalized[field] : null;
		locators[field] = record.provenance[field]?.locator ?? null;
	}
	return Object.freeze({
		sourceId: record.sourceId,
		recordLocator: Object.freeze({ table: record.sheet, row: record.row }),
		identity: Object.freeze(identity),
		values: Object.freeze(values),
		locators: Object.freeze(locators),
	});
}

function firstPresentField(record, fields) {
	return fields.find((field) => Object.hasOwn(record.normalized, field)) ?? null;
}

function finalizeObservationGroup(group) {
	const observationsByValue = new Map();
	for (const observation of group.observations) {
		const signature = exactSignature(observation.values);
		const equal = observationsByValue.get(signature) ?? [];
		equal.push(observation);
		observationsByValue.set(signature, equal);
	}
	const valueGroups = Object.freeze([...observationsByValue.values()].map((observations) => Object.freeze({
		classification: observations.length > 1 ? "duplicate-equal" : "single",
		values: observations[0].values,
		sourceIds: Object.freeze(observations.map((observation) => observation.sourceId)),
		locators: Object.freeze(observations.map((observation) => observation.recordLocator)),
	})));
	const classification = group.observations.length === 1
		? "single"
		: valueGroups.length === 1 ? "duplicate-equal" : "conflict";
	const sourceIds = Object.freeze(group.observations.map((observation) => observation.sourceId));
	const locators = Object.freeze(group.observations.map((observation) => observation.recordLocator));
	const fieldLocators = Object.freeze(group.observations.map((observation) => Object.freeze({
		sourceId: observation.sourceId,
		locators: observation.locators,
	})));
	const conflict = classification === "conflict"
		? Object.freeze({
			sourceIds,
			locators,
			fieldLocators,
			differingFields: Object.freeze(group.valueFields.filter((field) => new Set(group.observations.map((observation) => exactSignature(observation.values[field]))).size > 1)),
		})
		: null;
	return Object.freeze({
		family: group.family,
		identity: group.identity,
		classification,
		observations: Object.freeze(group.observations),
		valueGroups,
		evidence: Object.freeze({ sourceIds, locators, fieldLocators }),
		conflict,
	});
}

function exactSignature(value) {
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	if (typeof value === "number") return Number.isNaN(value) ? "number:NaN" : Object.is(value, -0) ? "number:-0" : `number:${value}`;
	if (typeof value === "string") return `string:${JSON.stringify(value)}`;
	if (typeof value === "boolean") return `boolean:${value}`;
	if (Array.isArray(value)) return `array:[${value.map(exactSignature).join(",")}]`;
	if (typeof value === "object") return `object:{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${exactSignature(value[key])}`).join(",")}}`;
	return `${typeof value}:${String(value)}`;
}

function normalizeRecord({ fingerprint, table, tableName, family, row, diagnostics }) {
	const sourceOrdinal = finiteOrNull(row?.ordinal);
	const raw = {};
	const normalized = {};
	const provenance = {};
	const recordDiagnostics = [];

	for (const [cellOrdinal, cell] of (row?.cells ?? []).entries()) {
		const rawHeader = text(cell?.columnName);
		const normalizedHeader = normalizeHeader(rawHeader);
		const locator = Object.freeze({ table: tableName, row: sourceOrdinal, column: rawHeader, cellOrdinal });
		raw[rawHeader] = Object.freeze({ state: text(cell?.state) || GND_CELL_STATES.UNREADABLE, value: cloneValue(cell?.value) });
		provenance[normalizedHeader] = Object.freeze({ locator, rawHeader, normalizedHeader, origin: "source" });

		if (cell?.state === GND_CELL_STATES.ABSENT || cell?.state === GND_CELL_STATES.UNREADABLE) {
			const diagnostic = Object.freeze({ code: "source-cell-not-normalized", family, locator, state: cell?.state, decision: "retain-raw-evidence" });
			recordDiagnostics.push(diagnostic); diagnostics.push(diagnostic);
			continue;
		}
		normalized[normalizedHeader] = normalizeGndCellValue(cell?.value);
	}

	return Object.freeze({
		sourceId: [fingerprint ?? "no-fingerprint", tableName, sourceOrdinal ?? "no-row"].join(":"),
		family,
		sourceOrdinal,
		sheet: tableName,
		row: sourceOrdinal,
		raw: Object.freeze(raw),
		normalized: Object.freeze(normalized),
		provenance: Object.freeze(provenance),
		diagnostics: Object.freeze(recordDiagnostics),
	});
}

function classifySchemaVariant(envelope) {
	let aliased = false;
	for (const table of envelope?.tables ?? []) for (const row of table?.rows ?? []) for (const cell of row?.cells ?? []) {
		if (HEADER_ALIASES[normalizeHeaderRaw(cell?.columnName)]) aliased = true;
	}
	const present = new Set((envelope?.tables ?? []).map((table) => text(table?.name)));
	const complete = Object.keys(FAMILY_BY_TABLE).every((name) => present.has(name));
	return `${complete ? "complete" : "partial"}-${aliased ? "aliased" : "canonical"}`;
}

function normalizeHeader(value) {
	const header = normalizeHeaderRaw(value);
	return HEADER_ALIASES[header] ?? header;
}

function normalizeHeaderRaw(value) { return text(value).replace(/\s+/g, "").toUpperCase(); }
function text(value) { return String(value ?? "").trim(); }
function finiteOrNull(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function cloneValue(value) {
	if (value instanceof Uint8Array) return value.slice();
	if (value && typeof value === "object") return structuredClone(value);
	return value ?? null;
}
