import assert from "node:assert/strict";
import test from "node:test";
import { buildVerticalProfileAuthoringDockModel } from "../../../app/domain/workspace/buildVerticalProfileAuthoringDockModel.js";
import { createVerticalProfileAuthoringDockController } from "../../../app/controllers/alignment-profile/createVerticalProfileAuthoringDockController.js";

const projection = { alignmentId: "A", selectableElements: { vertical: [{ elementId: "V1", type: "constant-gradient", startS: 0, endS: 50 }, { elementId: "V2", type: "parabolic", startS: 50, endS: 100 }] }, terminalParabolicVerticalElement: { id: "V2", type: "parabolic", gradientRate: 0.001, endS: 100 } };
test("only exact terminal parabolic element is editable", () => {
	assert.equal(buildVerticalProfileAuthoringDockModel({ projection, activeObjectId: "A", requestedObjectId: "A", requestedElementId: "V2" }).canEdit, true);
	assert.equal(buildVerticalProfileAuthoringDockModel({ projection, activeObjectId: "A", requestedElementId: "V1" }).canEdit, false);
	assert.equal(buildVerticalProfileAuthoringDockModel({ projection, activeObjectId: "B", requestedObjectId: "B", requestedElementId: "V2" }).status, "unavailable");
	assert.equal(buildVerticalProfileAuthoringDockModel({ projection, activeObjectId: "A", requestedElementId: "missing" }).status, "target-missing");
});
test("controller delegates exact existing composite action and blocks duplicate submit", async () => {
	let handlers; let calls=0; let resolve; const pending=new Promise(r=>resolve=r); const renders=[];
	const controller=createVerticalProfileAuthoringDockController({ store:{getState:()=>({workspace_selection:{primaryId:"A"}})}, profileSource:{getCurrentProjection:()=>projection,subscribeProjection(){return()=>{};},updateTerminalParabolicComposite(){calls++;return pending;}}, ui:{openVerticalProfileAuthoring(){}}, view:{render:(m,s)=>renders.push([m,s]),setHandlers(h){handlers=h;}} });
	controller.open({objectId:"A",elementId:"V2"}); const first=handlers.editTerminal({elementId:"V2",gradientRate:.002,endS:120}); const second=await handlers.editTerminal({}); assert.equal(second,false); assert.equal(calls,1); resolve({status:"saved"}); assert.equal(await first,true); assert.equal(renders.at(-1)[1].status,"saved"); controller.stop();
});

test("submit rechecks exact active object projection and terminal identity", async () => {
	let activeId = "A"; let currentProjection = projection; let handlers; let calls = 0;
	const controller = createVerticalProfileAuthoringDockController({
		store: { getState: () => ({ workspace_selection: { primaryId: activeId } }) },
		profileSource: { getCurrentProjection: () => currentProjection, subscribeProjection() { return () => {}; }, async updateTerminalParabolicComposite() { calls += 1; return {}; } },
		ui: { openVerticalProfileAuthoring() {} }, view: { render() {}, setHandlers(value) { handlers = value; } },
	});
	assert.equal(controller.open({ objectId: "A", elementId: "V2" }), true);
	activeId = "B"; assert.equal(await handlers.editTerminal({ elementId: "V2", gradientRate: .002, endS: 120 }), false); assert.equal(calls, 0);
	activeId = "A"; currentProjection = { ...projection, selectableElements: { vertical: [{ elementId: "V3", type: "parabolic" }] }, terminalParabolicVerticalElement: { id: "V3", type: "parabolic", gradientRate: .001, endS: 100 } };
	assert.equal(await handlers.editTerminal({ elementId: "V2", gradientRate: .002, endS: 120 }), false); assert.equal(calls, 0);
	assert.equal(controller.open({ objectId: "A", elementId: "missing" }), false);
});
