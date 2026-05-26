// src/lib/math/optim/qp/solveEqualityQP.js
//
// Equality constrained QP:
//
//   min_d  1/2 d^T Q d + c^T d
//   s.t.   A d + b = 0
//
// KKT system:
//
//   [ Q  A^T ] [ d      ] = [ -c ]
//   [ A   0  ] [ lambda ]   [ -b ]

function finite(x) {
	return Number.isFinite(x);
}

function cloneMatrix(M) {
	return M.map((row) => row.slice());
}

function solveLinearSystem(Ain, bin) {
	const A = cloneMatrix(Ain);
	const b = bin.slice();
	const n = b.length;

	for (let k = 0; k < n; k++) {
		let pivot = k;
		let pivotAbs = Math.abs(A[k][k]);

		for (let i = k + 1; i < n; i++) {
			const v = Math.abs(A[i][k]);
			if (v > pivotAbs) {
				pivot = i;
				pivotAbs = v;
			}
		}

		if (pivotAbs < 1e-14) {
			return {
				ok: false,
				status: "singular",
				reason: `pivot too small at column ${k}`,
			};
		}

		if (pivot !== k) {
			[A[k], A[pivot]] = [A[pivot], A[k]];
			[b[k], b[pivot]] = [b[pivot], b[k]];
		}

		const akk = A[k][k];

		for (let i = k + 1; i < n; i++) {
			const factor = A[i][k] / akk;
			A[i][k] = 0;

			for (let j = k + 1; j < n; j++) {
				A[i][j] -= factor * A[k][j];
			}

			b[i] -= factor * b[k];
		}
	}

	const x = new Array(n).fill(0);

	for (let i = n - 1; i >= 0; i--) {
		let sum = b[i];

		for (let j = i + 1; j < n; j++) {
			sum -= A[i][j] * x[j];
		}

		x[i] = sum / A[i][i];

		if (!finite(x[i])) {
			return {
				ok: false,
				status: "nan",
				reason: `solution invalid at row ${i}`,
			};
		}
	}

	return { ok: true, x };
}

export function solveEqualityQP({ Q, c, A, b } = {}) {
	const n = Array.isArray(c) ? c.length : 0;
	const m = Array.isArray(b) ? b.length : 0;

	if (!n) return { ok: false, status: "invalid", reason: "missing c" };
	if (!Array.isArray(Q) || Q.length !== n) return { ok: false, status: "invalid", reason: "Q size mismatch" };
	if (!Array.isArray(A) || A.length !== m) return { ok: false, status: "invalid", reason: "A size mismatch" };

	const K = [];
	const rhs = [];

	for (let i = 0; i < n; i++) {
		const row = [];

		for (let j = 0; j < n; j++) row.push(Q[i][j]);
		for (let r = 0; r < m; r++) row.push(A[r][i]);

		K.push(row);
		rhs.push(-c[i]);
	}

	for (let r = 0; r < m; r++) {
		const row = [];

		for (let j = 0; j < n; j++) row.push(A[r][j]);
		for (let rr = 0; rr < m; rr++) row.push(0);

		K.push(row);
		rhs.push(-b[r]);
	}

	const solved = solveLinearSystem(K, rhs);

	if (!solved.ok) {
		return solved;
	}

	return {
		ok: true,
		status: "solved",
		d: solved.x.slice(0, n),
		lambda: solved.x.slice(n),
		kktSize: n + m,
	};
}
