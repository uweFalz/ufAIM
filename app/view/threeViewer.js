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
	scene.add(new THREE.GridHelper(600, 30));
	scene.add(new THREE.AxesHelper(120));

	const trackMat = new THREE.LineBasicMaterial();
	let trackLine = null;

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
			return;
		}

		const pts3 = pointsXY.map(p => new THREE.Vector3(p.x, p.y, p.z ?? 0));
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
		const cx = Math.cos(yaw) * Math.sin(pitch) * radius;
		const cy = Math.sin(yaw) * Math.sin(pitch) * radius;
		const cz = Math.cos(pitch) * radius;

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

	window.addEventListener("resize", resize);

	return {
		THREE,
		resize,
		start,
		zoomToFitBox,

		setTrackPoints,
		setMarker: setMarkerObj,
		setSectionLine,

		// optional legacy
		setTrackFromXY,
		setMarkerXYZ: setMarker,

		getMarkerXY: () => ({ x: marker.position.x, y: marker.position.y }),
		onMarkerClick,
	};
}
