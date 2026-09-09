import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const aliases = {
	"@app/": "app/",
	"@src/": "src/",
	"@kimport/": "src/import/",
	"@kgeom/": "src/lib/geom/",
	"@kmath/": "src/lib/math/",
	"@utils/": "src/lib/utils/",
	"@spot/": "src/model/spot/",
	"@transition/": "src/domain/transition/",
};
registerHooks({
	resolve(specifier, context, nextResolve) {
		for (const [prefix, target] of Object.entries(aliases)) {
			if (specifier.startsWith(prefix)) {
				return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context);
			}
		}
		return nextResolve(specifier, context);
	},
});

import AlignmentProfileApplicationService from "../../../src/services/alignment/AlignmentProfileApplicationService.js";
import { createLongitudinalProfileController } from "../../../app/controllers/alignment-profile/createLongitudinalProfileController.js";
import { createCantCrossLevelViewController } from "../../../app/controllers/alignment-profile/createCantCrossLevelViewController.js";

const { buildAlignmentImportOutcome } = await import("../../../src/import/build/buildAlignmentImportOutcome.js");
const { promoteImportItems } = await import("../../../src/model/spot/mutate/promoteImportItems.js");

function importedAlignment() {
	return {
		id: "A-SOURCE",
		name: "Source-declared profile Alignment",
		sparseAlignment: {
			type: "sparseAlignment",
			version: "sparse_v1",
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			sparse: [
				{ id: "H1", type: "fixed", poseA: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, arcLength: 100, curvature: 0 },
			],
		},
		extras: {
			meta: {
				staStart: { value: 1000, unit: "meter" },
				length: { value: 100, unit: "meter" },
			},
		},
		profile: {
			type: "Profile",
			name: "A-SOURCE profile",
			profAlign: {
				pvis: [
					{ type: "PVI", station: { value: 1000 }, elevation: { value: 10 } },
					{ type: "PVI", station: { value: 1100 }, elevation: { value: 11 } },
				],
				paraCurves: [
					{ type: "ParaCurve", station: { value: 1050 }, elevation: { value: 10.4 }, length: { value: 30 } },
				],
			},
		},
		cant: [
			{ type: "CantStation", station: { value: 1000, unit: "meter" }, appliedCant: { value: 0, unit: "millimeter" } },
			{ type: "CantStation", station: { value: 1100, unit: "meter" }, appliedCant: { value: 95, unit: "millimeter" } },
		],
		staEquations: [
			{ type: "StaEquation", staInternal: { value: 1050 }, staBack: { value: 1050 }, staAhead: { value: 2000 }, staIncrement: "increasing" },
		],
	};
}

function buildAndPromote() {
	const outcome = buildAlignmentImportOutcome({
		alignment: importedAlignment(),
		source: { fileName: "source.xml", parserId: "landXML", objectName: "A-SOURCE" },
		containerUnits: { linearUnit: "meter", elevationUnit: "millimeter", angularUnit: "radian" },
	});
	assert.equal(outcome.ok, true, JSON.stringify(outcome.validation));
	const objects = [];
	const promotion = promoteImportItems({
		items: [outcome.item],
		spotStore: {
			addObjects(entries) { objects.push(...entries); },
			addCrs() {},
		},
	});
	assert.equal(promotion.count.addedObjects, 1);
	return { outcome, object: objects[0] };
}

test("source-declared Vertical, Cant, and StaEquation stay attached to the promoted Alignment", () => {
	const { outcome, object } = buildAndPromote();
	const imported = outcome.item.payload.sourceAttachments;
	assert.equal(imported.association, "source-declared-inline-alignment-child");
	assert.equal(imported.profile.profAlign.pvis.length, 2);
	assert.equal(imported.cant[1].appliedCant.value, 95);
	assert.equal(imported.staEquations[0].staAhead.value, 2000);

	const alignmentData = object.data.alignmentData;
	assert.deepEqual(alignmentData.sourceAttachments, imported);
	assert.equal(alignmentData.profileState.vertical, null);
	assert.equal(alignmentData.profileState.cant, null);
	assert.equal(alignmentData.profileState.chainageMappings.length, 1);
	assert.equal(alignmentData.profileState.chainageMappings[0].segments.length, 2);
	assert.equal(alignmentData.profileState.chainageMappings[0].segments[1].startAddress, 2000);
	assert.deepEqual(structuredClone(alignmentData).sourceAttachments, imported);
});

test("one shared intrinsic-s cursor projects source evidence, chainage, longitudinal, and cross-section status", async () => {
	const { object } = buildAndPromote();
	const alignmentData = structuredClone(object.data.alignmentData);
	const service = new AlignmentProfileApplicationService({
		alignmentRepository: {
			async loadById(id) { return id === alignmentData.id ? alignmentData : null; },
			async saveById() { throw new Error("not used"); },
		},
	});
	const projection = await service.projectAt({ alignmentId: alignmentData.id, s: 75 });
	assert.equal(projection.vertical.status, "source-evidence");
	assert.equal(projection.vertical.admission, "evidence-only");
	assert.equal(projection.vertical.admissible, false);
	assert.equal(projection.vertical.sourceRecords[1].type, "ParaCurve");
	assert.equal(projection.vertical.value.s, 75);
	assert.equal(projection.cant.status, "source-evidence");
	assert.equal(projection.cant.admission, "evidence-only");
	assert.equal(projection.cant.admissible, false);
	assert.equal(projection.cant.reference.scalarCrossLevelStatus, "partial-evidence");
	assert.equal(projection.chainage.mappings[0].candidates[0].address, 2025);

	const longitudinal = await createLongitudinalProfileController({
		alignmentProfileApplicationService: service,
	}).project({
		alignmentId: alignmentData.id,
		revision: "R1",
		s: 75,
		profileState: alignmentData.profileState,
		sourceProjection: projection.vertical,
	});
	assert.equal(longitudinal.status, "projected");
	assert.equal(longitudinal.admission, "evidence-only");
	assert.equal(longitudinal.samples.length, 3);
	assert.equal(longitudinal.cursor.status, "source-evidence");

	const crossSection = createCantCrossLevelViewController().project({
		alignmentId: alignmentData.id,
		revision: "R1",
		s: 75,
		profileState: alignmentData.profileState,
		sourceProjection: projection.cant,
	});
	assert.equal(crossSection.status, "projected");
	assert.equal(crossSection.admission, "evidence-only");
	assert.equal(crossSection.admissible, false);
	assert.equal(crossSection.samples[1].crossLevel, 95);
	assert.equal(crossSection.crossSection.pairedRails.status, "unknown");
});
