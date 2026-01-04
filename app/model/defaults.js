// app/model/defaults.js

export const DEFAULT_PROJECT = Object.freeze({
	schema: "ufaim.project.v0",
	meta: { createdAt: null, app: "ufAIM", note: "" },
	view: { u: 0.25, L: 120, R: 800, lead: 60, arcLen: 220 },
	transition: {
		family: "linear-clothoid",
		params: { w1: 0.0, w2: 1.0, m: 1.0 },
		plot: "k"
	}
});
