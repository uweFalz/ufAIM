// src/domain/optimization/alignment/CurvatureJunction.js
//
// The junction of two elements, in curvature. The kernel reads a
// transition's end curvatures off its neighbours (AlignmentPoseJacobian);
// a file that states them itself - a TRA's R1 and R2 - is read by two
// adapters, the solver's reader (src/import/parsers/technet/vermEsn/
// traAlignment.js) and the app's import (src/import/build/
// buildSparseFromLandFAT.js), and both have to answer the same two
// questions the same way: when are the curvature the file states and the
// curvature the neighbour has the same one, so that no holder of zero
// length is needed between them; and when is a curvature a straight's.
// This module is that one answer, so the two readings cannot drift apart.
//
// Curvature is 1/m. Two radii of 1000 m and 1000.001 m differ by 1e-9 in
// curvature: that is the bound, as the reader has used it since October;
// a difference of 1e-12 is a straight to any purpose here.

export const CURVATURE_JUNCTION_VERSION = "axtran2/curvature-junction/0.1";

/** two curvatures at a junction closer than this are the same curvature (1/m) */
export const JUNCTION_CURVATURE_TOLERANCE = 1e-9;

/** a curvature smaller than this is a straight's (1/m) */
export const STRAIGHT_CURVATURE_TOLERANCE = 1e-12;

/**
 * Whether two curvatures meeting at a junction are the same one, so that
 * nothing has to carry a step between them.
 * @param {number} a
 * @param {number} b
 * @returns {boolean}  false where either is not a number
 */
export function sameJunctionCurvature(a, b) {
	return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= JUNCTION_CURVATURE_TOLERANCE;
}

/**
 * Whether a curvature is a straight's.
 * @param {number} curvature
 * @returns {boolean}  true for 0 and anything below the bound; false where it is not a number
 */
export function isStraightCurvature(curvature) {
	return Number.isFinite(curvature) && Math.abs(curvature) <= STRAIGHT_CURVATURE_TOLERANCE;
}
