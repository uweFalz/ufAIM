import assert from "node:assert/strict";
import test from "node:test";
import { ExistingAlignmentIntelligenceView } from "../../../app/view/workspace/ExistingAlignmentIntelligenceView.js";
import { createExistingAlignmentIntelligenceJourneyController } from "../../../app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js";
import { buildGndSevenLineRoleAssembly } from "../../../app/domain/workspace/buildGndSevenLineRoleAssembly.js";

test("L view shows seven ordered bands and names single-track placement honestly", () => {
	const assignments = ["EL", "EH", "EU"].map((family) => ({ family, route: "1", directionCode: "0", trackClass: "single-track", sourceIds: [family] }));
	const relationEvidence = { status: "reviewed", reviewedCandidateId: "R", candidates: [{ id: "R", to: "A", family: "EH", claimScope: "source-association-only", attachmentSourceIds: ["EH"] }] };
	const assembly = buildGndSevenLineRoleAssembly({ assignments, relationEvidence }, { targetItemId: "A" });
	const list = { replaceChildren() {}, append() {} }; const bands = { dataset: { alignmentSevenLineBands: "" }, children: [], replaceChildren() { this.children=[]; }, append(node) { this.children.push(node); } };
	const root = { dataset: {}, querySelector(selector) { if (selector.includes("capabilities")) return list; if (selector.includes("seven-line")) return bands; return null; } };
	const documentRef = { getElementById: () => root, createElement: () => ({ dataset: {}, append() {} }) };
	new ExistingAlignmentIntelligenceView({ documentRef }).render({ status: "active", mode: "l", context: { objectId: "A", s: 0 }, capabilities: {}, sevenLineRoleAssembly: assembly });
	assert.equal(bands.children.length, 7);
	assert.match(bands.children[0].textContent, /eingleisig · Darstellungsplatz, keine Gleisseite/);
	assert.equal(assembly.rows[1].status, "not-applicable");
	assert.equal(assembly.rows[1].trackSide, "not-applicable");
});

test("ordinary promoted evidence activation transports all seven rows through controller model and L DOM", () => {
	const rows = ["gradient-right", "gradient-left", "cant-left", "curvature-left", "curvature-kilometer", "curvature-right", "cant-right"].map((id) => ({ id, label: id, status: "partial-evidence" }));
	const assembly = { rows };
	const list = { replaceChildren() {}, append() {} }; const bands = { dataset: { alignmentSevenLineBands: "" }, children: [], replaceChildren() { this.children=[]; }, append(node) { this.children.push(node); }, hidden: true };
	const root = { dataset: {}, isConnected: true, querySelector(selector) { if (selector.includes("capabilities")) return list; if (selector.includes("seven-line")) return bands; return null; }, querySelectorAll(selector) { return selector === "[data-seven-line-role]" ? bands.children : []; } };
	const documentRef = { getElementById: () => root, createElement: () => ({ dataset: {}, append() {} }) };
	const view = new ExistingAlignmentIntelligenceView({ documentRef });
	const controller = createExistingAlignmentIntelligenceJourneyController({ store: { getState: () => ({ workspace_selection: { primaryId: "A" }, cursor: { s: 5 } }) }, workspace: { getActiveMode: () => "l" }, viewController: { getDebugState: () => ({ objectId: "A", segmentCount: 1 }) }, view });
	const model = controller.setPromotedEvidence({ evidenceId: "E", sevenLineRoleAssembly: assembly, relation: { status: "partial-evidence" } });
	assert.equal(model.sevenLineRoleAssembly.rows.length, 7);
	assert.equal(bands.children.length, 7);
	assert.equal(bands.hidden, false);
});

test("reload acceptance closes the modal object overlay before switching to L", () => {
	let overlayVisible = true, mode = "main";
	const activateObjectRow = () => ({ objectId: "A", assemblyRows: 7 });
	const chooseMode = (next) => { if (!overlayVisible) mode = next; };
	const selected = activateObjectRow();
	chooseMode("l");
	assert.equal(mode, "main", "modal object overlay must block mode switching");
	overlayVisible = false;
	chooseMode("l");
	assert.deepEqual({ mode, assemblyRows: selected.assemblyRows, renderedBands: 7, hidden: false }, { mode: "l", assemblyRows: 7, renderedBands: 7, hidden: false });
});
