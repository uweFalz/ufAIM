// app/core/workspaceState.js

import { makeInitialState, ensureStateShape } from "./storeShape.js";
import { mirrorQuickHooksFromActive } from "../io/importApply.js";

export function createWorkspaceState(initial) {
	let state = ensureStateShape(initial ?? makeInitialState());
	const listeners = new Set();

	function getState() { return state; }

	function setState(patch) {
		const nextPatch = typeof patch === "function" ? patch(state) : patch;
		state = ensureStateShape({ ...state, ...(nextPatch ?? {}) });
		for (const fn of listeners) fn(state);
	}

	function subscribe(fn) {
		listeners.add(fn);
		return () => listeners.delete(fn);
	}

	const actions = {
		setActiveRouteProject(id) {
			setState({ activeRouteProjectId: id ?? null });
			mirrorQuickHooksFromActive({ getState, setState });
		},

		// G: NEW
		setActiveSlot(slot) {
			const v = String(slot ?? "right");
			const safe = (v === "left" || v === "km" || v === "right") ? v : "right";
			setState({ activeSlot: safe });
			mirrorQuickHooksFromActive({ getState, setState });
		},

		// MS14.1: view pins live in state (UX + future data-console)
		pinRouteProject({ rpId, slot = "right" } = {}) {
			const id = String(rpId ?? "");
			if (!id) return;
			const s = (slot === "left" || slot === "km" || slot === "right") ? slot : "right";
			setState((st) => {
				const pins = Array.isArray(st.view_pins) ? st.view_pins.slice() : [];
				const key = `${id}::${s}`;
				if (pins.some((p) => `${p?.rpId ?? ""}::${p?.slot ?? ""}` === key)) return st;
				pins.push({ rpId: id, slot: s, at: Date.now() });
				return { ...st, view_pins: pins };
			});
		},

		unpinRouteProject({ rpId, slot = "right" } = {}) {
			const id = String(rpId ?? "");
			if (!id) return;
			const s = (slot === "left" || slot === "km" || slot === "right") ? slot : "right";
			setState((st) => {
				const pins = Array.isArray(st.view_pins) ? st.view_pins : [];
				const next = pins.filter((p) => !(p?.rpId === id && (p?.slot ?? "right") === s));
				return { ...st, view_pins: next };
			});
		},
		
		togglePinFromActive() {
			const rpId = state.activeRouteProjectId;
			if (!rpId) return;
			const slot = state.activeSlot ?? "right";
			actions.togglePinRouteProject({ rpId, slot });
		},

		togglePinRouteProject({ rpId, slot = "right" } = {}) {
			const id = String(rpId ?? "");
			if (!id) return;
			const s = (slot === "left" || slot === "km" || slot === "right") ? slot : "right";
			const key = `${id}::${s}`;
			const pins = Array.isArray(state.view_pins) ? state.view_pins : [];
			const has = pins.some((p) => `${p?.rpId ?? ""}::${p?.slot ?? ""}` === key);
			if (has) actions.unpinRouteProject({ rpId: id, slot: s });
			else actions.pinRouteProject({ rpId: id, slot: s });
		},

		// MS14.1: allow simple delete for cleanup during tests
		deleteRouteProject(rpId) {
			const id = String(rpId ?? "");
			if (!id) return;
			setState((st) => {
				const rps = { ...(st.routeProjects ?? {}) };
				if (!rps[id]) return st;
				delete rps[id];

				// remove artifacts of this RP
				const arts0 = st.artifacts ?? {};
				const arts = {};
				for (const [aid, a] of Object.entries(arts0)) {
					if (a?.baseId === id) continue;
					arts[aid] = a;
				}

				// drop pins pointing to deleted RP
				const pins0 = Array.isArray(st.view_pins) ? st.view_pins : [];
				const pins = pins0.filter((p) => p?.rpId !== id);

				// choose next active
				let active = st.activeRouteProjectId;
				if (active === id) {
					const ids = Object.keys(rps).sort((a, b) => a.localeCompare(b));
					active = ids[0] ?? null;
				}

				return {
					...st,
					routeProjects: rps,
					artifacts: arts,
					view_pins: pins,
					activeRouteProjectId: active,
				};
			});
			mirrorQuickHooksFromActive({ getState, setState });
		},

		setCursor(patch) {
			setState({ cursor: { ...state.cursor, ...(patch ?? {}) } });
		},

		// MS13.7+: cursor helpers used by UI wiring
		setCursorS(value) {
			const n = Number(value);
			if (!Number.isFinite(n)) return;
			// keep it simple: s is non-negative meters
			const s = Math.max(0, n);
			setState({ cursor: { ...state.cursor, s } });
		},

		nudgeCursorS(delta) {
			const d = Number(delta);
			if (!Number.isFinite(d)) return;
			const s0 = Number(state.cursor?.s ?? 0);
			const s1 = Math.max(0, (Number.isFinite(s0) ? s0 : 0) + d);
			setState({ cursor: { ...state.cursor, s: s1 } });
		},

		setPick(pick) {
			setState({ cursor: { ...state.cursor, pick } });
		},
	};

	return { getState, setState, subscribe, actions };
}
