// app/view/viewers/threeViewer.js

import * as THREE from "three";

export function makeThreeViewer({ canvas }) {
	if (!canvas) {
		throw new Error("makeThreeViewer: missing canvas");
	}

	// MS13.13: align viewer coordinates with ENU (Z-up)
	// Project convention: x=east, y=north, z=up.
	THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	const scene = new THREE.Scene();

	scene.background = new THREE.Color(0x0b0e14);

	const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
	camera.up.set(0, 0, 1);
	camera.position.set(0, -220, 160);
	camera.lookAt(0, 0, 0);

	const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
	dirLight.position.set(200, -100, 300);

	scene.add(dirLight);
	scene.add(new THREE.AmbientLight(0xffffff, 0.35));

	// Grid is a great spatial cue, but it must not dominate the scene.
	// Keep it subtle and let tracks win visually.
	const grid = new THREE.GridHelper(600, 30);
	// GridHelper is created in XZ by default; rotate it into the XY plane (Z-up world).
	grid.rotation.x = Math.PI / 2;

	if (Array.isArray(grid.material)) {
		for (const m of grid.material) {
			m.transparent = true;
			m.opacity = 0.18;
			m.depthWrite = false;
			m.depthTest = true;
		}
	} else if (grid.material) {
		grid.material.transparent = true;
		grid.material.opacity = 0.18;
		grid.material.depthWrite = false;
		grid.material.depthTest = true;
	}
	grid.renderOrder = 0;
	scene.add(grid);
	scene.add(new THREE.AxesHelper(120));

	// Visual language:
	// - active track: solid + bright
	// - aux tracks (pinned/background): dashed + muted
	const trackMat = new THREE.LineBasicMaterial({
		color: 0x00d7ff,
		transparent: true,
		opacity: 0.98,
		depthTest: false,
		depthWrite: false,
	});
	let trackLine = null;

	// Base aux material; styled tracks may clone/override this.
	const auxMat = new THREE.LineDashedMaterial({
		color: 0x9ca3af,
		dashSize: 12,
		gapSize: 8,
		transparent: true,
		opacity: 0.78,
		depthTest: false,
		depthWrite: false,
	});
	const auxLines = new Map(); // id -> THREE.Line

	// section line
	const sectionMat = new THREE.LineBasicMaterial({
		transparent: true,
		opacity: 0.95,
		depthTest: false,
		depthWrite: false,
	});
	let sectionLine = null;

	const marker = new THREE.Mesh(
		new THREE.SphereGeometry(4, 18, 12),
		new THREE.MeshStandardMaterial({
			color: 0xffc107,
			depthTest: false,
			depthWrite: false,
		})
	);
	marker.renderOrder = 30;
	scene.add(marker);

	// orbit
	let isDrag = false;
	let lastX = 0;
	let lastY = 0;
	let yaw = 0.3;
	let pitch = 0.55;
	let radius = 320;
	const target = new THREE.Vector3(0, 0, 0);

	// smooth zoom animation
	let zoomAnim = null; // { t0, durationMs, r0, r1 }

	// animation loop control
	let isStarted = false;
	let rafId = 0;

	// resize control
	let lastResizeW = 0;
	let lastResizeH = 0;
	let resizeQueued = false;
	const resizeHost = canvas.parentElement ?? canvas;
	let resizeObserver = null;

	function scheduleResize() {
		if (resizeQueued) return;
		resizeQueued = true;

		requestAnimationFrame(() => {
			resizeQueued = false;
			resize();
		});
	}

	canvas.addEventListener("mousedown", (e) => {
		isDrag = true;
		lastX = e.clientX;
		lastY = e.clientY;
	});

	canvas.addEventListener(
		"wheel",
		(e) => {
			e.preventDefault();
			radius = Math.min(1200, Math.max(80, radius + e.deltaY * 0.4));
		},
		{ passive: false }
	);

	window.addEventListener("mouseup", () => {
		isDrag = false;
	});

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

		if (w === lastResizeW && h === lastResizeH) return;

		lastResizeW = w;
		lastResizeH = h;

		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}

	function setTrackFromXY(pointsXY) {
		// pointsXY: [{x,y,z}, ...] OR null => clear
		if (!Array.isArray(pointsXY) || pointsXY.length < 2) {
			if (trackLine) {
				scene.remove(trackLine);
				trackLine.geometry.dispose();
				trackLine = null;
			}
			return;
		}

		const pts3 = pointsXY.map((p) => new THREE.Vector3(p.x, p.y, p.z ?? 0));
		const geo = new THREE.BufferGeometry().setFromPoints(pts3);

		if (trackLine) {
			trackLine.geometry.dispose();
			trackLine.geometry = geo;
		} else {
			trackLine = new THREE.Line(geo, trackMat);
			trackLine.renderOrder = 20;
			trackLine.position.z = 0.12;
			scene.add(trackLine);
		}
	}

	function disposeLineMaterial(line) {
		if (!line?.material) return;

		if (line.material !== auxMat && typeof line.material.dispose === "function") {
			line.material.dispose();
		}
	}

	function clearAuxTracks() {
		for (const line of auxLines.values()) {
			scene.remove(line);
			line.geometry.dispose();
			disposeLineMaterial(line);
		}
		auxLines.clear();
	}

	function makeAuxMaterialFromStyle(style = {}) {
		const dashed = style.dashed !== false;

		if (dashed) {
			return new THREE.LineDashedMaterial({
				color: Number.isFinite(style.color) ? style.color : 0x9ca3af,
				dashSize: Number.isFinite(style.dashSize) ? style.dashSize : 12,
				gapSize: Number.isFinite(style.gapSize) ? style.gapSize : 8,
				transparent: true,
				opacity: Number.isFinite(style.opacity) ? style.opacity : 0.78,
				depthTest: false,
				depthWrite: false,
			});
		}

		return new THREE.LineBasicMaterial({
			color: Number.isFinite(style.color) ? style.color : 0x9ca3af,
			transparent: true,
			opacity: Number.isFinite(style.opacity) ? style.opacity : 0.78,
			depthTest: false,
			depthWrite: false,
		});
	}

	function applyAuxStyle(line, style = {}) {
		const wantsStyledMaterial =
			style &&
			(
				Number.isFinite(style.color) ||
				Number.isFinite(style.opacity) ||
				style.dashed === false ||
				Number.isFinite(style.dashSize) ||
				Number.isFinite(style.gapSize)
			);

		if (!wantsStyledMaterial) {
			if (line.material !== auxMat) {
				disposeLineMaterial(line);
				line.material = auxMat;
			}
		} else {
			disposeLineMaterial(line);
			line.material = makeAuxMaterialFromStyle(style);
		}

		line.position.z = Number.isFinite(style.zOffset) ? style.zOffset : 0.08;
		line.renderOrder = Number.isFinite(style.renderOrder) ? style.renderOrder : 12;
		line.frustumCulled = false;

		if (typeof line.computeLineDistances === "function" && line.material?.isLineDashedMaterial) {
			line.computeLineDistances();
		}
	}

	function setAuxTracks(tracks) {
		// tracks: [{ id, pointsXY:[{x,y,z?},...] }, ...]
		if (!Array.isArray(tracks) || tracks.length === 0) {
			clearAuxTracks();
			return;
		}

		const keep = new Set();

		for (const t of tracks) {
			const id = String(t?.id ?? "");
			const pts = t?.pointsXY;
			if (!id || !Array.isArray(pts) || pts.length < 2) continue;

			keep.add(id);

			const pts3 = pts.map((p) => new THREE.Vector3(p.x, p.y, p.z ?? 0));
			const geo = new THREE.BufferGeometry().setFromPoints(pts3);

			let line = auxLines.get(id);
			if (!line) {
				line = new THREE.Line(geo, auxMat);
				auxLines.set(id, line);
				scene.add(line);
			} else {
				line.geometry.dispose();
				line.geometry = geo;
			}

			applyAuxStyle(line, t?.style ?? {});
		}

		// remove stale
		for (const [id, line] of auxLines.entries()) {
			if (keep.has(id)) continue;
			scene.remove(line);
			line.geometry.dispose();
			disposeLineMaterial(line);
			auxLines.delete(id);
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
			sectionLine.renderOrder = 25;
			sectionLine.position.z = 0.14;
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

	function render() {
		// animate radius (zoom) smoothly
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

		const cx = Math.cos(yaw) * Math.sin(pitch) * radius;
		const cy = Math.sin(yaw) * Math.sin(pitch) * radius;
		const cz = Math.cos(pitch) * radius;

		camera.position.set(target.x + cx, target.y + cy, target.z + cz);
		camera.lookAt(target);

		renderer.render(scene, camera);
	}

	function loop() {
		render();
		rafId = requestAnimationFrame(loop);
	}

	function start() {
		if (isStarted) return;
		isStarted = true;

		resize();
		scheduleResize();

		if (typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver(() => {
				scheduleResize();
			});
			resizeObserver.observe(resizeHost);
			if (resizeHost !== canvas) {
				resizeObserver.observe(canvas);
			}
		}

		loop();
	}

	function stop() {
		if (!isStarted) return;
		isStarted = false;

		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}

		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}
	}

	function setTrackPoints(points) {
		setTrackFromXY(points);
	}

	function computeFitRadiusForBox(bbox, pad = 1.25) {
		if (!bbox) return null;
		const minX = bbox.minX;
		const minY = bbox.minY;
		const maxX = bbox.maxX;
		const maxY = bbox.maxY;
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

		const minX = bbox.minX;
		const minY = bbox.minY;
		const maxX = bbox.maxX;
		const maxY = bbox.maxY;
		if (![minX, minY, maxX, maxY].every(Number.isFinite)) return;

		target.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, 0);

		const r1 = computeFitRadiusForBox(bbox, pad);
		if (Number.isFinite(r1)) radius = r1;
	}

	function zoomToFitBoxSoft(bbox, opts = {}) {
		if (!bbox) return;
		const pad = Number.isFinite(opts.padding) ? opts.padding : 1.25;

		const r1 = computeFitRadiusForBox(bbox, pad);
		if (Number.isFinite(r1)) radius = r1;
	}

	function zoomToFitBoxSoftAnimated(bbox, opts = {}) {
		if (!bbox) return;

		const pad = Number.isFinite(opts.padding) ? opts.padding : 1.25;
		const durationMs = Number.isFinite(opts.durationMs) ? opts.durationMs : 240;

		const r1 = computeFitRadiusForBox(bbox, pad);
		if (!Number.isFinite(r1)) return;

		zoomAnim = {
			t0: performance.now(),
			durationMs: Math.max(0, durationMs),
			r0: radius,
			r1,
		};
	}

	function destroy() {
		stop();

		window.removeEventListener("resize", scheduleResize);

		clearAuxTracks();

		if (trackLine) {
			scene.remove(trackLine);
			trackLine.geometry.dispose();
			trackLine = null;
		}

		if (sectionLine) {
			scene.remove(sectionLine);
			sectionLine.geometry.dispose();
			sectionLine = null;
		}

		scene.remove(marker);
		marker.geometry.dispose();
		if (marker.material?.dispose) marker.material.dispose();

		trackMat.dispose();
		auxMat.dispose();
		sectionMat.dispose();

		renderer.dispose();
	}

	window.addEventListener("resize", scheduleResize);

	return {
		THREE,
		resize,
		scheduleResize,
		start,
		stop,
		destroy,

		zoomToFitBox,
		zoomToFitBoxSoft,
		zoomToFitBoxSoftAnimated,

		setTrackPoints,

		setMarker: setMarkerObj,
		setSectionLine,

		setAuxTracks,
		clearAuxTracks,
		setAuxTracksPoints: setAuxTracks,

		setTrackFromXY,
		setMarkerXYZ: setMarker,

		getMarkerXY: () => ({ x: marker.position.x, y: marker.position.y }),
		onMarkerClick,
	};
}
