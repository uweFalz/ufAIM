import assert from "node:assert/strict";
import test from "node:test";

class Node {
	constructor(tag = "div") { this.tag = tag; this.children = []; this.dataset = {}; this.className = ""; this.textContent = ""; this.disabled = false; this.childElementCount = 0; }
	append(...children) { this.children.push(...children); this.childElementCount = this.children.length; }
	replaceChildren(...children) { this.children = [...children]; this.childElementCount = this.children.length; }
	setAttribute(name, value) { if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); }
	get text() { return [this.textContent, ...this.children.map((child) => child?.text ?? child?.textContent ?? "")].join(" "); }
	find(predicate) { if (predicate(this)) return this; for (const child of this.children) { const found = child?.find?.(predicate); if (found) return found; } return null; }
}
globalThis.document = { createElement: (tag) => new Node(tag), createElementNS: (_ns, tag) => new Node(tag), createDocumentFragment: () => new Node("fragment") };
const { renderGndImportWorkbench } = await import("../../../app/gndImportWorkbench/gndImportWorkbenchView.js");

test("empty normal start explains alignmentOS and exposes exactly three real paths", () => {
	const root = new Node();
	renderGndImportWorkbench(root, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], lifecycle: null, dropState: null, workspacePhase: "ready", workspaceObjects: [] });
	assert.match(root.text, /alignmentOS · Wissenskern/);
	assert.match(root.text, /AIM Engineering Workspace/);
	assert.match(root.text, /Daten hier ablegen \/ Datei wählen/);
	assert.match(root.text, /Mehrere Dateien und ganze Verzeichnisse hineinziehen/);
	assert.ok(root.find((node) => node.dataset.importChooseFiles === "true"));
	assert.ok(root.find((node) => node.dataset.openWorkspaceObjects === "true"));
	assert.ok(root.find((node) => node.dataset.createAlignment === "true"));
	assert.equal(root.find((node) => node.dataset.gndPromote), null);
});

test("returning start shows canonical count and explicit continuation", () => {
	const root = new Node();
	renderGndImportWorkbench(root, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], lifecycle: null, dropState: null, workspacePhase: "ready", workspaceObjects: [{ id: "A1", meta: { label: "Marschbahn" } }, { id: "A2" }] });
	assert.match(root.text, /2 kanonische Objekte/);
	assert.match(root.text, /Weiterarbeiten/);
	assert.match(root.text, /Marschbahn · A1/);
	assert.ok(root.find((node) => node.dataset.reopenWorkspaceObject === "A1"));
	assert.ok(root.find((node) => node.dataset.openWorkspaceObjects === "true"));
});

test("loading and failure are honest and failure has retry", () => {
	const loading = new Node();
	renderGndImportWorkbench(loading, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], lifecycle: null, dropState: null, workspacePhase: "loading", workspaceObjects: [] });
	assert.match(loading.text, /Arbeitsbereich wird geladen/);
	assert.equal(loading.find((node) => node.dataset.workspaceRetry), null);
	const failed = new Node();
	renderGndImportWorkbench(failed, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], lifecycle: null, dropState: null, workspacePhase: "error", workspaceObjects: [] });
	assert.match(failed.text, /Arbeitsbereich nicht verfügbar/);
	assert.ok(failed.find((node) => node.dataset.workspaceRetry === "true"));
});
