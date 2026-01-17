// app/view/hView.js

export function createHView({ container, store }) {
	const canvas = document.createElement("canvas");
	canvas.width = container.clientWidth || 600;
	canvas.height = container.clientHeight || 200;
	container.appendChild(canvas);

	const ctx = canvas.getContext("2d");

	function render(profile) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!Array.isArray(profile) || profile.length < 2) return;

		const pad = 20;
		const w = canvas.width - 2 * pad;
		const h = canvas.height - 2 * pad;

		const sMin = profile[0].s;
		const sMax = profile[profile.length - 1].s;

		let zMin = Infinity, zMax = -Infinity;
		for (const p of profile) {
			if (p.z < zMin) zMin = p.z;
			if (p.z > zMax) zMax = p.z;
		}
		if (zMax === zMin) {
			zMax += 1;
			zMin -= 1;
		}

		const sx = s => pad + ((s - sMin) / (sMax - sMin)) * w;
		const sy = z => pad + h - ((z - zMin) / (zMax - zMin)) * h;

		// axes
		ctx.strokeStyle = "#888";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(pad, pad);
		ctx.lineTo(pad, pad + h);
		ctx.lineTo(pad + w, pad + h);
		ctx.stroke();

		// profile
		ctx.strokeStyle = "#0af";
		ctx.lineWidth = 2;
		ctx.beginPath();
		profile.forEach((p, i) => {
			const x = sx(p.s);
			const y = sy(p.z);
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		});
		ctx.stroke();
	}

	// subscribe to store
	const unsub = store.subscribe((state) => {
		render(state.import_profile1d);
	});

	// initial draw
	render(store.getState().import_profile1d);

	return {
		destroy() {
			unsub?.();
			canvas.remove();
		}
	};
}
