// src/modules/alignment/sparseAlignment.js
// SparseAlignment v0: alternating fix/trans elements, deterministic sampling.

export class SparseAlignment {
	constructor({ id = "alignment", startPose, elements, meta = {} } = {}) {
		this.id = id;
		this.meta = meta;

		// pose: x,y in local metric frame; theta in rad
		this.startPose = startPose ?? { x: 0, y: 0, theta: 0 };

		this.elements = Array.isArray(elements) ? elements : [];

		// precompute s ranges for fast eval
		this._ranges = buildRanges(this.elements);
		this.length = this._ranges.totalLength;

		// optional: validate in debug builds
		// validateAlternation(this.elements);
	}

	/**
	* Curvature κ(s) at arc length s (1/m). For v0: piecewise.
	*/
	evalKappa(s) {
		const hit = findElementAtS(this._ranges, s);
		if (!hit) return 0;

		const { elem, u } = hit;

		if (elem.kind === "fix") return elem.curvature ?? 0;

		if (elem.kind === "trans") {
			const family = elem.family;
			if (!family || typeof family.evalKappaU !== "function") return 0;
			// u in [0,1]
			return family.evalKappaU(u, elem.params ?? {});
		}

		return 0;
	}

	/**
	* Pose at arc length s. Numerical integration from start.
	* For v0: integrate with fixed step size; deterministic.
	*/
	evalPose(s, opts = {}) {
		const step = Number.isFinite(opts.step) ? opts.step : 2.0; // meters
		const clampedS = clamp(s, 0, this.length);

		// Integrate along elements deterministically
		let x = this.startPose.x;
		let y = this.startPose.y;
		let theta = this.startPose.theta;

		// walk element by element
		let remaining = clampedS;
		for (const elem of this.elements) {
			if (remaining <= 0) break;
			const segLen = Math.min(remaining, elem.arcLength);
			({ x, y, theta } = integrateElement(elem, segLen, { x, y, theta, step }));
			remaining -= segLen;
		}

		return { x, y, theta };
	}

	/**
	* Sample polyline of positions along s.
	*/
	sample(step = 5.0, opts = {}) {
		const st = Number.isFinite(step) && step > 0 ? step : 5.0;
		const pts = [];

		const n = Math.max(1, Math.ceil(this.length / st));
		for (let i = 0; i <= n; i++) {
			const s = (i / n) * this.length;
			const p = this.evalPose(s, { step: opts.integrateStep ?? Math.min(2.0, st) });
			pts.push({ x: p.x, y: p.y, s });
		}
		return pts;
	}
}

// ---------- element factories ----------

export function makeFixElem({ arcLength, curvature, meta = {} }) {
	return { kind: "fix", arcLength, curvature, meta };
}

export function makeTransElem({ arcLength, family, params = {}, meta = {} }) {
	return { kind: "trans", arcLength, family, params, meta };
}

// ---------- helpers ----------

function buildRanges(elements) {
	let s0 = 0;
	const ranges = elements.map((elem) => {
		const s1 = s0 + (elem.arcLength ?? 0);
		const out = { s0, s1, elem };
		s0 = s1;
		return out;
	});
	return { ranges, totalLength: s0 };
}

function findElementAtS(rangesObj, s) {
	const sClamped = clamp(s, 0, rangesObj.totalLength);
	const ranges = rangesObj.ranges;
	for (let i = 0; i < ranges.length; i++) {
		const r = ranges[i];
		if (sClamped >= r.s0 && sClamped <= r.s1) {
			const len = Math.max(1e-9, r.s1 - r.s0);
			const u = clamp((sClamped - r.s0) / len, 0, 1);
			return { elem: r.elem, u, s0: r.s0, s1: r.s1 };
		}
	}
	return null;
}

// RK2 / midpoint integration over an element for segLen
function integrateElement(elem, segLen, { x, y, theta, step }) {
	const L = segLen;
	const h = Math.max(1e-6, step);

	let traveled = 0;
	while (traveled < L - 1e-9) {
		const dt = Math.min(h, L - traveled);

		// curvature at start & midpoint of this small step
		const k0 = curvatureAtElem(elem, traveled / Math.max(1e-9, elem.arcLength));
		const km = curvatureAtElem(elem, (traveled + dt * 0.5) / Math.max(1e-9, elem.arcLength));

		// midpoint theta
		const thetaMid = theta + k0 * (dt * 0.5);

		// advance position using midpoint direction
		x += Math.cos(thetaMid) * dt;
		y += Math.sin(thetaMid) * dt;

		// advance theta using midpoint curvature
		theta += km * dt;

		traveled += dt;
	}

	return { x, y, theta };
}

function curvatureAtElem(elem, u) {
	if (elem.kind === "fix") return elem.curvature ?? 0;
	if (elem.kind === "trans") {
		const fam = elem.family;
		if (!fam || typeof fam.evalKappaU !== "function") return 0;
		return fam.evalKappaU(clamp(u, 0, 1), elem.params ?? {});
	}
	return 0;
}

function clamp(v, a, b) {
	return Math.min(b, Math.max(a, v));
}

// optional strict alternation validator (leave off in prod for now)
export function validateAlternation(elements) {
	if (!elements.length) return;

	if (elements[0]?.kind !== "fix") throw new Error("SparseAlignment must start with fix element");
	if (elements[elements.length - 1]?.kind !== "fix") throw new Error("SparseAlignment must end with fix element");

	for (let i = 1; i < elements.length; i++) {
		const prev = elements[i - 1]?.kind;
		const cur = elements[i]?.kind;
		if (prev === cur) throw new Error(`SparseAlignment must alternate fix/trans (idx ${i})`);
	}
}
