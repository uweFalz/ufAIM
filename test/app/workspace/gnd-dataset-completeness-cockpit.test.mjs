import assert from "node:assert/strict";
import test from "node:test";
import { buildGndRouteWorkspaceModel } from "../../../app/domain/workspace/buildGndRouteWorkspaceModel.js";
import { buildGndDatasetCompletenessCockpitModel } from "../../../app/domain/workspace/buildGndDatasetCompletenessCockpitModel.js";

function assignment(family, code, ids=[]) { return { family, route:"1720", directionCode:code, targetItemIds:ids }; }

test("dataset cockpit binds exact fingerprint PP route families roles and neutral association",()=>{
	const record={evidenceId:"E1",source:{sha256:"sha-a",fileName:"right/track.mdb"},sevenLineRoleEvidence:{assignments:[assignment("EL","1",["Q1"]),assignment("EH","1"),assignment("EU","1"),assignment("EL","2"),assignment("EK","3")]},relationCandidates:[{id:"R1",from:"EH:1",to:"Q1"}]};
	const routes=buildGndRouteWorkspaceModel({records:[record],items:[{id:"A1",evidenceItemId:"Q1",status:{promotable:true}}]});
	const model=buildGndDatasetCompletenessCockpitModel({lifecycle:{state:"completed",fileCount:1,fileNames:["right/track.mdb"]},fileOutcomes:[{fileName:"right/track.mdb",status:"ok"}],routeWorkspaces:routes,records:[record]});
	assert.equal(model.sourceCount,1);assert.equal(model.status,"completed");assert.equal(model.groups.length,1);
	const group=model.groups[0];
	assert.equal(group.sourceFingerprint,"sha-a");assert.equal(group.route,"1720");
	assert.deepEqual(group.families,{PP:"source-evidence",EL:"constructive",EH:"source-evidence-only",EU:"source-evidence-only",EK:"source-evidence-only"});
	assert.equal(group.associationStatus,"open-candidates");assert.equal(group.promotableItemIds[0],"A1");
});

test("mixed fingerprints and routes never merge and missing km line remains actionable",()=>{
	const records=["a","b"].map((fingerprint,index)=>({evidenceId:`E${index}`,source:{sha256:fingerprint,fileName:`${fingerprint}/same.mdb`},sevenLineRoleEvidence:{assignments:[assignment("EL","1"),assignment("EL","2")]}}));
	const routes=buildGndRouteWorkspaceModel({records});
	const model=buildGndDatasetCompletenessCockpitModel({routeWorkspaces:routes,records});
	assert.equal(model.groups.length,2);
	assert.ok(model.groups.every((group)=>group.diagnostics.includes("KM_LINE_REQUIRED")));
	assert.deepEqual(model.groups.map((group)=>group.sourcePaths[0]),["a/same.mdb","b/same.mdb"]);
});

test("327 exact relative sources remain distinct with bounded group work",()=>{
	const fileNames=Array.from({length:327},(_,index)=>`folder-${index}/track.mdb`);
	const model=buildGndDatasetCompletenessCockpitModel({lifecycle:{state:"processing",fileCount:327,fileNames},fileOutcomes:[],routeWorkspaces:[],records:[]});
	assert.equal(model.sourceCount,327);assert.equal(model.sources.length,327);assert.equal(model.sources[0].path,"folder-0/track.mdb");assert.equal(model.sources[326].path,"folder-326/track.mdb");assert.equal(model.status,"processing");
});

test("one fingerprint with two routes never leaks target-bound source review",()=>{
	const record={
		evidenceId:"E",source:{sha256:"same-fingerprint",fileName:"dataset.mdb"},
		sevenLineRoleEvidence:{assignments:[
			{family:"EL",route:"A",directionCode:"1",targetItemIds:["Q-A"]},
			{family:"EL",route:"B",directionCode:"2",targetItemIds:["Q-B"]},
		]},
		relationCandidates:[{id:"R-A",to:"Q-A"},{id:"R-B",toId:"Q-B"},{id:"R-NONE",to:"Q-X"}],
		relationDecision:{reviewedCandidateId:"R-B",revision:1},
	};
	const routes=buildGndRouteWorkspaceModel({records:[record]});
	const model=buildGndDatasetCompletenessCockpitModel({routeWorkspaces:routes,records:[record]});
	const a=model.groups.find((group)=>group.route==="A"),b=model.groups.find((group)=>group.route==="B");
	assert.equal(a.associationStatus,"open-candidates");
	assert.deepEqual(a.associationActions.map((entry)=>entry.candidateId),["R-A"]);
	assert.equal(b.associationStatus,"reviewed");
	assert.deepEqual(b.associationActions.map((entry)=>entry.candidateId),["R-B"]);
	assert.ok(!model.groups.some((group)=>group.associationActions.some((entry)=>entry.candidateId==="R-NONE")));
});

test("group without exact target ids exposes no global relation action",()=>{
	const record={evidenceId:"E",source:{sha256:"fingerprint"},sevenLineRoleEvidence:{assignments:[{family:"EH",route:"A",directionCode:"1",targetItemIds:[]}]},relationCandidates:[{id:"R",to:"Q"}],relationDecision:{reviewedCandidateId:"R"}};
	const routes=buildGndRouteWorkspaceModel({records:[record]});
	const model=buildGndDatasetCompletenessCockpitModel({routeWorkspaces:routes,records:[record]});
	assert.equal(model.groups[0].associationStatus,"missing");
	assert.deepEqual(model.groups[0].associationActions,[]);
});
