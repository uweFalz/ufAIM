// src/aim-core/geometry/Alignment2D.js

import { normalize, dot, sub, rot90 } from "./vec2.js";

export class Alignment2D {

	constructor(elements = [], pose0 = { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }) {
		this.elements = elements;
		this.pose0 = {
			p: { ...pose0.p },
			t: normalize(pose0.t)
		};

		this._buildIndex();
	}

	// ------------------------------------------------------------
	// precompute segment offsets
	// ------------------------------------------------------------

	_buildIndex() {
		this._offsets = [];
		let acc = 0;

		for (const el of this.elements) {
			this._offsets.push(acc);
			acc += el.arcLength;
		}

		this._arcLength = acc;
	}

	get arcLength() {
		return this._arcLength;
	}

	// ------------------------------------------------------------
	// helper: find segment
	// ------------------------------------------------------------

	_findSegment(s) {
		const ss = Math.max(0, Math.min(this._arcLength, s));

		for (let i = this.elements.length - 1; i >= 0; i--) {
			if (ss >= this._offsets[i]) {
				return {
					index: i,
					localS: ss - this._offsets[i]
				};
			}
		}

		return { index: 0, localS: ss };
	}

	// ------------------------------------------------------------
	// curvature
	// ------------------------------------------------------------

	curvatureAt(s) {
		if (this.elements.length === 0) return 0;

		const { index, localS } = this._findSegment(s);
		return this.elements[index].curvatureAt(localS);
	}

	// ------------------------------------------------------------
	// pose
	// ------------------------------------------------------------

	poseAt(s, opts = {}) {
		if (this.elements.length === 0) return this.pose0;

		const ss = Math.max(0, Math.min(this._arcLength, s));

		let pose = this.pose0;

		for (let i = 0; i < this.elements.length; i++) {
			const el = this.elements[i];
			const start = this._offsets[i];
			const end = start + el.arcLength;

			if (ss <= end) {
				// inside this element
				return el.poseAt(ss - start, pose, opts);
			}

			// advance fully through element
			pose = el.poseE(pose, opts);
		}

		return pose;
	}

	// ------------------------------------------------------------
	// convenience
	// ------------------------------------------------------------

	pointAt(s, opts = {}) {
		return this.poseAt(s, opts).p;
	}

	tangentAt(s, opts = {}) {
		return this.poseAt(s, opts).t;
	}

	// ------------------------------------------------------------
	// transforms (minimal v1)
	// ------------------------------------------------------------

	reverse() {
		const reversed = this.elements
		.slice()
		.reverse()
		.map(el => el.reverse());

		const poseEnd = this.poseAt(this.arcLength);

		return new Alignment2D(
		reversed,
		{
			p: poseEnd.p,
			t: { x: -poseEnd.t.x, y: -poseEnd.t.y }
		}
		);
	}

	parallel(offset) {
		const shifted = this.elements.map(el => el.parallel(offset));
		return new Alignment2D(shifted, this.pose0);
	}

	// ------------------------------------------------------------
	// world → track (v1: robust, sampling + refinement)
	// ------------------------------------------------------------

	/**
	 * Nearest point on the alignment to (x, y).
	 *
	 * The foot station is clamped to [0, arcLength], so a point beyond an end
	 * does not fail: it comes back with the offset measured from the END TANGENT,
	 * extended. That is a defensible answer to "nearest point on the alignment"
	 * and a misleading one to "how far is this point from the track" - `q` is
	 * then an offset from a line the alignment does not occupy.
	 *
	 * Nothing in the default result says which of the two happened. Passing
	 * `reportFoot: true` adds the two facts that do:
	 *
	 *   u        the longitudinal residual at the reported station, in metres.
	 *            Zero at a true perpendicular foot point; at a clamped end it is
	 *            the distance past that end.
	 *   clamped  whether the reported station sits on an end at all.
	 *
	 * Together they answer it exactly: `clamped && |u| > tolerance` is an
	 * extrapolation, and the caller chooses the tolerance rather than finding one
	 * buried here.
	 *
	 * The default shape is unchanged on purpose. It is pinned by the geometry
	 * compatibility suite and this is a released Core surface; making these
	 * fields unconditional is a contract change and belongs to whoever owns that
	 * contract, not to a caller who needs the information.
	 *
	 * @param {number} x
	 * @param {number} y
	 * @param {{samples?:number, refineSteps?:number, reportFoot?:boolean}} [opts]
	 */
	world2Track(x, y, opts = {}) {
		if (this.elements.length === 0) return null;

		const X = { x: Number(x), y: Number(y) };
		if (!Number.isFinite(X.x) || !Number.isFinite(X.y)) return null;

		const samples = Math.max(8, Number(opts.samples) || 64);
		const refineSteps = Math.max(4, Number(opts.refineSteps) || 12);

		let best = null;

		const evalAt = (s) => {
			const pose = this.poseAt(s, { quality: "balanced" });

			const t = normalize(pose.t);
			const n = rot90(t);

			const d = sub(X, pose.p);

			const u = dot(d, t); // longitudinal
			const q = dot(d, n); // lateral
			const dist = Math.hypot(d.x, d.y);

			return {
				s,
				u,
				q,
				dist,
				point: pose.p,
				tangent: t,
			};
		};

		// --------------------------------------------------------
		// 1) coarse scan
		// --------------------------------------------------------

		for (let i = 0; i <= samples; i++) {
			const s = this._arcLength * (i / samples);
			const cand = evalAt(s);

			if (!best || cand.dist < best.dist) {
				best = cand;
			}
		}

		// --------------------------------------------------------
		// 2) local refinement interval
		// --------------------------------------------------------

		let left = Math.max(0, best.s - this._arcLength / samples);
		let right = Math.min(this._arcLength, best.s + this._arcLength / samples);

		// --------------------------------------------------------
		// 3) ternary refinement (distance minimization)
		// --------------------------------------------------------

		for (let i = 0; i < refineSteps; i++) {
			const s1 = left + (right - left) / 3;
			const s2 = right - (right - left) / 3;

			const c1 = evalAt(s1);
			const c2 = evalAt(s2);

			if (c1.dist <= c2.dist) {
				right = s2;
				if (c1.dist < best.dist) best = c1;
			} else {
				left = s1;
				if (c2.dist < best.dist) best = c2;
			}
		}

		// --------------------------------------------------------
		// 4) final midpoint
		// --------------------------------------------------------

		const mid = (left + right) * 0.5;
		const final = evalAt(mid);

		if (final.dist < best.dist) best = final;

		// --------------------------------------------------------
		// 5) one-step tangential correction
		// --------------------------------------------------------

		let sCorr = best.s + best.u;
		sCorr = Math.max(0, Math.min(this._arcLength, sCorr));

		const corrected = evalAt(sCorr);

		if (corrected.dist <= best.dist + 1e-9) {
			best = corrected;
		}

		// --------------------------------------------------------
		// 6) segment info
		// --------------------------------------------------------

		const seg = this._findSegment(best.s);

		const result = {
			s: best.s,
			q: best.q,
			dist: best.dist,
			point: best.point,
			tangent: best.tangent,
			elementIndex: seg?.index ?? null,
		};

		if (opts.reportFoot === true) {
			result.u = best.u;
			result.clamped = best.s <= 0 || best.s >= this._arcLength;
		}

		return result;
	}
}
