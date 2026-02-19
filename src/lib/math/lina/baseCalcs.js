// src/lib/math/lina/baseCalcs.js

// =============================
// 🔧 Utility: Vector, Angle, Curvature (Optimized & Structured)
// =============================

/**
* @typedef {Object} Vector
* @property {number} x
* @property {number} y
* @property {number} z
*/
const Vector = {
	create: (x = 0, y = 0, z = 0) => ({ x, y, z }),

	add: (vec, wec) => ({ x: vec.x + wec.x, y: vec.y + wec.y, z: vec.z + wec.z }),

	subtract: (vec, wec) => ({ x: vec.x - wec.x, y: vec.y - wec.y, z: vec.z - wec.z }),

	scale: (sc, vec) => ({ x: sc * vec.x, y: sc * vec.y, z: sc * vec.z }),

	dot: (vec, wec) => vec.x * wec.x + vec.y * wec.y + vec.z * wec.z,

	transposeXY: (vec) => ({ x: vec.y, y: -vec.x, z: vec.z }),

	toArray: (vec) => [vec.x, vec.y, vec.z],

	fromArray: ([x, y, z = 0]) => ({ x, y, z }),

	toString: (vec) => `(${vec.x.toFixed(9)}, ${vec.y.toFixed(9)}, ${vec.z.toFixed(9)})`
};

/**
* @typedef {Object} Angle
* @property {number} cos
* @property {number} sin
*/
const Angle = {
	create: (rad = 0) => ({ cos: Math.cos(rad), sin: Math.sin(rad) }),

	fromGon: (gon) => Angle.create((100 - gon) / 200 * Math.PI),
	fromDeg: (deg) => Angle.create(( 90 - deg) / 180 * Math.PI),

	toRad: (tau) => Math.atan2(tau.sin, tau.cos),

	toGon: (tau) => 100 - (Math.atan2(tau.sin, tau.cos) * 200 / Math.PI),
	toDeg: (tau) =>  90 - (Math.atan2(tau.sin, tau.cos) * 180 / Math.PI),

	add: (phi, psi) => Angle.create(Angle.toRad(phi) + Angle.toRad(psi)),

	subtract: (phi, psi) => Angle.create(Angle.toRad(phi) - Angle.toRad(psi)),

	transpose: (tau) => Angle.create(Angle.toRad(tau) + Math.PI / 2),

	scale: (sc, tau) => Vector.create(sc * tau.cos, sc * tau.sin, 0),

	rotateV2: (vec, tau) => Vector.create(
	tau.cos * vec.x - tau.sin * vec.y,
	tau.sin * vec.x + tau.cos * vec.y,
	vec.z
	),

	affTrans: (pntA, dirV, pntX) => ({
		s: Vector.dot(Vector.subtract(pntX, pntA), dirV),
		q: Vector.dot(Vector.subtract(pntX, pntA), Vector.transposeXY(dirV))
	})
};

/**
* @typedef {Object} Curvature
* @property {number} value
*/
const Curvature = {
	create: (value = 0) => ({ value }),

	getValue: (c) => c.value,

	equalsZero: (c) => c.value === 0,

	add: (a, b) => ({ value: a.value + b.value }),

	scale: (sc, c) => ({ value: sc * c.value }),

	average: (a, b) => ({ value: (a.value + b.value) / 2 }),

	partitionFill: (ka, ke, arr) => arr.map(t => ({ value: ka.value + t * (ke.value - ka.value) }))
};

// console.log("✅ Structured Vector, Angle, and Curvature interfaces initialized.");
