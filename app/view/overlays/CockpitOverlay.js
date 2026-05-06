// app/view/overlays/CockpitOverlay.js

export function mountCockpitOverlay({ root = document.body } = {}) {
	const el = document.createElement("div");

	el.style.position = "absolute";
	el.style.top = "10px";
	el.style.right = "10px";
	el.style.zIndex = "9999";
	el.style.background = "rgba(0,0,0,0.7)";
	el.style.color = "#0f0";
	el.style.fontSize = "12px";
	el.style.padding = "8px";
	el.style.fontFamily = "monospace";

	root.appendChild(el);

	return {
		render(text) {
			el.textContent = text;
		},
	};
}
