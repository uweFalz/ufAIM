import assert from "node:assert/strict";
import test from "node:test";
import { authoringDraftKey,clearDraftAfterCanonicalRefresh,createAuthoringDraftStore,isConfirmedAuthoringSaveResult } from "../../../app/domain/workspace/createAuthoringDraftStore.js";
import { createVerticalProfileAuthoringDockController } from "../../../app/controllers/alignment-profile/createVerticalProfileAuthoringDockController.js";
import { createCantAuthoringDockController } from "../../../app/controllers/alignment-profile/createCantAuthoringDockController.js";
import { createChainageAuthoringDockController } from "../../../app/controllers/alignment-profile/createChainageAuthoringDockController.js";

const projection=(id="A")=>({alignmentId:id,selectableElements:{vertical:[]},laneCoverage:{vertical:{elementCount:0}}});

test("drafts are isolated by exact object discipline action and target",()=>{
	const drafts=createAuthoringDraftStore(),a={objectId:"A",discipline:"horizontal",action:"edit",elementId:"H1"};
	drafts.write(a,{length:"broken"});
	assert.deepEqual(drafts.read(a),{length:"broken"});
	for(const changed of [{...a,objectId:"B"},{...a,discipline:"vertical"},{...a,action:"append"},{...a,elementId:"H2"}])assert.equal(drafts.read(changed),null);
	assert.equal(drafts.clear(a),true);assert.equal(drafts.read(a),null);
});

test("embedded separators cannot collide and only explicit saved/projected results confirm cleanup",()=>{
	assert.notEqual(authoringDraftKey({objectId:"A::B",discipline:"vertical",action:"edit"}),authoringDraftKey({objectId:"A",discipline:"B::vertical",action:"edit"}));
	assert.equal(isConfirmedAuthoringSaveResult({status:"saved"}),true);assert.equal(isConfirmedAuthoringSaveResult({status:"projected"}),true);
	for(const result of [{},{status:"error"},{status:"rejected"},{status:"unavailable"},null])assert.equal(isConfirmedAuthoringSaveResult(result),false);
});

test("horizontal cleanup waits for successful canonical refresh",async()=>{let clears=0;assert.equal(await clearDraftAfterCanonicalRefresh({refresh:async()=>false,clear:()=>clears++}),false);assert.equal(clears,0);await assert.rejects(()=>clearDraftAfterCanonicalRefresh({refresh:async()=>{throw new Error("readback failed")},clear:()=>clears++}),/readback failed/);assert.equal(clears,0);assert.equal(await clearDraftAfterCanonicalRefresh({refresh:async()=>true,clear:()=>clears++}),true);assert.equal(clears,1);});

test("vertical reject and rerender retain exact input while success clears only that draft",async()=>{
	let handlers,lastState,fail=true,projectionListener;
	const controller=createVerticalProfileAuthoringDockController({store:{getState:()=>({workspace_selection:{primaryId:"A"}})},profileSource:{getCurrentProjection:()=>projection(),subscribeProjection(fn){projectionListener=fn;return()=>{};},async submitBasicVerticalProfile(){return fail?null:{status:"saved"};}},ui:{openVerticalProfileAuthoring(){}},view:{setHandlers(value){handlers=value;},render(_model,state){lastState=state;}}});
	assert.equal(controller.open({objectId:"A"}),true);
	handlers.draftChanged("submitBasicVerticalProfile",{segmentId:"V1",startElevation:"12.4"});
	assert.equal(await handlers.createInitial({segmentId:"V1",startElevation:"12.4"}),false);
	projectionListener();assert.deepEqual(lastState.readDraft("submitBasicVerticalProfile"),{segmentId:"V1",startElevation:"12.4"});
	fail=false;assert.equal(await handlers.createInitial({segmentId:"V1",startElevation:"12.4"}),true);
	assert.equal(lastState.readDraft("submitBasicVerticalProfile"),null);
});

test("Cant and Chainage errors retain only their own action drafts",async()=>{
	for(const spec of[
		{create:createCantAuthoringDockController,projection:{alignmentId:"A",selectableElements:{cant:[]}},method:"submitBasicCant",handler:"createInitial",payload:{elementId:"C1",startCrossLevel:"bad"}},
		{create:createChainageAuthoringDockController,projection:{alignmentId:"A",selectableElements:{chainage:[]},laneCoverage:{chainage:{mappingCount:0}}},method:"submitBasicChainage",handler:"createInitial",payload:{mappingId:"M1",startAddress:"bad",direction:"1"}},
	]){let handlers,lastState;const controller=spec.create({store:{getState:()=>({workspace_selection:{primaryId:"A"}})},profileSource:{getCurrentProjection:()=>spec.projection,subscribeProjection(){return()=>{};},async[spec.method](){throw new Error("canonical save rejected");}},ui:{},view:{setHandlers(x){handlers=x;},render(_m,s){lastState=s;}}});assert.equal(controller.open({objectId:"A"}),true);handlers.draftChanged(spec.method,spec.payload);assert.equal(await handlers[spec.handler](spec.payload),false);assert.deepEqual(lastState.readDraft(spec.method),spec.payload);assert.match(lastState.error,/canonical save rejected/);assert.equal(lastState.readDraft("foreignAction"),null);controller.stop();}
});

test("truthy rejected profile result is not success and retains exact draft",async()=>{let handlers,lastState;const controller=createVerticalProfileAuthoringDockController({store:{getState:()=>({workspace_selection:{primaryId:"A"}})},profileSource:{getCurrentProjection:()=>projection(),subscribeProjection(){return()=>{};},async submitBasicVerticalProfile(){return{status:"rejected",code:"INVALID"};}},ui:{},view:{setHandlers(x){handlers=x},render(_m,s){lastState=s}}});controller.open({objectId:"A"});const payload={segmentId:"V1",endS:"bad"};assert.equal(await handlers.createInitial(payload),false);assert.deepEqual(lastState.readDraft("submitBasicVerticalProfile"),payload);assert.equal(lastState.status,"error");assert.equal(lastState.error,"INVALID");});
