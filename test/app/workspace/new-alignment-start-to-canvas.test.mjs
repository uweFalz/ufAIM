import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
const rootUrl=new URL("../../../",import.meta.url),aliases={"@app/":"app/","@src/":"src/","@utils/":"src/lib/utils/","@spot/":"src/model/spot/","@transition/":"src/domain/transition/"};registerHooks({resolve(specifier,context,nextResolve){for(const[prefix,target]of Object.entries(aliases))if(specifier.startsWith(prefix))return nextResolve(new URL(target+specifier.slice(prefix.length),rootUrl).href,context);return nextResolve(specifier,context);}});
const { makeGndImportWorkbenchController } = await import("../../../app/gndImportWorkbench/gndImportWorkbenchController.js");
const { normalizeExplicitAlignmentName, createAlignmentFromExplicitName } = await import("../../../app/controllers/alignmentCreationController.js");

function installDocument() {
	class Node { constructor() { this.children=[]; this.dataset={}; this.classList={ contains:()=>false, add(){}, remove(){} }; } append(...x){this.children.push(...x);} replaceChildren(...x){this.children=x;} setAttribute(){} addEventListener(){} querySelector(){return null;} }
	const overlay = new Node(), root = new Node(); overlay.classList={ contains:()=>false, add(){}, remove(){} };
	globalThis.document={ documentElement:{style:{},dataset:{}}, createElement:()=>new Node(), createDocumentFragment:()=>new Node(), querySelectorAll:()=>[], getElementById:id=>id==="gndImportWorkbenchOverlay"?overlay:id==="gndImportWorkbenchBody"?root:null };
	globalThis.window={ addEventListener(){} };
}

test("explicit name creates once, verifies canonical object, activates canvas and opens authoring", async () => {
	installDocument(); let creates=0, activations=0, opened=null, release;
	const pending = new Promise(resolve => { release=resolve; });
	const controller=makeGndImportWorkbenchController({ store:{actions:{}}, messaging:{async sendCmdAwait(name){if(name==="Spot.GetState") return {objects:creates?[{id:"A1",type:"alignment"}]:[]}; return {items:[],rejectedItems:[],records:[]};}}, alignmentCreation:{async create(value){creates++; assert.deepEqual(value,{name:"Bahnhof West"}); await pending; return {spotObject:{id:"A1"},alignmentData:{id:"A1"}};}}, cockpit:{async activateSpotObject(id){activations++; return id==="A1";}}, alignmentEditorBridge:{async open(value){opened=value; return true;}} });
	const first=controller.createAlignment("  Bahnhof West  "), duplicate=controller.createAlignment("Bahnhof West");
	assert.equal(await duplicate,false); assert.equal(creates,1); release(); assert.equal(await first,"A1"); assert.equal(activations,1); assert.deepEqual(opened,{objectId:"A1",discipline:"horizontal",source:"guided-start-create"}); assert.equal(controller.getState().newAlignmentPhase,"created");
});

test("missing explicit name performs zero create and exposes retryable error", async () => {
	installDocument(); let creates=0; const controller=makeGndImportWorkbenchController({store:{actions:{}},messaging:{},alignmentCreation:{async create(){creates++;}}});
	assert.equal(await controller.createAlignment("   "),false); assert.equal(creates,0); assert.equal(controller.getState().newAlignmentPhase,"error"); assert.match(controller.getState().workspaceFeedback,/Name/);
});

test("direct creation input uses the same explicit trimmed-name contract", async () => {
	assert.equal(normalizeExplicitAlignmentName("  Direkte Trasse  "), "Direkte Trasse");
	assert.equal(normalizeExplicitAlignmentName("   "), "");
	assert.equal(normalizeExplicitAlignmentName(undefined), "");
	const calls=[]; const editor={async newAlignment(value){calls.push(value);return{changed:true};}};
	assert.equal((await createAlignmentFromExplicitName(editor,{name:"   "})).code,"ALIGNMENT_NAME_REQUIRED"); assert.deepEqual(calls,[]);
	assert.equal((await createAlignmentFromExplicitName(editor,{name:"  Direkte Trasse  "})).changed,true); assert.deepEqual(calls,[{name:"Direkte Trasse"}]);
});
