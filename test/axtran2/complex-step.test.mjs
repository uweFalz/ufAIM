import assert from "node:assert/strict";
import test from "node:test";

const LIB = new URL("../../src/lib/math/", import.meta.url);
const DOM = new URL("../../src/domain/optimization/alignment/", import.meta.url);

const C = await import(new URL("complex/complex.js", LIB));
const { complexStepJacobian, ComplexStepJacobianError } =
	await import(new URL("optim/diff/complexStepJacobian.js", LIB));
const { finiteDiffJacobian } = await import(new URL("optim/diff/finiteDiffJacobian.js", LIB));
const { createTransitionMoments, curvatureIntegralFrom } =
	await import(new URL("TransitionMoments.js", DOM));
const { createAlignmentPoseJacobian } = await import(new URL("AlignmentPoseJacobian.js", DOM));

// ---------------------------------------------------------------- the tool

test("the complex step reproduces a derivative it cannot have guessed", () => {
	// f(x) = [x0^2 sin(x1), exp(x0) / x1]
	const f = ([a, b]) => [
		C.mul(C.mul(a, a), C.sin(b)),
		C.div(C.pow(a, 3), b),
	];
	const x = [1.3, 0.7];
	const J = complexStepJacobian(f, x);
	const [a, b] = x;
	assert.ok(Math.abs(J[0][0] - 2 * a * Math.sin(b)) < 1e-15);
	assert.ok(Math.abs(J[0][1] - a * a * Math.cos(b)) < 1e-15);
	assert.ok(Math.abs(J[1][0] - (3 * a * a) / b) < 1e-14);
	assert.ok(Math.abs(J[1][1] + (a ** 3) / (b * b)) < 1e-14);
});

test("a function that drops the imaginary part is reported, not silently zero", () => {
	// Math.abs instead of the analytic continuation is the classic way to lose it
	const broken = ([z]) => [{ re: Math.hypot(z.re, z.im), im: 0 }];
	const J = complexStepJacobian(broken, [2]);
	assert.deepEqual(J, [[0]]);          // a real result is a legal zero column
	const worse = ([z]) => [z.re];        // a bare number is not a complex value
	assert.throws(() => complexStepJacobian(worse, [2]), ComplexStepJacobianError);
});

// ------------------------------------------------- the alignment pose chain

// Bloss: kappaHat(u) = 3u^2 - 2u^3, so KHat(1) = 1/2.
const khat = curvatureIntegralFrom((u) => 3 * u * u - 2 * u * u * u);
const bloss = Object.freeze({
	...createTransitionMoments({ id: "bloss", curvatureIntegral: khat }),
	khat,
});
const momentsFor = () => bloss;

const TYPES = ["straight", "transition", "arc", "transition", "straight"];
const ARC = 2;
const START = { x: 0, y: 0, theta: 0 };
// [L0..L4, curvature of the arc]
const X = [180, 85, 260, 90, 200, 1 / 720];

const FACTORIAL = [1];
for (let i = 1; i <= 32; i++) FACTORIAL[i] = FACTORIAL[i - 1] * i;
const binomial = (n, k) => FACTORIAL[n] / (FACTORIAL[k] * FACTORIAL[n - k]);

/**
 * The pose chain again, in complex arithmetic. Deliberately a second reading of
 * the same mathematics rather than the production code made generic: making
 * AlignmentPoseJacobian generic over an arithmetic would put a function call
 * around every multiplication in the hot path. The quadrature is shared - the
 * real moment table M and the total turn come from createTransitionMoments -
 * so what is reimplemented here is the algebra, which is exactly what the
 * analytic derivatives are claims about.
 */
function endPoseComplex(vars) {
	const L = vars.slice(0, 5);
	const k = vars[5];
	const zero = C.complex(0);

	const curvature = (i) =>
		(TYPES[i] === "arc" ? k : TYPES[i] === "straight" ? zero : null);
	const ends = TYPES.map((type, i) => {
		if (type !== "transition") { const c = curvature(i); return { entry: c, exit: c }; }
		return {
			entry: i > 0 ? curvature(i - 1) ?? zero : zero,
			exit: i + 1 < TYPES.length ? curvature(i + 1) ?? zero : zero,
		};
	});

	const arcTransform = (length, kappa) => {
		const turn = C.mul(kappa, length);
		if (Math.abs(kappa.re) < 1e-12) {
			return {                                    // series limits; sin(t)/k is 0/0 here
				dx: C.mul(length, C.sub(C.complex(1), C.scale(C.mul(turn, turn), 1 / 6))),
				dy: C.scale(C.mul(length, turn), 0.5),
				dtheta: turn,
			};
		}
		return {
			dx: C.div(C.sin(turn), kappa),
			dy: C.div(C.sub(C.complex(1), C.cos(turn)), kappa),
			dtheta: turn,
		};
	};

	const transitionTransform = (length, entry, exit) => {
		const dk = C.sub(exit, entry);
		const a = C.mul(entry, length);
		const b = C.mul(dk, length);
		const M = bloss.moments;
		const rawMoment = (n) => {
			let sum = C.complex(0);
			for (let i = 0; i <= n; i++) {
				sum = C.add(sum, C.scale(
					C.mul(C.pow(a, i), C.pow(b, n - i)),
					binomial(n, i) * M[i][n - i]
				));
			}
			return sum;
		};
		let cosPart = C.complex(0);
		let sinPart = C.complex(0);
		for (let n = 0; n <= bloss.order; n++) {
			const term = C.scale(rawMoment(n), 1 / FACTORIAL[n]);
			if (n % 2 === 0) cosPart = C.add(cosPart, C.scale(term, (n / 2) % 2 ? -1 : 1));
			else sinPart = C.add(sinPart, C.scale(term, ((n - 1) / 2) % 2 ? -1 : 1));
		}
		return {
			dx: C.mul(length, cosPart),
			dy: C.mul(length, sinPart),
			dtheta: C.add(a, C.scale(b, bloss.totalTurn)),
		};
	};

	let pose = { x: C.complex(START.x), y: C.complex(START.y), theta: C.complex(START.theta) };
	for (let i = 0; i < TYPES.length; i++) {
		const local = TYPES[i] === "straight"
			? { dx: L[i], dy: zero, dtheta: zero }
			: TYPES[i] === "arc"
				? arcTransform(L[i], k)
				: transitionTransform(L[i], ends[i].entry, ends[i].exit);
		const cos = C.cos(pose.theta);
		const sin = C.sin(pose.theta);
		pose = {
			x: C.add(pose.x, C.sub(C.mul(cos, local.dx), C.mul(sin, local.dy))),
			y: C.add(pose.y, C.add(C.mul(sin, local.dx), C.mul(cos, local.dy))),
			theta: C.add(pose.theta, local.dtheta),
		};
	}
	return [pose.x, pose.y, pose.theta];
}

const elementsAt = (vars) => TYPES.map((type, i) => ({
	id: `E${i}`,
	type,
	length: vars[i],
	curvature: type === "arc" ? vars[5] : undefined,
	family: type === "transition" ? "bloss" : undefined,
}));

const PARAMETERS = [
	...TYPES.map((_, i) => ({ kind: "length", elementIndex: i })),
	{ kind: "curvature", elementIndex: ARC },
];

test("the complex pose chain agrees with the real one on the pose itself", () => {
	const analytic = createAlignmentPoseJacobian({ elements: elementsAt(X), startPose: START, momentsFor });
	const [x, y, theta] = endPoseComplex(X.map((v) => C.complex(v)));
	assert.ok(Math.abs(x.re - analytic.endPose.x) < 1e-9, `x ${x.re} vs ${analytic.endPose.x}`);
	assert.ok(Math.abs(y.re - analytic.endPose.y) < 1e-9, `y ${y.re} vs ${analytic.endPose.y}`);
	assert.ok(Math.abs(theta.re - analytic.endPose.theta) < 1e-12);
});

test("the analytic end-pose Jacobian matches the complex step to machine precision", () => {
	const analytic = createAlignmentPoseJacobian({ elements: elementsAt(X), startPose: START, momentsFor })
		.endPoseJacobian(PARAMETERS);
	const stepped = complexStepJacobian(endPoseComplex, X);

	let worst = 0;
	let where = "";
	["dx", "dy", "dtheta"].forEach((component, row) => {
		PARAMETERS.forEach((parameter, column) => {
			const a = analytic[column][component];
			const b = stepped[row][column];
			const relative = Math.abs(a - b) / Math.max(1, Math.abs(a));
			if (relative > worst) {
				worst = relative;
				where = `${component}/d(${parameter.kind} E${parameter.elementIndex}): analytic ${a}, step ${b}`;
			}
		});
	});
	assert.ok(worst < 1e-12, `worst relative disagreement ${worst.toExponential(2)} at ${where}`);
});

test("the complex step beats the central difference it replaces", () => {
	// Not a competition for its own sake: finiteDiffJacobian has to be told each
	// variable's magnitude precisely because its error is bounded below by
	// cancellation. Showing that bound is showing why the step matters.
	const analytic = createAlignmentPoseJacobian({ elements: elementsAt(X), startPose: START, momentsFor })
		.endPoseJacobian(PARAMETERS);
	const stepped = complexStepJacobian(endPoseComplex, X);
	const differenced = finiteDiffJacobian({
		x: X,
		residual: (v) => {
			const p = createAlignmentPoseJacobian({ elements: elementsAt(v), startPose: START, momentsFor }).endPose;
			return [p.x, p.y, p.theta];
		},
		scales: [200, 200, 200, 200, 200, 1e-3],
	});
	assert.ok(differenced.ok, "the central difference did not run");

	const worstOf = (J) => {
		let worst = 0;
		["dx", "dy", "dtheta"].forEach((component, row) => {
			PARAMETERS.forEach((_, column) => {
				const a = analytic[column][component];
				worst = Math.max(worst, Math.abs(a - J[row][column]) / Math.max(1, Math.abs(a)));
			});
		});
		return worst;
	};
	const byStep = worstOf(stepped);
	const byDifference = worstOf(differenced.J);
	assert.ok(byStep < byDifference,
		`complex step ${byStep.toExponential(2)} is not better than central differences ${byDifference.toExponential(2)}`);
});
