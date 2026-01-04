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
		
		camera.position.set(cx, cy, cz);
		camera.lookAt(0, 0, 0);

		renderer.render(scene, camera);
	}

	function start() {
		function loop() {
			render();
			requestAnimationFrame(loop);
		}
		loop();
	}

	return {
		THREE,
		resize,
		start,
		setTrackFromXY,
		setMarker,
		getMarkerXY: () => ({ x: marker.position.x, y: marker.position.y }),
		onMarkerClick
	};
}
