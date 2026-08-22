// app/_e2eAlignmentNativeUiTest.js

import { getWorkspacePrimaryId } from "@src/shared/runtime/workspaceSelectionAccess.js";
import { createAlignmentSpotObject } from "@src/model/spot/model/createAlignmentSpotObject.js";
import { buildSparseFromEditModel } from "@src/domain/alignment/editor/buildSparseAlignment.js";
import { setLanguage, t } from "@app/i18n/strings.js";
import { registerE2EFixture } from "@app/_e2eLifecycle.js";

function assert(condition, message) {
	if (!condition) {
		throw new Error(`AlignmentNativeUi E2E FAIL: ${message}`);
	}
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, { timeoutMs = 10000, intervalMs = 40, label = "condition" } = {}) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (await Promise.resolve(predicate())) return true;
		await sleep(intervalMs);
	}
	throw new Error(`timeout waiting for ${label}`);
}

function unwrapSpotState(raw) {
	if (!raw) return null;
	if (raw.state && typeof raw.state === "object") return raw.state;
	if (raw.ok && raw.payload && typeof raw.payload === "object") return raw.payload;
	if (typeof raw === "object") return raw;
	return null;
}

async function readActiveAlignmentData(store, messaging) {
	const spotRaw = await messaging.sendCmdAwait("Spot.GetState", {});
	const spotState = unwrapSpotState(spotRaw);
	const primaryId = getWorkspacePrimaryId(store.getState?.() ?? {});
	if (!primaryId) return null;

	const objects = Array.isArray(spotState?.objects)
		? spotState.objects
		: (
			spotState?.objects && typeof spotState.objects === "object"
				? Object.values(spotState.objects)
				: (Array.isArray(spotState?.items) ? spotState.items : [])
		);

	const active = objects.find((obj) => String(obj?.id ?? "") === String(primaryId));
	return active?.data?.alignmentData ?? null;
}

function setInputValue(input, value) {
	input.value = String(value);
	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
}

function chooseSelectValue(select, value) {
	select.value = String(value);
	select.dispatchEvent(new Event("change", { bubbles: true }));
}

function pointer(type, y, pointerId = 74) {
	return new PointerEvent(type, {
		bubbles: true,
		clientX: 400,
		clientY: y,
		pointerId,
		pointerType: "mouse",
		buttons: type === "pointerup" ? 0 : 1,
	});
}

function readViewerDebugState() {
	return window.__ufAIM_viewController?.getDebugState?.() ?? null;
}

const nativeResult = {
	passed: false,
	phase: "runtime-readiness",
	failures: [],
	fixtureId: null,
	activeObjectId: null,
	completedAt: null,
	updatedAt: new Date().toISOString(),
};
window.__alignmentNativeEditorUiE2E = nativeResult;

function setPhase(phase, details = {}) {
	nativeResult.phase = phase;
	nativeResult.updatedAt = new Date().toISOString();
	Object.assign(nativeResult, details);
}

window.__alignmentNativeEditorUiE2EPromise = (async function runAlignmentNativeUiE2E() {
	try {
		await waitFor(
			() => typeof window !== "undefined" && window.__ufAIM_store && window.messaging,
			{ label: "runtime globals" }
		);

		await waitFor(
			() => !!window.__ufAIM_viewController?.getDebugState && typeof window.__ufAIM_aeBridge?.focusElementInEditor === "function",
			{ label: "viewer and editor-focus bridge readiness" }
		);

		const store = window.__ufAIM_store;
		const messaging = window.messaging;
		assert(!document.querySelector("#transOverlay .uf-align-edit"), "TransEd must not contain Alignment Element Editor UI");
		assert(document.getElementById("tePresetSelMain")?.options?.length > 0, "TransEd transition presets should remain available");

		const id = `alignment_native_ui_${Math.random().toString(36).slice(2, 10)}`;
		registerE2EFixture("alignmentNativeUi", id);
		setPhase("fixture-created", { fixtureId: id });
		const alignmentData = {
			type: "AlignmentData",
			id,
			name: "E2E Native UI",
			source: { kind: "editor", native: true },
			editModel: {
				startPose: {
					p: { x: 0, y: 0 },
					t: { x: 1, y: 0 },
				},
				elements: [
					{ id: "S0", type: "straight", parameters: { length: 80 }, length: 80 },
					{ id: "T1", type: "transition", parameters: { length: 35, transitionType: "bloss", w1: 0.2, w2: 0.85 }, length: 35, transitionType: "bloss", opts: { w1: 0.2, w2: 0.85 } },
					{ id: "A2", type: "arc", parameters: { length: 90, curvature: 1 / 300 }, length: 90, curvature: 1 / 300 },
					{ id: "T3", type: "transition", parameters: { length: 30, transitionType: "clothoid" }, length: 30, transitionType: "clothoid" },
					{ id: "S4", type: "straight", parameters: { length: 70 }, length: 70 },
				],
			},
		};

		const sparseAlignment = buildSparseFromEditModel(alignmentData);
		alignmentData.sparseAlignment = sparseAlignment;

		const spotObject = createAlignmentSpotObject({
			id,
			name: alignmentData.name,
			kernel: sparseAlignment,
			sparseAlignment,
			alignmentData,
			meta: {
				source: { kind: "editor", native: true },
			},
		});

		const addRes = await messaging.sendCmdAwait("Spot.AddObjects", { objects: [spotObject] });
		assert(addRes != null, "Spot.AddObjects should return a result");
		setPhase("spot-object-acknowledged");
		await waitFor(async () => {
			const spotState = unwrapSpotState(await messaging.sendCmdAwait("Spot.GetState", {}));
			const objects = Array.isArray(spotState?.objects) ? spotState.objects : Object.values(spotState?.objects ?? {});
			return objects.some((object) => String(object?.id ?? "") === id);
		}, { label: "owned SPOT object acknowledgement" });

		store.actions?.setWorkspacePrimary?.({
			objectId: id,
			source: "alignment-native-ui-e2e",
		});
		store.actions?.setActiveRouteProject?.(null);
		setPhase("activation-requested");
		await waitFor(() => getWorkspacePrimaryId(store.getState?.() ?? {}) === id, {
			label: "workspace primary acknowledgement",
		});
		setPhase("active-object-acknowledged", { activeObjectId: id });

		await waitFor(async () => {
			const active = await readActiveAlignmentData(store, messaging);
			return Array.isArray(active?.editModel?.elements) && active.editModel.elements.length >= 5;
		}, { label: "active composed native alignment" });
		setPhase("viewer-readiness");

		await waitFor(() => {
			const viewerState = readViewerDebugState();
			return viewerState?.segmentCount >= 5 && Array.isArray(viewerState?.segmentKinds) && viewerState.segmentKinds.length >= 3;
		}, { label: "viewer rendered alignment segments" });

		const viewerStateInitial = readViewerDebugState();
		assert(viewerStateInitial?.segmentCount >= 5, "viewer should render all native alignment elements");
		assert(viewerStateInitial?.boundaryCount >= 6, "viewer should render element boundaries and endpoints");
		assert(
			viewerStateInitial?.segmentKinds?.includes("straight") &&
			viewerStateInitial?.segmentKinds?.includes("arc") &&
			viewerStateInitial?.segmentKinds?.includes("transition"),
			"viewer should distinguish straight, arc, and transition segments"
		);

		const projectionSignatureBeforeEdits = readViewerDebugState()?.projectionSignature ?? null;
		assert(!!projectionSignatureBeforeEdits, "viewer projection signature should exist after initial render");

		setPhase("viewer-selection-dispatch");
		const viewerSelectionAccepted = window.__ufAIM_viewController.debugSelectAlignmentElement("A2");
		assert(viewerSelectionAccepted === true, "viewer should accept arc element selection");
		await waitFor(() => String(store.getState?.()?.workspace_selection?.elementId ?? "") === "A2", {
			label: "viewer arc ID in workspace selection",
		});
		setPhase("workspace-selection-acknowledged");
		await waitFor(() => String(readViewerDebugState()?.selectedElementId ?? "") === "A2", {
			label: "viewer arc selection synchronization",
		});
		assert(
			String(readViewerDebugState()?.selectedElementId ?? "") === "A2",
			"viewer selection should highlight the arc element after viewer-driven focus"
		);
		setPhase("editor-focus-event-acknowledged");
		await waitFor(() => !document.getElementById("alignmentEditorOverlay")?.classList.contains("hidden"), {
			label: "viewer-opened Alignment Element Editor",
		});
		assert(document.getElementById("transOverlay")?.classList.contains("hidden"), "viewer focus must not open TransEd");
		assert(store.getState()?.ae_open === true && store.getState()?.te_open === false, "Alignment Editor and TransEd open states must be independent");
		await waitFor(() => String(document.getElementById("aeElementSel")?.value ?? "") === "A2", {
			label: "viewer arc ID rendered in element selector",
		});
		setPhase("selection-and-cockpit");
		assert(
			document.querySelector('.cockpit-sofa__list--compact li.is-selected'),
			"cockpit should reflect the viewer-driven selected element"
		);

		const alignmentEditorButton = document.getElementById("btnAlignmentEditor");
		assert(!!alignmentEditorButton, "alignment editor open button should exist");

		setLanguage("de");
		await waitFor(
			() => !!document.querySelector('[data-cockpit-focus-editor-element][data-cockpit-element-id="A2"]'),
			{ label: "cockpit editor-focus action for arc element" }
		);
		const cockpitFocusBtn = document.querySelector('[data-cockpit-focus-editor-element][data-cockpit-element-id="A2"]');
		assert(!!cockpitFocusBtn, "cockpit editor-focus action should exist for arc element A2");
		cockpitFocusBtn.click();

		await waitFor(() => !document.getElementById("alignmentEditorOverlay")?.classList.contains("hidden"), {
			label: "transition overlay visible",
		});

		await waitFor(() => document.getElementById("aeElementSel"), {
			label: "native element editor injected",
		});

		let elementSel = document.getElementById("aeElementSel");
		let lengthInput = document.getElementById("aeLength");
		let curvatureInput = document.getElementById("aeCurvature");
		let radiusInput = document.getElementById("aeRadius");
		let transitionTypeSelect = document.getElementById("aeTransitionType");
		let w1Input = document.getElementById("aeW1");
		let w2Input = document.getElementById("aeW2");
		let applyBtn = document.getElementById("aeApply");
		let resetBtn = document.getElementById("aeReset");
		let statusEl = document.getElementById("aeStatus");
		let titleEl = document.getElementById("aeTitle");
		let elementLabelEl = document.getElementById("aeElementSelLabel");
		let lengthLabelEl = document.getElementById("aeLengthLabel");
		let transitionFamilyLabelEl = document.getElementById("aeTransitionTypeLabel");

		assert(!!elementSel && !!lengthInput && !!curvatureInput && !!radiusInput, "arc editor inputs missing");
		assert(!!transitionTypeSelect && !!w1Input && !!w2Input && !!applyBtn && !!statusEl && !!resetBtn, "transition editor inputs missing");

		await waitFor(() => String(elementSel.value) === "A2", { label: "cockpit-to-editor selected element" });
		assert(String(readViewerDebugState()?.selectedElementId ?? "") === "A2", "viewer should stay focused on the editor-selected arc element");
		assert(titleEl?.textContent === t("alignment_editor.title"), "de panel title should resolve via i18n");
		assert(elementLabelEl?.textContent === t("alignment_editor.label.element"), "de element label should resolve via i18n");
		assert(lengthLabelEl?.textContent === t("alignment_editor.label.length_m"), "de length label should resolve via i18n");
		assert(transitionFamilyLabelEl?.textContent === t("alignment_editor.label.transition_family"), "de transition family label should resolve via i18n");
		assert(applyBtn?.textContent === t("alignment_editor.action.apply"), "de apply label should resolve via i18n");
		assert(resetBtn?.textContent === t("alignment_editor.action.reset"), "de reset label should resolve via i18n");
		assert(titleEl?.textContent !== "alignment_editor.title", "panel title must not be unresolved key fallback");
		assert(applyBtn?.textContent !== "Apply", "de apply label must not use hard-coded fallback text");

		setLanguage("en");
		if (window.__ufAIM_aeBridge?.refresh) {
			await window.__ufAIM_aeBridge.refresh({ preserveSelection: true });
		} else {
			transBtn.click();
			await waitFor(() => !document.getElementById("alignmentEditorOverlay")?.classList.contains("hidden"), {
				label: "transition overlay visible for en refresh",
			});
		}
		setPhase("language-refresh-selection-verification");
		elementSel = document.getElementById("aeElementSel");
		lengthInput = document.getElementById("aeLength");
		curvatureInput = document.getElementById("aeCurvature");
		radiusInput = document.getElementById("aeRadius");
		transitionTypeSelect = document.getElementById("aeTransitionType");
		w1Input = document.getElementById("aeW1");
		w2Input = document.getElementById("aeW2");
		applyBtn = document.getElementById("aeApply");
		resetBtn = document.getElementById("aeReset");
		statusEl = document.getElementById("aeStatus");
		titleEl = document.getElementById("aeTitle");
		elementLabelEl = document.getElementById("aeElementSelLabel");
		lengthLabelEl = document.getElementById("aeLengthLabel");
		transitionFamilyLabelEl = document.getElementById("aeTransitionTypeLabel");
		assert(elementSel?.isConnected && lengthInput?.isConnected && applyBtn?.isConnected, "language refresh must expose live Editor controls");
		assert(String(elementSel.value ?? "") === "A2", "language refresh should preserve A2 in the Editor selector");
		assert(String(store.getState?.()?.workspace_selection?.elementId ?? "") === "A2", "language refresh should preserve A2 in workspace selection");
		await waitFor(() => String(readViewerDebugState()?.selectedElementId ?? "") === "A2", {
			label: "Viewer selection preserved after language refresh",
		});
		assert(
			document.querySelector('.cockpit-sofa__list--compact li.is-selected [data-cockpit-element-id="A2"]'),
			"language refresh should preserve A2 as the Cockpit-selected element"
		);
		assert(titleEl?.textContent === t("alignment_editor.title"), "en panel title should resolve via i18n");
		assert(applyBtn?.textContent === t("alignment_editor.action.apply"), "en apply label should resolve via i18n");
		assert(resetBtn?.textContent === t("alignment_editor.action.reset"), "en reset label should resolve via i18n");

		const beforeArcData = await readActiveAlignmentData(store, messaging);
		const beforeArcEl = beforeArcData?.editModel?.elements?.find((el) => String(el?.type ?? "") === "arc");
		assert(beforeArcEl?.id, "active alignment should contain arc element");
		assert(String(elementSel.value ?? "") === String(beforeArcEl.id), "preserved Editor selection should remain on the active arc before editing");
		const productiveRefreshes = [];
		const captureProductiveRefresh = (event) => productiveRefreshes.push(event.detail);
		window.addEventListener("ufaim:alignment-changed", captureProductiveRefresh);

		setInputValue(lengthInput, 110);
		setInputValue(curvatureInput, 1 / 220);
		assert(Math.abs(Number(radiusInput.value) - 220) < 1e-9, "curvature input should keep its signed radius reciprocal synchronized");
		setInputValue(lengthInput, 999);
		resetBtn.click();
		assert(Math.abs(Number(lengthInput.value) - Number(beforeArcEl?.parameters?.length)) < 1e-9, "reset should restore current arc length input value");

		setInputValue(lengthInput, 110);
		setInputValue(radiusInput, -220);
		assert(Math.abs(Number(curvatureInput.value) - (-1 / 220)) < 1e-12, "signed radius input should keep curvature synchronized");
		applyBtn.click();

		setPhase("arc-edit-persisting");
		await waitFor(async () => {
			const current = await readActiveAlignmentData(store, messaging);
			const arc = current?.editModel?.elements?.find((el) => String(el?.id ?? "") === String(beforeArcEl.id));
			return Math.abs(Number(arc?.parameters?.length) - 110) < 1e-9 && Math.abs(Number(arc?.parameters?.curvature) - (-1 / 220)) < 1e-12;
		}, { label: "persisted arc model state" });

		const afterArcData = await readActiveAlignmentData(store, messaging);
		const afterArcEl = afterArcData?.editModel?.elements?.find((el) => String(el?.id ?? "") === String(beforeArcEl.id));
		assert(Math.abs(Number(afterArcEl?.parameters?.length) - 110) < 1e-9, "arc length should update via UI apply");
		assert(Math.abs(Number(afterArcEl?.parameters?.curvature) - (-1 / 220)) < 1e-12, "signed arc radius should update productive curvature via UI apply");
		await waitFor(() => productiveRefreshes.length === 1, { label: "single productive alignment refresh" });
		assert(productiveRefreshes[0]?.alignmentData === afterArcData || productiveRefreshes[0]?.alignmentData?.id === afterArcData?.id, "productive refresh should identify the persisted Alignment");
		assert(productiveRefreshes[0]?.elementId === beforeArcEl.id, "productive refresh should retain the edited element selection");
		assert(productiveRefreshes[0]?.revision === afterArcData?.meta?.modifiedAt, "productive refresh should carry the persisted revision");
		await waitFor(
			() => document.getElementById("curvatureBand")?.dataset?.state === "committed"
				&& document.getElementById("curvatureBandValue")?.textContent?.includes("-0.004545"),
			{ label: "curvature band canonical label after editor commit" }
		);
		window.removeEventListener("ufaim:alignment-changed", captureProductiveRefresh);
		await waitFor(() => {
			const state = readViewerDebugState();
			return state?.projectionSignature && state.projectionSignature !== projectionSignatureBeforeEdits;
		}, { label: "viewer refresh after arc edit" });
		const projectionSignatureAfterArc = readViewerDebugState()?.projectionSignature ?? null;
		assert(projectionSignatureAfterArc !== projectionSignatureBeforeEdits, "viewer projection should refresh after arc edit");

		setPhase("curvature-band-pointer-commit");
		const bandArc = document.querySelector(`#curvatureBandSvg .band-hit[data-element-id="${beforeArcEl.id}"]`);
		assert(bandArc, "real curvature-band hit target should expose the edited arc");
		bandArc.dispatchEvent(pointer("pointerdown", 70));
		window.dispatchEvent(pointer("pointermove", 20));
		window.dispatchEvent(pointer("pointerup", 20));
		const bandCommit = await window.__ufAIM_curvatureBand.whenCommitSettled();
		assert(bandCommit?.changed === true && bandCommit?.state === "committed", `curvature-band pointer commit rejected: ${bandCommit?.error ?? "unknown reason"}`);
		const afterBandData = await readActiveAlignmentData(store, messaging);
		const afterBandArc = afterBandData?.editModel?.elements?.find((el) => String(el?.id ?? "") === String(beforeArcEl.id));
		assert(Math.abs(Number(afterBandArc?.parameters?.curvature) - Number(bandCommit.curvature)) < 1e-12, "canonical SPOT arc must equal the pointer-drag curvature");
		assert(afterBandData?.meta?.modifiedAt !== afterArcData?.meta?.modifiedAt, "curvature-band pointer commit must advance the persisted revision");
		await waitFor(
			() => Math.abs(Number(curvatureInput.value) - Number(afterBandArc.parameters.curvature)) < 1e-12,
			{ label: "element editor canonical curvature after band pointer commit" }
		);
		assert(String(elementSel.value ?? "") === String(beforeArcEl.id), "element editor selection should remain on the pointer-edited arc");
		assert(String(getWorkspacePrimaryId(store.getState?.() ?? {})) === String(afterBandData.id), "active Alignment should remain the canonical pointer-edited object");
		await waitFor(() => {
			const signature = readViewerDebugState()?.projectionSignature;
			return signature && signature !== projectionSignatureAfterArc;
		}, { label: "viewer canonical geometry after band pointer commit" });
		const projectionSignatureAfterBand = readViewerDebugState()?.projectionSignature ?? null;

		const beforeTransitionData = afterBandData;
		const beforeTransitionEl = beforeTransitionData?.editModel?.elements?.find((el) => String(el?.type ?? "") === "transition");
		assert(beforeTransitionEl?.id, "active alignment should contain transition element");

		chooseSelectValue(elementSel, beforeTransitionEl.id);
		await waitFor(() => transitionTypeSelect.options.length > 0, { label: "transition family options" });

		const optionValues = Array.from(transitionTypeSelect.options).map((opt) => String(opt.value));
		const targetFamily = optionValues.includes("clothoid") ? "clothoid" : optionValues[0];
		assert(!!targetFamily, "transition family option missing");

		chooseSelectValue(transitionTypeSelect, targetFamily);
		setInputValue(lengthInput, 60);
		setInputValue(w1Input, 0.3);
		setInputValue(w2Input, 0.7);
		applyBtn.click();

		setPhase("transition-edit-persisting");
		await waitFor(async () => {
			const current = await readActiveAlignmentData(store, messaging);
			const transition = current?.editModel?.elements?.find((el) => String(el?.id ?? "") === String(beforeTransitionEl.id));
			return Math.abs(Number(transition?.parameters?.length) - 60) < 1e-9 && String(transition?.parameters?.transitionType ?? "") === String(targetFamily);
		}, { label: "persisted transition model state" });

		const afterTransitionData = await readActiveAlignmentData(store, messaging);
		const afterTransitionEl = afterTransitionData?.editModel?.elements?.find((el) => String(el?.id ?? "") === String(beforeTransitionEl.id));
		assert(Math.abs(Number(afterTransitionEl?.parameters?.length) - 60) < 1e-9, "transition length should update via UI apply");
		assert(String(afterTransitionEl?.parameters?.transitionType ?? "") === String(targetFamily), "transition family should update via UI apply");
		assert(Math.abs(Number(afterTransitionEl?.parameters?.w1) - 0.3) < 1e-9, "transition w1 should update via UI apply");
		assert(Math.abs(Number(afterTransitionEl?.parameters?.w2) - 0.7) < 1e-9, "transition w2 should update via UI apply");
		await waitFor(() => {
			const state = readViewerDebugState();
			return state?.projectionSignature && state.projectionSignature !== projectionSignatureAfterBand;
		}, { label: "viewer refresh after transition edit" });
		const projectionSignatureAfterTransition = readViewerDebugState()?.projectionSignature ?? null;
		assert(projectionSignatureAfterTransition !== projectionSignatureAfterBand, "viewer projection should refresh after transition edit");

		const beforeStraightData = afterTransitionData;
		const beforeStraightEl = beforeStraightData?.editModel?.elements?.find((el) => String(el?.type ?? "") === "straight");
		assert(beforeStraightEl?.id, "active alignment should contain straight element");
		chooseSelectValue(elementSel, beforeStraightEl.id);
		setInputValue(lengthInput, 95);
		setPhase("straight-edit-persisting");
		applyBtn.click();
		await waitFor(async () => {
			const current = await readActiveAlignmentData(store, messaging);
			const straight = current?.editModel?.elements?.find((el) => String(el?.id ?? "") === String(beforeStraightEl.id));
			return Math.abs(Number(straight?.parameters?.length) - 95) < 1e-9;
		}, { label: "persisted straight model state" });
		await waitFor(() => {
			const signature = readViewerDebugState()?.projectionSignature;
			return signature && signature !== projectionSignatureAfterTransition;
		}, { label: "viewer refresh after straight edit" });
		const afterStraightData = await readActiveAlignmentData(store, messaging);

		const snapshotBeforeInvalid = JSON.stringify(afterStraightData?.editModel?.elements ?? []);
		const projectionBeforeInvalid = readViewerDebugState()?.projectionSignature ?? null;
		window.__ufAIM_viewController.debugSelectAlignmentElement(beforeArcEl.id);
		await waitFor(() => String(elementSel.value ?? "") === String(beforeArcEl.id), {
			label: "viewer selection returns to arc before invalid edit",
		});
		setInputValue(radiusInput, 0);
		setPhase("invalid-arc-rejection");
		applyBtn.click();

		await waitFor(() => statusEl.dataset.kind === "error", { label: "invalid apply rejection message" });

		const afterInvalidData = await readActiveAlignmentData(store, messaging);
		const snapshotAfterInvalid = JSON.stringify(afterInvalidData?.editModel?.elements ?? []);
		assert(snapshotAfterInvalid === snapshotBeforeInvalid, "invalid UI apply must not mutate active alignment");
		assert((readViewerDebugState()?.projectionSignature ?? null) === projectionBeforeInvalid, "invalid UI apply must not change viewer projection");

		window.dispatchEvent(new CustomEvent("ufaim:alignment-editor-focus-element", {
			detail: { elementId: "MISSING_ID_999" },
		}));
		await waitFor(() => statusEl.dataset.kind === "warn", { label: "missing element focus warning" });
		assert(
			statusEl.textContent === t("alignment_editor.status.focus_target_missing"),
			"missing element focus should use structured warning message"
		);

		setPhase("complete");
		nativeResult.passed = true;
		nativeResult.completedAt = new Date().toISOString();
		nativeResult.ts = Date.now();
		console.log(`AlignmentNativeUi E2E RESULT ${JSON.stringify(nativeResult)}`);
		console.log("AlignmentNativeUi E2E PASSED");
	} catch (error) {
		const message = String(error?.message ?? error);
		nativeResult.passed = false;
		nativeResult.failures.push({ phase: nativeResult.phase, message });
		nativeResult.error = message;
		nativeResult.completedAt = new Date().toISOString();
		nativeResult.ts = Date.now();
		console.log(`AlignmentNativeUi E2E RESULT ${JSON.stringify(nativeResult)}`);
		console.error("AlignmentNativeUi E2E FAILED");
	}
})();
