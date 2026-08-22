import assert from "node:assert/strict";
import test from "node:test";
import { makeGndImportWorkbenchController } from "../../../app/gndImportWorkbench/gndImportWorkbenchController.js";

class Node {
	constructor(tag="div"){this.tag=tag;this.children=[];this.dataset={};this.className="";this.textContent="";this.disabled=false;this.childElementCount=0;}
	append(...children){this.children.push(...children);this.childElementCount=this.children.length;}
	replaceChildren(...children){this.children=[...children];this.childElementCount=this.children.length;}
	setAttribute(name,value){if(name.startsWith("data-"))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
	get text(){return [this.textContent,...this.children.map((child)=>child?.text??child?.textContent??"")].join(" ");}
	find(predicate){if(predicate(this))return this;for(const child of this.children){const found=child?.find?.(predicate);if(found)return found;}return null;}
	findAll(predicate,found=[]){if(predicate(this))found.push(this);for(const child of this.children)child?.findAll?.(predicate,found);return found;}
}
globalThis.document={createElement:(tag)=>new Node(tag),createElementNS:(_ns,tag)=>new Node(tag),createDocumentFragment:()=>new Node("fragment")};
const { renderGndImportWorkbench }=await import("../../../app/gndImportWorkbench/gndImportWorkbenchView.js");
const base={phase:"ready",records:[],items:[],rejectedItems:[],fileOutcomes:[],lifecycle:null,dropState:null,workspacePhase:"ready",workspaceObjects:[]};

test("supported start exposes a distinct directory action",()=>{
	const root=new Node();renderGndImportWorkbench(root,{...base,directoryPickerSupported:true});
	assert.ok(root.find((node)=>node.dataset.importChooseDirectory==="true"));
	assert.match(root.text,/Ordner wählen/);
	assert.match(root.text,/als ein Dataset gemeinsam analysiert/);
});

test("unsupported picker keeps truthful recursive drag and multi-file fallback",()=>{
	const root=new Node();renderGndImportWorkbench(root,{...base,directoryPickerSupported:false});
	assert.equal(root.find((node)=>node.dataset.importChooseDirectory),null);
	assert.ok(root.find((node)=>node.dataset.importChooseFiles==="true"));
	assert.match(root.text,/Ordner per Drag & Drop/);
});

test("the exact controller Window capability reaches the DOM for false and true",()=>{
	for(const [windowRef,supported] of [[{},false],[{showDirectoryPicker(){}},true]]){
		globalThis.window=windowRef;
		const controller=makeGndImportWorkbenchController({store:{actions:{}}});
		const root=new Node();
		renderGndImportWorkbench(root,{...base,...controller.getState(),workspacePhase:"ready"});
		assert.equal(root.findAll((node)=>node.dataset.importChooseDirectory==="true").length,supported?1:0);
		assert.equal(root.text.includes("Ordner per Drag & Drop"),!supported);
	}
});

test("one dataset shows exact total and per-file terminal states",()=>{
	const root=new Node();renderGndImportWorkbench(root,{...base,lifecycle:{state:"completed",fileCount:3,fileNames:["a/track.mdb","b/track.mdb","readme.xyz"],fileStates:[{fileName:"a/track.mdb",state:"completed"},{fileName:"b/track.mdb",state:"staged"},{fileName:"readme.xyz",state:"unsupported"}]},fileOutcomes:[{fileName:"a/track.mdb",status:"ok",itemCount:1},{fileName:"b/track.mdb",status:"partial",itemCount:1},{fileName:"readme.xyz",status:"unsupported",itemCount:0}]});
	assert.match(root.text,/3 Dateien zur Analyse angenommen · ein Dataset/);
	assert.match(root.text,/a\/track\.mdb/);assert.match(root.text,/b\/track\.mdb/);
	assert.match(root.text,/analysiert/);assert.match(root.text,/nicht unterstützt/);
	assert.doesNotMatch(root.text,/Übernehmen & anzeigen/);
});
