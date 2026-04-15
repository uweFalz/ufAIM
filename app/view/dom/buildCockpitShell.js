// app/view/dom/buildCockpitShell.js
//
// buildCockpitShell
//
// Window-local cockpit shell.
//
// Role:
// - creates a visible cockpit layout
// - provides dedicated DOM anchors
// - does not bind logic
//
// Structure:
// - header
// - main
//   - primary view area
//   - side panel with cockpit + auxiliary panels
// - footer

export function buildCockpitShell(ctx = {}) {
	const root = document.createElement("div");
	root.className = "cockpit";

	// -------------------------------------------------------------------------
	// HEADER
	// -------------------------------------------------------------------------
	const header = document.createElement("header");
	header.className = "cockpit-header";

	// -------------------------------------------------------------------------
	// MAIN
	// -------------------------------------------------------------------------
	const main = document.createElement("main");
	main.className = "cockpit-main";

	// -------------------------------------------------------------------------
	// VIEW AREA
	// -------------------------------------------------------------------------
	const viewArea = document.createElement("section");
	viewArea.className = "view-area";

	// -------------------------------------------------------------------------
	// SIDE PANEL
	// -------------------------------------------------------------------------
	const side = document.createElement("aside");
	side.className = "side-panels";

	const cockpitPanel = document.createElement("section");
	cockpitPanel.className = "cockpit-panel";
	cockpitPanel.id = "cockpitPanel";

	const cockpitPanelHead = document.createElement("div");
	cockpitPanelHead.className = "cockpit-panel__head";
	cockpitPanelHead.textContent = "Cockpit";

	const cockpitPanelBody = document.createElement("div");
	cockpitPanelBody.className = "cockpit-panel__body";
	cockpitPanelBody.id = "cockpitPanelBody";

	cockpitPanel.appendChild(cockpitPanelHead);
	cockpitPanel.appendChild(cockpitPanelBody);

	side.appendChild(cockpitPanel);

	main.appendChild(viewArea);
	main.appendChild(side);

	// -------------------------------------------------------------------------
	// FOOTER
	// -------------------------------------------------------------------------
	const footer = document.createElement("footer");
	footer.className = "cockpit-footer";

	root.appendChild(header);
	root.appendChild(main);
	root.appendChild(footer);

	return {
		root,
		header,
		main,
		viewArea,
		side,
		footer,
		cockpitPanel,
		cockpitPanelHead,
		cockpitPanelBody,
	};
}
