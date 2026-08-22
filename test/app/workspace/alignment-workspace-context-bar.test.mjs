import assert from "node:assert/strict";
import test from "node:test";
import { buildAlignmentWorkspaceContextBarModel } from "../../../app/domain/workspace/buildAlignmentWorkspaceContextBarModel.js";

test("binds exact canonical context mode and qualified spatial fact", () => {
	const model = buildAlignmentWorkspaceContextBarModel({ intelligence: { mode: "q", context: { objectId: "A", route: "4711", sourceRole: "1", s: 25 } }, georeferenceQualification: { coordinateMode: "qualified", resolvedEpsg: "EPSG:25832" } });
	assert.equal(model.status, "active"); assert.equal(model.mode, "q"); assert.deepEqual(model.context, { objectId: "A", route: "4711", sourceRole: "1", s: 25, coordinateMode: "QUALIFIED · EPSG:25832" }); assert.equal(model.actions.openTaskRail, true);
});

test("absent and incomplete contexts stay honest without stale identity", () => {
	const absent = buildAlignmentWorkspaceContextBarModel({ intelligence: { mode: "main", context: { route: "stale", s: 10 } } });
	assert.equal(absent.status, "absent"); assert.equal(absent.context.objectId, null); assert.equal(absent.context.route, null); assert.equal(absent.context.s, null); assert.equal(absent.actions.openTaskRail, false); assert.equal(absent.context.coordinateMode, null);
	const incomplete = buildAlignmentWorkspaceContextBarModel({ intelligence: { mode: "l", context: { objectId: "A", s: Number.NaN } } }); assert.equal(incomplete.status, "context-incomplete"); assert.equal(incomplete.context.s, null); assert.equal(incomplete.context.coordinateMode, "LOCAL · engineering");
});
