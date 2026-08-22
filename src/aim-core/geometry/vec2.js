// src/aim-core/geometry/vec2.js

const EPS = 1e-12;

export function vec(x = 0, y = 0) {
	return { x, y };
}

export function dot(a, b) {
	return a.x * b.x + a.y * b.y;
}

export function len2(v) {
	return dot(v, v);
}

export function len(v) {
	return Math.sqrt(len2(v));
}

export function scale(v, s) {
	return { x: v.x * s, y: v.y * s };
}

export function add(a, b) {
	return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a, b) {
	return { x: a.x - b.x, y: a.y - b.y };
}

export function rot90(v) {
	return { x: -v.y, y: v.x };
}

export function rot(v, phi) {
	const c = Math.cos(phi);
	const s = Math.sin(phi);
	return {
		x: c * v.x - s * v.y,
		y: s * v.x + c * v.y,
	};
}

export function normalize(v, eps = EPS) {
	const l = len(v);
	if (l < eps) throw new Error("vec2.normalize(): zero-length vector");
	return { x: v.x / l, y: v.y / l };
}
