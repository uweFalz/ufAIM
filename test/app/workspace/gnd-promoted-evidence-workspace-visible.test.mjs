import assert from "node:assert/strict";
import test from "node:test";
import { ExistingAlignmentIntelligenceView } from "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js";

test("promoted identity and qualified GND evidence are visible on the shared intelligence surface", () => {
	const attributes = {};
	const identity = { textContent: "" };
	const list = { children: [], replaceChildren() { this.children = []; }, append(item) { this.children.push(item); } };
	const root = { dataset: attributes, querySelector(selector) { return selector.includes("identity") ? identity : list; } };
	const documentRef = { getElementById: () => root, createElement: (tag) => ({ tag, dataset: {}, append(...children) { this.children = children; } }) };
	const view = new ExistingAlignmentIntelligenceView({ documentRef });
	view.render({ status: "active", mode: "main", context: { objectId: "GND-A1", evidenceId: "EV1", s: 25 }, capabilities: { horizontal: { name: "EL", status: "constructive", sourceRefs: ["X_ASC_EL"] }, vertical: { name: "EH", status: "partial-evidence", sourceRefs: ["X_ASC_EH"] } } });
	assert.equal(root.dataset.alignmentObjectId, "GND-A1");
	assert.equal(root.dataset.alignmentEvidenceId, "EV1");
	assert.match(identity.textContent, /GND-A1/);
	assert.equal(list.children[0].dataset.alignmentCapabilitySources, "X_ASC_EL");
});

test("Main q and L button changes explicitly request a fresh shared intelligence render", async () => {
	let listener = null;
	let renders = 0;
	const root = { dataset: {}, querySelector: () => null };
	const documentRef = { getElementById: () => root, addEventListener(type, callback) { assert.equal(type, "click"); listener = callback; }, removeEventListener() {}, createElement: () => ({ dataset: {} }) };
	const view = new ExistingAlignmentIntelligenceView({ documentRef });
	const dispose = view.wireModeChanges(() => { renders += 1; });
	for (const mode of ["main", "q", "l"]) listener({ target: { closest: (selector) => selector === "[data-workspace-view-mode]" ? { dataset: { workspaceViewMode: mode } } : null } });
	await Promise.resolve();
	assert.equal(renders, 3);
	dispose();
});

test("render reacquires the active intelligence surface after shell replacement", () => {
	function surface() {
		const identity = { textContent: "" };
		const list = { children: [], replaceChildren() { this.children = []; }, append(item) { this.children.push(item); } };
		return { dataset: {}, identity, list, querySelector(selector) { return selector.includes("identity") ? identity : list; } };
	}
	const first = surface();
	const active = surface();
	let current = first;
	const documentRef = { getElementById: () => current, createElement: (tag) => ({ tag, dataset: {}, children: [], append(...children) { this.children.push(...children); } }) };
	const view = new ExistingAlignmentIntelligenceView({ documentRef });
	current = active;
	view.render({ status: "active", mode: "q", context: { objectId: "GND-A1", evidenceId: "EV1", s: 25 }, capabilities: { topology: { name: "Topology", status: "partial-evidence", reason: "Source association reviewed", relationStatus: "reviewed", reviewedCandidateId: "R1", reviewRevision: 2, claimScope: "source-association-only", intrinsicMappingStatus: "not-established", domainRelationStatus: "not-established", reviewProvenancePresent: true } } });
	assert.equal(first.list.children.length, 0);
	assert.equal(active.dataset.alignmentObjectId, "GND-A1");
	assert.equal(active.dataset.alignmentIntelligenceMode, "q");
	assert.equal(active.list.children[0].dataset.alignmentCapabilityStatus, "partial-evidence");
	const topologyDetail = active.list.children[0].children[3].textContent;
	assert.match(topologyDetail, /reviewed/);
	assert.match(topologyDetail, /revision 2/);
	assert.match(topologyDetail, /source-association-only/);
	assert.equal(topologyDetail.match(/not-established/g)?.length, 2);
	assert.match(topologyDetail, /review-provenance present/);
});
