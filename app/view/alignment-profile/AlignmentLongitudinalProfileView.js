const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 640;
const HEIGHT = 240;
const MARGIN = 28;

function svgElement(documentRef, name) {
	return documentRef.createElementNS?.(SVG_NS, name) ??
		documentRef.createElement(name);
}

function setAttributes(element, attributes) {
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, String(value));
	}
}

function appendSvgText(svg, documentRef, textContent, attributes, dataset) {
	const text = svgElement(documentRef, "text");
	setAttributes(text, attributes);
	Object.assign(text.dataset, dataset);
	text.textContent = String(textContent);
	svg.append(text);
	return text;
}

function scale(value, fromStart, fromEnd, toStart, toEnd) {
	if (Object.is(fromStart, fromEnd)) return (toStart + toEnd) / 2;
	return (
		toStart +
		((value - fromStart) / (fromEnd - fromStart)) *
			(toEnd - toStart)
	);
}

function groupConsecutiveElementSamples(samples) {
	const groups = [];
	for (const sample of samples) {
		const previous = groups.at(-1);
		if (previous && Object.is(previous.elementId, sample.elementId)) {
			previous.samples.push(sample);
		} else {
			groups.push({ elementId: sample.elementId, samples: [sample] });
		}
	}
	return groups;
}

const INSPECTOR_FIELDS = Object.freeze([
	["id", "Identity"],
	["type", "Declared type"],
	["startS", "Start s"],
	["endS", "End s"],
	["startElevation", "Start elevation"],
	["startGradient", "Start gradient"],
	["gradient", "Gradient"],
	["gradientRate", "Gradient rate"],
]);

export class AlignmentLongitudinalProfileView {
	#host;
	#onCursorSelect = null;
	#onTerminalParabolicGradientRate = null;
	#terminalParabolicEditStatus = "";
	#terminalParabolicEditStatusNode = null;
	#onTerminalParabolicEndS = null;
	#terminalParabolicDomainEditStatus = "";
	#terminalParabolicDomainEditStatusNode = null;
	#onTerminalParabolicRemove = null;
	#terminalParabolicRemoveStatus = "";
	#terminalParabolicRemoveStatusNode = null;

	constructor({ host } = {}) {
		if (
			!host ||
			typeof host.replaceChildren !== "function" ||
			!host.ownerDocument
		) {
			throw new TypeError(
				"AlignmentLongitudinalProfileView requires a DOM host"
			);
		}
		this.#host = host;
	}

	setCursorSelectionHandler(onCursorSelect) {
		if (typeof onCursorSelect !== "function") {
			throw new TypeError(
				"longitudinal profile cursor selection requires a callback"
			);
		}
		this.#onCursorSelect = onCursorSelect;
	}

	setTerminalParabolicGradientRateHandler(onSubmit) {
		if (typeof onSubmit !== "function") {
			throw new TypeError(
				"terminal parabolic gradient-rate editing requires a callback"
			);
		}
		this.#onTerminalParabolicGradientRate = onSubmit;
	}

	renderTerminalParabolicEditStatus(status) {
		this.#terminalParabolicEditStatus = String(status ?? "");
		if (this.#terminalParabolicEditStatusNode) {
			this.#terminalParabolicEditStatusNode.textContent =
				this.#terminalParabolicEditStatus;
		}
	}

	setTerminalParabolicEndSHandler(onSubmit) {
		if (typeof onSubmit !== "function") {
			throw new TypeError(
				"terminal parabolic end-s editing requires a callback"
			);
		}
		this.#onTerminalParabolicEndS = onSubmit;
	}

	renderTerminalParabolicDomainEditStatus(status) {
		this.#terminalParabolicDomainEditStatus = String(status ?? "");
		if (this.#terminalParabolicDomainEditStatusNode) {
			this.#terminalParabolicDomainEditStatusNode.textContent =
				this.#terminalParabolicDomainEditStatus;
		}
	}

	setTerminalParabolicRemoveHandler(onRemove) {
		if (typeof onRemove !== "function") {
			throw new TypeError(
				"terminal parabolic removal requires a callback"
			);
		}
		this.#onTerminalParabolicRemove = onRemove;
	}

	renderTerminalParabolicRemoveStatus(status) {
		this.#terminalParabolicRemoveStatus = String(status ?? "");
		if (this.#terminalParabolicRemoveStatusNode) {
			this.#terminalParabolicRemoveStatusNode.textContent =
				this.#terminalParabolicRemoveStatus;
		}
	}

	render(viewModel) {
		const documentRef = this.#host.ownerDocument;
		const region = documentRef.createElement("section");
		region.dataset.longitudinalProfile = "";
		region.setAttribute("aria-label", "Longitudinal profile");
		const heading = documentRef.createElement("h3");
		heading.textContent = "Longitudinal profile";
		const status = documentRef.createElement("strong");
		status.dataset.longitudinalProfileStatus = viewModel?.status ?? "error";
		status.textContent = viewModel?.status ?? "error";
		region.append(heading, status);

		if (viewModel?.status !== "projected") {
			const empty = documentRef.createElement("p");
			empty.dataset.longitudinalProfileEmpty = "";
			empty.textContent =
				viewModel?.status === "absent"
					? "No persisted vertical profile"
					: String(
							viewModel?.error?.message ??
								"Longitudinal profile unavailable"
						);
			region.append(empty);
			this.#host.replaceChildren(region);
			return region;
		}
		const domainEvidenceIsFinite =
			Number.isFinite(viewModel.domain?.startS) &&
			Number.isFinite(viewModel.domain?.endS);
		const parameterKindIsCompatible =
			!("parameterKind" in (viewModel.domain ?? {})) ||
			viewModel.domain.parameterKind === "intrinsic-s";
		const extentEvidenceIsFinite =
			Number.isFinite(viewModel.elevationExtent?.min) &&
			Number.isFinite(viewModel.elevationExtent?.max);
		const boundaryEvidenceIsFinite =
			Array.isArray(viewModel.boundaries) &&
			viewModel.boundaries.every(Number.isFinite);
		if (
			!domainEvidenceIsFinite ||
			!parameterKindIsCompatible ||
			!extentEvidenceIsFinite ||
			!boundaryEvidenceIsFinite
		) {
			const unavailable = documentRef.createElement("p");
			unavailable.dataset.longitudinalProfileEmpty = "";
			unavailable.textContent = "Longitudinal profile unavailable";
			region.append(unavailable);
			this.#host.replaceChildren(region);
			return region;
		}

		const svg = svgElement(documentRef, "svg");
		setAttributes(svg, {
			viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
			role: "img",
			"aria-label": `Longitudinal profile from s ${viewModel.domain.startS} to ${viewModel.domain.endS}`,
		});
		svg.dataset.longitudinalProfilePlot = "";
		const minElevation = viewModel.elevationExtent.min;
		const maxElevation = viewModel.elevationExtent.max;
		const x = (s) =>
			scale(
				s,
				viewModel.domain.startS,
				viewModel.domain.endS,
				MARGIN,
				WIDTH - MARGIN
			);
		const y = (elevation) =>
			scale(
				elevation,
				minElevation,
				maxElevation,
				HEIGHT - MARGIN,
				MARGIN
			);

		const horizontalAxis = svgElement(documentRef, "line");
		horizontalAxis.dataset.longitudinalHorizontalAxis = "";
		setAttributes(horizontalAxis, {
			x1: MARGIN,
			x2: WIDTH - MARGIN,
			y1: HEIGHT - MARGIN,
			y2: HEIGHT - MARGIN,
			stroke: "currentColor",
			"aria-label": "intrinsic-s axis",
		});
		svg.append(horizontalAxis);
		const verticalAxis = svgElement(documentRef, "line");
		verticalAxis.dataset.longitudinalVerticalAxis = "";
		setAttributes(verticalAxis, {
			x1: MARGIN,
			x2: MARGIN,
			y1: MARGIN,
			y2: HEIGHT - MARGIN,
			stroke: "currentColor",
			"aria-label": "elevation [m] axis",
		});
		svg.append(verticalAxis);

		appendSvgText(
			svg,
			documentRef,
			"intrinsic-s",
			{ x: WIDTH / 2, y: HEIGHT - 2, "text-anchor": "middle" },
			{ longitudinalHorizontalAxisLabel: "" }
		);
		appendSvgText(
			svg,
			documentRef,
			"elevation [m]",
			{ x: 2, y: 14 },
			{ longitudinalVerticalAxisLabel: "" }
		);
		appendSvgText(
			svg,
			documentRef,
			viewModel.domain.startS,
			{ x: MARGIN, y: HEIGHT - MARGIN + 12, "text-anchor": "start" },
			{ longitudinalDomainStart: "" }
		);
		appendSvgText(
			svg,
			documentRef,
			viewModel.domain.endS,
			{
				x: WIDTH - MARGIN,
				y: HEIGHT - MARGIN + 12,
				"text-anchor": "end",
			},
			{ longitudinalDomainEnd: "" }
		);
		appendSvgText(
			svg,
			documentRef,
			minElevation,
			{ x: MARGIN + 4, y: y(minElevation), "text-anchor": "start" },
			{ longitudinalElevationMin: "" }
		);
		appendSvgText(
			svg,
			documentRef,
			maxElevation,
			{ x: MARGIN + 4, y: y(maxElevation), "text-anchor": "start" },
			{ longitudinalElevationMax: "" }
		);
		const labelledBoundaries = [];
		for (const boundary of viewModel.boundaries) {
			if (labelledBoundaries.some((value) => Object.is(value, boundary))) {
				continue;
			}
			labelledBoundaries.push(boundary);
			appendSvgText(
				svg,
				documentRef,
				boundary,
				{ x: x(boundary), y: MARGIN - 5, "text-anchor": "middle" },
				{ longitudinalBoundaryLabel: String(boundary) }
			);
		}

		let hitTarget = null;
		if (this.#onCursorSelect) {
			hitTarget = svgElement(documentRef, "rect");
			hitTarget.dataset.longitudinalCursorHitTarget = "";
			setAttributes(hitTarget, {
				x: MARGIN,
				y: MARGIN,
				width: WIDTH - 2 * MARGIN,
				height: HEIGHT - 2 * MARGIN,
				fill: "transparent",
				role: "button",
				"aria-label": "Select shared intrinsic-s cursor",
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
		path.dataset.longitudinalProfilePath = "";
		setAttributes(path, {
			points: viewModel.samples
				.map((sample) => `${x(sample.s)},${y(sample.elevation)}`)
				.join(" "),
			fill: "none",
			stroke: "currentColor",
			"stroke-width": 2,
		});
		svg.append(path);

		const elementGroups = groupConsecutiveElementSamples(viewModel.samples);
		const cursorElementId = viewModel.cursor?.elementId;
		const hasCursorElementId =
			cursorElementId !== null &&
			cursorElementId !== undefined &&
			String(cursorElementId).length > 0;
		const cursorElementIsKnown =
			viewModel.cursor.status === "evaluated" &&
			hasCursorElementId &&
			elementGroups.some(
				(group) =>
					group.elementId !== null &&
					group.elementId !== undefined &&
					Object.is(group.elementId, cursorElementId)
			);

		for (const [index, group] of elementGroups.entries()) {
			if (group.elementId === null || group.elementId === undefined) {
				continue;
			}
			const segment = svgElement(documentRef, "polyline");
			segment.dataset.longitudinalElementSegment = String(group.elementId);
			const active =
				cursorElementIsKnown && Object.is(group.elementId, cursorElementId);
			segment.dataset.longitudinalElementActive = String(active);
			setAttributes(segment, {
				points: group.samples
					.map(
						(sample) => `${x(sample.s)},${y(sample.elevation)}`
					)
					.join(" "),
				fill: "none",
				stroke: "currentColor",
				"stroke-width": active ? 6 : 3,
				"stroke-opacity": active ? 1 : 0.35,
				role: "img",
				"aria-label": `${
					active ? "Active " : ""
				}vertical element ${group.elementId}, segment ${index + 1}`,
			});
			svg.append(segment);
			const anchor = group.samples[0];
			const labelX = x(anchor?.s);
			const labelY = y(anchor?.elevation);
			if (
				Number.isFinite(anchor?.s) &&
				Number.isFinite(anchor?.elevation) &&
				Number.isFinite(labelX) &&
				Number.isFinite(labelY)
			) {
				const label = appendSvgText(
					svg,
					documentRef,
					group.elementId,
					{ x: labelX + 6, y: labelY - 8, "text-anchor": "start" },
					{
						longitudinalElementLabel: String(group.elementId),
						longitudinalElementLabelActive: String(active),
					}
				);
				label.setAttribute(
					"aria-label",
					`${active ? "Active " : ""}vertical element label ${group.elementId}`
				);
			}
		}

		for (const boundary of viewModel.boundaries) {
			const marker = svgElement(documentRef, "line");
			marker.dataset.longitudinalBoundary = String(boundary);
			setAttributes(marker, {
				x1: x(boundary),
				x2: x(boundary),
				y1: MARGIN,
				y2: HEIGHT - MARGIN,
				stroke: "currentColor",
				"stroke-opacity": 0.3,
				"aria-label": `Element boundary s ${boundary}`,
			});
			svg.append(marker);
		}

		const cursorX = x(viewModel.cursor.s);
		const cursorY = y(viewModel.cursor.elevation);
		const cursorIsProjectable =
			viewModel.cursor.status === "evaluated" &&
			Number.isFinite(viewModel.cursor.s) &&
			Number.isFinite(viewModel.cursor.elevation) &&
			Number.isFinite(cursorX) &&
			Number.isFinite(cursorY);
		if (cursorIsProjectable) {
			const verticalGuide = svgElement(documentRef, "line");
			verticalGuide.dataset.longitudinalCursorVerticalGuide = "";
			setAttributes(verticalGuide, {
				x1: cursorX,
				x2: cursorX,
				y1: cursorY,
				y2: HEIGHT - MARGIN,
				stroke: "currentColor",
				"stroke-opacity": 0.45,
				"stroke-dasharray": "4 3",
				"aria-label": `Shared intrinsic-s cursor guide at ${viewModel.cursor.s}`,
			});
			const horizontalGuide = svgElement(documentRef, "line");
			horizontalGuide.dataset.longitudinalCursorHorizontalGuide = "";
			setAttributes(horizontalGuide, {
				x1: MARGIN,
				x2: cursorX,
				y1: cursorY,
				y2: cursorY,
				stroke: "currentColor",
				"stroke-opacity": 0.45,
				"stroke-dasharray": "4 3",
				"aria-label": `Shared elevation cursor guide at ${viewModel.cursor.elevation}`,
			});
			svg.append(verticalGuide, horizontalGuide);

			const cursor = svgElement(documentRef, "circle");
			cursor.dataset.longitudinalCursor = "";
			setAttributes(cursor, {
				cx: cursorX,
				cy: cursorY,
				r: 5,
				fill: "currentColor",
				role: "img",
				"aria-label": `Shared s cursor ${viewModel.cursor.s}, elevation ${viewModel.cursor.elevation}, gradient ${viewModel.cursor.gradient}`,
			});
			svg.append(cursor);
			const calloutFacesLeft = cursorX > WIDTH / 2;
			const calloutX = Math.max(
				MARGIN,
				Math.min(WIDTH - MARGIN, cursorX + (calloutFacesLeft ? -10 : 10))
			);
			const calloutY = Math.max(
				MARGIN,
				Math.min(HEIGHT - MARGIN, cursorY - 10)
			);
			const gradientIsFinite = Number.isFinite(viewModel.cursor.gradient);
			const gradientText = gradientIsFinite
				? ` · gradient ${viewModel.cursor.gradient}`
				: "";
			const callout = appendSvgText(
				svg,
				documentRef,
				`s ${viewModel.cursor.s} · elevation ${viewModel.cursor.elevation}${gradientText}`,
				{
					x: calloutX,
					y: calloutY,
					"text-anchor": calloutFacesLeft ? "end" : "start",
				},
				{ longitudinalCursorCallout: "" }
			);
			callout.setAttribute(
				"aria-label",
				`Shared cursor s ${viewModel.cursor.s}, elevation ${viewModel.cursor.elevation}${
					gradientIsFinite ? `, gradient ${viewModel.cursor.gradient}` : ""
				}`
			);
		}
		if (hitTarget) svg.append(hitTarget);
		region.append(svg);

		const activeElementEvidence = documentRef.createElement("p");
		activeElementEvidence.dataset.longitudinalActiveElement = "";
		activeElementEvidence.textContent = cursorElementIsKnown
			? `Active vertical element ${cursorElementId}`
			: "Active vertical element unknown / unavailable";
		region.append(activeElementEvidence);

		const inspector = documentRef.createElement("section");
		inspector.dataset.longitudinalElementInspector = "";
		inspector.setAttribute(
			"aria-label",
			"Active vertical element persisted definition"
		);
		const inspectorHeading = documentRef.createElement("h4");
		inspectorHeading.textContent = "Persisted vertical element definition";
		inspector.append(inspectorHeading);
		const definition = viewModel.activeElementDefinition;
		const definitionIsExact =
			cursorElementIsKnown &&
			definition &&
			Object.is(definition.id, cursorElementId);
		const terminalDefinition = Array.isArray(viewModel.elementDefinitions)
			? viewModel.elementDefinitions.at(-1)
			: null;
		const definitionIsTerminal =
			definitionIsExact &&
			terminalDefinition &&
			Object.is(terminalDefinition.id, definition.id);
		if (!definitionIsExact) {
			const unavailableDefinition = documentRef.createElement("p");
			unavailableDefinition.dataset.longitudinalElementDefinitionUnavailable =
				"";
			unavailableDefinition.textContent =
				"Vertical element definition unknown / unavailable";
			inspector.append(unavailableDefinition);
		} else {
			const fields = documentRef.createElement("dl");
			fields.dataset.longitudinalElementDefinition = String(definition.id);
			for (const [field, label] of INSPECTOR_FIELDS) {
				const term = documentRef.createElement("dt");
				term.textContent = label;
				const value = documentRef.createElement("dd");
				value.dataset.longitudinalElementField = field;
				value.textContent = Object.prototype.hasOwnProperty.call(
					definition,
					field
				)
					? String(definition[field])
					: "not-provided";
				fields.append(term, value);
			}
			inspector.append(fields);
		}
		region.append(inspector);

		this.#terminalParabolicEditStatusNode = null;
		this.#terminalParabolicDomainEditStatusNode = null;
		this.#terminalParabolicRemoveStatusNode = null;
		if (
			definitionIsExact &&
			definition.type === "parabolic" &&
			Number.isFinite(definition.gradientRate) &&
			this.#onTerminalParabolicGradientRate
		) {
			const form = documentRef.createElement("form");
			form.dataset.terminalParabolicGradientRateEdit = String(
				definition.id
			);
			form.setAttribute(
				"aria-label",
				`Edit terminal parabolic element ${definition.id}`
			);
			const identity = documentRef.createElement("strong");
			identity.dataset.terminalParabolicElementId = "";
			identity.textContent = `Element ${String(definition.id)}`;
			const label = documentRef.createElement("label");
			label.textContent = "Gradient rate";
			const input = documentRef.createElement("input");
			input.type = "number";
			input.step = "any";
			input.value = String(definition.gradientRate);
			input.dataset.terminalParabolicGradientRateInput = "";
			input.setAttribute(
				"aria-label",
				`Gradient rate for ${definition.id}`
			);
			label.append(input);
			const button = documentRef.createElement("button");
			button.type = "submit";
			button.textContent = "Apply gradient rate";
			button.dataset.terminalParabolicGradientRateApply = "";
			const editStatus = documentRef.createElement("strong");
			editStatus.dataset.terminalParabolicGradientRateStatus = "";
			editStatus.setAttribute("role", "status");
			editStatus.textContent = this.#terminalParabolicEditStatus;
			this.#terminalParabolicEditStatusNode = editStatus;
			form.onsubmit = (event) => {
				event?.preventDefault?.();
				void this.#onTerminalParabolicGradientRate({
					elementId: definition.id,
					gradientRate: input.value,
				});
			};
			form.append(identity, label, button, editStatus);
			region.append(form);
		}
		if (
			definitionIsTerminal &&
			definition.type === "parabolic" &&
			viewModel.elementDefinitions.length > 1 &&
			this.#onTerminalParabolicRemove
		) {
			const form = documentRef.createElement("form");
			form.dataset.terminalParabolicRemove = String(definition.id);
			form.setAttribute(
				"aria-label",
				`Remove terminal parabolic element ${definition.id}`
			);
			const identity = documentRef.createElement("strong");
			identity.dataset.terminalParabolicRemoveElementId = "";
			identity.textContent = `Element ${String(definition.id)}`;
			const button = documentRef.createElement("button");
			button.type = "submit";
			button.textContent = "Remove terminal parabolic element";
			button.dataset.terminalParabolicRemoveApply = "";
			const removeStatus = documentRef.createElement("strong");
			removeStatus.dataset.terminalParabolicRemoveStatus = "";
			removeStatus.setAttribute("role", "status");
			removeStatus.textContent = this.#terminalParabolicRemoveStatus;
			this.#terminalParabolicRemoveStatusNode = removeStatus;
			form.onsubmit = (event) => {
				event?.preventDefault?.();
				void this.#onTerminalParabolicRemove({
					elementId: definition.id,
				});
			};
			form.append(identity, button, removeStatus);
			region.append(form);
		}
		if (
			this.#terminalParabolicRemoveStatus &&
			!this.#terminalParabolicRemoveStatusNode
		) {
			const removeStatus = documentRef.createElement("strong");
			removeStatus.dataset.terminalParabolicRemoveStatus = "";
			removeStatus.setAttribute("role", "status");
			removeStatus.textContent = this.#terminalParabolicRemoveStatus;
			this.#terminalParabolicRemoveStatusNode = removeStatus;
			region.append(removeStatus);
		}
		if (
			definitionIsTerminal &&
			definition.type === "parabolic" &&
			Number.isFinite(definition.endS) &&
			this.#onTerminalParabolicEndS
		) {
			const form = documentRef.createElement("form");
			form.dataset.terminalParabolicDomainEdit = String(definition.id);
			form.setAttribute(
				"aria-label",
				`Edit terminal parabolic domain ${definition.id}`
			);
			const identity = documentRef.createElement("strong");
			identity.dataset.terminalParabolicDomainElementId = "";
			identity.textContent = `Element ${String(definition.id)}`;
			const label = documentRef.createElement("label");
			label.textContent = "End s";
			const input = documentRef.createElement("input");
			input.type = "number";
			input.step = "any";
			input.value = String(definition.endS);
			input.dataset.terminalParabolicEndSInput = "";
			input.setAttribute("aria-label", `End s for ${definition.id}`);
			label.append(input);
			const button = documentRef.createElement("button");
			button.type = "submit";
			button.textContent = "Apply end s";
			button.dataset.terminalParabolicEndSApply = "";
			const editStatus = documentRef.createElement("strong");
			editStatus.dataset.terminalParabolicDomainEditStatus = "";
			editStatus.setAttribute("role", "status");
			editStatus.textContent =
				this.#terminalParabolicDomainEditStatus;
			this.#terminalParabolicDomainEditStatusNode = editStatus;
			form.onsubmit = (event) => {
				event?.preventDefault?.();
				void this.#onTerminalParabolicEndS({
					elementId: definition.id,
					endS: input.value,
				});
			};
			form.append(identity, label, button, editStatus);
			region.append(form);
		}

		const cursorEvidence = documentRef.createElement("p");
		cursorEvidence.dataset.longitudinalCursorEvidence = "";
		cursorEvidence.textContent =
			viewModel.cursor.status === "evaluated"
				? `Shared s=${viewModel.cursor.s} · elevation=${viewModel.cursor.elevation} m · gradient=${viewModel.cursor.gradient} m/m`
				: `Shared s=${viewModel.cursor.s} · not-covered`;
		region.append(cursorEvidence);
		this.#host.replaceChildren(region);
		return region;
	}
}

export default AlignmentLongitudinalProfileView;
