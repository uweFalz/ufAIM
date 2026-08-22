import test from "node:test";
import assert from "node:assert/strict";
import { buildGndSourceEvidenceBands } from "../../../app/domain/workspace/buildGndSourceEvidenceBands.js";

test("EH and EU source parameters become visible numeric bands without constructive interpretation", () => {
	const bands = buildGndSourceEvidenceBands({ unresolvedEvidence: [
		attachment("profile", "EH", "uniquely-attachable", [
			element("EH", "EH:1", 0, 50, 0, 4),
			element("EH", "EH:2", 1, 25, 4, -2),
		]),
		attachment("cant", "EU", "ambiguous-unattached", [element("EU", "EU:1", 2, 75, 0, 0.12)]),
	] });
	assert.equal(bands[0].family, "EH");
	assert.equal(bands[0].interpretation, "source-evidence-only");
	assert.deepEqual(bands[0].drawableSegments.map(({ startS, endS, startValue, endValue }) => ({ startS, endS, startValue, endValue })), [
		{ startS: 0, endS: 50, startValue: 0, endValue: 4 },
		{ startS: 50, endS: 75, startValue: 4, endValue: -2 },
	]);
	assert.equal(bands[1].segments[0].attachmentStatus, "ambiguous-unattached");
	assert.equal(bands[1].segments[0].endValue, 0.12);
	assert.equal(bands[1].valueUnit, "m (Quellüberhöhung)");
});

test("incomplete source evidence remains visible but is never drawable by inference", () => {
	const [profile] = buildGndSourceEvidenceBands({ unresolvedEvidence: [attachment("profile", "EH", "unresolved", [{
		family: "EH", rowRef: "EH:3", typeCode: 999, parameters: { EHPAR1: 10, EHPAR2: 1, EHPAR3: null },
	}])] });
	assert.equal(profile.segments.length, 1);
	assert.equal(profile.segments[0].drawable, false);
	assert.equal(profile.segments[0].startS, null);
	assert.equal(profile.drawableSegments.length, 0);
});

test("typed source envelope remains a numeric fallback when the item bridge has no attachment copy", () => {
	const bands = buildGndSourceEvidenceBands({
		diagnostics: [{ family: "EU", code: "cant-context-ambiguous-unattached" }],
		sourceEnvelope: { tables: [
			table("X_ASC22_EH", row(3, { PAD1: "P1", PAD2: "P2", EHTYP: 1, EHPAR1: 80, EHPAR2: -2, EHPAR3: 3 })),
			table("X_ASC23_EU", row(4, { PAD1: "P1", PAD2: "P2", EUTYP: 2, EUPAR1: 80, EUPAR2: 0, EUPAR3: 0.12 })),
		] },
	});
	assert.equal(bands[0].segments[0].rowRef, "X_ASC22_EH:3");
	assert.equal(bands[0].segments[0].endValue, 3);
	assert.equal(bands[1].segments[0].endValue, 0.12);
	assert.equal(bands[1].segments[0].attachmentStatus, "ambiguous-unattached");
});

function attachment(kind, family, attachmentStatus, sourceElements) {
	return { kind, attachmentStatus, padStart: "P1", padEnd: "P2", sourceElements: sourceElements.map((entry) => ({ ...entry, family })) };
}
function element(family, rowRef, typeCode, length, start, end) {
	return { family, rowRef, typeCode, padStart: "P1", padEnd: "P2", parameters: { [`${family}PAR1`]: length, [`${family}PAR2`]: start, [`${family}PAR3`]: end } };
}
function table(name, ...rows) { return { name, rows }; }
function row(ordinal, values) { return { ordinal, cells: Object.entries(values).map(([columnName, value]) => ({ columnName, state: value === 0 ? "zero" : "value", value })) }; }
