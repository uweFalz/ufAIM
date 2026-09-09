import assert from "node:assert/strict";
import test from "node:test";

const { symmetricEigen } = await import("../../src/lib/math/lina/symmetricEigen.js");

test("Jacobi rotations reproduce known eigenpairs, descending, with unit eigenvectors", () => {
	// diag(3, 1) rotated by 30 degrees: eigenvalues 3 and 1
	const c = Math.cos(Math.PI / 6);
	const s = Math.sin(Math.PI / 6);
	const A = [[3 * c * c + 1 * s * s, (3 - 1) * c * s], [(3 - 1) * c * s, 3 * s * s + 1 * c * c]];
	const { values, vectors, converged } = symmetricEigen(A);
	assert.ok(converged);
	assert.ok(Math.abs(values[0] - 3) < 1e-12 && Math.abs(values[1] - 1) < 1e-12, `${values}`);
	assert.ok(Math.abs(Math.abs(vectors[0][0]) - c) < 1e-12 && Math.abs(Math.abs(vectors[0][1]) - s) < 1e-12);
	for (const v of vectors) assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-12);
	// A v = λ v
	vectors.forEach((v, k) => {
		const Av = A.map((row) => row.reduce((sum, a, j) => sum + a * v[j], 0));
		Av.forEach((value, i) => assert.ok(Math.abs(value - values[k] * v[i]) < 1e-12));
	});
});

test("a rank-deficient matrix reports its null space as zero eigenvalues", () => {
	// J'J for J = [[1, 1, 0], [0, 0, 0]] has rank one
	const A = [[1, 1, 0], [1, 1, 0], [0, 0, 0]];
	const { values, vectors } = symmetricEigen(A);
	assert.ok(Math.abs(values[0] - 2) < 1e-12);
	assert.ok(Math.abs(values[1]) < 1e-12 && Math.abs(values[2]) < 1e-12, `${values}`);
	// every null vector is orthogonal to (1, 1, 0)
	for (const v of vectors.slice(1)) assert.ok(Math.abs(v[0] + v[1]) < 1e-10, `${v}`);
});
