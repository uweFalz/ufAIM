import assert from "node:assert/strict";
import test from "node:test";
import { makeGndImportWorkbenchController } from "../../../app/gndImportWorkbench/gndImportWorkbenchController.js";

function installDocument() {
	class Node { constructor() { this.children=[]; this.dataset={}; this.className=""; this.textContent=""; this.childElementCount=0; } append(...x){this.children.push(...x);this.childElementCount=this.children.length;} replaceChildren(...x){this.children=[...x];this.childElementCount=this.children.length;} setAttribute(){} addEventListener(){} querySelector(){return null;} }
	const classes = new Set(["hidden"]);
	const overlay = { classList: { add:v=>classes.add(v), remove:v=>classes.delete(v), contains:v=>classes.has(v) } };
	const root = new Node(), clicks = [];
	globalThis.document = { documentElement:{style:{},dataset:{}}, createElement:()=>new Node(), createDocumentFragment:()=>new Node(), querySelectorAll:()=>[], getElementById(id){ if(id==="gndImportWorkbenchBody")return root;if(id==="gndImportWorkbenchOverlay")return overlay;if(id==="btnSpot"||id==="btnImport")return {click(){clicks.push(id);},addEventListener(){}};return null;} };
	globalThis.window = { addEventListener(){} };
	return { overlay, clicks };
}

test("normal start opens the guided surface after canonical workspace hydration", async () => {
	const { overlay } = installDocument();
	const controller = makeGndImportWorkbenchController({ store:{actions:{}}, messaging:{ async sendCmdAwait(name){ if(name==="Spot.GetState") return {objects:[]}; throw new Error(name); } }, cockpit:{} });
	controller.start();
	await new Promise((resolve)=>setImmediate(resolve));
	assert.equal(overlay.classList.contains("hidden"), false);
	assert.equal(controller.getState().workspacePhase, "ready");
});

test("existing start actions delegate to the existing object and import entry points", () => {
	const { clicks } = installDocument();
	const controller = makeGndImportWorkbenchController({ store:{actions:{}}, messaging:{}, cockpit:{} });
	controller.openObjects();
	controller.chooseFiles();
	assert.deepEqual(clicks, ["btnSpot", "btnImport"]);
});

test("workspace retry performs one authoritative refresh and exposes canonical objects", async () => {
	installDocument(); let calls = 0;
	const controller = makeGndImportWorkbenchController({ store:{actions:{}}, messaging:{ async sendCmdAwait(name){ assert.equal(name,"Spot.GetState"); calls += 1; return {state:{objects:{A1:{id:"A1",type:"alignment"}}}}; } }, cockpit:{} });
	const objects = await controller.refreshWorkspaceState();
	assert.equal(calls,1);
	assert.deepEqual(objects.map((entry)=>entry.id),["A1"]);
	assert.equal(controller.getState().workspacePhase,"ready");
});
