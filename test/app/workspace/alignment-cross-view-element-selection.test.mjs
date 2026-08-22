import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const aliases = { "@app/": "app/", "@src/": "src/", "@utils/": "src/lib/utils/", "@projection/": "src/domain/projection/", "@runtime/": "app/runtime/" };
registerHooks({ resolve(specifier, context, nextResolve) { for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context); return nextResolve(specifier, context); } });
const { buildCrossViewElementSelectionModel, resolveViewerElementSelection } = await import("../../../app/domain/workspace/buildCrossViewElementSelectionModel.js");
const { createWindowStore } = await import("../../../app/runtime/state/windowStore.js");

function state(discipline, elementId, primaryId = "A") { return { workspace_selection: { primaryId, elementDiscipline: discipline, elementId } }; }
const horizontalSource = { objectId: "A", projectionSignature: "P", elements: [{ id: "H1", kind: "arc", s0: 0, s1: 50, radius: 300 }] };
const profileSource = { alignmentId: "A", selectableElements: { vertical: [{ elementId: "V1", type: "constant-gradient", startS: 0, endS: 50, properties: { id: "V1", gradient: 0.01 } }], cant: [{ elementId: "C1", type: "constant-cross-level", startS: 0, endS: 50, properties: { id: "C1", startCrossLevel: 0.04 } }], chainage: [{ elementId: "S1", type: "segment", startS: 0, endS: 50, mappingId: "M1", properties: { id: "S1", startAddress: 1000 } }] } };

test("one exact shared selection resolves discipline-specific canonical properties", () => {
	for (const [discipline, id, action] of [["horizontal", "H1", "openHorizontal"], ["vertical", "V1", "openVertical"], ["cant", "C1", "openCant"], ["chainage", "S1", "openChainage"]]) {
		const model = buildCrossViewElementSelectionModel({ state: state(discipline, id), mode: "q", horizontalSource, profileSource }); assert.equal(model.status, "selected"); assert.deepEqual(model.selection, { objectId: "A", discipline, elementId: id }); assert.equal(model.property.action, action); assert.deepEqual(model.property.domain, { startS: 0, endS: 50 });
	}
});

test("horizontal render signature is not provenance while explicit source fields are", () => {
	const technicalOnly = buildCrossViewElementSelectionModel({ state: state("horizontal", "H1"), horizontalSource, profileSource });
	assert.equal(technicalOnly.status, "selected"); assert.equal(technicalOnly.property.provenancePresent, false);
	const sourced = buildCrossViewElementSelectionModel({ state: state("horizontal", "H1"), profileSource, horizontalSource: { ...horizontalSource, elements: [{ ...horizontalSource.elements[0], sourceRefs: ["EL:12"] }] } });
	assert.equal(sourced.property.provenancePresent, true);
});

test("unknown discipline id or object is invalid or empty without correspondence inference", () => {
	assert.equal(buildCrossViewElementSelectionModel({ state: state("vertical", "H1"), horizontalSource, profileSource }).status, "invalid");
	assert.equal(buildCrossViewElementSelectionModel({ state: state("cant", "V1"), horizontalSource, profileSource }).status, "invalid");
	assert.equal(buildCrossViewElementSelectionModel({ state: state("horizontal", "H1", "B"), horizontalSource, profileSource }).status, "invalid");
	assert.equal(buildCrossViewElementSelectionModel({ state: state(null, "H1") }).status, "empty");
});

test("productive window store stays identity-only and Three sync retains non-horizontal selection", () => {
	const store = createWindowStore();
	store.actions.setWorkspaceSelection({ primaryId: "A", contextIds: [], elementDiscipline: "vertical", elementId: "V1", source: "test" });
	assert.equal("objects" in store.getState(), false);
	assert.deepEqual(store.getState().workspace_selection.elementDiscipline, "vertical");
	assert.deepEqual(resolveViewerElementSelection({ selectedElementId: "V1", selectedDiscipline: "vertical", segmentIds: new Set(["H1"]) }), { retainShared: true, clearShared: false, viewerElementId: null });
	const model = buildCrossViewElementSelectionModel({ state: store.getState(), horizontalSource, profileSource });
	assert.equal(model.status, "selected"); assert.equal(model.selection.elementId, "V1");
	assert.deepEqual(resolveViewerElementSelection({ selectedElementId: "H1", selectedDiscipline: "horizontal", segmentIds: new Set(["H1"]) }), { retainShared: true, clearShared: false, viewerElementId: "H1" });
	assert.equal(resolveViewerElementSelection({ selectedElementId: "H2", selectedDiscipline: "horizontal", segmentIds: new Set(["H1"]) }).clearShared, true);
});
