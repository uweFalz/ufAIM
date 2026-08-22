import assert from "node:assert/strict";
import test from "node:test";
import { ExistingAlignmentIntelligenceView } from "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js";
import { MapLibreThreeAdapter } from "../../../app/controllers/adapters/geo/MapLibreThreeAdapter.js";

function node() { return { dataset: {}, children: [], textContent: "", append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; } }; }

test("visible camera language distinguishes qualified map, local Lok camera and intrinsic L", () => {
	const identity = node(), list = node();
	const root = { dataset: {}, querySelector(selector) { if (selector.includes("identity")) return identity; if (selector.includes("capabilities")) return list; return null; } };
	const documentRef = { getElementById: () => root, createElement: () => node() };
	const view = new ExistingAlignmentIntelligenceView({ documentRef });
	const model = (mode, crsStatus) => ({ status: "active", mode, context: { objectId: "A", s: 42 }, capabilities: { crs: { name: "CRS / world", status: crsStatus } } });
	view.render(model("main", "constructive")); assert.match(identity.children.at(-1).textContent, /qualified map context/);
	view.render(model("q", "constructive")); assert.match(identity.children.at(-1).textContent, /qualified source · local engineering view/);
	view.render(model("l", "not-covered")); assert.match(identity.children.at(-1).textContent, /intrinsic s camera/);
});

test("qualified MapLibre context renders active cursor as a separate visible marker", () => {
	const sources = new Map(), layers = [];
	const adapter = new MapLibreThreeAdapter();
	adapter.map = { loaded: () => true, getSource: (id) => sources.get(id), addSource(id, config) { sources.set(id, { data: config.data, setData(data) { this.data = data; } }); }, addLayer(layer) { layers.push(layer); } };
	adapter.setCursor({ longitude: 9.1, latitude: 50.2, objectId: "A", s: 42, crsId: "EPSG:5683" });
	assert.deepEqual(sources.get("ufaim-cursor").data.geometry.coordinates, [9.1, 50.2]);
	assert.equal(layers[0].type, "circle");
	assert.equal(adapter.getDebugState().cursor.objectId, "A");
});
