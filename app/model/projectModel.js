// app/model/projectModel.js
// Minimal persistent project container (v0)

import { DEFAULT_PROJECT } from "./defaults.js";

export function createProjectModel(initialData) {
	let data = structuredClone(initialData);

	return {
		get() {
			return data;
		},
		set(nextData) {
			data = structuredClone(nextData);
		}
	};
}

// app/model/projectModel.js
export function makeProjectModel({
	meta = {},
	view = {},
	alignment = {},
	transition = {}
} = {}) {
	return {
		schema: "ufAIM.project.v0",
		meta: {
			app: "ufAIM",
			createdAt: new Date().toISOString(),
			...meta
		},
		view: {
			// viewer-centric state (s, camera later, etc.)
			...view
		},
		alignment: {
			// “world” embedding / alignment data (minimal for now)
			kind: alignment.kind ?? "demo-embedded-transition",
			params: alignment.params ?? {},
			...alignment
		},
		transition: {
			family: transition.family ?? "linear-clothoid",
			params: transition.params ?? { w1: 0, w2: 1, m: 1.0 },
			plot: transition.plot ?? "k",
			...transition
		}
	};
}

