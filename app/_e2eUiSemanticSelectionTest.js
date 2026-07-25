import {
	createSemanticSelectionContract,
	createSubjectReference,
	installSelectionDiagnostics,
	SUBJECT_KINDS,
} from "./runtime/selection/index.js";

const result = {
	passed: false,
	phase: "initializing",
	failures: [],
	primarySubjectPassed: false,
	crossSurfacePassed: false,
	toolLocalIsolationPassed: false,
	causalityPassed: false,
	restorationPassed: false,
	completedAt: null,
};

if (typeof window !== "undefined") window.__uiSemanticSelectionE2E = result;

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function createFakeStore(initialSelection) {
	let state = { workspace_selection: structuredClone(initialSelection) };
	return {
		getState: () => structuredClone(state),
		actions: {
			setWorkspaceSelection(selection) {
				state = { ...state, workspace_selection: structuredClone(selection) };
			},
		},
	};
}

export function runUiSemanticSelectionE2E() {
	const initialSelection = {
		primaryId: "alignment-original",
		contextIds: ["alignment-context"],
		elementId: "A0",
		source: "existing:selection",
		crsId: "EPSG:25833",
	};
	const store = createFakeStore(initialSelection);
	const contract = createSemanticSelectionContract({
		store,
		resolvePrimaryKind: () => SUBJECT_KINDS.ALIGNMENT,
		now: () => "2026-07-25T00:00:00.000Z",
	});
	const uninstallDiagnostics = installSelectionDiagnostics(contract, {
		target: typeof window === "undefined" ? globalThis : window,
	});

	try {
		result.phase = "primary-subject";
		const alignment = createSubjectReference({ kind: SUBJECT_KINDS.ALIGNMENT, id: "alignment-1" });
		const objectsChange = contract.selectPrimary(alignment, {
			surface: "objects-workspace",
			action: "activate-card",
		});
		assert(objectsChange.changed, "Objects activation must change the authoritative workspace selection");
		assert(contract.read().primary?.id === "alignment-1", "one global primary Alignment must be readable");
		assert(contract.read().intrinsicFocus == null, "new primary selection must not retain a stale element");
		result.primarySubjectPassed = true;

		result.phase = "cross-surface";
		const elementChange = contract.focusElement({
			alignment,
			element: { id: "A2" },
		}, {
			surface: "curvature-band",
			action: "select-element",
			chainId: "chain-element-A2",
		});
		assert(elementChange.changed, "CurvatureBand element focus must reach the workspace adapter");
		assert(contract.read().intrinsicFocus?.id === "A2", "Alignment element focus must retain A2");
		assert(contract.read().intrinsicFocus?.parent?.id === "alignment-1", "selected element must retain parent Alignment identity");
		const synchronized = contract.synchronize("main-view", "chain-element-A2", (cause) =>
			contract.focusElement({ alignment, element: { id: "A2" } }, cause)
		);
		assert(synchronized.changed === false, "dependent mainView synchronization must not create a redundant selection write");
		assert(contract.read().intrinsicFocus?.id === "A2", "closing or synchronizing a surface must preserve element focus");
		result.crossSurfacePassed = true;

		result.phase = "tool-local-isolation";
		const beforeLocal = structuredClone(store.getState().workspace_selection);
		contract.setToolLocal("transed", {
			kind: SUBJECT_KINDS.TRANSITION_DB_RECORD,
			id: "transition-record-17",
		}, {
			surface: "transed",
			action: "inspect-record",
		});
		contract.setToolLocal("import-workbench", {
			kind: SUBJECT_KINDS.IMPORT_EVIDENCE_RECORD,
			id: "EU:row-23",
		}, {
			surface: "import-workbench",
			action: "inspect-evidence",
		});
		contract.setToolLocal("axtran-review", {
			kind: SUBJECT_KINDS.AXTRAN_CANDIDATE,
			id: "candidate-1",
		}, {
			surface: "axtran-review",
			action: "review-calculation",
		});
		contract.setHover({ kind: SUBJECT_KINDS.ALIGNMENT_ELEMENT, id: "T1", parent: alignment }, {
			surface: "main-view",
			action: "pointer-hover",
		});
		contract.setPreview({ kind: SUBJECT_KINDS.AXTRAN_CANDIDATE, id: "candidate-1" }, {
			surface: "axtran-review",
			action: "preview-candidate",
		});
		assert(JSON.stringify(store.getState().workspace_selection) === JSON.stringify(beforeLocal), "tool-local, hover and preview state must not mutate global selection");
		assert(contract.read().toolLocalSelections.transed?.id === "transition-record-17", "TransEd record must remain explicitly tool-local");
		assert(contract.read().toolLocalSelections["import-workbench"]?.id === "EU:row-23", "import evidence must remain evidence");
		assert(contract.read().toolLocalSelections["axtran-review"]?.id === "candidate-1", "AXTRAN review must remain unapplied");
		result.toolLocalIsolationPassed = true;

		result.phase = "causality";
		const rejected = contract.synchronize("main-view", "chain-element-A2", () => {
			throw new Error("loop callback must not execute");
		});
		assert(rejected.rejected && rejected.reason === "selection-synchronization-loop", "repeated surface in a synchronization chain must be rejected");
		const diagnostics = contract.diagnostics();
		assert(diagnostics.initiatingSource?.surface === "axtran-review", "last initiating source must be inspectable");
		assert(diagnostics.rejectedEvents.at(-1)?.reason === "selection-synchronization-loop", "loop rejection must remain inspectable");
		result.causalityPassed = true;

		result.phase = "restoration";
		store.actions.setWorkspaceSelection(initialSelection);
		contract.setToolLocal("transed", null, { surface: "test", action: "restore" });
		contract.setToolLocal("import-workbench", null, { surface: "test", action: "restore" });
		contract.setToolLocal("axtran-review", null, { surface: "test", action: "restore" });
		contract.setHover(null, { surface: "test", action: "restore" });
		contract.setPreview(null, { surface: "test", action: "restore" });
		assert(JSON.stringify(store.getState().workspace_selection) === JSON.stringify(initialSelection), "legacy workspace selection must restore exactly");
		assert(Object.keys(contract.read().toolLocalSelections).length === 0 && contract.read().hover == null && contract.read().preview == null, "temporary semantic state must restore exactly");
		result.restorationPassed = true;
		result.phase = "complete";
	} catch (error) {
		result.failures.push({ phase: result.phase, message: String(error?.message ?? error) });
	} finally {
		uninstallDiagnostics();
		result.passed = result.failures.length === 0 &&
			result.primarySubjectPassed &&
			result.crossSurfacePassed &&
			result.toolLocalIsolationPassed &&
			result.causalityPassed &&
			result.restorationPassed;
		result.completedAt = new Date().toISOString();
		if (typeof console !== "undefined") {
			console[result.passed ? "log" : "error"](`UiSemanticSelection E2E ${result.passed ? "PASSED" : "FAILED"}`);
		}
	}
	return result;
}

runUiSemanticSelectionE2E();
