import assert from "node:assert/strict";
import test from "node:test";

class Node { constructor(tag="div") { this.tag=tag; this.children=[]; this.dataset={}; this.textContent=""; this.className=""; this.disabled=false; } append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=[...nodes];} setAttribute(name,value){if(name.startsWith("data-"))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);} get text(){return [this.textContent,...this.children.map(x=>x?.text??"")].join("");} find(fn){if(fn(this))return this;for(const child of this.children){const found=child?.find?.(fn);if(found)return found;}return null;} }
globalThis.document={createElement:(tag)=>new Node(tag),createElementNS:(_ns,tag)=>new Node(tag),createDocumentFragment:()=>new Node("fragment")};
const { renderGndImportWorkbench } = await import("../../../app/gndImportWorkbench/gndImportWorkbenchView.js");
const { buildGndRelationReviewModel } = await import("../../../app/domain/workspace/buildGndRelationReviewModel.js");

test("all relation candidates and their production provenance are visible and none is auto-selected", () => {
	const root=new Node();
	const record={evidenceId:"E1",source:{fileName:"gnd.mdb"},truthfulnessStatus:"construction-available",diagnostics:[],unresolvedEvidence:[],inventory:[],relationCandidates:[{id:"R1",from:"EH1",to:"A1",type:"profile-of",source:{fileName:"gnd.mdb",parserId:"technet-gnd",objectName:"EH1"},origin:"EH",derivedBy:"gnd-relation-evidence",method:"explicit-source-reference",reasons:["shared source key"]},{id:"R2",from:"EU1",to:"A1",type:"cant-of",source:{fileName:"gnd.mdb",parserId:"technet-gnd",objectName:"EU1"},origin:"EU",derivedBy:"gnd-relation-evidence",method:"explicit-source-reference",reasons:["shared source key"]}]};
	renderGndImportWorkbench(root,{phase:"ready",fileOutcomes:[],items:[],rejectedItems:[],activeEvidenceId:"E1",records:[record],relationReviewModel:buildGndRelationReviewModel(record)});
	assert.match(root.text,/R1 · profile-of · EH1 → A1/); assert.match(root.text,/R2 · cant-of · EU1 → A1/);
	assert.match(root.text,/Provenienz: gnd\.mdb · technet-gnd · EH1 · EH · gnd-relation-evidence · explicit-source-reference · shared source key/);
	assert.ok(root.find(node=>node.dataset.gndSourceAssociationReview==="R1")); assert.ok(root.find(node=>node.dataset.gndSourceAssociationReview==="R2"));
	assert.match(root.text,/Quellenassoziation als geprüft markieren/);
	assert.equal(root.find(node=>Object.hasOwn(node.dataset,"gndSourceAssociationWithdrawReview")),null);
});

test("reviewed source association exposes only the reversible withdrawal action",()=>{const root=new Node();renderGndImportWorkbench(root,{phase:"ready",fileOutcomes:[],items:[],rejectedItems:[],activeEvidenceId:"E1",records:[{evidenceId:"E1",source:{},truthfulnessStatus:"construction-available",diagnostics:[],unresolvedEvidence:[],inventory:[],relationCandidates:[]}],relationReviewModel:{evidenceId:"E1",revision:1,status:"reviewed",reviewedCandidateId:"R1",candidates:[{id:"R1",from:"EH1",to:"A1",type:"gndSourceEvidenceAssociation",status:"reviewed",provenance:{}}]}});assert.ok(root.find(node=>node.dataset.gndSourceAssociationWithdrawReview==="R1"));assert.match(root.text,/Prüfung zurücknehmen/);});
