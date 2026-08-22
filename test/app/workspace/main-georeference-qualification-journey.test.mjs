import assert from "node:assert/strict";
import test from "node:test";
import { buildMainGeoreferenceQualificationModel } from "../../../app/domain/workspace/buildMainGeoreferenceQualificationModel.js";
import { createExistingAlignmentIntelligenceJourneyController } from "../../../app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js";

test("local GND evidence stays LOCAL without EPSG or map readiness", () => {
	const model = buildMainGeoreferenceQualificationModel({ mode: "main", context: { objectId: "A", s: 25 }, debugObjectId: "A", georeference: { validationStatus: "malformed-crs", sourceCrs: "SYNTH_LSYS", transformationAvailable: false, coordinateProvenance: "GND.PL", warnings: ["source requires review"] } });
	assert.equal(model.coordinateMode, "local-cartesian");
	assert.equal(model.resolvedEpsg, null);
	assert.equal(model.mapReady, false);
	assert.equal(model.actions.showOnMap, false);
	assert.equal(model.actions.openReview, true);
	assert.equal(model.coordinateProvenance, "GND.PL");
});

test("only existing validated transform authority qualifies map and marker", () => {
	const model = buildMainGeoreferenceQualificationModel({ mode: "main", context: { objectId: "A", s: 12 }, debugObjectId: "A", cursor: { x: 1, y: 2 }, georeference: { validationStatus: "valid", sourceCrs: "DB_REF", resolvedEpsg: "EPSG:5683", transformationAvailable: true, coordinateProvenance: "GND.PL:Y(easting),X(northing)" } });
	assert.equal(model.coordinateMode, "qualified");
	assert.equal(model.resolvedEpsg, "EPSG:5683");
	assert.equal(model.mapReady, true);
	assert.equal(model.markerReady, true);
	assert.equal(model.actions.showOnMap, true);
});

test("qualified map without an existing finite cursor never claims marker readiness", () => {
	const base = { mode: "main", context: { objectId: "A", s: 12 }, debugObjectId: "A", georeference: { validationStatus: "valid", resolvedEpsg: "EPSG:5683", transformationAvailable: true } };
	for (const cursor of [null, { x: Number.NaN, y: 2 }, { x: 1, y: Number.POSITIVE_INFINITY }]) {
		const model = buildMainGeoreferenceQualificationModel({ ...base, cursor });
		assert.equal(model.mapReady, true); assert.equal(model.markerReady, false); assert.equal(model.actions.showOnMap, true);
	}
});

test("selected B never borrows qualified georeference or cursor from debug object A", () => {
	const evidence = { validationStatus: "valid", sourceCrs: "DB_REF", resolvedEpsg: "EPSG:5683", transformationAvailable: true, coordinateProvenance: "GND.PL" };
	const stale = buildMainGeoreferenceQualificationModel({ mode: "main", context: { objectId: "B", s: 0 }, debugObjectId: "A", georeference: evidence, cursor: { x: 1, y: 2 } });
	assert.equal(stale.coordinateMode, "local-cartesian"); assert.equal(stale.resolvedEpsg, null); assert.equal(stale.mapReady, false); assert.equal(stale.markerReady, false); assert.equal(stale.provenancePresent, false); assert.deepEqual(stale.warnings, []);
	const current = buildMainGeoreferenceQualificationModel({ mode: "main", context: { objectId: "B", s: 0 }, debugObjectId: "B", georeference: evidence, cursor: { x: 1, y: 2 } });
	assert.equal(current.coordinateMode, "qualified"); assert.equal(current.mapReady, true); assert.equal(current.markerReady, true);
});

test("controller reprojects exact canonical debug evidence in Main and hides journey in q and L", () => {
	let mode = "main"; const rendered = [];
	const controller = createExistingAlignmentIntelligenceJourneyController({
		store: { getState: () => ({ workspace_selection: { primaryId: "A" }, cursor: { s: 30 } }), subscribe: () => () => {} },
		workspace: { getActiveMode: () => mode },
		viewController: { getDebugState: () => ({ objectId: "A", segmentCount: 1, cursor: { x: 10, y: 20 }, georeference: { validationStatus: "valid", resolvedEpsg: "EPSG:5683", sourceCrs: "DB_REF", transformationAvailable: true } }) },
		view: { render: (model) => rendered.push(model) },
	});
	controller.start();
	assert.equal(rendered.at(-1).georeferenceQualification.visible, true);
	assert.equal(rendered.at(-1).georeferenceQualification.objectId, "A");
	mode = "q"; controller.render(); assert.equal(rendered.at(-1).georeferenceQualification.visible, false);
	mode = "l"; controller.render(); assert.equal(rendered.at(-1).georeferenceQualification.visible, false);
});
