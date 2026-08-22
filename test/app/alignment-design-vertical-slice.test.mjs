import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../", import.meta.url);
const aliases = {
	"@app/": "app/",
	"@src/": "src/",
	"@spot/": "src/model/spot/",
	"@projection/": "src/domain/projection/",
	"@transition/": "src/domain/transition/",
	"@alignment/": "src/domain/alignment/",
	"@domain/": "src/domain/",
	"@shared/": "src/shared/",
	"@kgeom/": "src/lib/geom/",
	"@kmath/": "src/lib/math/",
	"@utils/": "src/lib/utils/",
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

const { AlignmentApplicationService } = await import(
	"../../src/services/alignment/AlignmentApplicationService.js"
);
const { AlignmentMapper } = await import(
	"../../src/model/spot/model/AlignmentSpotObjectMapper.js"
);
const { resolveArcEditChange } = await import(
	"../../app/controllers/bridges/alignmentEditorBridge.js"
);

function fixture() {
	const mapper = new AlignmentMapper();
	let selection = { primaryId: null, contextIds: [], elementId: null, source: "test", crsId: null };
	const objects = new Map();
	const saves = [];
	const gateway = {
		async getActiveAlignment() {
			return selection.primaryId ? structuredClone(objects.get(selection.primaryId) ?? null) : null;
		},
		async getObjectById(id) {
			return structuredClone(objects.get(id) ?? null);
		},
		async saveObject(object, options) {
			objects.set(object.id, structuredClone(object));
			saves.push({ object: structuredClone(object), options: structuredClone(options) });
			if (options?.focus) selection = { ...selection, primaryId: object.id };
			return { spotObject: structuredClone(object), options };
		},
	};
	const repository = {
		async loadById(id) {
			const object = objects.get(id);
			return object ? structuredClone(mapper.readAlignmentDataFromSpotObject(object)) : null;
		},
		async saveById(id, state) {
			const previous = objects.get(id);
			const next = mapper.updateAlignmentSpotObjectFromData(previous, structuredClone(state));
			objects.set(id, structuredClone(next));
			saves.push({ object: structuredClone(next), options: { source: "repository" } });
			return structuredClone(mapper.readAlignmentDataFromSpotObject(next));
		},
	};
	const store = {
		getState: () => ({ workspace_selection: structuredClone(selection) }),
		actions: {
			setWorkspaceSelection(next) { selection = structuredClone(next); },
		},
	};
	const service = new AlignmentApplicationService({
		store,
		spotGateway: gateway,
		mapper,
		alignmentRepository: repository,
	});
	return {
		service,
		mapper,
		repository,
		objects,
		saves,
		getSelection: () => structuredClone(selection),
		setSelectedElement(elementId) { selection = { ...selection, elementId }; },
	};
}

test("create, add arc, edit signed radius, persist and reopen one productive Alignment", async () => {
	const f = fixture();
	const created = await f.service.newAlignment({ name: "Productive vertical slice" });
	assert.equal(created.changed, true);
	assert.strictEqual(created.alignmentChange.alignmentData, created.alignmentData);
	assert.strictEqual(created.alignmentChange.spotObject, created.spotObject);

	const added = await f.service.addArc({ length: 100, curvature: 1 / 300 });
	const arc = added.alignmentData.editModel.elements.at(-1);
	f.setSelectedElement(arc.id);
	assert.equal(added.changed, true);

	const change = resolveArcEditChange({ curvature: String(1 / 300), radius: "-220", authority: "radius" });
	assert.deepEqual(change, { radius: -220 });
	const edited = await f.service.updateArc({ elementId: arc.id, length: 110, ...change });
	assert.equal(edited.changed, true);
	assert.equal(edited.alignmentChange.objectId, created.spotObject.id);
	assert.equal(edited.alignmentChange.elementId, arc.id);
	assert.strictEqual(edited.alignmentChange.alignmentData, edited.alignmentData);
	assert.strictEqual(edited.alignmentChange.spotObject, edited.spotObject);
	assert.equal(edited.alignmentChange.revision, edited.alignmentData.meta.modifiedAt);
	assert.equal(f.getSelection().elementId, arc.id);

	const reopenedObject = structuredClone(f.objects.get(created.spotObject.id));
	const reopened = f.mapper.readAlignmentDataFromSpotObject(reopenedObject);
	assert.deepEqual(reopened, edited.alignmentData);
	assert.equal(reopened.editModel.elements[0].parameters.length, 110);
	assert.equal(reopened.editModel.elements[0].parameters.curvature, -1 / 220);
	assert.deepEqual(reopened.sparseAlignment, edited.sparseAlignment);
	assert.equal(f.saves.length, 3);
});

test("radius and curvature edits select one signed authority without stale reciprocal input", () => {
	assert.deepEqual(
		resolveArcEditChange({ curvature: "0.004", radius: "250", authority: "curvature" }),
		{ curvature: 0.004 }
	);
	assert.deepEqual(
		resolveArcEditChange({ curvature: "-0.004", radius: "-250", authority: "radius" }),
		{ radius: -250 }
	);
	assert.deepEqual(
		resolveArcEditChange({ curvature: "", radius: "0", authority: "radius" }),
		{ radius: 0 }
	);
});

test("no-op and stale persistence acknowledgement reject without a productive change", async () => {
	const f = fixture();
	const created = await f.service.newAlignment({ name: "Acknowledgement rejection" });
	const added = await f.service.addArc({ length: 100, curvature: 1 / 300 });
	const arc = added.alignmentData.editModel.elements.at(-1);

	const noEffect = await f.service.updateArcByAlignmentId({
		alignmentId: created.alignmentData.id,
		elementId: arc.id,
		length: arc.parameters.length,
		curvature: arc.parameters.curvature,
	});
	assert.equal(noEffect.status, "rejected");
	assert.equal(noEffect.code, "NO_EFFECT");

	const canonicalBefore = structuredClone(
		f.mapper.readAlignmentDataFromSpotObject(
			f.objects.get(created.alignmentData.id)
		)
	);
	const originalSave = f.repository.saveById;
	f.repository.saveById = async () => structuredClone(canonicalBefore);
	try {
		const stale = await f.service.updateArcByAlignmentId({
			alignmentId: created.alignmentData.id,
			elementId: arc.id,
			radius: -220,
		});
		assert.equal(stale.status, "rejected");
		assert.equal(stale.code, "PERSISTENCE_ACKNOWLEDGEMENT_REJECTED");
		assert.match(stale.reason, /persisted Alignment acknowledgement mismatch/);
		assert.equal(stale.focusRecommendation, null);
	} finally {
		f.repository.saveById = originalSave;
	}
});
