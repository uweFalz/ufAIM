import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

// Import the real viewer unchanged. Only the WebGL/DOM-facing THREE surface is
// replaced; Fit, orbit, wheel, resize, clipping and animation are production code.
const threeUrl = `data:text/javascript,${encodeURIComponent(`
export class Vector3 {
  constructor(x=0,y=0,z=0) { this.set(x,y,z); }
  set(x,y,z) { Object.assign(this,{x,y,z}); return this; }
}
export class Vector2 {}
export class Object3D { static DEFAULT_UP = new Vector3(); }
export class Scene { add() {} remove() {} }
export class Color { constructor(value) { this.value=value; } }
export class PerspectiveCamera {
  constructor(fov,aspect,near,far) { Object.assign(this,{fov,aspect,near,far}); this.up=new Vector3(); this.position=new Vector3(); }
  lookAt(x,y,z) { this.target=typeof x==='object'?{x:x.x,y:x.y,z:x.z}:{x,y,z}; }
  updateProjectionMatrix() {}
}
export class WebGLRenderer {
  static instances=[];
  constructor() { WebGLRenderer.instances.push(this); }
  setPixelRatio(value) { this.pixelRatio=value; }
  setSize(w,h) { this.size={w,h}; }
  render(scene,camera) { this.camera=camera; }
  dispose() {}
}
export class DirectionalLight { position=new Vector3(); }
export class AmbientLight {}
export class GridHelper { rotation={}; material={}; }
export class AxesHelper {}
export class LineBasicMaterial { constructor(value) { Object.assign(this,value); } dispose() {} }
export class LineDashedMaterial extends LineBasicMaterial {}
export class MeshStandardMaterial extends LineBasicMaterial {}
export class SphereGeometry { dispose() {} }
export class BufferGeometry { setFromPoints(points) { this.points=points; return this; } dispose() {} }
export class Mesh { constructor(geometry,material) { Object.assign(this,{geometry,material}); this.position=new Vector3(); } }
export class Line extends Mesh {}
export class Raycaster {}
export const MathUtils={degToRad:value=>value*Math.PI/180};
`)}`;
const hook = registerHooks({
	resolve(specifier, context, nextResolve) {
		return specifier === "three" ? { url: threeUrl, shortCircuit: true } : nextResolve(specifier, context);
	},
});
const { makeThreeViewer } = await import("../../../app/view/viewers/threeViewer.js");
const { WebGLRenderer } = await import(threeUrl);
hook.deregister();

function harness(t, width = 1440, height = 1000) {
	const prior = Object.fromEntries(["window", "requestAnimationFrame", "cancelAnimationFrame"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
	let now = 0, id = 0;
	const frames = new Map(), canvasEvents = new Map(), windowEvents = new Map();
	const rect = { width, height };
	globalThis.window = { devicePixelRatio: 1, addEventListener: (name, fn) => windowEvents.set(name, fn), removeEventListener: (name) => windowEvents.delete(name) };
	globalThis.requestAnimationFrame = (fn) => { frames.set(++id, fn); return id; };
	globalThis.cancelAnimationFrame = (key) => frames.delete(key);
	t.mock.method(performance, "now", () => now);
	const canvas = { getBoundingClientRect: () => rect, addEventListener: (name, fn) => canvasEvents.set(name, fn), removeEventListener: (name) => canvasEvents.delete(name) };
	const viewer = makeThreeViewer({ canvas });
	const renderer = WebGLRenderer.instances.at(-1);
	viewer.start();
	t.after(() => {
		viewer.destroy();
		for (const [key, descriptor] of Object.entries(prior)) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else delete globalThis[key];
		}
	});
	return {
		viewer, renderer, rect,
		get camera() { return renderer.camera; },
		frame(time = now) { now = time; const callbacks = [...frames.values()]; frames.clear(); for (const fn of callbacks) fn(time); },
		wheel(deltaY) { canvasEvents.get("wheel")({ deltaY, preventDefault() {} }); },
		orbit(dx, dy) { canvasEvents.get("mousedown")({ clientX: 0, clientY: 0 }); windowEvents.get("mousemove")({ clientX: dx, clientY: dy }); windowEvents.get("mouseup")(); },
	};
}

const large = { minX: -25775.8659745, maxX: 25775.8659745, minY: -14758.672353, maxY: 14758.672353 };
const small = { minX: -10, maxX: 10, minY: -5, maxY: 5 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const orbitRadius = (camera) => distance(camera.position, camera.target);
const approx = (actual, expected) => assert.ok(Math.abs(actual - expected) < Math.max(1e-8, Math.abs(expected) * 1e-12), `${actual} != ${expected}`);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (v) => { const length = Math.hypot(v.x, v.y, v.z); return { x: v.x / length, y: v.y / length, z: v.z / length }; };

function assertCornersInside(camera, bbox) {
	// Independent camera-basis projection, not the production sphere formula.
	const forward = unit({ x: camera.target.x - camera.position.x, y: camera.target.y - camera.position.y, z: camera.target.z - camera.position.z });
	const right = unit(cross(forward, camera.up));
	const up = cross(right, forward);
	const tanY = Math.tan(camera.fov * Math.PI / 360), tanX = tanY * camera.aspect;
	for (const x of [bbox.minX, bbox.maxX]) for (const y of [bbox.minY, bbox.maxY]) {
		const relative = { x: x - camera.position.x, y: y - camera.position.y, z: -camera.position.z };
		const depth = dot(relative, forward);
		assert.ok(depth >= camera.near && depth <= camera.far, `corner depth ${depth} not in [${camera.near},${camera.far}]`);
		assert.ok(Math.abs(dot(relative, right) / (depth * tanX)) <= 1 + 1e-10, "corner outside horizontal frustum");
		assert.ok(Math.abs(dot(relative, up) / (depth * tanY)) <= 1 + 1e-10, "corner outside vertical frustum");
	}
}

test("large planar box fits every tested orbit direction and aspect, beyond the old radius/far limits", (t) => {
	const h = harness(t);
	for (const aspect of [0.25, 0.75, 1, 1.44, 3.5]) {
		h.rect.width = 1000 * aspect;
		h.viewer.zoomToFitBox(large, { padding: 1.35 });
		h.frame();
		approx(h.camera.aspect, aspect);
		assert.ok(orbitRadius(h.camera) > 1200);
		assert.ok(h.camera.far > 100000);
		assertCornersInside(h.camera, large);
		for (const [dx, dy] of [[240, 180], [370, -210], [-830, 1000], [170, -1000]]) {
			h.orbit(dx, dy); h.frame();
			assertCornersInside(h.camera, large);
		}
	}
});

test("small, point and one-dimensional boxes retain finite close-range Fit", (t) => {
	const h = harness(t);
	for (const bbox of [small, { minX: 42, maxX: 42, minY: -7, maxY: -7 }, { minX: 0, maxX: 10000, minY: 8, maxY: 8 }]) {
		h.viewer.zoomToFitBox(bbox); h.frame();
		assert.ok(Number.isFinite(orbitRadius(h.camera)));
		assert.ok(orbitRadius(h.camera) >= 80 - 1e-8);
		assertCornersInside(h.camera, bbox);
	}
	h.viewer.zoomToFitBox(small); h.frame();
	approx(orbitRadius(h.camera), 80);
	approx(h.camera.near, 0.1);
	assert.equal(h.camera.far, 100000); // Preserve the previous context range.
});

test("invalid boxes and unrepresentable bounds leave target and radius unchanged", (t) => {
	const h = harness(t);
	h.viewer.zoomToFitBox(small); h.frame();
	const target = { ...h.camera.target }, radius = orbitRadius(h.camera);
	for (const bbox of [null, {}, { ...small, minX: NaN }, { ...small, maxY: Infinity }, { ...small, minX: 11 }, { ...small, minY: 6 }, { minX: -1e308, maxX: 1e308, minY: 0, maxY: 1 }]) {
		for (const method of ["zoomToFitBox", "zoomToFitBoxSoft", "zoomToFitBoxSoftAnimated"]) {
			h.viewer[method](bbox); h.frame(1000);
			assert.deepEqual(h.camera.target, target);
			approx(orbitRadius(h.camera), radius);
		}
	}
});

test("invalid padding uses safe default; padding one still contains the complete box", (t) => {
	const h = harness(t);
	h.viewer.zoomToFitBox(large); h.frame();
	const expected = orbitRadius(h.camera);
	for (const padding of [NaN, Infinity, -1, 0, 0.5, "2"]) {
		h.viewer.zoomToFitBox(large, { padding }); h.frame();
		approx(orbitRadius(h.camera), expected);
		assertCornersInside(h.camera, large);
	}
	h.viewer.zoomToFitBox(large, { padding: 1 }); h.frame();
	assertCornersInside(h.camera, large);
});

test("Fit uses latest valid dimensions and ignores invalid resize/aspect/FOV inputs", (t) => {
	const h = harness(t);
	h.viewer.zoomToFitBox(large); h.frame();
	h.rect.width = 300; h.rect.height = 1000;
	h.viewer.zoomToFitBox(large); h.frame(); // no ResizeObserver callback needed
	approx(h.camera.aspect, 0.3); assertCornersInside(h.camera, large);
	for (const [width, height] of [[NaN, 100], [100, Infinity], [0, 0], [-1, 100]]) {
		Object.assign(h.rect, { width, height }); h.viewer.resize();
		approx(h.camera.aspect, 0.3);
	}
	const radius = orbitRadius(h.camera), target = { ...h.camera.target };
	for (const aspect of [NaN, Infinity, 0, -1]) {
		h.camera.aspect = aspect; h.viewer.zoomToFitBox(small); h.frame();
		approx(orbitRadius(h.camera), radius); assert.deepEqual(h.camera.target, target);
	}
	h.camera.aspect = 0.3;
	for (const fov of [NaN, Infinity, 0, -1, 180]) {
		h.camera.fov = fov; h.viewer.zoomToFitBox(small); h.frame();
		approx(orbitRadius(h.camera), radius); assert.deepEqual(h.camera.target, target);
	}
	h.camera.fov = 45;
	Object.assign(h.rect, { width: 900, height: 600 });
	window.devicePixelRatio = NaN; h.viewer.resize();
	assert.equal(h.renderer.pixelRatio, 1); approx(h.camera.aspect, 1.5);
});

test("wheel zoom remains proportional after large Fit and is not overwritten by an old animation", (t) => {
	const h = harness(t);
	h.viewer.zoomToFitBox(large); h.frame();
	const before = orbitRadius(h.camera);
	h.viewer.zoomToFitBoxSoftAnimated(small, { durationMs: 240 });
	h.wheel(100); h.frame(1000);
	assert.ok(orbitRadius(h.camera) > before && orbitRadius(h.camera) < before * 1.2);
	const after = orbitRadius(h.camera);
	h.wheel(-100); h.frame(2000);
	approx(orbitRadius(h.camera), before);
	for (const delta of [NaN, Infinity, -Infinity]) { h.wheel(delta); h.frame(); approx(orbitRadius(h.camera), before); }
	assert.ok(after > 1200);
	h.viewer.zoomToFitBox(small); h.wheel(-1e8); h.frame();
	approx(orbitRadius(h.camera), 80);
});

test("hard and soft Fit cancel stale animation; soft Fit preserves its existing target", (t) => {
	const h = harness(t);
	const translated = { minX: 10000, maxX: 10020, minY: -300, maxY: -290 };
	h.viewer.zoomToFitBox(translated); h.frame();
	const target = { ...h.camera.target };
	h.viewer.zoomToFitBoxSoftAnimated(large);
	h.viewer.zoomToFitBoxSoft(small); h.frame(1000);
	approx(orbitRadius(h.camera), 80); assert.deepEqual(h.camera.target, target);
	h.viewer.zoomToFitBoxSoftAnimated(large);
	h.viewer.zoomToFitBox(small); h.frame(2000);
	approx(orbitRadius(h.camera), 80); assert.deepEqual(h.camera.target, { x: 0, y: 0, z: 0 });
});

test("animated Fit reaches the unclamped result, and a replacement animation owns the final radius", (t) => {
	const h = harness(t);
	h.viewer.zoomToFitBox(large); h.frame();
	const expected = orbitRadius(h.camera);
	h.viewer.zoomToFitBox(small);
	h.viewer.zoomToFitBoxSoftAnimated(large, { durationMs: 240 }); h.frame(120);
	assert.ok(orbitRadius(h.camera) > 80 && orbitRadius(h.camera) < expected);
	h.frame(240); approx(orbitRadius(h.camera), expected); assertCornersInside(h.camera, large);
	h.viewer.zoomToFitBoxSoftAnimated(small, { durationMs: 1000 });
	h.viewer.zoomToFitBoxSoftAnimated(large, { durationMs: 0 }); h.frame(300);
	approx(orbitRadius(h.camera), expected);
	h.frame(2000); approx(orbitRadius(h.camera), expected);
});

test("q-mode resets a large-scale near plane and cancels old zoom while retaining far coverage", (t) => {
	const h = harness(t, 250, 1000);
	h.viewer.zoomToFitBox(large); h.frame();
	assert.ok(h.camera.near > 1 && h.camera.far > 100000);
	h.viewer.setTrackPoints([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }]);
	h.viewer.setMarker({ x: 0, y: 0, z: 0 });
	h.viewer.zoomToFitBoxSoftAnimated(large);
	assert.equal(h.viewer.setWorkspaceViewMode("q"), true); h.frame(1000);
	approx(orbitRadius(h.camera), 34); approx(h.camera.near, 0.1);
	assert.ok(h.camera.near < 1 && h.camera.far > 2 * 34);
	for (const x of [large.minX, large.maxX]) for (const y of [large.minY, large.maxY]) assert.ok(distance(h.camera.position, { x, y, z: 0 }) < h.camera.far);
	h.viewer.zoomToFitBoxSoftAnimated(large);
	assert.equal(h.viewer.setWorkspaceViewMode("main"), true); h.frame(2000);
	approx(orbitRadius(h.camera), 80);
});
