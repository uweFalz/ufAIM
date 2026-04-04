// app/view/dom/buildCockpitShell.js

//
// ...
//
export function buildCockpitShell(ctx = {}) {
	const root = document.createElement("div");
	root.className = "cockpit";

	// HEADER
	const header = document.createElement("header");
	header.className = "cockpit-header";

	// MAIN
	const main = document.createElement("main");
	main.className = "cockpit-main";

	// VIEW AREA
	const viewArea = document.createElement("section");
	viewArea.className = "view-area";

	// SIDE PANEL
	const side = document.createElement("aside");
	side.className = "side-panels";

	main.appendChild(viewArea);
	main.appendChild(side);

	// FOOTER
	const footer = document.createElement("footer");
	footer.className = "cockpit-footer";

	root.appendChild(header);
	root.appendChild(main);
	root.appendChild(footer);

	return {
		root,
		header,
		viewArea,
		side,
		footer,
	};
}
