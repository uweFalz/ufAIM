// app/transition/families/linearClothoid.js

import { cubicHalfWave, mirrorHalfWave } from "../halfwaves/polynomial.js";

export const linearClothoidFamily = {
	id: "linear-clothoid",
	label: "Linear / Klothoid-like",

	defaults() {
		return {
			w1: 0.0,
			w2: 1.0,
			m: 1.0   // Steigung der Mitte (v0 = 1)
		};
	},

	kappa(u, p) {
		const { w1, w2, m } = p;
		if (u <= w1) {
			if (w1 === 0) return 0;
			const t = u / w1;
			const hw = cubicHalfWave(m);
			return w1 * hw.f(t);
		}
		if (u >= w2) {
			if (w2 === 1) return 1;
			const t = (u - w2) / (1 - w2);
			const hw = mirrorHalfWave(cubicHalfWave(m));
			return w2 + (1 - w2) * hw.f(t);
		}
		return m * u; // affine Mitte
	},

	dkappa(u, p) {
		const { w1, w2, m } = p;
		if (u <= w1) {
			if (w1 === 0) return m;
			const t = u / w1;
			const hw = cubicHalfWave(m);
			return hw.f1(t);
		}
		if (u >= w2) {
			if (w2 === 1) return m;
			const t = (u - w2) / (1 - w2);
			const hw = mirrorHalfWave(cubicHalfWave(m));
			return hw.f1(t);
		}
		return m;
	},

	d2kappa(u, p) {
		const { w1, w2, m } = p;
		if (u <= w1) {
			if (w1 === 0) return 0;
			const t = u / w1;
			const hw = cubicHalfWave(m);
			return hw.f2(t) / w1;
		}
		if (u >= w2) {
			if (w2 === 1) return 0;
			const t = (u - w2) / (1 - w2);
			const hw = mirrorHalfWave(cubicHalfWave(m));
			return hw.f2(t) / (1 - w2);
		}
		return 0;
	},

	constraints(p) {
		return {
			w1_max: p.w2,
			w2_min: p.w1,
			note: "C¹-glatt bei passender Steigung m"
		};
	}
};
