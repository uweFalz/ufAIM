// src/lib/math/optim/diff/complexStepJacobian.js
//
// Jacobian by the complex step, exact to machine precision.
//
// Perturb one variable into the imaginary direction and read the derivative off
// the imaginary part of the result:
//
//     J[i][j] = Im f_i(x + i h e_j) / h
//
// There is no subtraction, so there is no cancellation, so h does not have to
// be balanced against anything. Where finiteDiffJacobian needs each variable's
// engineering magnitude to place its step between truncation and cancellation,
// this needs only a step small enough that h^2 vanishes in double precision.
//
// The cost is that f must be written in complex arithmetic. That is a real
// constraint, not a formality: every branch inside f must be taken on the real
// part, and every Math.abs must be the analytic continuation. See
// ../../complex/complex.js.
//
// Pure numerics: depends only on the complex arithmetic.

import { from } from "../../complex/complex.js";

export const COMPLEX_STEP_JACOBIAN_VERSION = "optim/diff/complexStepJacobian/0.1";

export class ComplexStepJacobianError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "ComplexStepJacobianError";
		this.code = code;
	}
}

/**
 * @param {(z: Array<{re:number,im:number}>) => Array<{re:number,im:number}>} f
 *        the function, in complex arithmetic
 * @param {number[]} x  the real point
 * @param {object} [options]
 * @param {number} [options.step]  the imaginary step. Anything from 1e-10 down
 *        to about 1e-150 gives the same answer; the default is the textbook
 *        1e-20. It is NOT scaled per variable, and deliberately so - that
 *        scaling is exactly the problem the complex step removes.
 * @returns {number[][]} rows per output, columns per variable
 */
export function complexStepJacobian(f, x, { step = 1e-20 } = {}) {
	if (typeof f !== "function") {
		throw new ComplexStepJacobianError("MISSING_FUNCTION", "f must be a function");
	}
	if (!Array.isArray(x) || x.length === 0) {
		throw new ComplexStepJacobianError("EMPTY_POINT", "x must be a non-empty array");
	}
	if (!(step > 0)) {
		throw new ComplexStepJacobianError("INVALID_STEP", "step must be positive");
	}

	const columns = [];
	for (let j = 0; j < x.length; j++) {
		const probe = x.map((value, i) => from(i === j ? { re: value, im: step } : value));
		const out = f(probe);
		if (!Array.isArray(out)) {
			throw new ComplexStepJacobianError("INVALID_RESULT", "f must return an array");
		}
		columns.push(out.map((value) => {
			// A real result where a derivative was expected is the usual symptom of
			// a Math.abs or a comparison that dropped the imaginary part. Saying so
			// here is cheaper than reading a column of zeros as "no dependence".
			if (typeof value?.im !== "number" || !Number.isFinite(value.im)) {
				throw new ComplexStepJacobianError(
					"NOT_COMPLEX",
					"f returned a value without a finite imaginary part; the step was lost inside f"
				);
			}
			return value.im / step;
		}));
	}

	const rows = columns[0].length;
	return Array.from({ length: rows }, (_, i) => columns.map((column) => column[i]));
}
