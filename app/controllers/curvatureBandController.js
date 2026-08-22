import { getWorkspacePrimaryId, getWorkspaceSelectedElementId } from "@src/shared/runtime/workspaceSelectionAccess.js";
import { getSpotObjectById } from "@projection/queries/getSpotObjectById.js";
import { updateArcById } from "@src/domain/alignment/editor/alignmentEditOps.js";
import { buildSparseFromEditModel } from "@src/domain/alignment/editor/buildSparseAlignment.js";
import { makeAlignment2DFromSparse } from "@alignment/build/AlignmentFactory.js";
import { RegistryResolver } from "@transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "@transition/build/KappaFcnBuilder.js";
import { AlignmentEditorController } from "@app/controllers/alignmentEditorController.js";
import { dispatchProductiveAlignmentChange } from "@app/controllers/alignmentCreationController.js";

const NS = "http://www.w3.org/2000/svg";
const resolver = new RegistryResolver();

export function makeCurvatureBandController({ store, messaging } = {}) {
	const root = document.getElementById("curvatureBand");
	const svg = document.getElementById("curvatureBandSvg");
	const output = document.getElementById("curvatureBandValue");
	const context = document.getElementById("curvatureBandContext");
	const collapseButton = document.getElementById("btnCurvatureBandCollapse");
	const compactButton = document.getElementById("btnCurvatureBandCompact");
	const dockButton = document.getElementById("btnCurvatureBandDock");
	const resizeHandle = document.getElementById("curvatureBandResize");
	const editor = new AlignmentEditorController({ store, messaging });
	let snapshot = null;
	let emptyAlignmentId = null;
	let drag = null;
	let loadToken = 0;
	let unsubscribe = null;
	let commitPromise = Promise.resolve({ changed: false, state: "idle" });
	let lastCommit = { changed: false, state: "idle", elementId: null, curvature: null, error: null };
	let presentation = readPresentation();
	let resizeSession = null;

	function start() {
		if (!root || !svg) return;
		applyPresentation();
		svg.addEventListener("pointerdown", onPointerDown);
		svg.addEventListener("pointerover", onPointerOver);
		svg.addEventListener("pointerout", onPointerOut);
		svg.addEventListener("lostpointercapture", onLostPointerCapture);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		window.addEventListener("keydown", onKeyDown);
		collapseButton?.addEventListener("click", () => setPresentation(presentation.mode === "collapsed" ? "working" : "collapsed"));
		compactButton?.addEventListener("click", () => setPresentation(presentation.mode === "compact" ? "working" : "compact"));
		dockButton?.addEventListener("click", () => setDock(presentation.dock === "top" ? "bottom" : "top"));
		resizeHandle?.addEventListener("pointerdown", beginResize);
		window.addEventListener("pointermove", resize);
		window.addEventListener("pointerup", finishResize);
		unsubscribe = store.subscribe(() => void loadAndRender());
		window.addEventListener("ufaim:alignment-changed", onAlignmentChanged);
		void loadAndRender();
	}

	function onAlignmentChanged(event) {
		const change = event?.detail ?? null;
		event?.detail?.waitUntil?.(refreshFromVerifiedChange(change));
	}

	async function refreshFromVerifiedChange(change) {
		await loadAndRender(change);
		if (change?.source !== "alignment-editor") return;
		const objectId = String(change?.objectId ?? "").trim();
		const elementId = String(change?.elementId ?? "").trim();
		const revision = change?.revision ?? null;
		const changeRevision = change?.alignmentData?.meta?.modifiedAt ?? change?.spotObject?.meta?.modifiedAt ?? null;
		const element = snapshot?.alignmentData?.editModel?.elements?.find(
			(entry) => String(entry?.id ?? "") === elementId
		);
		const curvature = Number(element?.parameters?.curvature ?? element?.curvature);
		const mismatch =
			!snapshot?.object ? "missing-object"
				: String(snapshot.id ?? "") !== objectId || String(snapshot.object?.id ?? "") !== objectId ? "wrong-id"
					: snapshot.object?.type !== "alignment" ? "wrong-type"
						: revision == null
							|| String(changeRevision ?? "") !== String(revision)
							|| String(snapshot.alignmentData?.meta?.modifiedAt ?? "") !== String(revision) ? "stale-revision"
							: !element ? "missing-element"
								: !Number.isFinite(curvature) ? "invalid-curvature"
									: null;
		if (mismatch) {
			root.dataset.state = "rejected";
			output.textContent = `Curvature band: persisted Alignment acknowledgement mismatch (${mismatch})`;
			throw new Error(output.textContent);
		}
		root.dataset.state = "committed";
		output.textContent = formatValue(curvature);
	}

	function readPresentation() {
		try {
			const saved = JSON.parse(sessionStorage.getItem("ufaim.curvatureBand.presentation") ?? "null");
			return {
				mode: ["collapsed", "compact", "working"].includes(saved?.mode) ? saved.mode : "working",
				dock: saved?.dock === "top" ? "top" : "bottom",
				height: Math.max(140, Math.min(360, Number(saved?.height) || 216)),
			};
		} catch {
			return { mode: "working", dock: "bottom", height: 216 };
		}
	}

	function savePresentation() {
		try { sessionStorage.setItem("ufaim.curvatureBand.presentation", JSON.stringify(presentation)); } catch {}
	}

	function applyPresentation() {
		if (!root) return;
		root.dataset.presentation = presentation.mode;
		root.dataset.dock = presentation.dock;
		root.style.setProperty("--curvature-band-height", `${presentation.height}px`);
		collapseButton?.setAttribute("aria-expanded", String(presentation.mode !== "collapsed"));
		compactButton?.classList.toggle("is-active", presentation.mode === "compact");
		dockButton?.classList.toggle("is-active", presentation.dock === "top");
		requestAnimationFrame(() => render());
	}

	function setPresentation(mode) {
		if (!["collapsed", "compact", "working"].includes(mode)) return false;
		presentation = { ...presentation, mode };
		savePresentation();
		applyPresentation();
		return true;
	}

	function setDock(dock) {
		presentation = { ...presentation, dock: dock === "top" ? "top" : "bottom" };
		savePresentation();
		applyPresentation();
		return true;
	}

	function beginResize(event) {
		if (presentation.mode === "collapsed") return;
		resizeSession = { pointerId: event.pointerId, startY: event.clientY, startHeight: presentation.height };
		event.preventDefault();
	}

	function resize(event) {
		if (!resizeSession || event.pointerId !== resizeSession.pointerId) return;
		const direction = presentation.dock === "top" ? 1 : -1;
		const height = Math.max(140, Math.min(360, resizeSession.startHeight + (event.clientY - resizeSession.startY) * direction));
		presentation = { ...presentation, height };
		applyPresentation();
	}

	function finishResize(event) {
		if (!resizeSession || event.pointerId !== resizeSession.pointerId) return;
		resizeSession = null;
		savePresentation();
	}

	async function loadAndRender(change = null) {
		if (drag) return;
		const token = ++loadToken;
		const id = getWorkspacePrimaryId(store.getState?.() ?? {});
		if (!id) { snapshot = null; emptyAlignmentId = null; render(); return; }
		let object = String(change?.objectId ?? "") === String(id) ? change?.spotObject ?? null : null;
		let alignmentData = object && change?.alignmentData ? change.alignmentData : null;
		if (!object || !alignmentData) {
			const raw = await messaging.sendCmdAwait("Spot.GetState", {});
			if (token !== loadToken) return;
			const state = unwrap(raw);
			object = getSpotObjectById(state, id);
			alignmentData = object?.data?.alignmentData ?? editor.service.materializeAlignmentDataFromSparse(object);
		}
		if (alignmentData?.editModel && !alignmentData.editModel.elements?.length) {
			snapshot = null;
			emptyAlignmentId = id;
			render();
			return;
		}
		try {
			const sparse = alignmentData.sparseAlignment ?? buildSparseFromEditModel(alignmentData);
			const built = makeAlignment2DFromSparse({ startPose: sparse.startPose, sparse: sparse.sparse ?? sparse.elements, descriptorResolver: resolver, kappaBuilder: KappaFcnBuilder });
			snapshot = { id, object, alignmentData, sparse, alignment: built.alignment };
			emptyAlignmentId = null;
		} catch { snapshot = null; emptyAlignmentId = null; }
		render();
	}

	function render(preview = null) {
		svg.replaceChildren();
		if (context) context.textContent = snapshot
			? `${snapshot.object?.name ?? snapshot.object?.data?.name ?? snapshot.id} · ${snapshot.alignmentData?.editModel?.elements?.length ?? 0}`
			: "";
		if (!snapshot) {
			text(svg, 16, 62, emptyAlignmentId
				? "Noch keine Trassierungselemente · füge als ersten Schritt eine Gerade hinzu"
				: "Wähle ein bearbeitbares Alignment", "band-empty");
			return;
		}
		const active = preview ?? snapshot;
		const elements = active.sparse?.elements ?? active.sparse?.sparse ?? [];
		const total = Math.max(1, Number(active.sparse?.length) || elements.reduce((n, e) => n + Number(e.arcLength || 0), 0));
		const samples = Array.from({ length: 161 }, (_, i) => active.alignment.curvatureAt(total * i / 160));
		const maxK = Math.max(1e-5, ...samples.map((k) => Math.abs(Number(k) || 0))) * 1.25;
		const width = Math.max(400, svg.clientWidth || 900), height = Math.max(100, svg.clientHeight || 140);
		svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
		const x = (s) => 34 + (s / total) * (width - 50);
		const y = (k) => height / 2 - (k / maxK) * (height * .38);
		line(svg, 34, y(0), width - 16, y(0), "band-zero");
		text(svg, 8, y(0) + 3, "0", "band-axis-label");
		text(svg, width - 30, height - 5, "s", "band-axis-label");
		const selected = getWorkspaceSelectedElementId(store.getState?.() ?? {});
		for (const element of elements) {
			const s0 = Number(element.sStart), s1 = Number(element.sEnd);
			line(svg, x(s0), 10, x(s0), height - 15, "band-boundary");
			const points = [];
			for (let i = 0; i <= 24; i++) { const s = s0 + (s1 - s0) * i / 24; points.push(`${x(s)},${y(active.alignment.curvatureAt(s))}`); }
			const className = `band-segment is-${element.kind}${String(selected) === String(element.id) ? " is-selected" : ""}${drag?.elementId === element.id ? " is-dragging" : ""}`;
			const hit = node("polyline", { points: points.join(" "), class: `band-hit is-${element.kind}`, "data-element-id": element.id, "data-kind": element.kind, tabindex: "0", "aria-label": element.kind === "arc" ? `Arc ${element.id}; drag vertically to edit curvature` : `${element.kind} ${element.id}` });
			const path = node("polyline", { points: points.join(" "), class: className, "data-element-id": element.id, "data-kind": element.kind, "aria-hidden": "true" });
			svg.append(hit, path);
		}
		line(svg, x(total), 10, x(total), height - 15, "band-boundary");
	}

	function select(elementId) {
		const state = store.getState?.() ?? {};
		store.actions?.setWorkspaceSelection?.({ primaryId: snapshot?.id, contextIds: state.workspace_selection?.contextIds ?? [], elementId, source: "curvature-band", crsId: state.workspace_selection?.crsId ?? null });
		window.dispatchEvent(new CustomEvent("ufaim:alignment-editor-focus-element", { detail: { elementId, objectId: snapshot?.id, source: "curvature-band" } }));
	}

	function onPointerDown(event) {
		const segment = event.target.closest?.(".band-hit, .band-segment");
		if (!segment || !snapshot || drag) return;
		const elementId = segment.dataset.elementId;
		select(elementId);
		if (segment.dataset.kind !== "arc") { render(); return; }
		const element = snapshot.alignmentData.editModel.elements.find((e) => String(e.id) === String(elementId));
		const curvature = Number(element?.parameters?.curvature ?? element?.curvature);
		if (!Number.isFinite(curvature)) return;
		drag = { pointerId: event.pointerId, elementId, startY: event.clientY, originalCurvature: curvature, proposedCurvature: curvature, originalData: snapshot.alignmentData, preview: null, captureTarget: svg, captured: false };
		if (typeof svg.setPointerCapture === "function") {
			try {
				svg.setPointerCapture(event.pointerId);
				drag.captured = typeof svg.hasPointerCapture !== "function" || svg.hasPointerCapture(event.pointerId);
			} catch (error) {
				if (error?.name !== "NotFoundError") {
					const failed = drag; drag = null;
					root.dataset.state = "rejected";
					output.textContent = `Pointer capture failed: ${String(error?.message ?? error)}`;
					throw error;
				}
				// Synthetic events have no active browser pointer. Window listeners still
				// exercise the same session semantics without pretending capture succeeded.
				drag.captured = false;
			}
		}
		root.dataset.state = "dragging";
		event.preventDefault();
	}

	function onPointerMove(event) {
		if (!drag || event.pointerId !== drag.pointerId || !snapshot) return;
		const scale = Math.max(Math.abs(drag.originalCurvature), 1 / 500) / 55;
		let proposed = drag.originalCurvature + (drag.startY - event.clientY) * scale;
		if (Math.abs(proposed) < 1e-7) proposed = proposed < 0 ? -1e-7 : 1e-7;
		try {
			const next = updateArcById(drag.originalData, { elementId: drag.elementId, curvature: proposed });
			const sparse = buildSparseFromEditModel(next);
			const built = makeAlignment2DFromSparse({ startPose: sparse.startPose, sparse: sparse.sparse, descriptorResolver: resolver, kappaBuilder: KappaFcnBuilder });
			drag.proposedCurvature = proposed;
			drag.preview = { alignmentData: next, sparse, alignment: built.alignment };
			store.actions?.setPreviewItem?.({ item: { id: snapshot.id, kernel: sparse, crsId: snapshot.object?.crsId ?? null, georeference: snapshot.object?.data?.georeference ?? null }, source: { type: "curvature-band", state: "valid-preview" } });
			root.dataset.state = "preview";
			output.textContent = formatValue(proposed);
			render(drag.preview);
		} catch (error) { root.dataset.state = "rejected"; output.textContent = String(error?.message ?? error); }
	}

	function onPointerUp(event) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const session = drag; drag = null;
		releaseCapture(session);
		store.actions?.clearPreviewItem?.();
		commitPromise = commitSession(session);
	}

	async function commitSession(session) {
		try {
			let result = { changed: false };
			if (session.preview && session.proposedCurvature !== session.originalCurvature) {
				result = await editor.updateArcOnActiveAlignment({ elementId: session.elementId, curvature: session.proposedCurvature });
			}
			if (result?.changed) {
				const verifiedChange = await readVerifiedCanonicalChange({
					result,
					session,
				});
				await dispatchProductiveAlignmentChange({
					...verifiedChange,
					elementId: session.elementId,
					source: "curvature-band",
				});
				await loadAndRender(verifiedChange);
				window.dispatchEvent(
					new CustomEvent(
						"ufaim:alignment-editor-focus-element",
						{
							detail: {
								elementId: session.elementId,
								objectId: verifiedChange.objectId,
								source: "curvature-band",
								verifiedChange,
							},
						}
					)
				);
				root.dataset.state = "committed";
				output.textContent = formatValue(session.proposedCurvature);
			} else {
				root.dataset.state = session.preview ? "rejected" : "selected";
				output.textContent = session.preview
					? String(result?.reason ?? "Edit rejected")
					: formatValue(session.originalCurvature);
				await loadAndRender();
			}
			lastCommit = {
				changed: Boolean(result?.changed),
				state: root.dataset.state,
				elementId: session.elementId,
				curvature: session.proposedCurvature,
				error: result?.changed ? null : (result?.reason ?? null),
			};
			return lastCommit;
		} catch (error) {
			root.dataset.state = "rejected";
			output.textContent = String(error?.message ?? error);
			lastCommit = { changed: false, state: "rejected", elementId: session.elementId, curvature: session.proposedCurvature, error: String(error?.message ?? error) };
			await loadAndRender();
			return lastCommit;
		}
	}

	async function readVerifiedCanonicalChange({ result, session }) {
		const objectId = String(result?.alignmentChange?.objectId ?? snapshot?.id ?? "").trim();
		const expectedRevision = result?.alignmentChange?.revision ?? null;
		const raw = await messaging.sendCmdAwait("Spot.GetState", {});
		const state = unwrap(raw);
		const spotObject = getSpotObjectById(state, objectId);
		const alignmentData = spotObject?.data?.alignmentData ?? null;
		const element = alignmentData?.editModel?.elements?.find(
			(entry) => String(entry?.id ?? "") === String(session.elementId)
		);
		const curvature = Number(element?.parameters?.curvature ?? element?.curvature);
		const revision = alignmentData?.meta?.modifiedAt ?? spotObject?.meta?.modifiedAt ?? null;
		const previousRevision = session.originalData?.meta?.modifiedAt ?? null;
		const mismatch =
			!spotObject ? "missing-object"
				: spotObject.type !== "alignment" ? "wrong-type"
					: String(spotObject.id ?? "") !== objectId || String(alignmentData?.id ?? "") !== objectId ? "wrong-id"
						: !Number.isFinite(curvature) || curvature !== Number(session.proposedCurvature) ? "stale-curvature"
							: revision == null || String(revision) !== String(expectedRevision ?? "") ? "stale-revision"
								: String(revision) === String(previousRevision ?? "") ? "unchanged-revision"
									: null;
		if (mismatch) throw new Error(`Curvature band: persisted Alignment acknowledgement mismatch (${mismatch})`);
		return {
			...(result.alignmentChange ?? {}),
			objectId,
			spotObject,
			alignmentData,
			sparseAlignment: alignmentData.sparseAlignment ?? null,
			kernel: spotObject?.data?.kernel ?? alignmentData.sparseAlignment ?? null,
			revision,
		};
	}

	function onKeyDown(event) {
		if (event.key !== "Escape" || !drag) return;
		cancelDrag("Cancelled", drag.pointerId);
	}

	function onPointerCancel(event) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		cancelDrag("Pointer cancelled", event.pointerId);
	}

	function onLostPointerCapture(event) {
		if (!drag || !drag.captured || event.pointerId !== drag.pointerId) return;
		cancelDrag("Pointer capture lost", event.pointerId, { release: false });
	}

	function cancelDrag(message, pointerId, { release = true } = {}) {
		if (!drag || pointerId !== drag.pointerId) return false;
		const session = drag; drag = null;
		if (release) releaseCapture(session);
		store.actions?.clearPreviewItem?.();
		root.dataset.state = "selected";
		output.textContent = message;
		render();
		return true;
	}

	function releaseCapture(session) {
		if (!session?.captured || typeof session.captureTarget?.releasePointerCapture !== "function") return;
		try {
			if (typeof session.captureTarget.hasPointerCapture !== "function" || session.captureTarget.hasPointerCapture(session.pointerId)) {
				session.captureTarget.releasePointerCapture(session.pointerId);
			}
		} catch (error) {
			if (error?.name !== "NotFoundError") throw error;
		}
	}

	function onPointerOver(event) {
		const segment = event.target.closest?.(".band-hit.is-arc");
		if (!segment || drag) return;
		output.textContent = `Arc ${segment.dataset.elementId} · drag vertically`;
		root.dataset.state = "hovered";
	}

	function onPointerOut(event) {
		if (drag || !event.target.closest?.(".band-hit.is-arc")) return;
		output.textContent = "";
		root.dataset.state = "neutral";
	}

	return {
		start,
		refresh: loadAndRender,
		render,
		setPresentation,
		setDock,
		cancel: () => onKeyDown({ key: "Escape" }),
		whenCommitSettled: () => commitPromise,
		getDebugState: () => ({
			activeObjectId: snapshot?.id ?? null,
			dragging: Boolean(drag),
			pointerId: drag?.pointerId ?? null,
			captured: Boolean(drag?.captured),
			elementId: drag?.elementId ?? getWorkspaceSelectedElementId(store.getState?.() ?? {}),
			curvature: drag?.proposedCurvature ?? null,
			state: root?.dataset?.state ?? "neutral",
			presentation: { ...presentation },
			lastCommit,
		}),
		destroy: () => {
			unsubscribe?.();
			window.removeEventListener("ufaim:alignment-changed", onAlignmentChanged);
		},
	};
}

function unwrap(raw) { return raw?.state ?? raw?.payload ?? raw ?? null; }
function node(tag, attrs = {}) { const el = document.createElementNS(NS, tag); for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, String(v)); return el; }
function line(parent, x1,y1,x2,y2,cls) { parent.appendChild(node("line", { x1,y1,x2,y2,class:cls })); }
function text(parent, x,y,value,cls) { const el = node("text", { x,y,class:cls }); el.textContent = value; parent.appendChild(el); }
function formatValue(k) { const radius = 1 / k; return `κ ${k.toFixed(6)} m⁻¹ · R ${radius.toFixed(1)} m`; }
