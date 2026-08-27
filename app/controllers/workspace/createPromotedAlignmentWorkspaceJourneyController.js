import { buildPromotedGndWorkspaceEvidence } from "../../domain/workspace/buildPromotedGndWorkspaceEvidence.js";

export function createPromotedAlignmentWorkspaceJourneyController({
	cockpit,
	store,
	alignmentBimWorkspace,
	viewController,
	profileSource = null,
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
	const sameValue = (left, right) => {
		if (Object.is(left, right)) return true;
		if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => sameValue(entry, right[index]));
		if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
		const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
		return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && sameValue(left[key], right[key]));
	};
	const canonicalRevision = (object) => {
		const alignmentData = object?.data?.alignmentData;
		return alignmentData && Object.prototype.hasOwnProperty.call(alignmentData, "revision") ? alignmentData.revision : undefined;
	};
	const canonicalProfileState = (object) => {
		const alignmentData = object?.data?.alignmentData;
		if (!alignmentData || typeof alignmentData !== "object" || Array.isArray(alignmentData)) return null;
		if (!Object.prototype.hasOwnProperty.call(alignmentData, "profileState")) {
			return { presence: "absent", vertical: null, cant: null, chainageMappings: [] };
		}
		const profileState = alignmentData.profileState;
		if (!profileState || typeof profileState !== "object" || Array.isArray(profileState) ||
			!Object.prototype.hasOwnProperty.call(profileState, "vertical") ||
			!Object.prototype.hasOwnProperty.call(profileState, "cant") ||
			!Array.isArray(profileState.chainageMappings)) return null;
		return { presence: "present", vertical: profileState.vertical, cant: profileState.cant, chainageMappings: profileState.chainageMappings };
	};

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
				return { ok: true, objectId: requestedId, evidence: null, revision: undefined };
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
				return { ok: true, objectId: requestedId, evidence: null, revision: canonicalRevision(promotedObject), profileState: canonicalProfileState(promotedObject) };
			}
			alignmentIntelligence?.setPromotedEvidence?.(evidence);
			alignmentIntelligence?.setActiveContext?.({ objectId: requestedId, s: Number(store.getState()?.cursor?.s) });
			if (refreshSurfaces) await cockpit.refreshAll?.();
			hydratedObjectId = requestedId;
			return { ok: true, objectId: requestedId, evidence, revision: canonicalRevision(promotedObject), profileState: canonicalProfileState(promotedObject) };
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
		if (hydrated.revision === undefined || hydrated.revision === null) return { ok: false, code: "PROMOTED_ALIGNMENT_CANONICAL_REVISION_UNAVAILABLE" };
		if (hydrated.profileState === null) return { ok: false, code: "PROMOTED_ALIGNMENT_PROFILE_STATE_READBACK_MISMATCH" };
		if (typeof profileSource?.refresh !== "function") return { ok: false, code: "PROMOTED_ALIGNMENT_PROFILE_REFRESH_UNAVAILABLE" };
		if (typeof viewController?.refreshHorizontalProjection !== "function") return { ok: false, code: "PROMOTED_ALIGNMENT_HORIZONTAL_REFRESH_UNAVAILABLE" };
		let profileProjection;
		try { profileProjection = await profileSource.refresh(); }
		catch { return { ok: false, code: "PROMOTED_ALIGNMENT_PROFILE_REFRESH_FAILED" }; }
		let horizontalProjection;
		try { horizontalProjection = await viewController.refreshHorizontalProjection(); }
		catch { return { ok: false, code: "PROMOTED_ALIGNMENT_HORIZONTAL_REFRESH_FAILED" }; }
		const after = store.getState();
		const afterId = String(after?.workspace_selection?.primaryId ?? "").trim();
		const afterS = Number(after?.cursor?.s);
		if (afterId !== requestedId || !Object.is(afterS, s)) return { ok: false, code: "PROMOTED_ALIGNMENT_ACTIVE_CONTEXT_CHANGED" };
		const hasLanes = ["vertical", "cant", "chainage"].every((key) => Object.prototype.hasOwnProperty.call(profileProjection ?? {}, key));
		if (profileProjection?.status !== "projected" || profileProjection.alignmentId !== requestedId || !sameValue(profileProjection.revision, hydrated.revision) || profileProjection?.cursor?.parameterKind !== "intrinsic-s" || !Object.is(profileProjection.cursor.s, s) || !hasLanes) {
			return { ok: false, code: "PROMOTED_ALIGNMENT_PROFILE_READBACK_MISMATCH" };
		}
		if (profileProjection.state?.presence !== hydrated.profileState.presence ||
			!sameValue(profileProjection.state?.vertical, hydrated.profileState.vertical) ||
			!sameValue(profileProjection.state?.cant, hydrated.profileState.cant) ||
			!sameValue(profileProjection.state?.chainageMappings, hydrated.profileState.chainageMappings)) {
			return { ok: false, code: "PROMOTED_ALIGNMENT_PROFILE_STATE_READBACK_MISMATCH" };
		}
		if (horizontalProjection?.status !== "rendered" || horizontalProjection.objectId !== requestedId || !sameValue(horizontalProjection.revision, hydrated.revision) || horizontalProjection?.cursor?.parameterKind !== "intrinsic-s" || !Object.is(horizontalProjection.cursor.s, s) || horizontalProjection.mode !== "active" || !horizontalProjection.projectionSignature) {
			return { ok: false, code: "PROMOTED_ALIGNMENT_HORIZONTAL_READBACK_MISMATCH" };
		}

		return {
			ok: true,
			objectId: requestedId,
			s,
			projection: viewController.getDebugState(),
			profileProjection,
			horizontalProjection,
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
