import { createAlignmentProfileViewModel } from "./createAlignmentProfileViewModel.js";

function unwrap(raw) {
	return raw?.state ?? raw?.payload ?? raw ?? null;
}

function objects(state) {
	return Array.isArray(state?.objects)
		? state.objects
		: Object.values(state?.objects ?? {});
}

function createRegion(documentRef) {
	const panel = documentRef.getElementById("cockpitPanel");
	if (!panel) {
		throw new Error(
			"wireAlignmentProfileSynchronizedView: missing #cockpitPanel"
		);
	}
	const existing = panel.querySelector(
		"[data-alignment-profile-synchronized-region]"
	);
	if (existing) {
		return {
			root: existing,
			context: existing.querySelector("[data-profile-context]"),
			status: existing.querySelector("[data-profile-sync-status]"),
			content: existing.querySelector("[data-profile-content]"),
			longitudinal: existing.querySelector(
				"[data-longitudinal-profile-host]"
			),
			cantCrossLevel: existing.querySelector(
				"[data-cant-cross-level-host]"
			),
		};
	}

	const root = documentRef.createElement("section");
	root.dataset.alignmentProfileSynchronizedRegion = "";
	root.setAttribute(
		"aria-label",
		"Profile Chainage Cant synchronized view"
	);
	const heading = documentRef.createElement("h2");
	heading.textContent = "Profile / Chainage / Cant";
	const status = documentRef.createElement("strong");
	status.dataset.profileSyncStatus = "unavailable";
	status.textContent = "absent";
	const context = documentRef.createElement("pre");
	context.dataset.profileContext = "";
	const content = documentRef.createElement("div");
	content.dataset.profileContent = "";
	const longitudinal = documentRef.createElement("div");
	longitudinal.dataset.longitudinalProfileHost = "";
	const cantCrossLevel = documentRef.createElement("div");
	cantCrossLevel.dataset.cantCrossLevelHost = "";
	root.append(heading, status, context, content, longitudinal, cantCrossLevel);
	panel.append(root);
	return { root, context, status, content, longitudinal, cantCrossLevel };
}

function readCursorAndSelection(store) {
	const state = store.getState();
	const alignmentId = String(
		state?.workspace_selection?.primaryId ?? ""
	).trim();
	const s = Number(state?.cursor?.s);
	return {
		alignmentId: alignmentId || null,
		s: Number.isFinite(s) ? s : 0,
	};
}

function canonicalAlignmentFromState(state, alignmentId) {
	const object =
		objects(state).find(
			(entry) => String(entry?.id ?? "") === alignmentId
		) ?? null;
	const alignmentData =
		object?.type === "alignment"
			? object?.data?.alignmentData ?? null
			: null;
	if (
		!alignmentData ||
		String(alignmentData.id ?? "") !== alignmentId
	) {
		return null;
	}
	return {
		alignmentData,
		revision: Object.prototype.hasOwnProperty.call(
			alignmentData,
			"revision"
		)
			? alignmentData.revision
			: null,
	};
}

function renderContext(contextNode, value) {
	contextNode.textContent = JSON.stringify(value, null, 2);
}

function sameValue(left, right) {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		return (
			Array.isArray(left) &&
			Array.isArray(right) &&
			left.length === right.length &&
			left.every((entry, index) => sameValue(entry, right[index]))
		);
	}
	if (!left || !right || typeof left !== "object" || typeof right !== "object") {
		return false;
	}
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	return (
		leftKeys.length === rightKeys.length &&
		leftKeys.every(
			(key, index) =>
				key === rightKeys[index] && sameValue(left[key], right[key])
		)
	);
}

function renderFailure(region, { context, error }) {
	region.status.dataset.profileSyncStatus = "error";
	region.status.textContent = "error";
	renderContext(region.context, context);
	const pre = region.root.ownerDocument.createElement("pre");
	pre.dataset.profileError = "";
	pre.textContent = JSON.stringify(
		{
			status: "error",
			code: String(error?.code ?? "PROFILE_PROJECTION_FAILED"),
			message: String(error?.message ?? error),
		},
		null,
		2
	);
	region.content.replaceChildren(pre);
}

export function wireAlignmentProfileSynchronizedView({
	store,
	messaging,
	projectionController,
	authoringController = null,
	terminalParabolicVerticalCompositeEditController = null,
	chainageAuthoringController = null,
	chainageSegmentAppendController = null,
	terminalChainageSegmentAddressEditController = null,
	terminalChainageSegmentDirectionEditController = null,
	terminalChainageSegmentDomainEditController = null,
	terminalChainageSegmentCompositeEditController = null,
	terminalChainageSegmentRemoveController = null,
	cantAuthoringController = null,
	linearCantAuthoringController = null,
	terminalLinearCantRateEditController = null,
	terminalCantElementRemoveController = null,
	terminalConstantCantCrossLevelEditController = null,
	terminalConstantCantDomainEditController = null,
	terminalLinearCantDomainEditController = null,
	terminalLinearCantCompositeEditController = null,
	railPairCantRailLawEditController = null,
	chainageLookupController = null,
	longitudinalController = null,
	cantCrossLevelController = null,
	receiptSource = null,
	View,
	LongitudinalView = null,
	CantCrossLevelView = null,
	documentRef = globalThis.document,
} = {}) {
	const publishVerifiedReceipt=(discipline,operation,selected,readback,result)=>receiptSource?.publish?.({verified:result?.status==="saved",objectId:selected?.alignmentId,revision:readback?.revision,discipline,elementId:result?.elementId??result?.segment?.id??null,operation,source:"alignment-profile-canonical-readback"});
	if (
		!store?.getState ||
		typeof store?.subscribe !== "function" ||
		typeof messaging?.sendCmdAwait !== "function" ||
		typeof projectionController?.projectAt !== "function" ||
		(authoringController !== null &&
			typeof authoringController?.submit !== "function") ||
		(terminalParabolicVerticalCompositeEditController !== null &&
			typeof terminalParabolicVerticalCompositeEditController?.update !== "function") ||
		(chainageAuthoringController !== null &&
			typeof chainageAuthoringController?.submit !== "function") ||
		(chainageSegmentAppendController !== null &&
			typeof chainageSegmentAppendController?.append !== "function") ||
		(terminalChainageSegmentAddressEditController !== null &&
			typeof terminalChainageSegmentAddressEditController?.update !== "function") ||
		(terminalChainageSegmentDirectionEditController !== null &&
			typeof terminalChainageSegmentDirectionEditController?.update !== "function") ||
		(terminalChainageSegmentDomainEditController !== null &&
			typeof terminalChainageSegmentDomainEditController?.update !== "function") ||
		(terminalChainageSegmentCompositeEditController !== null &&
			typeof terminalChainageSegmentCompositeEditController?.update !== "function") ||
		(terminalChainageSegmentRemoveController !== null && typeof terminalChainageSegmentRemoveController?.remove !== "function") ||
		(cantAuthoringController !== null &&
			typeof cantAuthoringController?.submit !== "function") ||
		(linearCantAuthoringController !== null &&
			typeof linearCantAuthoringController?.append !== "function") ||
		(terminalLinearCantRateEditController !== null &&
			typeof terminalLinearCantRateEditController?.update !== "function") ||
		(terminalCantElementRemoveController !== null &&
			typeof terminalCantElementRemoveController?.remove !== "function") ||
		(terminalConstantCantCrossLevelEditController !== null &&
			typeof terminalConstantCantCrossLevelEditController?.update !== "function") ||
		(terminalConstantCantDomainEditController !== null &&
			typeof terminalConstantCantDomainEditController?.update !== "function") ||
		(terminalLinearCantDomainEditController !== null &&
			typeof terminalLinearCantDomainEditController?.update !== "function") ||
		(terminalLinearCantCompositeEditController !== null &&
			typeof terminalLinearCantCompositeEditController?.update !== "function") ||
		(railPairCantRailLawEditController !== null &&
			typeof railPairCantRailLawEditController?.update !== "function") ||
		(chainageLookupController !== null &&
			typeof chainageLookupController?.lookup !== "function") ||
		(longitudinalController !== null &&
			typeof longitudinalController?.project !== "function") ||
		(cantCrossLevelController !== null &&
			typeof cantCrossLevelController?.project !== "function") ||
		(LongitudinalView !== null && typeof LongitudinalView !== "function") ||
		(CantCrossLevelView !== null && typeof CantCrossLevelView !== "function") ||
		typeof View !== "function" ||
		!documentRef
	) {
		throw new TypeError(
			"wireAlignmentProfileSynchronizedView: incomplete dependencies"
		);
	}

	const region = createRegion(documentRef);
	const view = new View({ host: region.content });
	const longitudinalView =
		longitudinalController && LongitudinalView && region.longitudinal
			? new LongitudinalView({ host: region.longitudinal })
			: null;
	const cantCrossLevelView =
		cantCrossLevelController && CantCrossLevelView && region.cantCrossLevel
			? new CantCrossLevelView({ host: region.cantCrossLevel })
			: null;
	if (
		longitudinalView &&
		typeof store.actions?.setCursorS === "function"
	) {
		longitudinalView.setCursorSelectionHandler?.((s) => {
			store.actions.setCursorS(s);
		});
	}
	if (
		cantCrossLevelView &&
		typeof store.actions?.setCursorS === "function"
	) {
		cantCrossLevelView.setSelectionHandler?.((s) => {
			store.actions.setCursorS(s);
		});
	}
	let refreshToken = 0;
	let stopped = false;
	let lastSignature = "";
	let chainageLookupResult = null;
	let currentProjection = null;
	const projectionListeners = new Set();
	function publishProjection(value) { currentProjection = value; for (const listener of projectionListeners) listener(value); }

	function renderProjection(projection, profileState = null) {
		const baseViewModel = createAlignmentProfileViewModel(projection);
		const terminalVertical = profileState?.vertical?.elements?.at?.(-1) ?? null;
		const terminal = profileState?.cant?.elements?.at?.(-1) ?? null;
		const matches = terminal && baseViewModel.cant?.value?.elementId === terminal.id
			? profileState.cant.elements.filter((element) => element?.id === terminal.id)
			: [];
		const viewModel = Object.freeze({
			...baseViewModel,
			laneCoverage: buildLaneCoverage(baseViewModel, profileState),
			selectableElements: buildSelectableElements(profileState),
			crossViewSelection: store.getState()?.workspace_selection ?? null,
			terminalParabolicVerticalElement:
				terminalVertical?.type === "parabolic" &&
				profileState.vertical.elements.filter((element) => element?.id === terminalVertical.id).length === 1
					? terminalVertical
					: null,
			terminalCantElement:
				terminal && profileState.cant.elements.filter((element) => element?.id === terminal.id).length === 1
					? terminal
					: null,
			terminalLinearCantElement:
				matches.length === 1 && terminal.type === "linear-cross-level"
					? terminal
					: null,
		});
		renderContext(region.context, {
			alignmentId: viewModel.alignmentId,
			revision: viewModel.revision,
			s: viewModel.cursor.s,
		});
		region.status.dataset.profileSyncStatus =
			viewModel.profileStatePresence;
		region.status.textContent = viewModel.profileStatePresence;
		view.render(viewModel);
		publishProjection(viewModel);
		return viewModel;
	}
	view.setCrossViewElementSelectionHandler?.(({ discipline, elementId, s: exactS }) => {
		const selected = readCursorAndSelection(store);
		if (!selected.alignmentId || !["vertical", "cant", "chainage"].includes(discipline) || !String(elementId ?? "").trim()) return false;
		const current = store.getState()?.workspace_selection ?? {};
		store.actions.setWorkspaceSelection?.({ ...current, primaryId: selected.alignmentId, elementId: String(elementId), elementDiscipline: discipline, source: "longitudinal-workbench" });
		if (Number.isFinite(exactS)) store.actions.setCursorS?.(exactS);
		return true;
	});

	async function renderLongitudinal({ selected, canonical }) {
		if (!longitudinalController || !longitudinalView) {
			renderCantCrossLevel({ selected, canonical });
			return null;
		}
		const viewModel = await longitudinalController.project({
			alignmentId: selected.alignmentId,
			revision: canonical.revision,
			s: selected.s,
			profileState: canonical.alignmentData.profileState,
		});
		longitudinalView.render(viewModel);
		renderCantCrossLevel({ selected, canonical });
		return viewModel;
	}

	function renderCantCrossLevel({ selected, canonical }) {
		if (!cantCrossLevelController || !cantCrossLevelView) return null;
		const viewModel = cantCrossLevelController.project({
			alignmentId: selected.alignmentId,
			revision: canonical.revision,
			s: selected.s,
			profileState: canonical.alignmentData.profileState,
		});
		cantCrossLevelView.render(viewModel);
		return viewModel;
	}

	async function refresh() {
		const token = ++refreshToken;
		const selected = readCursorAndSelection(store);
		const context = {
			alignmentId: selected.alignmentId,
			revision: null,
			s: selected.s,
		};
		if (!selected.alignmentId) {
			publishProjection(null);
			region.status.dataset.profileSyncStatus = "absent";
			region.status.textContent = "absent";
			renderContext(region.context, context);
			region.content.replaceChildren();
			longitudinalView?.render({ status: "absent" });
			cantCrossLevelView?.render({ status: "absent" });
			return null;
		}

		try {
			const state = unwrap(
				await messaging.sendCmdAwait("Spot.GetState", {})
			);
			const canonical = canonicalAlignmentFromState(
				state,
				selected.alignmentId
			);
			if (!canonical) {
				throw Object.assign(
					new Error(
						"active Alignment is unavailable in canonical SPOT state"
					),
					{ code: "ACTIVE_ALIGNMENT_UNAVAILABLE" }
				);
			}
			context.revision = canonical.revision;
			const projection = await projectionController.projectAt(
				context
			);
			if (stopped || token !== refreshToken) return null;
			const result = renderProjection(
				projection,
				canonical.alignmentData.profileState
			);
			await renderLongitudinal({ selected, canonical });
			if (stopped || token !== refreshToken) return null;
			return result;
		} catch (error) {
			if (stopped || token !== refreshToken) return null;
			renderFailure(region, { context, error });
			publishProjection(null);
			return null;
		}
	}

	async function lookupChainageAddress(input) {
		if (!chainageLookupController) throw new Error("chainage address lookup is unavailable");
		view.renderChainageAddressLookup?.({ status: "looking-up" });
		try {
			const selected = readCursorAndSelection(store);
			const state = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const canonical = canonicalAlignmentFromState(state, selected.alignmentId);
			const result = await chainageLookupController.lookup({
				alignmentId: selected.alignmentId,
				revision: canonical.revision,
				s: selected.s,
				profileState: canonical.alignmentData.profileState,
				...input,
			});
			const after = readCursorAndSelection(store);
			if (after.alignmentId !== selected.alignmentId || !Object.is(after.s, selected.s)) {
				throw Object.assign(new Error("active Alignment or cursor changed during chainage lookup"), { code: "CHAINAGE_LOOKUP_CONTEXT_MISMATCH" });
			}
			chainageLookupResult = result;
			view.renderChainageAddressLookup?.(result);
			return result;
		} catch (error) {
			chainageLookupResult = null;
			view.renderChainageAddressLookup?.({ status: "error", code: String(error?.code ?? "CHAINAGE_LOOKUP_FAILED"), message: String(error?.message ?? error) });
			return null;
		}
	}

	function useChainageCandidate() {
		if (chainageLookupResult?.status !== "unique" || chainageLookupResult.candidates?.length !== 1) return null;
		const candidate = chainageLookupResult.candidates[0];
		if (!Number.isFinite(candidate?.s) || typeof store.actions?.setCursorS !== "function") return null;
		store.actions.setCursorS(candidate.s);
		return candidate;
	}

	async function submitBasicVerticalProfile(input) {
		if (!authoringController) {
			throw new Error("basic vertical authoring is unavailable");
		}
		view.renderBasicVerticalAuthoringStatus?.("saving");
		try {
			const selected = readCursorAndSelection(store);
			if (!selected.alignmentId) {
				throw Object.assign(
					new Error("an active Alignment is required"),
					{ code: "ACTIVE_ALIGNMENT_REQUIRED" }
				);
			}
			const state = unwrap(
				await messaging.sendCmdAwait("Spot.GetState", {})
			);
			const canonical = canonicalAlignmentFromState(
				state,
				selected.alignmentId
			);
			if (!canonical) {
				throw Object.assign(
					new Error(
						"active Alignment is unavailable in canonical SPOT state"
					),
					{ code: "ACTIVE_ALIGNMENT_UNAVAILABLE" }
				);
			}
			const result = await authoringController.submit({
				...input,
				alignmentId: selected.alignmentId,
				revision: canonical.revision,
				s: selected.s,
			});
			const after = readCursorAndSelection(store);
			if (
				after.alignmentId !== selected.alignmentId ||
				!Object.is(after.s, selected.s)
			) {
				throw Object.assign(
					new Error(
						"active Alignment or cursor changed during vertical profile save"
					),
					{ code: "ACTIVE_CONTEXT_CHANGED" }
				);
			}
			let readback=null;if(result?.status==="saved"&&result?.snapshot&&result?.profileState){const readbackState=unwrap(await messaging.sendCmdAwait("Spot.GetState",{}));readback=canonicalAlignmentFromState(readbackState,selected.alignmentId);if(!readback||!Object.is(readback.revision,result.snapshot.revision)||!sameValue(readback.alignmentData.profileState,result.profileState))throw Object.assign(new Error("basic vertical profile does not match canonical SPOT readback"),{code:"PROFILE_READBACK_MISMATCH"});}
			const viewModel = renderProjection(result.projection);
			if (longitudinalController && longitudinalView) {
				await refresh();
			}
			view.renderBasicVerticalAuthoringStatus?.("saved");
			publishVerifiedReceipt("vertical","submitBasicVerticalProfile",selected,readback,result);
			return viewModel;
		} catch (error) {
			region.status.dataset.profileSyncStatus = "error";
			region.status.textContent = "error";
			view.renderBasicVerticalAuthoringStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function readActiveProfileContext() {
		const selected = readCursorAndSelection(store);
		if (!selected.alignmentId) {
			throw Object.assign(
				new Error("an active Alignment is required"),
				{ code: "ACTIVE_ALIGNMENT_REQUIRED" }
			);
		}
		const state = unwrap(
			await messaging.sendCmdAwait("Spot.GetState", {})
		);
		const canonical = canonicalAlignmentFromState(
			state,
			selected.alignmentId
		);
		if (!canonical) {
			throw Object.assign(
				new Error(
					"active Alignment is unavailable in canonical SPOT state"
				),
				{ code: "ACTIVE_ALIGNMENT_UNAVAILABLE" }
			);
		}
		return { selected, canonical };
	}

	async function deriveParabolicGradientChangeStart() {
		if (!authoringController) {
			throw new Error("parabolic gradient authoring is unavailable");
		}
		try {
			const { selected, canonical } =
				await readActiveProfileContext();
			const derived =
				authoringController.deriveParabolicGradientChangeStart({
					alignmentId: selected.alignmentId,
					profileState:
						canonical.alignmentData.profileState,
				});
			view.renderParabolicGradientChangeStart?.(derived);
			return derived;
		} catch (error) {
			view.renderParabolicGradientChangeStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function appendParabolicGradientChange(input) {
		if (!authoringController) {
			throw new Error("parabolic gradient authoring is unavailable");
		}
		view.renderParabolicGradientChangeStatus?.("saving");
		try {
			const { selected, canonical } =
				await readActiveProfileContext();
			const result =
				await authoringController.appendParabolicGradientChange({
					...input,
					alignmentId: selected.alignmentId,
					revision: canonical.revision,
					s: selected.s,
					profileState:
						canonical.alignmentData.profileState,
				});
			const after = readCursorAndSelection(store);
			if (
				after.alignmentId !== selected.alignmentId ||
				!Object.is(after.s, selected.s)
			) {
				throw Object.assign(
					new Error(
						"active Alignment or cursor changed during gradient-change save"
					),
					{ code: "ACTIVE_CONTEXT_CHANGED" }
				);
			}
			let readback=null;if(result?.status==="saved"&&result?.snapshot&&result?.profileState){const readbackState=unwrap(await messaging.sendCmdAwait("Spot.GetState",{}));readback=canonicalAlignmentFromState(readbackState,selected.alignmentId);if(!readback||!Object.is(readback.revision,result.snapshot.revision)||!sameValue(readback.alignmentData.profileState,result.profileState))throw Object.assign(new Error("parabolic append does not match canonical SPOT readback"),{code:"PROFILE_READBACK_MISMATCH"});}
			const viewModel = renderProjection(result.projection);
			if (longitudinalController && longitudinalView) {
				await refresh();
			}
			view.renderParabolicGradientChangeStart?.(
				result.derivedStart
			);
			view.renderParabolicGradientChangeStatus?.("saved");
			publishVerifiedReceipt("vertical","appendParabolicGradientChange",selected,readback,result);
			return viewModel;
		} catch (error) {
			region.status.dataset.profileSyncStatus = "error";
			region.status.textContent = "error";
			view.renderParabolicGradientChangeStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function updateTerminalParabolicGradientRate(input) {
		if (
			!authoringController ||
			typeof authoringController.updateTerminalParabolicGradientRate !==
				"function"
		) {
			throw new Error("terminal parabolic editing is unavailable");
		}
		longitudinalView?.renderTerminalParabolicEditStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result =
				await authoringController.updateTerminalParabolicGradientRate({
					...input,
					alignmentId: selected.alignmentId,
					revision: canonical.revision,
					s: selected.s,
					profileState: canonical.alignmentData.profileState,
				});
			const afterSelection = readCursorAndSelection(store);
			if (
				afterSelection.alignmentId !== selected.alignmentId ||
				!Object.is(afterSelection.s, selected.s)
			) {
				throw Object.assign(
					new Error(
						"active Alignment or cursor changed during terminal parabolic save"
					),
					{ code: "ACTIVE_CONTEXT_CHANGED" }
				);
			}
			const readbackState = unwrap(
				await messaging.sendCmdAwait("Spot.GetState", {})
			);
			const readback = canonicalAlignmentFromState(
				readbackState,
				selected.alignmentId
			);
			if (
				!readback ||
				!Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(
					readback.alignmentData.profileState,
					result.profileState
				)
			) {
				throw Object.assign(
					new Error(
						"terminal parabolic edit does not match canonical SPOT readback"
					),
					{ code: "PROFILE_READBACK_MISMATCH" }
				);
			}
			renderProjection(result.projection);
			await renderLongitudinal({
				selected: afterSelection,
				canonical: readback,
			});
			longitudinalView?.renderTerminalParabolicEditStatus?.("saved");
			return result;
		} catch (error) {
			longitudinalView?.renderTerminalParabolicEditStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function updateTerminalParabolicEndS(input) {
		if (
			!authoringController ||
			typeof authoringController.updateTerminalParabolicEndS !==
				"function"
		) {
			throw new Error("terminal parabolic domain editing is unavailable");
		}
		longitudinalView?.renderTerminalParabolicDomainEditStatus?.(
			"saving"
		);
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result =
				await authoringController.updateTerminalParabolicEndS({
					...input,
					alignmentId: selected.alignmentId,
					revision: canonical.revision,
					s: selected.s,
					profileState: canonical.alignmentData.profileState,
				});
			const afterSelection = readCursorAndSelection(store);
			if (
				afterSelection.alignmentId !== selected.alignmentId ||
				!Object.is(afterSelection.s, selected.s)
			) {
				throw Object.assign(
					new Error(
						"active Alignment or cursor changed during terminal parabolic domain save"
					),
					{ code: "ACTIVE_CONTEXT_CHANGED" }
				);
			}
			const readbackState = unwrap(
				await messaging.sendCmdAwait("Spot.GetState", {})
			);
			const readback = canonicalAlignmentFromState(
				readbackState,
				selected.alignmentId
			);
			if (
				!readback ||
				!Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(
					readback.alignmentData.profileState,
					result.profileState
				)
			) {
				throw Object.assign(
					new Error(
						"terminal parabolic domain edit does not match canonical SPOT readback"
					),
					{ code: "PROFILE_READBACK_MISMATCH" }
				);
			}
			renderProjection(result.projection);
			await renderLongitudinal({
				selected: afterSelection,
				canonical: readback,
			});
			longitudinalView?.renderTerminalParabolicDomainEditStatus?.(
				"saved"
			);
			return result;
		} catch (error) {
			longitudinalView?.renderTerminalParabolicDomainEditStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function updateTerminalParabolicComposite(input) {
		if (!terminalParabolicVerticalCompositeEditController) throw new Error("terminal parabolic composite editing is unavailable");
		view.renderTerminalParabolicCompositeEditStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalParabolicVerticalCompositeEditController.update({
				...input, alignmentId: selected.alignmentId, revision: canonical.revision,
				s: selected.s, profileState: canonical.alignmentData.profileState,
			});
			const afterSelection = readCursorAndSelection(store);
			if (afterSelection.alignmentId !== selected.alignmentId || !Object.is(afterSelection.s, selected.s)) {
				throw Object.assign(new Error("active Alignment or cursor changed during terminal parabolic composite save"), { code: "ACTIVE_CONTEXT_CHANGED" });
			}
			const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (!readback || !Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(readback.alignmentData.profileState, result.profileState)) {
				throw Object.assign(new Error("terminal parabolic composite edit does not match canonical SPOT readback"), { code: "PROFILE_READBACK_MISMATCH" });
			}
			renderProjection(result.projection, readback.alignmentData.profileState);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalParabolicCompositeEditStatus?.("saved");
			publishVerifiedReceipt("vertical","updateTerminalParabolicComposite",selected,readback,result);
			return result;
		} catch (error) {
			view.renderTerminalParabolicCompositeEditStatus?.(`error: ${String(error?.code ?? error?.message ?? error)}`);
			return null;
		}
	}

	async function removeTerminalParabolicElement(input) {
		if (
			!authoringController ||
			typeof authoringController.removeTerminalParabolicElement !==
				"function"
		) {
			throw new Error("terminal parabolic removal is unavailable");
		}
		longitudinalView?.renderTerminalParabolicRemoveStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result =
				await authoringController.removeTerminalParabolicElement({
					...input,
					alignmentId: selected.alignmentId,
					revision: canonical.revision,
					s: selected.s,
					profileState: canonical.alignmentData.profileState,
				});
			const afterSelection = readCursorAndSelection(store);
			if (
				afterSelection.alignmentId !== selected.alignmentId ||
				!Object.is(afterSelection.s, selected.s)
			) {
				throw Object.assign(
					new Error(
						"active Alignment or cursor changed during terminal parabolic removal"
					),
					{ code: "ACTIVE_CONTEXT_CHANGED" }
				);
			}
			const readbackState = unwrap(
				await messaging.sendCmdAwait("Spot.GetState", {})
			);
			const readback = canonicalAlignmentFromState(
				readbackState,
				selected.alignmentId
			);
			if (
				!readback ||
				!Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(
					readback.alignmentData.profileState,
					result.profileState
				)
			) {
				throw Object.assign(
					new Error(
						"terminal parabolic removal does not match canonical SPOT readback"
					),
					{ code: "PROFILE_READBACK_MISMATCH" }
				);
			}
			renderProjection(result.projection);
			await renderLongitudinal({
				selected: afterSelection,
				canonical: readback,
			});
			longitudinalView?.renderTerminalParabolicRemoveStatus?.(
				"removed"
			);
			return result;
		} catch (error) {
			longitudinalView?.renderTerminalParabolicRemoveStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function submitBasicChainage(input) {
		if (!chainageAuthoringController) {
			throw new Error("basic chainage mapping authoring is unavailable");
		}
		view.renderBasicChainageStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await chainageAuthoringController.submit({
				...input,
				alignmentId: selected.alignmentId,
				revision: canonical.revision,
				s: selected.s,
				profileState: canonical.alignmentData.profileState,
			});
			const afterSelection = readCursorAndSelection(store);
			if (
				afterSelection.alignmentId !== selected.alignmentId ||
				!Object.is(afterSelection.s, selected.s)
			) {
				throw Object.assign(
					new Error(
						"active Alignment or cursor changed during chainage mapping save"
					),
					{ code: "ACTIVE_CONTEXT_CHANGED" }
				);
			}
			const readbackState = unwrap(
				await messaging.sendCmdAwait("Spot.GetState", {})
			);
			const readback = canonicalAlignmentFromState(
				readbackState,
				selected.alignmentId
			);
			if (
				!readback ||
				!Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(
					readback.alignmentData.profileState,
					result.profileState
				)
			) {
				throw Object.assign(
					new Error(
						"chainage mapping does not match canonical SPOT readback"
					),
					{ code: "PROFILE_READBACK_MISMATCH" }
				);
			}
			const viewModel = renderProjection(result.projection);
			await renderLongitudinal({
				selected: afterSelection,
				canonical: readback,
			});
			view.renderBasicChainageStatus?.("saved");
			publishVerifiedReceipt("chainage","submitBasicChainage",selected,readback,result);
			return viewModel;
		} catch (error) {
			region.status.dataset.profileSyncStatus = "error";
			region.status.textContent = "error";
			view.renderBasicChainageStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function appendChainageSegment(input) {
		if (!chainageSegmentAppendController) {
			throw new Error("chainage segment append is unavailable");
		}
		view.renderChainageSegmentAppendStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await chainageSegmentAppendController.append({
				...input,
				alignmentId: selected.alignmentId,
				revision: canonical.revision,
				s: selected.s,
				profileState: canonical.alignmentData.profileState,
			});
			const afterSelection = readCursorAndSelection(store);
			if (
				afterSelection.alignmentId !== selected.alignmentId ||
				!Object.is(afterSelection.s, selected.s)
			) {
				throw Object.assign(
					new Error("active Alignment or cursor changed during chainage segment save"),
					{ code: "ACTIVE_CONTEXT_CHANGED" }
				);
			}
			const readbackState = unwrap(
				await messaging.sendCmdAwait("Spot.GetState", {})
			);
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (
				!readback ||
				!Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(readback.alignmentData.profileState, result.profileState)
			) {
				throw Object.assign(
					new Error("chainage segment does not match canonical SPOT readback"),
					{ code: "PROFILE_READBACK_MISMATCH" }
				);
			}
			const viewModel = renderProjection(result.projection);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderChainageSegmentAppendStatus?.("saved");
			publishVerifiedReceipt("chainage","appendChainageSegment",selected,readback,result);
			return viewModel;
		} catch (error) {
			view.renderChainageSegmentAppendStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function updateTerminalChainageSegmentAddress(input) {
		if (!terminalChainageSegmentAddressEditController) {
			throw new Error("terminal chainage address editing is unavailable");
		}
		view.renderTerminalChainageAddressEditStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalChainageSegmentAddressEditController.update({
				...input,
				alignmentId: selected.alignmentId,
				revision: canonical.revision,
				s: selected.s,
				profileState: canonical.alignmentData.profileState,
			});
			const afterSelection = readCursorAndSelection(store);
			if (afterSelection.alignmentId !== selected.alignmentId ||
				!Object.is(afterSelection.s, selected.s)) {
				throw Object.assign(new Error(
					"active Alignment or cursor changed during terminal chainage address save"
				), { code: "ACTIVE_CONTEXT_CHANGED" });
			}
			const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (!readback || !Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(readback.alignmentData.profileState, result.profileState)) {
				throw Object.assign(new Error(
					"terminal chainage address does not match canonical SPOT readback"
				), { code: "PROFILE_READBACK_MISMATCH" });
			}
			const viewModel = renderProjection(result.projection);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalChainageAddressEditStatus?.("saved");
			return viewModel;
		} catch (error) {
			view.renderTerminalChainageAddressEditStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function updateTerminalChainageSegmentDirection(input) {
		if (!terminalChainageSegmentDirectionEditController) throw new Error("terminal chainage direction editing is unavailable");
		view.renderTerminalChainageDirectionEditStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalChainageSegmentDirectionEditController.update({
				...input, alignmentId: selected.alignmentId, revision: canonical.revision,
				s: selected.s, profileState: canonical.alignmentData.profileState,
			});
			const afterSelection = readCursorAndSelection(store);
			if (afterSelection.alignmentId !== selected.alignmentId || !Object.is(afterSelection.s, selected.s)) {
				throw Object.assign(new Error("active Alignment or cursor changed during terminal chainage direction save"), { code: "ACTIVE_CONTEXT_CHANGED" });
			}
			const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (!readback || !Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(readback.alignmentData.profileState, result.profileState)) {
				throw Object.assign(new Error("terminal chainage direction does not match canonical SPOT readback"), { code: "PROFILE_READBACK_MISMATCH" });
			}
			const viewModel = renderProjection(result.projection);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalChainageDirectionEditStatus?.("saved");
			return viewModel;
		} catch (error) {
			view.renderTerminalChainageDirectionEditStatus?.(`error: ${String(error?.code ?? error?.message ?? error)}`);
			return null;
		}
	}

	async function updateTerminalChainageSegmentDomain(input) {
		if (!terminalChainageSegmentDomainEditController) throw new Error("terminal chainage domain editing is unavailable");
		view.renderTerminalChainageDomainEditStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalChainageSegmentDomainEditController.update({
				...input, alignmentId: selected.alignmentId, revision: canonical.revision,
				s: selected.s, profileState: canonical.alignmentData.profileState,
			});
			const afterSelection = readCursorAndSelection(store);
			if (afterSelection.alignmentId !== selected.alignmentId || !Object.is(afterSelection.s, selected.s)) {
				throw Object.assign(new Error("active Alignment or cursor changed during terminal chainage domain save"), { code: "ACTIVE_CONTEXT_CHANGED" });
			}
			const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (!readback || !Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(readback.alignmentData.profileState, result.profileState)) {
				throw Object.assign(new Error("terminal chainage domain does not match canonical SPOT readback"), { code: "PROFILE_READBACK_MISMATCH" });
			}
			const viewModel = renderProjection(result.projection);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalChainageDomainEditStatus?.("saved");
			return viewModel;
		} catch (error) {
			view.renderTerminalChainageDomainEditStatus?.(`error: ${String(error?.code ?? error?.message ?? error)}`);
			return null;
		}
	}

	async function updateTerminalChainageSegmentComposite(input) {
		if (!terminalChainageSegmentCompositeEditController) throw new Error("terminal chainage composite editing is unavailable");
		view.renderTerminalChainageCompositeEditStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalChainageSegmentCompositeEditController.update({
				...input, alignmentId: selected.alignmentId, revision: canonical.revision,
				s: selected.s, profileState: canonical.alignmentData.profileState,
			});
			const afterSelection = readCursorAndSelection(store);
			if (afterSelection.alignmentId !== selected.alignmentId || !Object.is(afterSelection.s, selected.s)) {
				throw Object.assign(new Error("active Alignment or cursor changed during terminal chainage composite save"), { code: "ACTIVE_CONTEXT_CHANGED" });
			}
			const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (!readback || !Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(readback.alignmentData.profileState, result.profileState)) {
				throw Object.assign(new Error("terminal chainage composite edit does not match canonical SPOT readback"), { code: "PROFILE_READBACK_MISMATCH" });
			}
			const viewModel = renderProjection(result.projection);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalChainageCompositeEditStatus?.("saved");
			publishVerifiedReceipt("chainage","updateTerminalChainageSegmentComposite",selected,readback,result);
			return viewModel;
		} catch (error) {
			view.renderTerminalChainageCompositeEditStatus?.(`error: ${String(error?.code ?? error?.message ?? error)}`);
			return null;
		}
	}

	async function removeTerminalChainageSegment(input) {
		if (!terminalChainageSegmentRemoveController) throw new Error("terminal chainage removal is unavailable");
		view.renderTerminalChainageRemoveStatus?.("removing");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalChainageSegmentRemoveController.remove({ ...input, alignmentId: selected.alignmentId, revision: canonical.revision, s: selected.s, profileState: canonical.alignmentData.profileState });
			const afterSelection = readCursorAndSelection(store);
			if (afterSelection.alignmentId !== selected.alignmentId || !Object.is(afterSelection.s, selected.s)) throw Object.assign(new Error("active Alignment or cursor changed during terminal chainage removal"), { code: "ACTIVE_CONTEXT_CHANGED" });
			const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (!readback || !Object.is(readback.revision, result.snapshot.revision) || !sameValue(readback.alignmentData.profileState, result.profileState)) throw Object.assign(new Error("terminal chainage removal does not match canonical SPOT readback"), { code: "PROFILE_READBACK_MISMATCH" });
			const viewModel = renderProjection(result.projection);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalChainageRemoveStatus?.("removed");
			return viewModel;
		} catch (error) {
			view.renderTerminalChainageRemoveStatus?.(`error: ${String(error?.code ?? error?.message ?? error)}`);
			return null;
		}
	}

	async function submitBasicCant(input) {
		if (!cantAuthoringController) {
			throw new Error("basic Cant authoring is unavailable");
		}
		view.renderBasicCantStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await cantAuthoringController.submit({
				...input,
				alignmentId: selected.alignmentId,
				revision: canonical.revision,
				s: selected.s,
				profileState: canonical.alignmentData.profileState,
			});
			const afterSelection = readCursorAndSelection(store);
			if (
				afterSelection.alignmentId !== selected.alignmentId ||
				!Object.is(afterSelection.s, selected.s)
			) {
				throw Object.assign(
					new Error(
						"active Alignment or cursor changed during Cant save"
					),
					{ code: "ACTIVE_CONTEXT_CHANGED" }
				);
			}
			const readbackState = unwrap(
				await messaging.sendCmdAwait("Spot.GetState", {})
			);
			const readback = canonicalAlignmentFromState(
				readbackState,
				selected.alignmentId
			);
			if (
				!readback ||
				!Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(
					readback.alignmentData.profileState,
					result.profileState
				)
			) {
				throw Object.assign(
					new Error(
						"Cant state does not match canonical SPOT readback"
					),
					{ code: "PROFILE_READBACK_MISMATCH" }
				);
			}
			const viewModel = renderProjection(result.projection);
			await renderLongitudinal({
				selected: afterSelection,
				canonical: readback,
			});
			view.renderBasicCantStatus?.("saved");
			publishVerifiedReceipt("cant","submitBasicCant",selected,readback,result);
			return viewModel;
		} catch (error) {
			region.status.dataset.profileSyncStatus = "error";
			region.status.textContent = "error";
			view.renderBasicCantStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function appendLinearCantElement(input) {
		if (!linearCantAuthoringController) {
			throw new Error("linear Cant authoring is unavailable");
		}
		view.renderLinearCantStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await linearCantAuthoringController.append({
				...input,
				alignmentId: selected.alignmentId,
				revision: canonical.revision,
				s: selected.s,
				profileState: canonical.alignmentData.profileState,
			});
			const afterSelection = readCursorAndSelection(store);
			if (
				afterSelection.alignmentId !== selected.alignmentId ||
				!Object.is(afterSelection.s, selected.s)
			) {
				throw Object.assign(
					new Error("active Alignment or cursor changed during linear Cant save"),
					{ code: "ACTIVE_CONTEXT_CHANGED" }
				);
			}
			const readbackState = unwrap(
				await messaging.sendCmdAwait("Spot.GetState", {})
			);
			const readback = canonicalAlignmentFromState(
				readbackState,
				selected.alignmentId
			);
			if (
				!readback ||
				!Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(readback.alignmentData.profileState, result.profileState)
			) {
				throw Object.assign(
					new Error("linear Cant state does not match canonical SPOT readback"),
					{ code: "PROFILE_READBACK_MISMATCH" }
				);
			}
			const viewModel = renderProjection(result.projection);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderLinearCantStatus?.("saved");
			publishVerifiedReceipt("cant","appendLinearCantElement",selected,readback,result);
			return viewModel;
		} catch (error) {
			region.status.dataset.profileSyncStatus = "error";
			region.status.textContent = "error";
			view.renderLinearCantStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function updateTerminalLinearCantRate(input) {
		if (!terminalLinearCantRateEditController) {
			throw new Error("terminal linear Cant rate editing is unavailable");
		}
		view.renderTerminalLinearCantRateStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalLinearCantRateEditController.update({
				...input,
				alignmentId: selected.alignmentId,
				revision: canonical.revision,
				s: selected.s,
				profileState: canonical.alignmentData.profileState,
			});
			const afterSelection = readCursorAndSelection(store);
			if (
				afterSelection.alignmentId !== selected.alignmentId ||
				!Object.is(afterSelection.s, selected.s)
			) {
				throw Object.assign(
					new Error("active Alignment or cursor changed during terminal linear Cant save"),
					{ code: "ACTIVE_CONTEXT_CHANGED" }
				);
			}
			const readbackState = unwrap(
				await messaging.sendCmdAwait("Spot.GetState", {})
			);
			const readback = canonicalAlignmentFromState(
				readbackState,
				selected.alignmentId
			);
			if (
				!readback ||
				!Object.is(readback.revision, result.snapshot.revision) ||
				!sameValue(readback.alignmentData.profileState, result.profileState)
			) {
				throw Object.assign(
					new Error("terminal linear Cant rate does not match canonical SPOT readback"),
					{ code: "PROFILE_READBACK_MISMATCH" }
				);
			}
			renderProjection(result.projection, readback.alignmentData.profileState);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalLinearCantRateStatus?.("saved");
			return result;
		} catch (error) {
			view.renderTerminalLinearCantRateStatus?.(
				`error: ${String(error?.code ?? error?.message ?? error)}`
			);
			return null;
		}
	}

	async function removeTerminalCantElement(input) {
		if (!terminalCantElementRemoveController) throw new Error("terminal Cant removal is unavailable");
		view.renderTerminalCantRemoveStatus?.("removing");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalCantElementRemoveController.remove({
				...input,
				alignmentId: selected.alignmentId,
				revision: canonical.revision,
				s: selected.s,
				profileState: canonical.alignmentData.profileState,
			});
			const afterSelection = readCursorAndSelection(store);
			if (afterSelection.alignmentId !== selected.alignmentId || !Object.is(afterSelection.s, selected.s)) throw Object.assign(new Error("active Alignment or cursor changed during terminal Cant removal"), { code: "ACTIVE_CONTEXT_CHANGED" });
			const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (!readback || !Object.is(readback.revision, result.snapshot.revision) || !sameValue(readback.alignmentData.profileState, result.profileState)) throw Object.assign(new Error("removed terminal Cant state does not match canonical SPOT readback"), { code: "PROFILE_READBACK_MISMATCH" });
			renderProjection(result.projection, readback.alignmentData.profileState);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalCantRemoveStatus?.("removed");
			return result;
		} catch (error) {
			view.renderTerminalCantRemoveStatus?.(`error: ${String(error?.code ?? error?.message ?? error)}`);
			return null;
		}
	}

	async function updateTerminalConstantCantCrossLevel(input) {
		if (!terminalConstantCantCrossLevelEditController) throw new Error("terminal constant Cant editing is unavailable");
		view.renderTerminalConstantCantStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalConstantCantCrossLevelEditController.update({ ...input, alignmentId: selected.alignmentId, revision: canonical.revision, s: selected.s, profileState: canonical.alignmentData.profileState });
			const afterSelection = readCursorAndSelection(store);
			if (afterSelection.alignmentId !== selected.alignmentId || !Object.is(afterSelection.s, selected.s)) throw Object.assign(new Error("active Alignment or cursor changed during terminal constant Cant save"), { code: "ACTIVE_CONTEXT_CHANGED" });
			const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (!readback || !Object.is(readback.revision, result.snapshot.revision) || !sameValue(readback.alignmentData.profileState, result.profileState)) throw Object.assign(new Error("terminal constant Cant value does not match canonical SPOT readback"), { code: "PROFILE_READBACK_MISMATCH" });
			renderProjection(result.projection, readback.alignmentData.profileState);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalConstantCantStatus?.("saved");
			publishVerifiedReceipt("cant","updateTerminalConstantCantCrossLevel",selected,readback,result);
			return result;
		} catch (error) {
			view.renderTerminalConstantCantStatus?.(`error: ${String(error?.code ?? error?.message ?? error)}`);
			return null;
		}
	}

	async function updateTerminalConstantCantDomain(input) {
		if (!terminalConstantCantDomainEditController) throw new Error("terminal constant Cant domain editing is unavailable");
		view.renderTerminalConstantCantDomainStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalConstantCantDomainEditController.update({ ...input, alignmentId: selected.alignmentId, revision: canonical.revision, s: selected.s, profileState: canonical.alignmentData.profileState });
			const afterSelection = readCursorAndSelection(store);
			if (afterSelection.alignmentId !== selected.alignmentId || !Object.is(afterSelection.s, selected.s)) throw Object.assign(new Error("active Alignment or cursor changed during terminal constant Cant domain save"), { code: "ACTIVE_CONTEXT_CHANGED" });
			const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (!readback || !Object.is(readback.revision, result.snapshot.revision) || !sameValue(readback.alignmentData.profileState, result.profileState)) throw Object.assign(new Error("terminal constant Cant domain does not match canonical SPOT readback"), { code: "PROFILE_READBACK_MISMATCH" });
			renderProjection(result.projection, readback.alignmentData.profileState);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalConstantCantDomainStatus?.("saved");
			publishVerifiedReceipt("cant","updateTerminalConstantCantDomain",selected,readback,result);
			return result;
		} catch (error) {
			view.renderTerminalConstantCantDomainStatus?.(`error: ${String(error?.code ?? error?.message ?? error)}`);
			return null;
		}
	}

	async function updateTerminalLinearCantDomain(input) {
		if (!terminalLinearCantDomainEditController) throw new Error("terminal linear Cant domain editing is unavailable");
		view.renderTerminalLinearCantDomainStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalLinearCantDomainEditController.update({ ...input, alignmentId: selected.alignmentId, revision: canonical.revision, s: selected.s, profileState: canonical.alignmentData.profileState });
			const afterSelection = readCursorAndSelection(store);
			if (afterSelection.alignmentId !== selected.alignmentId || !Object.is(afterSelection.s, selected.s)) throw Object.assign(new Error("active Alignment or cursor changed during terminal linear Cant domain save"), { code: "ACTIVE_CONTEXT_CHANGED" });
			const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (!readback || !Object.is(readback.revision, result.snapshot.revision) || !sameValue(readback.alignmentData.profileState, result.profileState)) throw Object.assign(new Error("terminal linear Cant domain does not match canonical SPOT readback"), { code: "PROFILE_READBACK_MISMATCH" });
			renderProjection(result.projection, readback.alignmentData.profileState);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalLinearCantDomainStatus?.("saved");
			return result;
		} catch (error) {
			view.renderTerminalLinearCantDomainStatus?.(`error: ${String(error?.code ?? error?.message ?? error)}`);
			return null;
		}
	}

	async function updateTerminalLinearCantComposite(input) {
		if (!terminalLinearCantCompositeEditController) throw new Error("terminal linear Cant composite editing is unavailable");
		view.renderTerminalLinearCantCompositeStatus?.("saving");
		try {
			const { selected, canonical } = await readActiveProfileContext();
			const result = await terminalLinearCantCompositeEditController.update({ ...input, alignmentId: selected.alignmentId, revision: canonical.revision, s: selected.s, profileState: canonical.alignmentData.profileState });
			const afterSelection = readCursorAndSelection(store);
			if (afterSelection.alignmentId !== selected.alignmentId || !Object.is(afterSelection.s, selected.s)) throw Object.assign(new Error("active Alignment or cursor changed during terminal linear Cant composite save"), { code: "ACTIVE_CONTEXT_CHANGED" });
			const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
			const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
			if (!readback || !Object.is(readback.revision, result.snapshot.revision) || !sameValue(readback.alignmentData.profileState, result.profileState)) throw Object.assign(new Error("terminal linear Cant composite edit does not match canonical SPOT readback"), { code: "PROFILE_READBACK_MISMATCH" });
			renderProjection(result.projection, readback.alignmentData.profileState);
			await renderLongitudinal({ selected: afterSelection, canonical: readback });
			view.renderTerminalLinearCantCompositeStatus?.("saved");
			publishVerifiedReceipt("cant","updateTerminalLinearCantComposite",selected,readback,result);
			return result;
		} catch (error) {
			view.renderTerminalLinearCantCompositeStatus?.(`error: ${String(error?.code ?? error?.message ?? error)}`);
			return null;
		}
	}

	async function updateRailPairCantRailLaw(input) {
		if (!railPairCantRailLawEditController) throw new Error("rail-pair Cant law editing is unavailable");
		const { selected, canonical } = await readActiveProfileContext();
		const result = await railPairCantRailLawEditController.update({ ...input, alignmentId: selected.alignmentId, revision: canonical.revision, s: selected.s, profileState: canonical.alignmentData.profileState });
		const afterSelection = readCursorAndSelection(store);
		if (afterSelection.alignmentId !== selected.alignmentId || !Object.is(afterSelection.s, selected.s)) throw Object.assign(new Error("active Alignment or cursor changed during rail-pair Cant save"), { code: "ACTIVE_CONTEXT_CHANGED" });
		const readbackState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
		const readback = canonicalAlignmentFromState(readbackState, selected.alignmentId);
		if (!readback || !Object.is(readback.revision, result.snapshot.revision) || !sameValue(readback.alignmentData.profileState, result.profileState)) throw Object.assign(new Error("rail-pair Cant edit does not match canonical SPOT readback"), { code: "PROFILE_READBACK_MISMATCH" });
		renderProjection(result.projection, readback.alignmentData.profileState);
		await renderLongitudinal({ selected: afterSelection, canonical: readback });
		publishVerifiedReceipt("cant", "updateRailPairCantRailLaw", selected, readback, result);
		return result;
	}

	if (authoringController) {
		view.setBasicVerticalAuthoringHandler?.(
			submitBasicVerticalProfile
		);
		if (
			typeof authoringController
				.deriveParabolicGradientChangeStart === "function" &&
			typeof authoringController
				.appendParabolicGradientChange === "function"
		) {
			view.setParabolicGradientChangeHandlers?.({
				onPreview: deriveParabolicGradientChangeStart,
				onAppend: appendParabolicGradientChange,
			});
		}
		if (
			longitudinalView &&
			typeof authoringController
				.updateTerminalParabolicGradientRate === "function"
		) {
			longitudinalView.setTerminalParabolicGradientRateHandler?.(
				updateTerminalParabolicGradientRate
			);
		}
		if (
			longitudinalView &&
			typeof authoringController.removeTerminalParabolicElement ===
				"function"
		) {
			longitudinalView.setTerminalParabolicRemoveHandler?.(
				removeTerminalParabolicElement
			);
		}
		if (
			longitudinalView &&
			typeof authoringController.updateTerminalParabolicEndS ===
				"function"
		) {
			longitudinalView.setTerminalParabolicEndSHandler?.(
				updateTerminalParabolicEndS
			);
		}
	}
	if (terminalParabolicVerticalCompositeEditController) {
		view.setTerminalParabolicCompositeEditHandler?.(updateTerminalParabolicComposite);
	}
	if (chainageAuthoringController) {
		view.setBasicChainageHandler?.(
			submitBasicChainage
		);
	}
	if (chainageSegmentAppendController) {
		view.setChainageSegmentAppendHandler?.(appendChainageSegment);
	}
	if (terminalChainageSegmentAddressEditController) {
		view.setTerminalChainageAddressEditHandler?.(updateTerminalChainageSegmentAddress);
	}
	if (terminalChainageSegmentDirectionEditController) {
		view.setTerminalChainageDirectionEditHandler?.(updateTerminalChainageSegmentDirection);
	}
	if (terminalChainageSegmentDomainEditController) {
		view.setTerminalChainageDomainEditHandler?.(updateTerminalChainageSegmentDomain);
	}
	if (terminalChainageSegmentCompositeEditController) {
		view.setTerminalChainageCompositeEditHandler?.(updateTerminalChainageSegmentComposite);
	}
	if (terminalChainageSegmentRemoveController) view.setTerminalChainageRemoveHandler?.(removeTerminalChainageSegment);
	if (cantAuthoringController) {
		view.setBasicCantHandler?.(submitBasicCant);
	}
	if (linearCantAuthoringController) {
		view.setLinearCantHandler?.(appendLinearCantElement);
	}
	if (terminalLinearCantRateEditController) {
		view.setTerminalLinearCantRateHandler?.(updateTerminalLinearCantRate);
	}
	if (terminalCantElementRemoveController) {
		view.setTerminalCantRemoveHandler?.(removeTerminalCantElement);
	}
	if (terminalConstantCantCrossLevelEditController) {
		view.setTerminalConstantCantHandler?.(updateTerminalConstantCantCrossLevel);
	}
	if (terminalConstantCantDomainEditController) {
		view.setTerminalConstantCantDomainHandler?.(updateTerminalConstantCantDomain);
	}
	if (terminalLinearCantDomainEditController) {
		view.setTerminalLinearCantDomainHandler?.(updateTerminalLinearCantDomain);
	}
	if (terminalLinearCantCompositeEditController) {
		view.setTerminalLinearCantCompositeHandler?.(updateTerminalLinearCantComposite);
	}
	if (chainageLookupController) {
		view.setChainageAddressLookupHandlers?.({ onLookup: lookupChainageAddress, onUseCandidate: useChainageCandidate });
	}
	const unsubscribe = store.subscribe(() => {
		const selected = readCursorAndSelection(store);
		const signature = `${selected.alignmentId ?? ""}:${selected.s}`;
		if (signature === lastSignature) return;
		lastSignature = signature;
		void refresh();
	});
	const initial = readCursorAndSelection(store);
	lastSignature = `${initial.alignmentId ?? ""}:${initial.s}`;
	void refresh();

	return Object.freeze({
		refresh,
		focusLane(lane) { return view.focusLane?.(lane) ?? false; },
		submitBasicVerticalProfile,
		deriveParabolicGradientChangeStart,
		appendParabolicGradientChange,
		updateTerminalParabolicGradientRate,
		updateTerminalParabolicEndS,
		updateTerminalParabolicComposite,
		removeTerminalParabolicElement,
		submitBasicChainage,
		appendChainageSegment,
		updateTerminalChainageSegmentAddress,
		updateTerminalChainageSegmentDirection,
		updateTerminalChainageSegmentDomain,
		updateTerminalChainageSegmentComposite,
		removeTerminalChainageSegment,
		submitBasicCant,
		appendLinearCantElement,
		updateTerminalLinearCantRate,
		removeTerminalCantElement,
		updateTerminalConstantCantCrossLevel,
		updateTerminalConstantCantDomain,
		updateTerminalLinearCantDomain,
		updateTerminalLinearCantComposite,
		updateRailPairCantRailLaw,
		lookupChainageAddress,
		useChainageCandidate,
		stop() {
			stopped = true;
			refreshToken += 1;
			unsubscribe?.();
		},
		getRegion() {
			return region.root;
		},
		getCurrentProjection() { return currentProjection; },
		subscribeProjection(listener) { if (typeof listener !== "function") return () => {}; projectionListeners.add(listener); return () => projectionListeners.delete(listener); },
	});
}

function buildLaneCoverage(viewModel, profileState) {
	const verticalElements = profileState?.vertical?.elements ?? [];
	const cantElements = profileState?.cant?.elements ?? [];
	const mappings = profileState?.chainageMappings ?? [];
	const chainageSegments = mappings.flatMap((mapping) => mapping?.segments ?? []);
	return Object.freeze({
		vertical: laneCoverage(viewModel?.vertical, verticalElements),
		chainage: laneCoverage(viewModel?.chainage, chainageSegments, { mappingCount: mappings.length }),
		cant: laneCoverage(viewModel?.cant, cantElements),
	});
}

function laneCoverage(projection, elements, extra = {}) {
	const finiteStarts = elements.map((entry) => Number(entry?.startS)).filter(Number.isFinite);
	const finiteEnds = elements.map((entry) => Number(entry?.endS)).filter(Number.isFinite);
	return Object.freeze({ status: projection?.status ?? "not-covered", value: projection?.value ?? null, elementCount: elements.length, domain: finiteStarts.length && finiteEnds.length ? Object.freeze({ startS: Math.min(...finiteStarts), endS: Math.max(...finiteEnds) }) : null, provenancePresent: elements.length > 0, ...extra });
}

function buildSelectableElements(profileState) {
	const vertical = (profileState?.vertical?.elements ?? []).map((entry) => selectionEntry("vertical", entry));
	const cant = (profileState?.cant?.elements ?? []).map((entry) => selectionEntry("cant", entry));
	const chainage = (profileState?.chainageMappings ?? []).flatMap((mapping) => (mapping?.segments ?? []).map((entry) => selectionEntry("chainage", entry, { mappingId: mapping.id })));
	return Object.freeze({ vertical: Object.freeze(vertical), cant: Object.freeze(cant), chainage: Object.freeze(chainage) });
}

function selectionEntry(discipline, entry, extra = {}) { return Object.freeze({ discipline, elementId: String(entry?.id ?? ""), type: entry?.type ?? "segment", startS: entry?.startS, endS: entry?.endS, properties: entry, ...extra }); }

export default wireAlignmentProfileSynchronizedView;
