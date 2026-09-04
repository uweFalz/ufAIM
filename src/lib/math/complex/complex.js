// src/lib/math/complex/complex.js
//
// Minimal complex arithmetic, written for complex-step differentiation.
//
// The step works because f(x + ih) carries the derivative in its imaginary part
// with no subtraction anywhere:
//
//     f(x + ih) = f(x) + i h f'(x) - h^2 f''(x) / 2 + ...
//     f'(x) = Im f(x + ih) / h + O(h^2)
//
// so h may be taken far below the square root of machine epsilon and the
// truncation error disappears. A central difference cannot follow: it subtracts
// two nearly equal numbers, and its error is bounded below by that
// cancellation. That bound is why finiteDiffJacobian has to be told each
// variable's own magnitude, and why a length in metres and a curvature near
// 1e-3 1/m cannot share a step. The complex step has no such bound and needs no
// such care.
//
// Two rules are easy to get wrong and destroy the derivative silently:
//
//   - a comparison is taken on the real part. The imaginary part is an
//     infinitesimal, not a quantity to be ordered.
//   - abs() is the analytic continuation - negate when the real part is
//     negative - and never the modulus. The modulus is real and throws the
//     derivative away without saying so.
//
// Pure numerics: no dependencies.

export const COMPLEX_VERSION = "math/complex/0.1";

/** @typedef {{ re: number, im: number }} Complex */

/** @returns {Complex} */
export const complex = (re, im = 0) => ({ re, im });

export const from = (value) =>
	(typeof value === "number" ? { re: value, im: 0 } : value);

export const re = (z) => z.re;
export const im = (z) => z.im;

export const add = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
export const sub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
export const neg = (a) => ({ re: -a.re, im: -a.im });

/** by a real factor, which is most of the multiplications in a moment series */
export const scale = (a, t) => ({ re: a.re * t, im: a.im * t });

export const mul = (a, b) => ({
	re: a.re * b.re - a.im * b.im,
	im: a.re * b.im + a.im * b.re,
});

export const div = (a, b) => {
	const q = b.re * b.re + b.im * b.im;
	return {
		re: (a.re * b.re + a.im * b.im) / q,
		im: (a.im * b.re - a.re * b.im) / q,
	};
};

/** integer power by repeated multiplication; the exponents here are small */
export const pow = (a, n) => {
	let out = { re: 1, im: 0 };
	for (let i = 0; i < n; i++) out = mul(out, a);
	return out;
};

export const cos = (a) => ({
	re: Math.cos(a.re) * Math.cosh(a.im),
	im: -Math.sin(a.re) * Math.sinh(a.im),
});

export const sin = (a) => ({
	re: Math.sin(a.re) * Math.cosh(a.im),
	im: Math.cos(a.re) * Math.sinh(a.im),
});

/**
 * The analytic continuation of |x|, not the modulus. Used where real code
 * writes Math.abs(k) < eps to pick a series branch: the branch is decided on
 * the real part, and the value keeps its imaginary part.
 */
export const abs = (a) => (a.re < 0 ? neg(a) : { ...a });

/** every comparison in complex-step code is a comparison of real parts */
export const lt = (a, b) => a.re < b.re;
