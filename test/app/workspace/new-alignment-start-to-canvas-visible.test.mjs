import assert from "node:assert/strict";
import test from "node:test";

class Node { constructor(tag="div"){this.tag=tag;this.children=[];this.dataset={};this.textContent="";this.disabled=false;} append(...x){this.children.push(...x);} replaceChildren(...x){this.children=x;} setAttribute(name,value){if(name.startsWith("data-"))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);else this[name]=String(value);} get text(){return [this.textContent,...this.children.map(x=>x?.text??"")].join("");} find(fn){if(fn(this))return this;for(const x of this.children){const hit=x?.find?.(fn);if(hit)return hit;}return null;} }
globalThis.document={createElement:tag=>new Node(tag),createDocumentFragment:()=>new Node("fragment")};
const {renderGndImportWorkbench}=await import("../../../app/gndImportWorkbench/gndImportWorkbenchView.js");
const model=phase=>({phase:"ready",records:[],items:[],rejectedItems:[],fileOutcomes:[],lifecycle:null,dropState:null,workspacePhase:"ready",workspaceObjects:[],newAlignmentPhase:phase});

test("guided start requires a visible explicit name and claims no invented engineering facts",()=>{const root=new Node();renderGndImportWorkbench(root,model("idle"));const input=root.find(x=>Object.hasOwn(x.dataset,"newAlignmentName"));assert.ok(input);assert.equal(input.placeholder,"Name des Alignments");assert.match(root.text,/ohne erfundene Geometrie, Geschwindigkeit, Stationierung oder CRS/);assert.match(root.text,/Neues Alignment anlegen/);});
test("real pending and error phases are visible and disable duplicate submit",()=>{const busy=new Node();renderGndImportWorkbench(busy,model("creating"));assert.match(busy.text,/wird angelegt/);assert.equal(busy.find(x=>x.dataset.createAlignment==="true").disabled,true);const failed=new Node();renderGndImportWorkbench(failed,model("error"));assert.match(failed.text,/Erneut anlegen/);});
