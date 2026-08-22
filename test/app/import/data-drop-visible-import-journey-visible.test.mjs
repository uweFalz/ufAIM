import assert from "node:assert/strict";
import test from "node:test";

class Node {
	constructor(tag = "div") { this.tag = tag; this.children = []; this.dataset = {}; this.className = ""; this.textContent = ""; this.disabled = false; this.childElementCount = 0; }
	append(...children) { for (const child of children) { this.children.push(child); } this.childElementCount = this.children.length; }
	replaceChildren(...children) { this.children = [...children]; this.childElementCount = this.children.length; }
	setAttribute(name, value) { if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); }
	get text() { return [this.textContent, ...this.children.map((child) => child?.text ?? child?.textContent ?? "")].join(""); }
	find(predicate) { if (predicate(this)) return this; for (const child of this.children) { const found = child?.find?.(predicate); if (found) return found; } return null; }
}
globalThis.document = { createElement: (tag) => new Node(tag), createElementNS: (_namespace, tag) => new Node(tag), createDocumentFragment: () => new Node("fragment") };
const { renderGndImportWorkbench } = await import("../../../app/gndImportWorkbench/gndImportWorkbenchView.js");

test("Workbench always exposes a permanent ready status", () => {
	const root = new Node();
	renderGndImportWorkbench(root, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], lifecycle: null, dropState: null });
	assert.match(root.text, /Bereit\./);
	assert.ok(root.find((node) => node.dataset.importLifecycleState === "ready"));
});

test("empty hydrated workspace shows the two productive start actions", () => {
	const root = new Node();
	renderGndImportWorkbench(root, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], lifecycle: null, dropState: null, workspacePhase: "ready", workspaceObjects: [] });
	assert.match(root.text, /Daten hier ablegen \/ Datei wählen/);
	assert.ok(root.find((node) => node.dataset.importChooseFiles === "true"));
	assert.ok(root.find((node) => node.dataset.createAlignment === "true"));
	assert.match(root.text, /Neues Alignment/);
});

test("hydrated objects replace the empty claim with exact reopen evidence", () => {
	const root = new Node();
	renderGndImportWorkbench(root, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], lifecycle: null, dropState: null, workspacePhase: "ready", workspaceObjects: [{ id: "A1", type: "alignment", meta: { label: "Persisted Alignment" } }] });
	assert.match(root.text, /Vorhandenen Arbeitsbereich wieder öffnen/);
	assert.match(root.text, /Persisted Alignment · A1/);
	assert.ok(root.find((node) => node.dataset.reopenWorkspaceObject === "A1"));
	assert.doesNotMatch(root.text, /beginnen Sie mit einem neuen Alignment/);
});

test("active import lifecycle supersedes the empty-start actions", () => {
	const root = new Node();
	renderGndImportWorkbench(root, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], lifecycle: { state: "accepted", fileCount: 1, fileNames: ["one.mdb"] }, dropState: null, workspacePhase: "ready", workspaceObjects: [] });
	assert.match(root.text, /Drop-Inhalt wird gelesen/);
	assert.equal(root.find((node) => node.dataset.createAlignment === "true"), null);
});

test("drag target and accepted file acknowledgement are immediate and unmistakable", () => {
	const dragRoot = new Node();
	renderGndImportWorkbench(dragRoot, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], dropState: { state: "drag-active" }, lifecycle: null });
	assert.match(dragRoot.text, /Dateien hier ablegen/);
	assert.ok(dragRoot.find((node) => node.dataset.importDropTarget === "active"));
	const acceptedRoot = new Node();
	renderGndImportWorkbench(acceptedRoot, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], dropState: null, lifecycle: { state: "accepted", fileCount: 2, fileNames: ["one.mdb", "two.xyz"] }, jobSnapshot: null });
	assert.match(acceptedRoot.text, /2 Dateien zur Analyse angenommen/);
	assert.match(acceptedRoot.text, /Drop-Inhalt wird gelesen/);
	assert.match(acceptedRoot.text, /one\.mdb wird verarbeitet/);
	assert.match(acceptedRoot.text, /two\.xyz wird verarbeitet/);
	assert.ok(acceptedRoot.find((node) => node.dataset.importBusy === "true"));
});

test("processing renders persistent canonical phase and heartbeat evidence", () => {
	const root = new Node();
	renderGndImportWorkbench(root, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], dropState: null, lifecycle: { state: "processing", fileCount: 1, fileNames: ["slow.mdb"] }, jobSnapshot: { phase: "extracting", heartbeatAt: "2026-08-06T00:00:01.000Z" } });
	const progress = root.find((node) => node.dataset.importJobPhase === "extracting");
	assert.ok(progress);
	assert.equal(progress.dataset.importHeartbeat, "2026-08-06T00:00:01.000Z");
	assert.match(progress.text, /slow\.mdb: extracting/);
});

test("existing import phase evidence replaces only the visible progress detail", () => {
	const root = new Node();
	renderGndImportWorkbench(root, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [], dropState: null, lifecycle: { state: "processing", fileCount: 1, fileNames: ["slow.mdb"], activeFileName: "slow.mdb", importPhase: { code: "MDB_EXTRACTING", status: "running" } }, jobSnapshot: { phase: "extracting", heartbeatAt: "2026-08-06T00:00:01.000Z" } });
	const progress = root.find((node) => node.dataset.importPhase === "MDB_EXTRACTING");
	assert.ok(progress);
	assert.match(progress.text, /slow\.mdb: MDB_EXTRACTING/);
	assert.equal(progress.dataset.importJobPhase, "extracting");
});

test("terminal lifecycle classes and exact outcome reasons remain visible without automatic promotion", () => {
	for (const state of ["completed", "cancelled", "failed", "rejected"]) {
		const root = new Node();
		renderGndImportWorkbench(root, { phase: "ready", records: [], items: [], rejectedItems: [], lifecycle: { state, fileCount: 1, fileNames: ["result.bin"], code: state === "failed" ? "IMPORT_FAILED" : null }, fileOutcomes: [{ fileName: "result.bin", status: state === "completed" ? "partial" : state, reason: "exact-existing-reason", itemCount: 0, rejectedCount: 0, evidencePublished: false }] });
		assert.ok(root.find((node) => node.dataset.importLifecycleState === state));
		assert.match(root.text, /exact-existing-reason/);
		assert.equal(root.find((node) => Object.hasOwn(node.dataset, "gndPromote")), null);
	}
});

test("completed wording distinguishes recognized partial and unsupported outcomes", () => {
	for (const [status, wording] of [["ok", "Import erkannt / abgeschlossen"], ["partial", "Import teilweise erkannt"], ["unsupported", "Import nicht unterstützt"], ["unknown", "Import nicht erkannt"]]) {
		const root = new Node();
		renderGndImportWorkbench(root, { phase: "ready", records: [], items: [], rejectedItems: [], lifecycle: { state: "completed", fileCount: 1, fileNames: ["result.bin"] }, fileOutcomes: [{ fileName: "result.bin", status, reason: "exact-reason", itemCount: 0, rejectedCount: 0, evidencePublished: false }] });
		assert.ok(root.text.includes(wording));
		assert.match(root.text, /exact-reason/);
	}
});

test("unsupported terminal result remains visibly exact without evidence or promotion", () => {
	const root = new Node();
	renderGndImportWorkbench(root, { phase: "ready", records: [], items: [], rejectedItems: [], fileOutcomes: [{ fileName: "unsupported.xyz", parserId: null, status: "unsupported", reason: "UNSUPPORTED_FILE_TYPE", itemCount: 0, rejectedCount: 0, evidencePublished: false }] });
	assert.match(root.text, /unsupported\.xyz/); assert.match(root.text, /UNSUPPORTED_FILE_TYPE/); assert.match(root.text, /Evidence publishedfalse/);
	assert.equal(root.find((node) => Object.hasOwn(node.dataset, "gndPromote")), null);
});

test("rejected ImportSession item stays distinguishable and has disabled promotion", () => {
	const root = new Node(), item = { id: "R1", evidenceId: "E1", kind: "alignment", status: { promotable: false, rejected: true }, source: {}, payload: {}, derived: {} };
	renderGndImportWorkbench(root, { phase: "ready", fileOutcomes: [{ fileName: "partial.gnd", parserId: "gnd", status: "partial", reason: "conflicting-evidence", itemCount: 0, rejectedCount: 1, evidencePublished: true }], items: [], rejectedItems: [item], records: [{ evidenceId: "E1", source: { fileName: "partial.gnd", parserId: "gnd" }, truthfulnessStatus: "construction-withheld", diagnostics: [{ itemId: "R1", code: "conflict", reason: "conflicting-evidence" }], unresolvedEvidence: [], relationCandidates: [], inventory: [], sourceEnvelope: {} }] });
	const promote = root.find((node) => node.dataset.gndPromote === "R1"); assert.ok(promote); assert.equal(promote.disabled, true);
	assert.match(root.text, /partial/); assert.match(root.text, /conflicting-evidence/);
});

test("verified promotion feedback exposes the exact canonical object identity", () => {
	const root = new Node();
	renderGndImportWorkbench(root, { phase: "ready", fileOutcomes: [], items: [], rejectedItems: [], feedback: "gnd_workbench.transfer_ok", promotedObjectId: "O1", records: [{ evidenceId: "E1", source: {}, truthfulnessStatus: "construction-available", diagnostics: [], unresolvedEvidence: [], relationCandidates: [], inventory: [], sourceEnvelope: {} }] });
	assert.ok(root.find((node) => node.dataset.promotedObjectId === "O1"));
});

test("recognized files become a Viewer-style Inbox Stage Outbox and truthful seven-line plan", () => {
	const root = new Node();
	renderGndImportWorkbench(root, {
		phase: "ready",
		fileOutcomes: [{ fileName: "track.mdb", parserId: "gnd", status: "partial", itemCount: 1 }],
		items: [{ id: "A1", evidenceId: "E1", kind: "alignment", status: { promotable: true }, payload: { name: "Gleis 1" }, derived: { sparseAlignment: { elements: [{}] } } }],
		previewTracks: [{ importItemId: "A1", label: "Gleis 1", crsId: null, polyline2d: [{ x: 0, y: 0 }, { x: 100, y: 20 }] }],
		activeItemId: "A1",
		rejectedItems: [],
		activeEvidenceId: "E1",
		alignmentIntelligenceModel: { capabilities: { horizontal: { status: "constructive" }, vertical: { status: "partial-evidence" }, cant: { status: "missing" }, chainage: { status: "constructive" } } },
		records: [{ evidenceId: "E1", source: { fileName: "track.mdb", format: "GND" }, truthfulnessStatus: "construction-available", diagnostics: [], unresolvedEvidence: [], relationCandidates: [], inventory: [], sourceEnvelope: {} }],
	});
	assert.ok(root.find((node) => node.dataset.importWorkspace === "E1"));
	assert.match(root.text, /INBOX/);
	assert.match(root.text, /OUTBOX/);
	assert.match(root.text, /7-Linien-Plan/);
	assert.match(root.text, /Gradiente rechts/);
	assert.match(root.text, /Krümmung km/);
	assert.match(root.text, /Gleiszuordnung prüfen/);
	assert.match(root.text, /fachlich zurückgehalten|bereit zur Übernahme/);
	assert.ok(root.find((node) => node.dataset.importGeometryPreview === "A1"));
	assert.match(root.text, /Lokale Koordinaten · CRS offen/);
});

test("Workbench exposes numeric EH and EU source bands without claiming constructive geometry", () => {
	const root = new Node();
	renderGndImportWorkbench(root, {
		phase: "ready", fileOutcomes: [], items: [], rejectedItems: [], activeEvidenceId: "E1",
		records: [{ evidenceId: "E1", source: {}, truthfulnessStatus: "construction-available-with-unresolved-evidence", diagnostics: [], relationCandidates: [], inventory: [], sourceEnvelope: {}, unresolvedEvidence: [{
			kind: "profile", attachmentStatus: "uniquely-attachable", padStart: "P1", padEnd: "P2",
			sourceElements: [{ family: "EH", rowRef: "EH:1", typeCode: 0, parameters: { EHPAR1: 50, EHPAR2: 0, EHPAR3: 4 } }],
		}] }],
	});
	assert.match(root.text, /Numerische Source-Evidenz · noch keine konstruktive Kernel-Geometrie/);
	assert.match(root.text, /EH · Gradiente/);
	assert.match(root.text, /0 → 4 ‰ \(Quellgradient\)/);
	assert.ok(root.find((node) => node.dataset.sourceFamily === "EH"));
});
