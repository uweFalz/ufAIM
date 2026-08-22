import assert from "node:assert/strict";
import test from "node:test";
import { buildGndNormalizedSourceLayer } from "../src/import/parsers/technet/gndEdit/gnd/buildGndNormalizedSourceLayer.js";
import { createGndSourceEnvelope } from "../src/import/parsers/technet/gndEdit/gnd/gndSourceEnvelope.js";

function envelope() {
	return createGndSourceEnvelope({
		source: { fileName: "demo.mdb", byteLength: 42, sha256: "abc", container: "mdb", format: "Jet 4 MDB" },
		extractor: { id: "mdb-reader", version: "3.2.0" },
		inventory: [
			{ name: "X_ASC11_PP", ordinal: 0, interpreted: true },
			{ name: "X_ASC12_PL", ordinal: 1, interpreted: true },
			{ name: "EXTRA", ordinal: 7, interpreted: false },
		],
		tables: [
			{ name: "X_ASC11_PP", ordinal: 0, rows: [{ ordinal: 4, cells: [
				{ columnName: " PAD ", state: "value", value: " P1 " },
				{ columnName: "STATION", state: "zero", value: 0 },
				{ columnName: "COMMENT", state: "empty", value: "" },
			] }] },
			{ name: "X_ASC12_PL", ordinal: 1, rows: [{ ordinal: 9, cells: [
				{ columnName: "LSYST", state: "value", value: " DB_REF " },
				{ columnName: "Y", state: "unreadable", value: null },
			] }] },
		],
	});
}

test("every relevant row retains raw state, normalized values and exact provenance", () => {
	const layer = buildGndNormalizedSourceLayer(envelope());
	assert.equal(layer.type, "GndNormalizedSourceLayer");
	assert.equal(layer.sourceDocument.fingerprint, "abc");
	assert.equal(layer.sourceDocument.schemaVariant, "partial-aliased");
	assert.equal(layer.records.length, 2);
	const pp = layer.records[0];
	assert.equal(pp.sourceId, "abc:X_ASC11_PP:4");
	assert.deepEqual(pp.raw.STATION, { state: "zero", value: 0 });
	assert.equal(pp.normalized.PAD, "P1");
	assert.equal(pp.normalized.STATION, 0);
	assert.equal(pp.normalized.COMMENT, null);
	assert.deepEqual(pp.provenance.PAD.locator, { table: "X_ASC11_PP", row: 4, column: "PAD", cellOrdinal: 0 });
	const pl = layer.records[1];
	assert.equal(pl.normalized.LSYS, "DB_REF");
	assert.equal(Object.hasOwn(pl.normalized, "Y"), false);
	assert.equal(pl.diagnostics[0].code, "source-cell-not-normalized");
});

test("unsupported inventory content has an explicit exclusion reason", () => {
	const layer = buildGndNormalizedSourceLayer(envelope());
	assert.deepEqual(layer.unsupported, [{ table: "EXTRA", reason: "inventory-only-source-table", inventoryOrdinal: 7 }]);
});

test("building the source layer does not mutate the typed envelope", () => {
	const source = envelope(), before = structuredClone(source);
	buildGndNormalizedSourceLayer(source);
	assert.deepEqual(source, before);
});

test("PP PL and PH observation groups retain every exact duplicate and conflict source", () => {
	const source = createGndSourceEnvelope({
		source: { fileName: "observations.mdb", byteLength: 84, sha256: "obs", container: "mdb", format: "Jet 4 MDB" },
		extractor: { id: "mdb-reader", version: "3.2.0" },
		inventory: [],
		tables: [
			table("X_ASC11_PP", [
				row(1, { PAD: "P1", PSTRECKE: "1720", PSTRRIKZ: 1, STATION: 10 }),
				row(2, { PAD: "P1", PSTRECKE: "1720", PSTRRIKZ: 1, STATION: 10 }),
				row(3, { PAD: "P1", PSTRECKE: "1720", PSTRRIKZ: 1, STATION: 11 }),
				row(4, { PAD: "P1", PSTRECKE: "1730", PSTRRIKZ: 1, STATION: 11 }),
			]),
			table("X_ASC12_PL", [
				row(5, { PAD: "P1", LSYST: "L1", Y: 100, X: 200 }),
				row(6, { PAD: "P1", LSYS: "L1", Y: 100, X: 200 }),
				row(7, { PAD: "P1", LSYS: "L1", Y: 100.00000000000001, X: 200 }),
			]),
			table("X_ASC13_PH", [
				row(8, { PAD: "P1", HSYST: "H1", H: 50 }),
				row(9, { PAD: "P1", HSYS: "H1", H: 50 }),
			]),
		],
	});
	const layer = buildGndNormalizedSourceLayer(source);
	assert.equal(layer.records.length, 9);
	assert.equal(layer.observationGroups.length, 4);

	const pp = layer.observationGroups.find((group) => group.family === "PP" && group.identity.STRECKE === 1720);
	assert.equal(pp.classification, "conflict");
	assert.equal(pp.observations.length, 3);
	assert.deepEqual(pp.conflict.sourceIds, ["obs:X_ASC11_PP:1", "obs:X_ASC11_PP:2", "obs:X_ASC11_PP:3"]);
	assert.deepEqual(pp.conflict.locators, [
		{ table: "X_ASC11_PP", row: 1 },
		{ table: "X_ASC11_PP", row: 2 },
		{ table: "X_ASC11_PP", row: 3 },
	]);
	assert.deepEqual(pp.conflict.differingFields, ["STATION"]);
	assert.equal(pp.observations[0].locators.STATION.column, "STATION");
	assert.equal(pp.valueGroups[0].classification, "duplicate-equal");
	assert.deepEqual(pp.valueGroups[0].sourceIds, ["obs:X_ASC11_PP:1", "obs:X_ASC11_PP:2"]);
	assert.equal(pp.valueGroups[1].classification, "single");
	assert.deepEqual(pp.conflict.fieldLocators.map((entry) => entry.locators.STATION.row), [1, 2, 3]);
	assert.equal(layer.observationGroups.find((group) => group.family === "PP" && group.identity.STRECKE === 1730).classification, "single");

	const pl = layer.observationGroups.find((group) => group.family === "PL");
	assert.equal(pl.classification, "conflict");
	assert.equal(pl.observations.length, 3);
	assert.deepEqual(pl.conflict.differingFields, ["Y"]);
	assert.equal(pl.valueGroups[0].classification, "duplicate-equal");
	assert.equal(pl.valueGroups[1].classification, "single");
	assert.equal(pl.observations[0].locators.LSYS.column, "LSYST");
	assert.equal(pl.observations[1].locators.LSYS.column, "LSYS");

	const ph = layer.observationGroups.find((group) => group.family === "PH");
	assert.equal(ph.classification, "duplicate-equal");
	assert.equal(ph.observations.length, 2);
	assert.equal(ph.conflict, null);
	assert.deepEqual(ph.evidence.sourceIds, ["obs:X_ASC13_PH:8", "obs:X_ASC13_PH:9"]);
	assert.equal(Object.hasOwn(ph, "winner"), false);
	assert.equal(Object.hasOwn(ph, "selected"), false);
});

function table(name, rows) { return { name, rows }; }
function row(ordinal, values) {
	return {
		ordinal,
		cells: Object.entries(values).map(([columnName, value]) => ({
			columnName,
			state: value === 0 ? "zero" : "value",
			value,
		})),
	};
}
