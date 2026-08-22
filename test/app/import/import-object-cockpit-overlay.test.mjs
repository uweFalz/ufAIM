import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) {
	for (const [prefix, target] of Object.entries({ "@app/": "app/", "@src/": "src/" })) {
		if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context);
	}
	return nextResolve(specifier, context);
} });

const { buildImportRows } = await import("../../../app/domain/cockpit/cockpitItemAdapters.js");
const { renderCockpitHtml } = await import("../../../app/view/cockpit/renderCockpitHtml.js");

test("Cockpit exposes qualified and withheld ImportSession candidates before preview", () => {
	const importState = {
		items: [
			{ id: "I1", kind: "alignment", source: { fileName: "track.xml" }, status: { promotable: true }, derived: { sparseAlignment: { elements: [] } } },
			{ id: "I2", kind: "alignment", source: { fileName: "partial.gnd" }, status: { promotable: false, reason: "AMBIGUOUS_RELATION" }, derived: {} },
		],
		rejectedItems: [
			{ id: "I3", kind: "alignment", source: { fileName: "broken.gnd" }, status: { rejected: true, reason: "CONFLICTING_EVIDENCE" }, derived: {} },
		],
	};
	const rows = buildImportRows({}, importState);
	assert.deepEqual(rows.map((row) => [row.itemId, row.statusLabel, row.reason]), [
		["I1", "qualifizierter Kandidat", null],
		["I2", "partiell / nicht übernehmbar", "AMBIGUOUS_RELATION"],
		["I3", "abgelehnt", "CONFLICTING_EVIDENCE"],
	]);
	const html = renderCockpitHtml({ scene: { mode: "none" }, context: {}, actions: [], collections: { importRows: rows, spotRows: [] } });
	assert.match(html, /Import result[^<]*· 3 Kandidaten/);
	assert.match(html, /track\.xml/);
	assert.match(html, /AMBIGUOUS_RELATION/);
	assert.match(html, /CONFLICTING_EVIDENCE/);
	assert.equal((html.match(/data-cockpit-accept-show=/g) ?? []).length, 1);
});

test("Cockpit keeps the canonical object identity after promotion", () => {
	const html = renderCockpitHtml({
		scene: { mode: "spot", objectId: "SPOT-A1", label: "Imported A1", type: "alignment", status: "in_workspace" },
		context: { spotCount: 1 }, actions: [],
		collections: { importRows: [], spotRows: [{ objectId: "SPOT-A1", label: "Imported A1", type: "alignment", isActive: true }] },
	});
	assert.match(html, /Fokus: SPOT-A1/);
	assert.match(html, /Imported A1/);
	assert.doesNotMatch(html, /Import result/);
});
