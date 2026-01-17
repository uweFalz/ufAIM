// threeViewer.js
import * as THREE from "three";

export function makeThreeViewer({ canvas }) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	const scene = new THREE.Scene();
	
	scene.background = new THREE.Color(0x0b0e14);

	const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
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
		// pointsXY: [{x,y}, ...]
		const pts3 = pointsXY.map(p => new THREE.Vector3(p.x, p.y, 0));
		const geo = new THREE.BufferGeometry().setFromPoints(pts3);
		
		if (trackLine) {
			trackLine.geometry.dispose();
			trackLine.geometry = geo;
		} else {
			trackLine = new THREE.Line(geo, trackMat);
			scene.add(trackLine);
		}
	}

	function setMarker(x, y, z = 0) {
		marker.position.set(x, y, z);
	}

	// picking
	const raycaster = new THREE.Raycaster();
	const mouse = new THREE.Vector2();

	function onMarkerClick(handler) {
		canvas.addEventListener("click", (e) => {
			const rect = canvas.getBoundingClientRect();
			
			mouse.x =  ((e.clientX - rect.left) / rect.width) * 2 - 1;
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
		// points: [{x,y,z?}, ...]
		setTrackFromXY(points); // z ignorieren wir erstmal (0)
	}

	function setMarkerObj(p) {
		if (!p) return;
		setMarker(p.x ?? 0, p.y ?? 0, p.z ?? 0);
	}
	
	function zoomToFitBox(bbox, opts = {}) {
	if (!bbox) return;
	const pad = Number.isFinite(opts.padding) ? opts.padding : 1.25;

	const minX = bbox.minX, minY = bbox.minY, maxX = bbox.maxX, maxY = bbox.maxY;
	if (![minX, minY, maxX, maxY].every(Number.isFinite)) return;

	// center becomes new orbit target
	target.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, 0);

	// compute a radius so the box fits the vertical fov (good enough for now)
	const dx = Math.max(1e-6, maxX - minX);
	const dy = Math.max(1e-6, maxY - minY);

	// consider aspect: width fitting needs larger distance if aspect < 1
	const aspect = camera.aspect || 1;
	const boxHeight = dy;
	const boxWidth = dx;

	// fit in vertical FOV and also in horizontal FOV
	const vFov = THREE.MathUtils.degToRad(camera.fov);
	const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

	const distV = (boxHeight / 2) / Math.tan(vFov / 2);
	const distH = (boxWidth  / 2) / Math.tan(hFov / 2);

	radius = Math.max(distV, distH) * pad;

	// keep within your wheel clamp
	radius = Math.min(1200, Math.max(80, radius));
}
	
	window.addEventListener("resize", resize);

	return {
		THREE,
		resize,
		start,
		zoomToFitBox,

		// new AppCore-friendly API
		setTrackPoints,
		setMarker: setMarkerObj,

		// keep old API for now (optional)
		setTrackFromXY,
		setMarkerXYZ: setMarker,

		getMarkerXY: () => ({ x: marker.position.x, y: marker.position.y }),
		onMarkerClick
	};
}
