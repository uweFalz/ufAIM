// src/shared/runtime/_e2eWorkspaceSelectionAccessTest.js

import {
	getWorkspaceSelection,
	getWorkspacePrimaryId,
	getWorkspaceContextIds,
	getWorkspacePrimaryObject,
	getWorkspaceContextObjects,
} from "./workspaceSelectionAccess.js";

function assert(condition, message) {
	if (!condition) {
		throw new Error(`WorkspaceSelectionAccess E2E FAIL: ${message}`);
	}
}

function eq(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}

(function runWorkspaceSelectionAccessChecks() {
	console.log("WorkspaceSelectionAccess E2E starting...");

	const noSelection = getWorkspaceSelection({});
	assert(noSelection.primaryId === null, "missing selection primaryId");
	assert(eq(noSelection.contextIds, []), "missing selection contextIds");

	const emptySelection = getWorkspaceSelection({
		workspace_selection: {
			primaryId: "",
			contextIds: ["", null],
			source: "test",
			crsId: "",
		},
	});
	assert(emptySelection.primaryId === null, "empty selection primaryId");
	assert(eq(emptySelection.contextIds, []), "empty selection contextIds");

	const state = {
		workspace_selection: {
			primaryId: " A ",
			contextIds: ["B", " B", "", null, "C", "A", "C"],
			source: "suite",
			crsId: " EPSG:25832 ",
		},
	};

	const normalized = getWorkspaceSelection(state);
	assert(normalized.primaryId === "A", "primary resolution");
	assert(eq(normalized.contextIds, ["B", "C", "A"]), "context normalization and dedupe");
	assert(normalized.crsId === "EPSG:25832", "crs normalization");

	assert(getWorkspacePrimaryId(state) === "A", "primary id accessor");
	assert(eq(getWorkspaceContextIds(state), ["B", "C", "A"]), "context id accessor");

	const objectsMap = {
		A: { id: "A", label: "primary" },
		B: { id: "B", label: "ctx-b" },
		C: { id: "C", label: "ctx-c" },
	};

	const primaryObject = getWorkspacePrimaryObject(state, objectsMap);
	assert(primaryObject?.id === "A", "primary object lookup");

	const contextObjects = getWorkspaceContextObjects(state, objectsMap);
	assert(eq(contextObjects.map((o) => o.id), ["B", "C"]), "context object lookup excludes primary");

	const contextObjectsWithPrimary = getWorkspaceContextObjects(
		state,
		objectsMap,
		{ excludePrimary: false }
	);
	assert(
		eq(contextObjectsWithPrimary.map((o) => o.id), ["B", "C", "A"]),
		"primary/context coexistence"
	);

	const sparseObjects = {
		A: { id: "A" },
		C: { id: "C" },
	};
	const sparseContextObjects = getWorkspaceContextObjects(state, sparseObjects);
	assert(eq(sparseContextObjects.map((o) => o.id), ["C"]), "missing context objects filtered");

	const arrayObjects = [
		{ id: "A", tag: "primary" },
		{ id: "B", tag: "context-b" },
		{ id: "C", tag: "context-c" },
	];
	assert(
		getWorkspacePrimaryObject(state, arrayObjects)?.tag === "primary",
		"primary object lookup in array"
	);

	if (typeof window !== "undefined") {
		window.__workspaceSelectionAccessE2E = {
			passed: true,
			ts: Date.now(),
		};
	}

	console.log("WorkspaceSelectionAccess E2E PASSED");
})();
