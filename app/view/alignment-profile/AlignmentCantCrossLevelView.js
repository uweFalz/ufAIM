const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 640;
const HEIGHT = 180;
const MARGIN = 28;

function svgElement(documentRef, name) {
	return documentRef.createElementNS?.(SVG_NS, name) ?? documentRef.createElement(name);
}

function attributes(element, values) {
	for (const [name, value] of Object.entries(values)) element.setAttribute(name, String(value));
}

function scale(value, fromStart, fromEnd, toStart, toEnd) {
	if (Object.is(fromStart, fromEnd)) return (toStart + toEnd) / 2;
	return toStart + ((value - fromStart) / (fromEnd - fromStart)) * (toEnd - toStart);
}

export class AlignmentCantCrossLevelView {
	#host;
	#onCursorSelect = null;

	constructor({ host } = {}) {
		if (!host || typeof host.replaceChildren !== "function" || !host.ownerDocument) {
			throw new TypeError("AlignmentCantCrossLevelView requires a DOM host");
		}
		this.#host = host;
	}

	setSelectionHandler(onCursorSelect) {
		if (typeof onCursorSelect !== "function") {
			throw new TypeError(
				"Cant cross-level cursor selection requires a callback"
			);
		}
		this.#onCursorSelect = onCursorSelect;
	}

	render(viewModel) {
		const documentRef = this.#host.ownerDocument;
		const region = documentRef.createElement("section");
		region.dataset.cantCrossLevelView = "";
		region.setAttribute("aria-label", "Cant cross-level view");
		const heading = documentRef.createElement("h3");
		heading.textContent = "Cant cross-level";
		const status = documentRef.createElement("strong");
		status.dataset.cantCrossLevelStatus = viewModel?.status ?? "error";
		status.textContent = viewModel?.status ?? "error";
		region.append(heading, status);
		if (viewModel?.status !== "projected") {
			const empty = documentRef.createElement("p");
			empty.dataset.cantCrossLevelEmpty = "";
			empty.textContent = viewModel?.status === "absent" ? "No persisted Cant state" : String(viewModel?.error?.message ?? "Cant cross-level unavailable");
			region.append(empty);
			this.#host.replaceChildren(region);
			return region;
		}
		const evidenceValid =
			viewModel.domain?.parameterKind === "intrinsic-s" &&
			Number.isFinite(viewModel.domain.startS) &&
			Number.isFinite(viewModel.domain.endS) &&
			Array.isArray(viewModel.boundaries) &&
			viewModel.boundaries.every(Number.isFinite) &&
			Array.isArray(viewModel.samples) &&
			viewModel.samples.every((sample) => Number.isFinite(sample?.s) && Number.isFinite(sample?.crossLevel) && Number.isFinite(sample?.twist));
		if (!evidenceValid) {
			const unavailable = documentRef.createElement("p");
			unavailable.dataset.cantCrossLevelEmpty = "";
			unavailable.textContent = "Cant cross-level unavailable";
			region.append(unavailable);
			this.#host.replaceChildren(region);
			return region;
		}
		const values = viewModel.samples.map((sample) => sample.crossLevel);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const x = (s) => scale(s, viewModel.domain.startS, viewModel.domain.endS, MARGIN, WIDTH - MARGIN);
		const y = (value) => scale(value, min, max, HEIGHT - MARGIN, MARGIN);
		const svg = svgElement(documentRef, "svg");
		attributes(svg, { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: "img", "aria-label": `Cant cross-level from s ${viewModel.domain.startS} to ${viewModel.domain.endS}` });
		svg.dataset.cantCrossLevelPlot = "";
		let hitTarget = null;
		if (this.#onCursorSelect) {
			hitTarget = svgElement(documentRef, "rect");
			hitTarget.dataset.cantCursorHitTarget = "";
			attributes(hitTarget, {
				x: MARGIN,
				y: MARGIN,
				width: WIDTH - 2 * MARGIN,
				height: HEIGHT - 2 * MARGIN,
				fill: "transparent",
				role: "button",
				"aria-label": "Select shared intrinsic-s cursor from Cant cross-level",
				"pointer-events": "all",
			});
			hitTarget.onclick = (event) => {
				const bounds = svg.getBoundingClientRect?.();
				const clientX = Number(event?.clientX);
				if (
					!bounds ||
					!Number.isFinite(clientX) ||
					!Number.isFinite(bounds.left) ||
					!Number.isFinite(bounds.width) ||
					bounds.width <= 0
				) {
					return;
				}
				const viewBoxX =
					((clientX - bounds.left) / bounds.width) * WIDTH;
				const plotX = Math.max(
					MARGIN,
					Math.min(WIDTH - MARGIN, viewBoxX)
				);
				const selectedS = scale(
					plotX,
					MARGIN,
					WIDTH - MARGIN,
					viewModel.domain.startS,
					viewModel.domain.endS
				);
				if (Number.isFinite(selectedS)) {
					this.#onCursorSelect(selectedS);
				}
			};
		}
		const path = svgElement(documentRef, "polyline");
		path.dataset.cantCrossLevelPath = "";
		attributes(path, { points: viewModel.samples.map((sample) => `${x(sample.s)},${y(sample.crossLevel)}`).join(" "), fill: "none", stroke: "currentColor" });
		svg.append(path);
		for (const element of viewModel.elements) {
			const label = svgElement(documentRef, "text");
			label.dataset.cantElementId = String(element.id);
			attributes(label, { x: x(element.startS), y: MARGIN, "aria-label": `Cant element ${String(element.id)} from s ${String(element.startS)} to ${String(element.endS)}` });
			label.textContent = String(element.id);
			svg.append(label);
		}
		for (const boundary of viewModel.boundaries) {
			const marker = svgElement(documentRef, "text");
			marker.dataset.cantBoundary = String(boundary);
			attributes(marker, { x: x(boundary), y: HEIGHT - 4, "aria-label": `Cant boundary s ${String(boundary)}` });
			marker.textContent = String(boundary);
			svg.append(marker);
		}
		if (viewModel.cursor?.status === "evaluated" && Number.isFinite(viewModel.cursor.crossLevel) && Number.isFinite(viewModel.cursor.twist)) {
			const cursor = svgElement(documentRef, "circle");
			cursor.dataset.cantCursor = "";
			attributes(cursor, { cx: x(viewModel.cursor.s), cy: y(viewModel.cursor.crossLevel), r: 4, "aria-label": `Shared s ${String(viewModel.cursor.s)}, cross-level ${String(viewModel.cursor.crossLevel)}, twist ${String(viewModel.cursor.twist)}, element ${String(viewModel.cursor.elementId)}` });
			svg.append(cursor);
		}
		if (hitTarget) svg.append(hitTarget);
		region.append(svg);
		const cursorEvidence = documentRef.createElement("p");
		cursorEvidence.dataset.cantCursorEvidence = "";
		cursorEvidence.textContent = viewModel.cursor?.status === "evaluated"
			? `Shared s=${String(viewModel.cursor.s)} · element=${String(viewModel.cursor.elementId)} · cross-level=${String(viewModel.cursor.crossLevel)} · twist=${String(viewModel.cursor.twist)}`
			: `Shared s=${String(viewModel.cursor?.s)} · ${String(viewModel.cursor?.status ?? "unavailable")}`;
		const reference = documentRef.createElement("pre");
		reference.dataset.cantReferenceEvidence = "";
		reference.textContent = JSON.stringify(viewModel.reference, null, 2);
		region.append(cursorEvidence, reference);
		this.#host.replaceChildren(region);
		return region;
	}
}

export default AlignmentCantCrossLevelView;
