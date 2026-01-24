// app/view/threeViewer.js
import * as THREE from "three";

export function makeThreeViewer({ canvas }) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	const scene = new THREE.Scene();

	scene.background = new THREE.Color(0x0b0e14);

	const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
	camera.position.set(0, -220, 160);
	camera.lookAt(0, 0, 0);

	const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
	dirLight.position.set(200, -100, 300);

	scene.add(dirLight);
	scene.add(new THREE.AmbientLight(0xffffff, 0.35));
	// GridHelper is XZ by default (Y up). Our canonical convention is ENU with Z up.
	// Rotating the grid into the XY plane makes the scene less confusing.
	const grid = new THREE.GridHelper(600, 30);
	grid.rotation.x = Math.PI / 2;
	scene.add(grid);
	scene.add(new THREE.AxesHelper(120));

	const trackMat = new THREE.LineBasicMaterial();
	let trackLine = null;
	let trackPointsCache = null; // [{x,y,z}]
	let trackCumCache = null;    // cumulative chainage

	// section line
	const sectionMat = new THREE.LineBasicMaterial();
	let sectionLine = null;

	const marker = new THREE.Mesh(
	new THREE.SphereGeometry(4, 18, 12),
	new THREE.MeshStandardMaterial()
	);
	scene.add(marker);

	// orbit
	let isDrag = false, lastX = 0, lastY = 0;
	let yaw = 0.3, pitch = 0.55, radius = 320;
	const target = new THREE.Vector3(0, 0, 0);
	
	// MS13.2b: smooth zoom animation (radius lerp)
	let zoomAnim = null; 
	// { t0, durationMs, r0, r1 }

	canvas.addEventListener("mousedown", (e) => {
		isDrag = true; lastX = e.clientX; lastY = e.clientY;
	});

	canvas.addEventListener("wheel", (e) => {
		e.preventDefault();
		radius = Math.min(1200, Math.max(80, radius + e.deltaY * 0.4));
	}, { passive: false });

	window.addEventListener("mouseup", () => { isDrag = false; });
	window.addEventListener("mousemove", (e) => {
		if (!isDrag) return;
		const dx = e.clientX - lastX;
		const dy = e.clientY - lastY;

		lastX = e.clientX;
		lastY = e.clientY;

		yaw += dx * 0.005;
		pitch = Math.min(1.45, Math.max(0.15, pitch + dy * 0.005));
	});

	function resize() {
		const rect = canvas.getBoundingClientRect();
		const w = Math.max(1, Math.floor(rect.width));
		const h = Math.max(1, Math.floor(rect.height));

		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}

	function setTrackFromXY(pointsXY) {
		// pointsXY: [{x,y}, ...] OR null => clear
		if (!Array.isArray(pointsXY) || pointsXY.length < 2) {
			if (trackLine) {
				scene.remove(trackLine);
				trackLine.geometry.dispose();
				trackLine = null;
			}
			trackPointsCache = null;
			trackCumCache = null;
			return;
		}

		// Cache for picking: keep a lightweight copy + cumulative chainage.
		trackPointsCache = pointsXY.map(p => ({ x: Number(p?.x) || 0, y: Number(p?.y) || 0, z: Number(p?.z) || 0 }));
		trackCumCache = computeChainage(trackPointsCache);

		const pts3 = trackPointsCache.map(p => new THREE.Vector3(p.x, p.y, p.z));
		const geo = new THREE.BufferGeometry().setFromPoints(pts3);

		if (trackLine) {
			trackLine.geometry.dispose();
			trackLine.geometry = geo;
		} else {
			trackLine = new THREE.Line(geo, trackMat);
			scene.add(trackLine);
		}
	}

	function setSectionLine(p0, p1) {
		// p0/p1: {x,y,z?} OR null => clear
		if (!p0 || !p1) {
			if (sectionLine) {
				scene.remove(sectionLine);
				sectionLine.geometry.dispose();
				sectionLine = null;
			}
			return;
		}

		const pts3 = [
		new THREE.Vector3(p0.x, p0.y, p0.z ?? 0),
		new THREE.Vector3(p1.x, p1.y, p1.z ?? 0),
		];
		const geo = new THREE.BufferGeometry().setFromPoints(pts3);

		if (sectionLine) {
			sectionLine.geometry.dispose();
			sectionLine.geometry = geo;
		} else {
			sectionLine = new THREE.Line(geo, sectionMat);
			scene.add(sectionLine);
		}
	}

	function setMarker(x, y, z = 0) {
		marker.position.set(x, y, z);
	}

	function setMarkerObj(p) {
		if (!p) {
			// hide marker (cheap): move far away
			marker.position.set(0, 0, -999999);
			return;
		}
		setMarker(p.x ?? 0, p.y ?? 0, p.z ?? 0);
	}

	function computeChainage(points) {
		if (!Array.isArray(points) || points.length < 2) return null;
		const cum = new Array(points.length);
		cum[0] = 0;
		for (let i = 1; i < points.length; i++) {
			const a = points[i - 1];
			const b = points[i];
			cum[i] = cum[i - 1] + Math.hypot((b.x - a.x), (b.y - a.y));
		}
		return cum;
	}

	function closestChainageOnPolyline2D(points, cum, q) {
		if (!Array.isArray(points) || points.length < 2 || !Array.isArray(cum)) return null;
		const qx = Number(q?.x);
		const qy = Number(q?.y);
		if (!Number.isFinite(qx) || !Number.isFinite(qy)) return null;

		let bestD2 = Infinity;
		let bestS = 0;

		for (let i = 0; i < points.length - 1; i++) {
			const a = points[i];
			const b = points[i + 1];
			const ax = a.x, ay = a.y;
			const bx = b.x, by = b.y;
			const vx = bx - ax;
			const vy = by - ay;
			const vv = vx * vx + vy * vy;
			if (vv < 1e-12) continue;

			let t = ((qx - ax) * vx + (qy - ay) * vy) / vv;
			if (t < 0) t = 0;
			else if (t > 1) t = 1;

			const cx = ax + t * vx;
			const cy = ay + t * vy;
			const dx = qx - cx;
			const dy = qy - cy;
			const d2 = dx * dx + dy * dy;

			if (d2 < bestD2) {
				bestD2 = d2;
				const segLen = Math.sqrt(vv);
				bestS = cum[i] + t * segLen;
			}
		}

		return Number.isFinite(bestS) ? bestS : null;
	}

	// picking
	const raycaster = new THREE.Raycaster();
	const mouse = new THREE.Vector2();

	function onMarkerClick(handler) {
		canvas.addEventListener("click", (e) => {
			const rect = canvas.getBoundingClientRect();

			mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

			raycaster.setFromCamera(mouse, camera);
			const hits = raycaster.intersectObject(marker);
			if (!hits.length) return;
			handler?.();
		});
	}

	function onTrackClick(handler) {
		canvas.addEventListener("click", (e) => {
			if (!trackLine || !trackPointsCache || !trackCumCache) return;

			const rect = canvas.getBoundingClientRect();
			mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

			raycaster.setFromCamera(mouse, camera);

			// If marker was clicked, let marker handler win (avoid double actions).
			const markerHits = raycaster.intersectObject(marker);
			if (markerHits.length) return;

			// Line picking needs a threshold (world units)
			raycaster.params.Line.threshold = 6;
			const hits = raycaster.intersectObject(trackLine);
			if (!hits.length) return;

			const hit = hits[0];
			const p = hit.point;
			const s = computeClosestChainageAtPointXY(trackPointsCache, trackCumCache, p);
			if (!Number.isFinite(s)) return;

			handler?.({ s, point: { x: p.x, y: p.y, z: p.z }, event: e });
		});
	}

	function render() {
		const cx = Math.cos(yaw) * Math.sin(pitch) * radius;
		const cy = Math.sin(yaw) * Math.sin(pitch) * radius;
		const cz = Math.cos(pitch) * radius;
		
		// MS13.2b: animate radius (zoom) smoothly
		if (zoomAnim) {
			const now = performance.now();
			const dt = now - zoomAnim.t0;
			const d = zoomAnim.durationMs;

			if (d <= 0) {
				radius = zoomAnim.r1;
				zoomAnim = null;
			} else {
				let u = dt / d;
				if (u >= 1) {
					radius = zoomAnim.r1;
					zoomAnim = null;
				} else {
					// smoothstep easing
					u = u * u * (3 - 2 * u);
					radius = zoomAnim.r0 + (zoomAnim.r1 - zoomAnim.r0) * u;
				}
			}
		}

		camera.position.set(target.x + cx, target.y + cy, target.z + cz);
		camera.lookAt(target);

		renderer.render(scene, camera);
	}

	function start() {
		resize();
		function loop() { render(); requestAnimationFrame(loop); }
		loop();
	}

	function setTrackPoints(points) {
		// points: [{x,y,z?}, ...] OR null
		setTrackFromXY(points);
	}
	
	function computeFitRadiusForBox(bbox, pad = 1.25) {
		if (!bbox) return null;

		const minX = bbox.minX, minY = bbox.minY, maxX = bbox.maxX, maxY = bbox.maxY;
		if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;

		const dx = Math.max(1e-6, maxX - minX);
		const dy = Math.max(1e-6, maxY - minY);

		const aspect = camera.aspect || 1;
		const vFov = THREE.MathUtils.degToRad(camera.fov);
		const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

		const distV = (dy / 2) / Math.tan(vFov / 2);
		const distH = (dx / 2) / Math.tan(hFov / 2);

		let r = Math.max(distV, distH) * pad;
		r = Math.min(1200, Math.max(80, r));
		return r;
	}

	function zoomToFitBox(bbox, opts = {}) {
		if (!bbox) return;
		const pad = Number.isFinite(opts.padding) ? opts.padding : 1.25;

		const minX = bbox.minX, minY = bbox.minY, maxX = bbox.maxX, maxY = bbox.maxY;
		if (![minX, minY, maxX, maxY].every(Number.isFinite)) return;

		target.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, 0);

		const dx = Math.max(1e-6, maxX - minX);
		const dy = Math.max(1e-6, maxY - minY);

		const aspect = camera.aspect || 1;
		const vFov = THREE.MathUtils.degToRad(camera.fov);
		const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

		const distV = (dy / 2) / Math.tan(vFov / 2);
		const distH = (dx / 2) / Math.tan(hFov / 2);

		radius = Math.max(distV, distH) * pad;
		radius = Math.min(1200, Math.max(80, radius));
	}
	
	function zoomToFitBoxSoftAnimated(bbox, opts = {}) {
		if (!bbox) return;

		const pad = Number.isFinite(opts.padding) ? opts.padding : 1.25;
		const durationMs = Number.isFinite(opts.durationMs) ? opts.durationMs : 240;

		const r1 = computeFitRadiusForBox(bbox, pad);
		if (!Number.isFinite(r1)) return;

		// Start a new animation from current radius
		zoomAnim = {
			t0: performance.now(),
			durationMs: Math.max(0, durationMs),
			r0: radius,
			r1,
		};
	}
	
	function zoomToFitBoxSoft(bbox, opts = {}) {
		if (!bbox) return;
		const pad = Number.isFinite(opts.padding) ? opts.padding : 1.25;

		const minX = bbox.minX, minY = bbox.minY, maxX = bbox.maxX, maxY = bbox.maxY;
		if (![minX, minY, maxX, maxY].every(Number.isFinite)) return;

		const dx = Math.max(1e-6, maxX - minX);
		const dy = Math.max(1e-6, maxY - minY);

		const aspect = camera.aspect || 1;
		const vFov = THREE.MathUtils.degToRad(camera.fov);
		const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

		const distV = (dy / 2) / Math.tan(vFov / 2);
		const distH = (dx / 2) / Math.tan(hFov / 2);

		// MS13.2: NO target change here (only zoom)
		radius = Math.max(distV, distH) * pad;
		radius = Math.min(1200, Math.max(80, radius));
	}

	window.addEventListener("resize", resize);

	return {
		THREE,
		resize,
		start,
		zoomToFitBox,
		zoomToFitBoxSoft,   // <- MS13.2
		zoomToFitBoxSoftAnimated, // ✅ MS13.2b

		setTrackPoints,
		setMarker: setMarkerObj,
		setSectionLine,

		// optional legacy
		setTrackFromXY,
		setMarkerXYZ: setMarker,

		getMarkerXY: () => ({ x: marker.position.x, y: marker.position.y }),
		onMarkerClick,
		onTrackClick,
	};
}
