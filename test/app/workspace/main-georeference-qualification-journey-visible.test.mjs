import assert from "node:assert/strict";
import test from "node:test";
import { ExistingAlignmentIntelligenceView } from "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js";

function node() { return { dataset: {}, children: [], textContent: "", hidden: false, disabled: false, append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; }, addEventListener(type, handler) { this.handler = handler; }, querySelector() { return null; } }; }

function fixture(actions = {}) {
	const geo = node();
	const root = { dataset: {}, querySelector(selector) { return selector.includes("main-georeference") ? geo : null; }, append() {} };
	return { geo, view: new ExistingAlignmentIntelligenceView({ documentRef: { getElementById: () => root, createElement: () => node() }, actions }) };
}

test("Main visibly distinguishes LOCAL evidence and disables map without hiding review actions", () => {
	const { geo, view } = fixture({ openObjects() {}, openImport() {}, openReview() {}, showOnMap() {} });
	view.render({ mode: "main", context: { objectId: "A" }, capabilities: {}, georeferenceQualification: { visible: true, coordinateMode: "local-cartesian", validationStatus: "malformed-crs", sourceCrs: "SYNTH_LSYS", transformationAvailable: false, coordinateProvenance: "GND.PL", mapReady: false, markerReady: false, reason: "CRS evidence requires review", warnings: [], actions: { showOnMap: false, openObjects: true, openImport: true, openReview: true } } });
	assert.equal(geo.dataset.coordinateMode, "local-cartesian");
	assert.match(geo.children[0].children[1].textContent, /LOCAL · kein EPSG-Claim/);
	const actions = geo.children.at(-1); assert.equal(actions.children[0].disabled, true); assert.equal(actions.children.length, 4);
});

test("qualified Main exposes exactly the existing map activation action", () => {
	const calls = []; const { geo, view } = fixture({ showOnMap: () => calls.push("map"), openObjects() {} });
	view.render({ mode: "main", context: { objectId: "A" }, capabilities: {}, georeferenceQualification: { visible: true, coordinateMode: "qualified", validationStatus: "valid", sourceCrs: "DB_REF", resolvedEpsg: "EPSG:5683", transformationAvailable: true, coordinateProvenance: "GND.PL", mapReady: true, markerReady: true, warnings: [], actions: { showOnMap: true, openObjects: true } } });
	const button = geo.children.at(-1).children[0]; assert.equal(button.disabled, false); button.handler(); assert.deepEqual(calls, ["map"]);
	assert.match(geo.children[0].children[1].textContent, /QUALIFIED · EPSG:5683/);
});

test("qualified map visibly distinguishes unavailable marker without disabling fit", () => {
	const { geo, view } = fixture({ showOnMap() {}, openObjects() {} });
	view.render({ mode: "main", context: { objectId: "A" }, capabilities: {}, georeferenceQualification: { visible: true, coordinateMode: "qualified", validationStatus: "valid", resolvedEpsg: "EPSG:5683", transformationAvailable: true, mapReady: true, markerReady: false, warnings: [], actions: { showOnMap: true, openObjects: true } } });
	const facts = geo.children[1];
	assert.match(facts.children.at(-1).children[1].textContent, /Karte bereit · Marker nicht verfügbar/);
	assert.equal(geo.children.at(-1).children[0].disabled, false);
});
