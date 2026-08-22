// TransEd bridge: transitionDB commands, TransEd UI state, and a read-only
// SPOT lookup for explicit active Alignment preview context.
import { clamp01 } from "@utils/helpers.js";
import { t } from "../../i18n/strings.js";

const LEVELS = ["constant", "simpleFcn", "protoFcn", "halfWave", "transition"];

function text(el, value) { if (el) el.textContent = String(value ?? ""); }
function clone(value) { return structuredClone(value); }
function title(id) {
	return String(id ?? "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function cuts(spec) {
	const part = spec?.descriptor?.normLengthPartition ?? [0, 1, 0];
	return { w1: clamp01(Number(part[0]) || 0), w2: clamp01((Number(part[0]) || 0) + (Number(part[1]) || 0)) };
}
function card(label, value) {
	const wrap = document.createElement("dl");
	wrap.className = "te-detail-card";
	const dt = document.createElement("dt"); dt.textContent = label;
	const dd = document.createElement("dd");
	if (typeof value === "object" && value !== null) {
		const pre = document.createElement("pre"); pre.textContent = JSON.stringify(value, null, 2); dd.append(pre);
	} else dd.textContent = String(value ?? "—");
	wrap.append(dt, dd);
	return wrap;
}

export function makeTransitionEditorBridge({ store, ui, messaging, view, previewController = null } = {}) {
	if (!store?.getState || !ui?.elements || !messaging?.sendCmdAwait) throw new Error("TransitionEditorBridge: incomplete dependencies");
	const byId = (id) => document.getElementById(id);
	const ov = ui.elements.transitionOverlay ?? byId("transOverlay");
	const nodes = {
		levels: byId("teLevels"), records: byId("teRecordList"), breadcrumb: byId("teBreadcrumb"), details: byId("teDetails"),
		kind: byId("teRecordKind"), title: byId("teRecordTitle"), status: byId("teRecordStatus"), controls: byId("teTransitionControls"),
		preset: ui.elements.tePresetSelMain ?? byId("tePresetSelMain"), compare: byId("teComparePreset"), compareSummary: byId("teCompareSummary"), compareGraph: byId("teCompareGraph"),
		part: [byId("tePart1"), byId("tePartCore"), byId("tePart2")], apply: byId("teApply"), reset: byId("teReset"), editStatus: byId("teEditStatus"), legend: byId("teLegend"),
		w1: byId("teW1"), w2: byId("teW2"), w1Value: byId("teW1Val"), w2Value: byId("teW2Val"),
	};
	let catalogue = null;
	let level = "transition";
	let recordId = "";
	let compareId = "";
	let viewInit = null;
	let visibleRepair = null;
	let previewToken = 0;
	const send = (command, payload = {}) => messaging.sendCmdAwait(command, payload);
	const records = () => catalogue?.records?.[level] ?? [];
	const unwrap = (raw) => raw?.state ?? raw?.payload ?? raw ?? null;

	async function ensureView() {
		if (!viewInit) {
			viewInit = Promise.resolve(view?.init?.()).finally(() => {
				viewInit = null;
			});
		}
		await viewInit;
	}
	async function waitForVisibleLayout() {
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	}
	function setOpen(open) {
		(open ? ui.openTransition : ui.closeTransition)?.();
		store.actions?.setTeOpen?.(open);
	}
	function setPlot(mode) { store.actions?.setTePlot?.(mode); renderCompare(); }
	function isVisible() {
		const host = byId("transBoard");
		return Boolean(
			ov
			&& !ov.classList.contains("hidden")
			&& ov.getClientRects().length
			&& host?.isConnected
			&& host.getClientRects().length
		);
	}
	async function repairVisiblePlot() {
		if (!isVisible()) return false;
		if (!visibleRepair) {
			visibleRepair = (async () => {
				await waitForVisibleLayout();
				if (!isVisible()) return false;
				await ensureView();
				await view?.resize?.();
				return true;
			})().finally(() => {
				visibleRepair = null;
			});
		}
		return await visibleRepair;
	}

	function renderLevels() {
		nodes.levels.replaceChildren();
		for (const item of catalogue?.levels ?? []) {
			const button = document.createElement("button");
			button.type = "button"; button.classList.toggle("is-active", item.id === level);
			button.textContent = `${t(`transed.level.${item.id}`)} (${item.count})`;
			button.addEventListener("click", () => selectLevel(item.id)); nodes.levels.append(button);
		}
	}
	function renderRecords() {
		nodes.records.replaceChildren();
		for (const item of records()) {
			const button = document.createElement("button"); button.type = "button";
			button.classList.toggle("is-active", item.id === recordId); button.textContent = title(item.id);
			button.title = item.id; button.addEventListener("click", () => selectRecord(item.id)); nodes.records.append(button);
		}
	}
	function renderDetails(item) {
		const value = item?.value ?? {};
		nodes.details.replaceChildren(
			card(t("transed.field.identifier"), item?.id),
			card(t("transed.field.access"), t(`transed.access.${item?.access}`)),
			card(t("transed.field.representation"), value?.op ?? value?.type ?? (value?.coeff ? "polynomial" : value?.fcn ? "trigonometric" : "composition")),
			card(t("transed.field.parameters"), value?.normLengthPartition ?? value?.coeff ?? value?.fcn ?? value?.source ?? value),
			card(
				t("transed.field.boundaries"),
				value?.crop ?? ((value?.halfWave1 || value?.halfWave2)
					? { halfWave1: value?.halfWave1, halfWave2: value?.halfWave2 }
					: "—"),
			),
			card(t("transed.field.provenance"), value?.source ?? t("transed.provenance.database")),
		);
	}
	function populateSelect(select, items, active) {
		select.replaceChildren();
		for (const item of items) { const option = document.createElement("option"); option.value = item.id; option.textContent = title(item.id); select.append(option); }
		if (items.some((item) => item.id === active)) select.value = active;
	}

	async function applyPreset(id, { force = false } = {}) {
		const spec = await send("Transition.GetPresetSpec", { presetId: id });
		store.actions?.setTePresetId?.(id); store.actions?.setTePresetSpec?.(spec);
		const { w1, w2 } = cuts(spec);
		store.actions?.setTeSplitsPresetId?.(id); store.actions?.setTeSplitsDirty?.(false);
		store.actions?.setTeW1?.(w1); store.actions?.setTeW2?.(w2);
		nodes.w1.value = w1.toFixed(3); nodes.w2.value = w2.toFixed(3);
		nodes.w1.max = nodes.w2.value; nodes.w2.min = nodes.w1.value;
		text(nodes.w1Value, `${Math.round(w1 * 100)}%`); text(nodes.w2Value, `${Math.round(w2 * 100)}%`);
		const partition = spec?.descriptor?.normLengthPartition ?? [w1, w2 - w1, 1 - w2];
		nodes.part.forEach((node, index) => { node.value = String(partition[index]); });
		text(nodes.status, `${t(`transed.status.${spec?.meta?.status}`)} · ${t("transed.persistence.runtime")}`);
		text(nodes.legend, `${title(id)} · κ(s), κ′(s), κ″(s) · u ∈ [0,1] · ${t("transed.domain.physicalUnavailable")}`);
		if (force) await view?.samplePreset?.(id, { w1, w2 });
		return spec;
	}

	function selectedParameters() {
		const st = store.getState();
		const w1 = clamp01(Number(st.te_w1));
		const w2 = clamp01(Number(st.te_w2));
		return {
			w1,
			w2,
			normLengthPartition: [w1, w2 - w1, 1 - w2],
		};
	}

	async function readActiveAlignmentContext() {
		const selection = store.getState()?.workspace_selection ?? {};
		const alignmentId = String(selection.primaryId ?? "").trim();
		const elementId = String(selection.elementId ?? "").trim();
		if (!alignmentId || !elementId) {
			return { alignmentId: alignmentId || null, revision: null, elementId: elementId || null };
		}
		const state = unwrap(await send("Spot.GetState", {}));
		const objects = Array.isArray(state?.objects)
			? state.objects
			: Object.values(state?.objects ?? {});
		const object = objects.find((entry) => String(entry?.id ?? "") === alignmentId) ?? null;
		const alignmentData = object?.type === "alignment"
			? object?.data?.alignmentData ?? null
			: null;
		const hasElement = alignmentData?.editModel?.elements?.some(
			(entry) => String(entry?.id ?? "") === elementId
		);
		return {
			alignmentId: alignmentData && String(alignmentData.id ?? "") === alignmentId
				? alignmentId
				: null,
			revision: alignmentData?.meta?.modifiedAt ?? object?.meta?.modifiedAt ?? null,
			elementId: hasElement ? elementId : null,
		};
	}

	async function refreshEngineeringPreview() {
		const token = ++previewToken;
		if (!previewController?.createPreview || level !== "transition" || !recordId) {
			view?.renderEngineeringPreview?.(null);
			return null;
		}
		let active;
		try {
			active = await readActiveAlignmentContext();
		} catch (error) {
			active = { alignmentId: null, revision: null, elementId: null };
		}
		if (token !== previewToken) return null;
		const parameters = selectedParameters();
		const projection = previewController.createPreview({
			active,
			selected: { recordId, parameters },
			evaluation: {
				quantity: "curvature",
				at: { role: "normalized-longitudinal-parameter", value: 0.5 },
			},
			continuityProblem: {
				problemId: `transed-preview:${recordId}`,
				knownParameters: parameters,
				fixedParameters: [],
				freeParameters: [],
				constraints: [],
				requestedOutputQuantities: ["curvature"],
				provenance: { source: "transition-editor-engineering-preview" },
			},
			axtranInput: {
				knownParameters: parameters,
				constraints: [],
				requestedOutputQuantities: ["curvature"],
			},
			provenance: {
				source: "transition-editor-selected-record",
				alignmentId: active.alignmentId,
				revision: active.revision,
				elementId: active.elementId,
			},
		});
		view?.renderEngineeringPreview?.(projection);
		return projection;
	}

	async function selectLevel(next) {
		if (!LEVELS.includes(next)) return false;
		level = next; recordId = catalogue?.records?.[level]?.[0]?.id ?? "";
		renderLevels(); renderRecords(); await selectRecord(recordId); return true;
	}
	async function selectRecord(id) {
		const item = records().find((candidate) => candidate.id === id); if (!item) return false;
		recordId = id; renderRecords(); text(nodes.breadcrumb, `${t("transed.catalogue")} › ${t(`transed.level.${level}`)} › ${title(id)}`);
		text(nodes.kind, t(`transed.level.${level}`)); text(nodes.title, title(id)); renderDetails(item);
		nodes.controls?.classList.toggle("hidden", level !== "transition");
		if (level === "transition") {
			nodes.preset.value = id;
			await applyPreset(id);
			await renderCompare();
			await refreshEngineeringPreview();
		} else view?.renderEngineeringPreview?.(null);
		return true;
	}

	async function reloadCatalogue({ preserve = true } = {}) {
		const previous = { level, recordId, compareId };
		catalogue = await send("Transition.GetCatalogue", {});
		level = preserve && LEVELS.includes(previous.level) ? previous.level : "transition";
		recordId = preserve && catalogue.records[level].some((x) => x.id === previous.recordId) ? previous.recordId : catalogue.records[level][0]?.id ?? "";
		const transitions = catalogue.records.transition;
		compareId = preserve && transitions.some((x) => x.id === previous.compareId) ? previous.compareId : transitions.find((x) => x.id !== recordId)?.id ?? "";
		populateSelect(nodes.preset, transitions, level === "transition" ? recordId : transitions[0]?.id);
		populateSelect(nodes.compare, transitions, compareId); renderLevels(); renderRecords();
		await selectRecord(recordId); return catalogue;
	}

	function summary(samples, key) {
		const values = samples?.samples?.map((x) => Number(x[key])).filter(Number.isFinite) ?? [];
		return values.length ? { start: values[0], end: values.at(-1), min: Math.min(...values), max: Math.max(...values) } : null;
	}
	async function renderCompare() {
		if (!recordId || level !== "transition" || !compareId || !view?.samplePreset) return null;
		const primary = await view.samplePreset(recordId); const secondary = await view.samplePreset(compareId); if (!primary || !secondary) return null;
		const modes = ["k", "k1", "k2"];
		nodes.compareSummary.innerHTML = `<table><thead><tr><th></th><th>${title(recordId)}</th><th>${title(compareId)}</th></tr></thead><tbody>${modes.map((mode) => `<tr><th>${mode === "k" ? "κ" : mode === "k1" ? "κ′" : "κ″"}</th><td>${JSON.stringify(summary(primary, mode))}</td><td>${JSON.stringify(summary(secondary, mode))}</td></tr>`).join("")}</tbody></table>`;
		const mode = store.getState()?.te_plot ?? "k"; const all = [...primary.samples, ...secondary.samples].map((x) => x[mode]).filter(Number.isFinite); const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
		const points = (sample) => sample.samples.map((x) => `${x.u * 600},${170 - ((x[mode] - lo) / span) * 160}`).join(" ");
		nodes.compareGraph.innerHTML = `<polyline class="primary" points="${points(primary)}"></polyline><polyline class="secondary" points="${points(secondary)}"></polyline>`;
		return { primary, secondary, modes };
	}

	async function applyWorkingCopy(values = nodes.part.map((node) => Number(node.value))) {
		const result = await send("Transition.UpdateWorkingCopy", { presetId: recordId, normLengthPartition: values });
		text(nodes.editStatus, result.ok ? t("transed.feedback.applied") : `${result.code}: ${result.reason}`);
		if (result.ok) { await reloadCatalogue(); await applyPreset(recordId, { force: true }); }
		return result;
	}
	async function resetWorkingCopy() {
		const result = await send("Transition.ResetWorkingCopy", { presetId: recordId }); text(nodes.editStatus, t("transed.feedback.reset"));
		await reloadCatalogue(); await applyPreset(recordId, { force: true }); return result;
	}
	function snapshotState() { const st = store.getState(); return clone({ open: !!st.te_open, level, recordId, compareId, plot: st.te_plot ?? "k" }); }
	async function restoreState(snapshot) {
		if (!snapshot) return;
		level = snapshot.level; recordId = snapshot.recordId; compareId = snapshot.compareId; setPlot(snapshot.plot);
		await reloadCatalogue();
		if (snapshot.open) await open();
		else close();
	}
	async function open() {
		setOpen(true);
		if (!catalogue) await reloadCatalogue();
		await repairVisiblePlot();
		await renderCompare();
		await refreshEngineeringPreview();
	}
	function close() { setOpen(false); }

	async function wire() {
		if (ui.elements.__teBridgeWired) return; ui.elements.__teBridgeWired = true;
		(ui.elements.buttonTransition ?? byId("btnTrans"))?.addEventListener("click", open);
		(ui.elements.buttonTransitionClose ?? byId("btnTransClose"))?.addEventListener("click", close);
		nodes.preset.addEventListener("change", () => { level = "transition"; selectRecord(nodes.preset.value); });
		nodes.compare.addEventListener("change", () => { compareId = nodes.compare.value; renderCompare(); });
		nodes.apply.addEventListener("click", () => applyWorkingCopy()); nodes.reset.addEventListener("click", resetWorkingCopy);
		const updateSplits = (source) => {
			let w1 = Number(nodes.w1.value); let w2 = Number(nodes.w2.value);
			if (w1 > w2) { if (source === nodes.w1) w1 = w2; else w2 = w1; }
			w1 = clamp01(w1); w2 = clamp01(w2);
			nodes.w1.value = w1.toFixed(3); nodes.w2.value = w2.toFixed(3);
			nodes.w1.max = nodes.w2.value; nodes.w2.min = nodes.w1.value;
			text(nodes.w1Value, `${Math.round(w1 * 100)}%`); text(nodes.w2Value, `${Math.round(w2 * 100)}%`);
			nodes.part[0].value = String(w1); nodes.part[1].value = String(w2 - w1); nodes.part[2].value = String(1 - w2);
			store.actions?.setTeW1?.(w1); store.actions?.setTeW2?.(w2); store.actions?.setTeSplitsPresetId?.(recordId); store.actions?.setTeSplitsDirty?.(true);
			void refreshEngineeringPreview();
		};
		nodes.w1.addEventListener("input", () => updateSplits(nodes.w1)); nodes.w2.addEventListener("input", () => updateSplits(nodes.w2));
		let previewStateSignature = "";
		store.subscribe(() => {
			const st = store.getState();
			const w1 = clamp01(Number(st.te_w1));
			const w2 = clamp01(Number(st.te_w2));
			nodes.w1.value = w1.toFixed(3);
			nodes.w2.value = w2.toFixed(3);
			nodes.w1.max = nodes.w2.value;
			nodes.w2.min = nodes.w1.value;
			text(nodes.w1Value, `${Math.round(w1 * 100)}%`);
			text(nodes.w2Value, `${Math.round(w2 * 100)}%`);
			nodes.part[0].value = String(w1);
			nodes.part[1].value = String(w2 - w1);
			nodes.part[2].value = String(1 - w2);
			const nextSignature = [
				st.workspace_selection?.primaryId ?? "",
				st.workspace_selection?.elementId ?? "",
				w1,
				w2,
			].join(":");
			if (nextSignature !== previewStateSignature) {
				previewStateSignature = nextSignature;
				void refreshEngineeringPreview();
			}
		});
		document.querySelectorAll('input[name="tePlot"]').forEach((node) => {
			node.checked = node.value === (store.getState()?.te_plot ?? "k");
			node.addEventListener("change", () => node.checked && setPlot(node.value));
		});
		window.addEventListener("ufaim:language-changed", async () => {
			await reloadCatalogue();
			if (store.getState().te_open) {
				await repairVisiblePlot();
			}
		});
		const hostObserver = new ResizeObserver(() => {
			if (isVisible()) void repairVisiblePlot();
		});
		let observedHost = null;
		const observeCurrentHost = () => {
			const host = byId("transBoard");
			if (!host || host === observedHost) return;
			if (observedHost) hostObserver.unobserve(observedHost);
			observedHost = host;
			hostObserver.observe(host);
		};
		observeCurrentHost();
		const overlayObserver = new MutationObserver((mutations) => {
			const ownershipChanged = mutations.some((mutation) =>
				(mutation.type === "attributes" && mutation.target === ov)
				|| (mutation.type === "childList" && (
					mutation.target?.id === "transBoard"
					|| [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
						node?.id === "transBoard" || node?.querySelector?.("#transBoard")
					)
				))
			);
			if (!ownershipChanged) return;
			observeCurrentHost();
			if (isVisible()) void repairVisiblePlot();
		});
		overlayObserver.observe(ov, {
			attributes: true,
			attributeFilter: ["class", "style"],
			childList: true,
			subtree: true,
		});
		window.addEventListener("pageshow", () => {
			if (isVisible()) void repairVisiblePlot();
		});
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible" && isVisible()) void repairVisiblePlot();
		});
		window.addEventListener("ufaim:alignment-changed", () => {
			if (isVisible()) void refreshEngineeringPreview();
		});
		window.addEventListener("keydown", (event) => { if (event.key === "Escape" && store.getState().te_open) close(); });
		await reloadCatalogue({ preserve: false });
		if (store.getState().te_open) await open();
	}

	return { wire, open, close, reloadCatalogue, selectLevel, selectRecord, applyWorkingCopy, resetWorkingCopy, renderCompare, refreshEngineeringPreview, snapshotState, restoreState, repairVisiblePlot, getDebugState: () => ({ level, recordId, compareId, catalogue: clone(catalogue) }) };
}
