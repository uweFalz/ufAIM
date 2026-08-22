import { buildPromotedGndWorkspaceEvidence } from "../../domain/workspace/buildPromotedGndWorkspaceEvidence.js";

export function createPromotedAlignmentWorkspaceJourneyController({
	cockpit,
	store,
	alignmentBimWorkspace,
	viewController,
	alignmentIntelligence = null,
} = {}) {
	if (
		typeof cockpit?.activateSpotObject !== "function" ||
		typeof store?.getState !== "function" ||
		typeof alignmentBimWorkspace?.activate !== "function" ||
		typeof viewController?.getDebugState !== "function"
	) {
		throw new TypeError("createPromotedAlignmentWorkspaceJourneyController: incomplete dependencies");
	}
	let hydratedObjectId = null;
	let hydrationObjectId = null;
	let hydrationPromise = null;

	async function rehydrateCanonicalAlignment(objectId, { refreshSurfaces = true } = {}) {
		const requestedId = String(objectId ?? "").trim();
		if (!requestedId) return { ok: false, code: "PROMOTED_ALIGNMENT_ID_MISSING" };
		if (hydrationPromise && hydrationObjectId === requestedId) return hydrationPromise;
		hydrationObjectId = requestedId;
		const run = (async () => {
			if (typeof cockpit.refreshSpotState !== "function") {
				hydratedObjectId = null;
				alignmentIntelligence?.setActiveContext?.({ objectId: requestedId, s: Number(store.getState()?.cursor?.s) });
				if (alignmentIntelligence) {
					alignmentIntelligence.setPromotedEvidence?.(null);
					return { ok: false, code: "PROMOTED_ALIGNMENT_CANONICAL_REFRESH_UNAVAILABLE" };
				}
				return { ok: true, objectId: requestedId, evidence: null };
			}
			const spot = await cockpit.refreshSpotState?.();
			const promotedObject = readSpotObjects(spot).find((entry) => String(entry?.id ?? "") === requestedId) ?? null;
			const activeId = String(store.getState()?.workspace_selection?.primaryId ?? "").trim();
			if (activeId !== requestedId || !promotedObject) {
				alignmentIntelligence?.setPromotedEvidence?.(null);
				hydratedObjectId = null;
				return { ok: false, code: "PROMOTED_ALIGNMENT_REFOCUS_MISMATCH" };
			}
			const evidence = buildPromotedGndWorkspaceEvidence(promotedObject);
			if (!evidence) {
				alignmentIntelligence?.setPromotedEvidence?.(null);
				alignmentIntelligence?.setActiveContext?.({ objectId: requestedId, s: Number(store.getState()?.cursor?.s) });
				if (refreshSurfaces) await cockpit.refreshAll?.();
				hydratedObjectId = requestedId;
				return { ok: true, objectId: requestedId, evidence: null };
			}
			alignmentIntelligence?.setPromotedEvidence?.(evidence);
			alignmentIntelligence?.setActiveContext?.({ objectId: requestedId, s: Number(store.getState()?.cursor?.s) });
			if (refreshSurfaces) await cockpit.refreshAll?.();
			hydratedObjectId = requestedId;
			return { ok: true, objectId: requestedId, evidence };
		})();
		hydrationPromise = run;
		try {
			return await run;
		} finally {
			if (hydrationPromise === run) {
				hydrationPromise = null;
				hydrationObjectId = null;
			}
		}
	}

	async function activateCanonicalAlignment(objectId) {
		const requestedId = String(objectId ?? "").trim();
		if (!requestedId) return { ok: false, code: "PROMOTED_ALIGNMENT_ID_MISSING" };

		const activated = await cockpit.activateSpotObject(requestedId);
		if (activated !== true) return { ok: false, code: "PROMOTED_ALIGNMENT_NOT_ACTIVATED" };

		const state = store.getState();
		const activeId = String(state?.workspace_selection?.primaryId ?? "").trim();
		const s = Number(state?.cursor?.s);
		if (activeId !== requestedId) return { ok: false, code: "PROMOTED_ALIGNMENT_IDENTITY_MISMATCH" };
		if (!Number.isFinite(s)) return { ok: false, code: "PROMOTED_ALIGNMENT_CURSOR_INVALID" };
		if (alignmentBimWorkspace.activate("main") !== true) {
			return { ok: false, code: "PROMOTED_ALIGNMENT_MAIN_UNAVAILABLE" };
		}
		const hydrated = await rehydrateCanonicalAlignment(requestedId);
		if (hydrated.ok !== true) return hydrated;

		return {
			ok: true,
			objectId: requestedId,
			s,
			projection: viewController.getDebugState(),
			...(hydrated.evidence ? { evidence: hydrated.evidence } : {}),
		};
	}

	store.subscribe?.(() => {
		const activeId = String(store.getState()?.workspace_selection?.primaryId ?? "").trim();
		if (!activeId) {
			hydratedObjectId = null;
			alignmentIntelligence?.setPromotedEvidence?.(null);
			return;
		}
		if (activeId !== hydratedObjectId) {
			if (hydratedObjectId && activeId !== hydratedObjectId) alignmentIntelligence?.setPromotedEvidence?.(null);
			void rehydrateCanonicalAlignment(activeId);
		}
	});
	const initialId = String(store.getState()?.workspace_selection?.primaryId ?? "").trim();
	if (initialId) void rehydrateCanonicalAlignment(initialId);

	return { activateCanonicalAlignment, rehydrateCanonicalAlignment };
}

function readSpotObjects(response) {
	const state = response?.state ?? response?.payload ?? response ?? {};
	return Array.isArray(state?.objects) ? state.objects : Object.values(state?.objects ?? {});
}

export default createPromotedAlignmentWorkspaceJourneyController;
