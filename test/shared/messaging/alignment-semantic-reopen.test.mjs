import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
registerHooks({
	resolve(specifier, context, nextResolve) {
		const aliases = {
			"@src/": "src/", "@spot/": "src/model/spot/",
			"@transition/": "src/domain/transition/", "@alignment/": "src/domain/alignment/",
			"@domain/": "src/domain/", "@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/",
		};
		for (const [prefix, target] of Object.entries(aliases)) {
			if (specifier.startsWith(prefix)) {
				return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context);
			}
		}
		return nextResolve(specifier, context);
	},
});

const { createSpotStore } = await import("../../../src/model/spot/model/SpotStore.js");
const { createSpotService } = await import("../../../src/shared/messaging/service/SpotService.js");
const { AlignmentApplicationService } = await import("../../../src/services/alignment/AlignmentApplicationService.js");
const { AlignmentProfileApplicationService } = await import("../../../src/services/alignment/AlignmentProfileApplicationService.js");
const { AlignmentAxtranEvidenceService } = await import("../../../src/services/alignment/AlignmentAxtranEvidenceService.js");
const { createVerticalConstructiveState, appendVerticalElement } = await import("../../../src/aim-core/alignment/profile/VerticalConstructiveState.js");
const { createCantConstructiveState, appendCantElement } = await import("../../../src/aim-core/alignment/profile/CantConstructiveState.js");
const { createChainageMapping, appendChainageSegment } = await import("../../../src/aim-core/alignment/profile/ChainageMapping.js");
const {
	buildHorizontalRealizationChangeReceipt,
	archiveHorizontalRealizationChangeReceipt,
	restoreHorizontalRealizationChangeReceipt,
} = await import("../../../app/domain/workspace/buildHorizontalRealizationChangeReceipt.js");

// Only the transport and storage device are injected. Authoring, mapping,
// repository acknowledgement, persistence orchestration and hydration are real.
function session(persistence) {
	const spotStore = createSpotStore();
	const spot = createSpotService({ spotStore, persistence });
	let selection = { primaryId: null, contextIds: [], elementId: null };
	const localStore = {
		getState: () => ({ workspace_selection: structuredClone(selection) }),
		actions: {
			setWorkspacePrimary({ objectId }) { selection = { ...selection, primaryId: objectId }; },
			setWorkspaceSelection(next) { selection = structuredClone(next); },
		},
	};
	const messaging = {
		async sendCmdAwait(command, payload) {
			if (command === "Spot.AddObjects") return spot.addObjects(payload);
			if (command === "Spot.GetState") {
				await spot.hydrate();
				return { state: spot.getState() };
			}
			throw new Error(`Unexpected test transport command: ${command}`);
		},
	};
	const alignment = new AlignmentApplicationService({ store: localStore, messaging });
	const profile = new AlignmentProfileApplicationService({ alignmentRepository: alignment.alignmentRepository });
	return { spotStore, spot, alignment, profile };
}

function profileState(alignmentId) {
	return {
		vertical: appendVerticalElement(
			createVerticalConstructiveState({ id: "vertical-070", alignmentId }),
			{ id: "V1", type: "constant-gradient", startS: 0, endS: 140, startElevation: 10, gradient: 0.01 }
		),
		cant: appendCantElement(
			createCantConstructiveState({ id: "cant-070", alignmentId }),
			{ id: "C1", type: "linear-cross-level", startS: 0, endS: 140, startCrossLevel: 0, crossLevelRate: 0.001 }
		),
		chainageMappings: [appendChainageSegment(
			createChainageMapping({ id: "chainage-070", alignmentId, schemeId: "fixture-chainage", schemeVersion: "v1" }),
			{ id: "K1", startS: 0, endS: 140, startAddress: 1000, direction: 1 }
		)],
	};
}

test("native radius edit, constructive profiles and qualified evidence survive a fresh service/store readback", async () => {
	const untouched = { id: "untouched-070", type: "note", crsId: null, crsStatus: null, coordContextId: null, data: { text: "preserve", values: [0, null, ""] }, refs: {}, meta: { source: "synthetic-test-fixture" } };
	let persisted = { objects: { [untouched.id]: untouched } };
	let loads = 0;
	let writes = 0;
	const persistence = {
		async load() { loads += 1; return structuredClone(persisted); },
		async save(state) { writes += 1; persisted = structuredClone(state); },
	};
	const first = session(persistence);
	const created = await first.alignment.newAlignment({ name: "Semantic reopen 070" });
	assert.equal(created.changed, true);
	const alignmentId = created.alignmentData.id;
	const added = await first.alignment.addArc({ length: 100, radius: 300 });
	assert.equal(added.changed, true, added.reason ?? added.code);
	const arcId = added.alignmentData.editModel.elements[0].id;
	const continuation = await first.alignment.addTransitionArc({ transitionLength: 20, arcLength: 20, radius: 500 });
	assert.equal(continuation.changed, true, continuation.reason ?? continuation.code);

	// Explicit fixture references/attachments must survive all subsequent saves.
	const annotated = await first.alignment.spotGateway.getObjectById(alignmentId);
	annotated.refs.fixtureSource = { id: "fixture-070", kind: "synthetic-test-reference" };
	annotated.data.extended.untouchedAttachment = { provenance: "fixture-070", payload: [0, null, ""] };
	await first.alignment.spotGateway.saveObject(annotated);
	const declaredProfile = profileState(alignmentId);
	const declaredBefore = structuredClone(declaredProfile);
	const savedProfile = await first.profile.saveProfileState({ alignmentId, profileState: declaredProfile });
	assert.equal(savedProfile.presence, "present");
	const before = await first.alignment.alignmentRepository.loadById(alignmentId);
	assert.deepEqual(before.profileState, declaredProfile);
	const beforeSnapshot = structuredClone(before);
	const beforeObject = await first.alignment.spotGateway.getObjectById(alignmentId);

	const edited = await first.alignment.updateArc({ elementId: arcId, radius: -220 });
	assert.equal(edited.changed, true);
	assert.equal(edited.alignmentChange.objectId, alignmentId);
	assert.equal(edited.alignmentChange.elementId, arcId);
	assert.ok(Date.parse(edited.alignmentChange.revision) > Date.parse(before.meta.modifiedAt));
	assert.equal(edited.alignmentData.editModel.elements[0].parameters.curvature, -1 / 220);
	assert.deepEqual(edited.alignmentData.profileState, declaredProfile);
	assert.deepEqual(edited.alignmentData.editModel.elements.slice(1), before.editModel.elements.slice(1));
	assert.deepEqual(edited.spotObject.refs, beforeObject.refs);
	assert.deepEqual(edited.spotObject.data.extended, beforeObject.data.extended);

	// Zero iterations deliberately measures/stores the edited context, not a
	// converged engineering answer. No solver is run during reopen below.
	const evidence = new AlignmentAxtranEvidenceService().evaluateChange({
		beforeAlignmentData: before,
		afterAlignmentData: edited.alignmentData,
		sampleCount: 3,
		maxIterations: 0,
	});
	assert.equal(evidence.status, "evidence-only");
	assert.equal(evidence.admissible, false);
	assert.equal(evidence.diagnostics.interactiveBudget.effectiveMaxIterations, 0);
	const receipt = buildHorizontalRealizationChangeReceipt({
		beforeAlignmentData: before,
		alignmentChange: edited.alignmentChange,
		activeObjectId: alignmentId,
		activeElementId: arcId,
		axtranEvidence: evidence,
	});
	const entry = archiveHorizontalRealizationChangeReceipt({ receipt, beforeAlignmentData: before, alignmentChange: edited.alignmentChange });
	assert.equal((await first.spot.storeHorizontalReceipt({ objectId: alignmentId, entry })).ok, true);
	const expectedObject = await first.alignment.spotGateway.getObjectById(alignmentId);
	const expectedState = first.spot.getState();
	const projection = await first.profile.projectAt({ alignmentId, s: 50 });
	assert.equal(projection.revision, edited.alignmentChange.revision);
	assert.equal(projection.vertical.value.elevation, 10.5);
	assert.equal(projection.cant.value.crossLevel, 0.05);
	assert.equal(projection.chainage.mappings[0].candidates[0].address, 1050);
	assert.equal(projection.cant.reference.status, "partial");
	assert.equal(projection.cant.reference.sourceReference.status, "unknown");
	assert.equal(projection.speed.status, "absent");
	assert.deepEqual(declaredProfile, declaredBefore);
	assert.deepEqual(before, beforeSnapshot);
	assert.deepEqual(expectedState.objects[untouched.id], untouched);
	assert.equal(writes, 7, "all authoring/profile/evidence operations crossed persistence.save exactly once");
	assert.equal(loads, 1);

	const writesBeforeReopen = writes;
	const reopened = session(persistence);
	assert.deepEqual(reopened.spotStore.getState().objects, {}, "new canonical store starts empty");
	assert.equal(await reopened.alignment.spotGateway.getActiveAlignment(), null, "no inherited window focus");
	await reopened.spot.hydrate();
	assert.equal(loads, 2, "fresh service loaded persisted state rather than the old store");
	assert.deepEqual(reopened.spot.getState(), expectedState);
	const object = await reopened.alignment.spotGateway.getObjectById(alignmentId);
	const data = await reopened.alignment.alignmentRepository.loadById(alignmentId);
	assert.deepEqual(object, expectedObject);
	assert.notStrictEqual(object, expectedObject);
	assert.deepEqual(data, edited.alignmentData);
	assert.equal(data.id, alignmentId);
	assert.equal(data.name, "Semantic reopen 070");
	assert.equal(data.meta.modifiedAt, edited.alignmentChange.revision);
	assert.equal(object.meta.modifiedAt, edited.alignmentChange.revision);
	assert.deepEqual(data.source, { kind: "native", native: true });
	assert.equal(data.placement.mode, "local-cartesian");
	assert.equal(object.crsStatus, "local-cartesian");
	assert.equal(object.crsId, null);
	assert.deepEqual(object.data.kernel, data.sparseAlignment);
	assert.deepEqual(data.profileState, declaredProfile);
	assert.equal(data.profileState.cant.unit, "alignment-length-unit");
	assert.equal(data.profileState.cant.signConvention, "left-minus-right-viewed-in-increasing-s");
	assert.equal(data.profileState.chainageMappings[0].unit, "alignment-length-unit");
	assert.equal(data.profileState.chainageMappings[0].schemeVersion, "v1");
	assert.deepEqual(object.refs, beforeObject.refs);
	assert.deepEqual(object.data.extended.untouchedAttachment, beforeObject.data.extended.untouchedAttachment);
	const restoredReceipt = restoreHorizontalRealizationChangeReceipt({ spotObject: object, elementId: arcId });
	assert.deepEqual(restoredReceipt, receipt);
	assert.deepEqual(restoredReceipt.diagnostics.evidence, evidence);
	assert.equal(restoredReceipt.diagnostics.evidence.admissible, false);
	assert.equal(restoredReceipt.revision, data.meta.modifiedAt);
	assert.deepEqual(await reopened.profile.projectAt({ alignmentId, s: 50 }), projection);
	assert.equal(writes, writesBeforeReopen, "readback does not rewrite state or evidence");
});
