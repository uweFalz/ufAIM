function appendProjectionSection(documentRef, root, label, value) {
	const section = documentRef.createElement("section");
	section.dataset.profileSection = label;

	const heading = documentRef.createElement("h3");
	heading.textContent = label;
	section.append(heading);

	const content = documentRef.createElement("pre");
	content.textContent = JSON.stringify(value, null, 2);
	section.append(content);
	root.append(section);
}

const LANE_LABELS = Object.freeze({ vertical: "Vertical / Gradiente", chainage: "Chainage / Stationierung", cant: "Überhöhung / Cant" });
function laneForNode(node) {
	const explicit = String(node?.dataset?.profileSection ?? "").toLowerCase();
	if (["vertical", "chainage", "cant"].includes(explicit)) return explicit;
	const keys = Object.keys(node?.dataset ?? {}).join(" ").toLowerCase();
	if (keys.includes("chainage")) return "chainage";
	if (keys.includes("cant") || keys.includes("crosslevel")) return "cant";
	if (keys.includes("vertical") || keys.includes("parabolic")) return "vertical";
	return null;
}
function assembleLongitudinalSurface(documentRef, root, viewModel) {
	const original = Array.from(root.children ?? []);
	const surface = documentRef.createElement("section"); surface.dataset.longitudinalDesignSurface = "";
	surface.dataset.alignmentId = viewModel.alignmentId; surface.dataset.cursorS = String(viewModel?.cursor?.s ?? 0);
	for (const id of ["vertical", "chainage", "cant"]) {
		const lane = documentRef.createElement("section"); lane.dataset.longitudinalDesignLane = id; lane.tabIndex = -1;
		const coverage = viewModel?.laneCoverage?.[id] ?? { status: "not-covered", elementCount: 0, domain: null, value: null, provenancePresent: false };
		lane.dataset.laneStatus = coverage.status; lane.dataset.laneProvenance = coverage.provenancePresent ? "present" : "absent";
		const header = documentRef.createElement("header");
		const title = documentRef.createElement("h3"); title.textContent = LANE_LABELS[id];
		const summary = documentRef.createElement("p"); summary.dataset.longitudinalLaneSummary = "";
		summary.textContent = `${coverage.status} · ${coverage.elementCount} Elemente${coverage.mappingCount !== undefined ? ` · ${coverage.mappingCount} Mappings` : ""}${coverage.domain ? ` · s ${coverage.domain.startS}…${coverage.domain.endS}` : " · Domain nicht belegt"} · Provenienz ${coverage.provenancePresent ? "vorhanden" : "nicht belegt"}`;
		const current = documentRef.createElement("pre"); current.dataset.longitudinalLaneCurrent = ""; current.textContent = JSON.stringify(coverage.value ?? { status: coverage.status }, null, 2);
		header.append(title, summary); lane.append(header, current);
		for (const node of original.filter((entry) => laneForNode(entry) === id)) lane.append(node);
		surface.append(lane);
	}
	root.replaceChildren(surface);
	return surface;
}

export class AlignmentProfileSynchronizedView {
	#host;
	#onBasicVerticalSubmit = null;
	#authoringStatus = null;
	#onParabolicPreview = null;
	#onParabolicAppend = null;
	#parabolicDerivedStart = null;
	#parabolicStatus = null;
	#onTerminalParabolicCompositeEdit = null;
	#terminalParabolicCompositeEditStatus = null;
	#onBasicChainageSubmit = null;
	#chainageAuthoringStatus = null;
	#onChainageSegmentAppend = null;
	#chainageSegmentAppendStatus = null;
	#onTerminalChainageAddressEdit = null;
	#terminalChainageAddressEditStatus = null;
	#onTerminalChainageDirectionEdit = null;
	#terminalChainageDirectionEditStatus = null;
	#onTerminalChainageDomainEdit = null;
	#terminalChainageDomainEditStatus = null;
	#onTerminalChainageCompositeEdit = null;
	#terminalChainageCompositeEditStatus = null;
	#onTerminalChainageRemove = null;
	#terminalChainageRemoveStatus = null;
	#onBasicCantSubmit = null;
	#cantAuthoringStatus = null;
	#onLinearCantSubmit = null;
	#linearCantStatus = null;
	#onTerminalLinearCantRateSubmit = null;
	#terminalLinearCantRateStatus = null;
	#onTerminalCantRemove = null;
	#terminalCantRemoveStatus = null;
	#onTerminalConstantCantSubmit = null;
	#terminalConstantCantStatus = null;
	#onTerminalConstantCantDomainSubmit = null;
	#terminalConstantCantDomainStatus = null;
	#onTerminalLinearCantDomainSubmit = null;
	#terminalLinearCantDomainStatus = null;
	#onTerminalLinearCantCompositeSubmit = null;
	#terminalLinearCantCompositeStatus = null;
	#onChainageLookup = null;
	#onChainageCandidateUse = null;
	#chainageLookupStatus = null;
	#chainageLookupResult = null;
	#chainageUseCandidate = null;
	#focusedLane = null;
	#onCrossViewElementSelection = null;
	setCrossViewElementSelectionHandler(handler) { this.#onCrossViewElementSelection = typeof handler === "function" ? handler : null; }

	constructor({ host } = {}) {
		if (
			!host ||
			typeof host.replaceChildren !== "function" ||
			!host.ownerDocument ||
			typeof host.ownerDocument.createElement !== "function"
		) {
			throw new TypeError(
				"AlignmentProfileSynchronizedView requires a DOM host"
			);
		}
		this.#host = host;
	}

	setBasicVerticalAuthoringHandler(onSubmit) {
		if (typeof onSubmit !== "function") {
			throw new TypeError(
				"basic vertical authoring requires an onSubmit handler"
			);
		}
		this.#onBasicVerticalSubmit = onSubmit;
	}

	renderBasicVerticalAuthoringStatus(value) {
		if (this.#authoringStatus) {
			this.#authoringStatus.textContent = String(value ?? "");
		}
	}

	setParabolicGradientChangeHandlers({ onPreview, onAppend } = {}) {
		if (
			typeof onPreview !== "function" ||
			typeof onAppend !== "function"
		) {
			throw new TypeError(
				"parabolic gradient change requires preview and append handlers"
			);
		}
		this.#onParabolicPreview = onPreview;
		this.#onParabolicAppend = onAppend;
	}

	renderParabolicGradientChangeStart(value) {
		if (this.#parabolicDerivedStart) {
			this.#parabolicDerivedStart.textContent = JSON.stringify(
				value ?? { status: "unavailable" },
				null,
				2
			);
		}
	}

	renderParabolicGradientChangeStatus(value) {
		if (this.#parabolicStatus) {
			this.#parabolicStatus.textContent = String(value ?? "");
		}
	}

	setTerminalParabolicCompositeEditHandler(onSubmit) {
		if (typeof onSubmit !== "function") throw new TypeError("terminal parabolic composite edit requires an onSubmit handler");
		this.#onTerminalParabolicCompositeEdit = onSubmit;
	}

	renderTerminalParabolicCompositeEditStatus(value) {
		if (this.#terminalParabolicCompositeEditStatus) this.#terminalParabolicCompositeEditStatus.textContent = String(value ?? "");
	}

	setBasicChainageHandler(onSubmit) {
		if (typeof onSubmit !== "function") {
			throw new TypeError(
				"basic chainage mapping requires an onSubmit handler"
			);
		}
		this.#onBasicChainageSubmit = onSubmit;
	}

	renderBasicChainageStatus(value) {
		if (this.#chainageAuthoringStatus) {
			this.#chainageAuthoringStatus.textContent = String(value ?? "");
		}
	}

	setChainageSegmentAppendHandler(onSubmit) {
		if (typeof onSubmit !== "function") {
			throw new TypeError("chainage segment append requires an onSubmit handler");
		}
		this.#onChainageSegmentAppend = onSubmit;
	}

	renderChainageSegmentAppendStatus(value) {
		if (this.#chainageSegmentAppendStatus) {
			this.#chainageSegmentAppendStatus.textContent = String(value ?? "");
		}
	}

	setTerminalChainageAddressEditHandler(onSubmit) {
		if (typeof onSubmit !== "function") {
			throw new TypeError("terminal chainage address edit requires an onSubmit handler");
		}
		this.#onTerminalChainageAddressEdit = onSubmit;
	}

	renderTerminalChainageAddressEditStatus(value) {
		if (this.#terminalChainageAddressEditStatus) {
			this.#terminalChainageAddressEditStatus.textContent = String(value ?? "");
		}
	}

	setTerminalChainageDirectionEditHandler(onSubmit) {
		if (typeof onSubmit !== "function") throw new TypeError("terminal chainage direction edit requires an onSubmit handler");
		this.#onTerminalChainageDirectionEdit = onSubmit;
	}

	renderTerminalChainageDirectionEditStatus(value) {
		if (this.#terminalChainageDirectionEditStatus) this.#terminalChainageDirectionEditStatus.textContent = String(value ?? "");
	}

	setTerminalChainageDomainEditHandler(onSubmit) {
		if (typeof onSubmit !== "function") throw new TypeError("terminal chainage domain edit requires an onSubmit handler");
		this.#onTerminalChainageDomainEdit = onSubmit;
	}

	renderTerminalChainageDomainEditStatus(value) {
		if (this.#terminalChainageDomainEditStatus) this.#terminalChainageDomainEditStatus.textContent = String(value ?? "");
	}

	setTerminalChainageCompositeEditHandler(onSubmit) {
		if (typeof onSubmit !== "function") throw new TypeError("terminal chainage composite edit requires an onSubmit handler");
		this.#onTerminalChainageCompositeEdit = onSubmit;
	}

	renderTerminalChainageCompositeEditStatus(value) {
		if (this.#terminalChainageCompositeEditStatus) this.#terminalChainageCompositeEditStatus.textContent = String(value ?? "");
	}

	setTerminalChainageRemoveHandler(onSubmit) {
		if (typeof onSubmit !== "function") throw new TypeError("terminal chainage removal requires an onSubmit handler");
		this.#onTerminalChainageRemove = onSubmit;
	}

	renderTerminalChainageRemoveStatus(value) {
		if (this.#terminalChainageRemoveStatus) this.#terminalChainageRemoveStatus.textContent = String(value ?? "");
	}

	setBasicCantHandler(onSubmit) {
		if (typeof onSubmit !== "function") {
			throw new TypeError(
				"basic Cant authoring requires an onSubmit handler"
			);
		}
		this.#onBasicCantSubmit = onSubmit;
	}

	renderBasicCantStatus(value) {
		if (this.#cantAuthoringStatus) {
			this.#cantAuthoringStatus.textContent = String(value ?? "");
		}
	}

	setLinearCantHandler(onSubmit) {
		if (typeof onSubmit !== "function") {
			throw new TypeError("linear Cant authoring requires an onSubmit handler");
		}
		this.#onLinearCantSubmit = onSubmit;
	}

	renderLinearCantStatus(value) {
		if (this.#linearCantStatus) {
			this.#linearCantStatus.textContent = String(value ?? "");
		}
	}

	setTerminalLinearCantRateHandler(onSubmit) {
		if (typeof onSubmit !== "function") {
			throw new TypeError("terminal linear Cant editing requires an onSubmit handler");
		}
		this.#onTerminalLinearCantRateSubmit = onSubmit;
	}

	renderTerminalLinearCantRateStatus(value) {
		if (this.#terminalLinearCantRateStatus) {
			this.#terminalLinearCantRateStatus.textContent = String(value ?? "");
		}
	}

	setTerminalCantRemoveHandler(onSubmit) {
		if (typeof onSubmit !== "function") throw new TypeError("terminal Cant removal requires an onSubmit handler");
		this.#onTerminalCantRemove = onSubmit;
	}

	renderTerminalCantRemoveStatus(value) {
		if (this.#terminalCantRemoveStatus) this.#terminalCantRemoveStatus.textContent = String(value ?? "");
	}

	setTerminalConstantCantHandler(onSubmit) {
		if (typeof onSubmit !== "function") throw new TypeError("terminal constant Cant editing requires an onSubmit handler");
		this.#onTerminalConstantCantSubmit = onSubmit;
	}

	renderTerminalConstantCantStatus(value) {
		if (this.#terminalConstantCantStatus) this.#terminalConstantCantStatus.textContent = String(value ?? "");
	}

	setTerminalConstantCantDomainHandler(onSubmit) {
		if (typeof onSubmit !== "function") throw new TypeError("terminal constant Cant domain editing requires an onSubmit handler");
		this.#onTerminalConstantCantDomainSubmit = onSubmit;
	}

	renderTerminalConstantCantDomainStatus(value) {
		if (this.#terminalConstantCantDomainStatus) this.#terminalConstantCantDomainStatus.textContent = String(value ?? "");
	}

	setTerminalLinearCantDomainHandler(onSubmit) {
		if (typeof onSubmit !== "function") throw new TypeError("terminal linear Cant domain editing requires an onSubmit handler");
		this.#onTerminalLinearCantDomainSubmit = onSubmit;
	}

	renderTerminalLinearCantDomainStatus(value) {
		if (this.#terminalLinearCantDomainStatus) this.#terminalLinearCantDomainStatus.textContent = String(value ?? "");
	}

	setTerminalLinearCantCompositeHandler(onSubmit) {
		if (typeof onSubmit !== "function") throw new TypeError("terminal linear Cant composite edit requires an onSubmit handler");
		this.#onTerminalLinearCantCompositeSubmit = onSubmit;
	}

	renderTerminalLinearCantCompositeStatus(value) {
		if (this.#terminalLinearCantCompositeStatus) this.#terminalLinearCantCompositeStatus.textContent = String(value ?? "");
	}

	setChainageAddressLookupHandlers({ onLookup, onUseCandidate } = {}) {
		if (typeof onLookup !== "function" || typeof onUseCandidate !== "function") {
			throw new TypeError("chainage address lookup requires lookup and candidate handlers");
		}
		this.#onChainageLookup = onLookup;
		this.#onChainageCandidateUse = onUseCandidate;
	}

	renderChainageAddressLookup(value) {
		if (!this.#chainageLookupStatus || !this.#chainageLookupResult) return;
		this.#chainageLookupStatus.textContent = String(value?.status ?? "unavailable");
		this.#chainageLookupResult.textContent = JSON.stringify(value ?? { status: "unavailable" }, null, 2);
		if (this.#chainageUseCandidate) {
			this.#chainageUseCandidate.disabled = value?.status !== "unique" || value?.candidates?.length !== 1;
		}
	}

	focusLane(lane) {
		const id = ["vertical", "chainage", "cant"].includes(lane) ? lane : null;
		if (!id) return false;
		const target = this.#host.querySelector?.(`[data-longitudinal-design-lane="${id}"]`);
		if (!target) return false;
		for (const candidate of this.#host.querySelectorAll?.("[data-longitudinal-design-lane]") ?? []) candidate.dataset.laneFocused = "false";
		target.dataset.laneFocused = "true"; this.#focusedLane = id;
		target.scrollIntoView?.({ behavior: "smooth", block: "start" }); target.focus?.({ preventScroll: true });
		return true;
	}

	render(viewModel) {
		if (!viewModel || typeof viewModel !== "object") {
			throw new TypeError(
				"AlignmentProfileSynchronizedView.render requires a view model"
			);
		}
		const documentRef = this.#host.ownerDocument;
		const root = documentRef.createElement("article");
		root.dataset.alignmentProfile = viewModel.alignmentId;
		root.dataset.profilePresence =
			viewModel.profileStatePresence;

		appendProjectionSection(
			documentRef,
			root,
			"vertical",
			viewModel.vertical
		);
		appendProjectionSection(
			documentRef,
			root,
			"chainage",
			viewModel.chainage
		);
		appendProjectionSection(
			documentRef,
			root,
			"cant",
			viewModel.cant
		);

		if (this.#onBasicVerticalSubmit) {
			const details = documentRef.createElement("details");
			details.dataset.basicVerticalProfile = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Basic vertical profile";
			details.append(summary);

			const fields = [
				["Segment ID", "segmentId", ""],
				["Start s", "startS", ""],
				["End s", "endS", ""],
				["Start elevation [m]", "startElevation", ""],
				["Gradient [m/m]", "gradient", ""],
			];
			const inputs = {};
			for (const [labelText, name, value] of fields) {
				const label = documentRef.createElement("label");
				label.textContent = labelText;
				const input = documentRef.createElement("input");
				input.name = name;
				input.value = value;
				input.type = name === "segmentId" ? "text" : "number";
				label.append(input);
				details.append(label);
				inputs[name] = input;
			}
			const submit = documentRef.createElement("button");
			submit.type = "button";
			submit.textContent = "Save vertical profile";
			this.#authoringStatus = documentRef.createElement("strong");
			this.#authoringStatus.dataset.basicVerticalStatus = "";
			submit.onclick = () => {
				void this.#onBasicVerticalSubmit({
					segmentId: inputs.segmentId.value,
					startS: inputs.startS.value,
					endS: inputs.endS.value,
					startElevation: inputs.startElevation.value,
					gradient: inputs.gradient.value,
				});
			};
			details.append(submit, this.#authoringStatus);
			root.append(details);
		}

		if (this.#onParabolicPreview && this.#onParabolicAppend) {
			const details = documentRef.createElement("details");
			details.dataset.parabolicGradientChange = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Parabolic gradient change";
			details.append(summary);

			const derivedLabel = documentRef.createElement("strong");
			derivedLabel.textContent =
				"Derived canonical start conditions";
			this.#parabolicDerivedStart =
				documentRef.createElement("pre");
			this.#parabolicDerivedStart.dataset.parabolicDerivedStart =
				"";
			this.#parabolicDerivedStart.textContent =
				JSON.stringify({ status: "unavailable" }, null, 2);
			details.append(
				derivedLabel,
				this.#parabolicDerivedStart
			);

			const fields = [
				["Element ID", "elementId", ""],
				["End s", "endS", ""],
				["Gradient rate [1/m]", "gradientRate", ""],
			];
			const inputs = {};
			for (const [labelText, name, value] of fields) {
				const label = documentRef.createElement("label");
				label.textContent = labelText;
				const input = documentRef.createElement("input");
				input.name = name;
				input.value = value;
				input.type = name === "elementId" ? "text" : "number";
				label.append(input);
				details.append(label);
				inputs[name] = input;
			}
			const append = documentRef.createElement("button");
			append.type = "button";
			append.textContent = "Append parabolic gradient change";
			this.#parabolicStatus =
				documentRef.createElement("strong");
			this.#parabolicStatus.dataset.parabolicGradientStatus = "";
			details.ontoggle = () => {
				if (details.open) void this.#onParabolicPreview();
			};
			append.onclick = () => {
				void this.#onParabolicAppend({
					elementId: inputs.elementId.value,
					endS: inputs.endS.value,
					gradientRate: inputs.gradientRate.value,
				});
			};
			details.append(append, this.#parabolicStatus);
			root.append(details);
		}

		if (this.#onTerminalParabolicCompositeEdit && viewModel.terminalParabolicVerticalElement?.type === "parabolic") {
			const element = viewModel.terminalParabolicVerticalElement;
			const details = documentRef.createElement("details"); details.dataset.terminalParabolicCompositeEdit = "";
			const summary = documentRef.createElement("summary"); summary.textContent = "Edit terminal parabolic fields";
			const identity = documentRef.createElement("pre"); identity.dataset.terminalParabolicCompositeIdentity = "";
			identity.textContent = JSON.stringify({ elementId: element.id, type: element.type, startS: element.startS, endS: element.endS, startElevation: element.startElevation, startGradient: element.startGradient, gradientRate: element.gradientRate }, null, 2);
			const rateLabel = documentRef.createElement("label"); rateLabel.textContent = "Gradient rate";
			const rate = documentRef.createElement("input"); rate.name = "terminalParabolicCompositeGradientRate"; rate.type = "number"; rate.value = String(element.gradientRate); rateLabel.append(rate);
			const endLabel = documentRef.createElement("label"); endLabel.textContent = "End s";
			const end = documentRef.createElement("input"); end.name = "terminalParabolicCompositeEndS"; end.type = "number"; end.value = String(element.endS); endLabel.append(end);
			const submit = documentRef.createElement("button"); submit.type = "button"; submit.textContent = "Apply parabolic fields";
			this.#terminalParabolicCompositeEditStatus = documentRef.createElement("strong");
			this.#terminalParabolicCompositeEditStatus.dataset.terminalParabolicCompositeEditStatus = "";
			submit.onclick = () => void this.#onTerminalParabolicCompositeEdit({ elementId: element.id, gradientRate: rate.value, endS: end.value });
			details.append(summary, identity, rateLabel, endLabel, submit, this.#terminalParabolicCompositeEditStatus); root.append(details);
		}

		if (this.#onBasicChainageSubmit) {
			const details = documentRef.createElement("details");
			details.dataset.basicChainageMapping = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Basic chainage mapping";
			details.append(summary);

			const fields = [
				["Mapping ID", "mappingId", "text"],
				["Scheme ID", "schemeId", "text"],
				["Scheme version", "schemeVersion", "text"],
				["Segment ID", "segmentId", "text"],
				["Start s", "startS", "number"],
				["End s", "endS", "number"],
				["Start address", "startAddress", "number"],
			];
			const inputs = {};
			for (const [labelText, name, type] of fields) {
				const label = documentRef.createElement("label");
				label.textContent = labelText;
				const input = documentRef.createElement("input");
				input.name = name;
				input.type = type;
				input.value = "";
				label.append(input);
				details.append(label);
				inputs[name] = input;
			}

			const directionLabel = documentRef.createElement("label");
			directionLabel.textContent = "Direction";
			const direction = documentRef.createElement("select");
			direction.name = "direction";
			for (const [text, value] of [
				["Select direction", ""],
				["+1", "1"],
				["-1", "-1"],
			]) {
				const option = documentRef.createElement("option");
				option.textContent = text;
				option.value = value;
				direction.append(option);
			}
			direction.value = "";
			directionLabel.append(direction);
			details.append(directionLabel);

			const submit = documentRef.createElement("button");
			submit.type = "button";
			submit.textContent = "Save chainage mapping";
			this.#chainageAuthoringStatus = documentRef.createElement("strong");
			this.#chainageAuthoringStatus.dataset.basicChainageStatus = "";
			submit.onclick = () => {
				void this.#onBasicChainageSubmit({
					mappingId: inputs.mappingId.value,
					schemeId: inputs.schemeId.value,
					schemeVersion: inputs.schemeVersion.value,
					segmentId: inputs.segmentId.value,
					startS: inputs.startS.value,
					endS: inputs.endS.value,
					startAddress: inputs.startAddress.value,
					direction: direction.value,
				});
			};
			details.append(submit, this.#chainageAuthoringStatus);
			root.append(details);
		}

		if (
			this.#onChainageSegmentAppend &&
			viewModel.chainage?.status !== "absent"
		) {
			const details = documentRef.createElement("details");
			details.dataset.chainageSegmentAppend = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Append chainage segment";
			details.append(summary);
			const fields = [
				["Mapping ID", "appendMappingId", "text"],
				["Segment ID", "appendSegmentId", "text"],
				["Start s", "appendStartS", "number"],
				["End s", "appendEndS", "number"],
				["Start address", "appendStartAddress", "number"],
			];
			const inputs = {};
			for (const [labelText, name, type] of fields) {
				const label = documentRef.createElement("label");
				label.textContent = labelText;
				const input = documentRef.createElement("input");
				input.name = name;
				input.type = type;
				input.value = "";
				label.append(input);
				details.append(label);
				inputs[name] = input;
			}
			const directionLabel = documentRef.createElement("label");
			directionLabel.textContent = "Direction";
			const direction = documentRef.createElement("select");
			direction.name = "appendDirection";
			for (const [text, value] of [["Select direction", ""], ["+1", "1"], ["-1", "-1"]]) {
				const option = documentRef.createElement("option");
				option.textContent = text;
				option.value = value;
				direction.append(option);
			}
			direction.value = "";
			directionLabel.append(direction);
			details.append(directionLabel);
			const submit = documentRef.createElement("button");
			submit.type = "button";
			submit.textContent = "Append chainage segment";
			this.#chainageSegmentAppendStatus = documentRef.createElement("strong");
			this.#chainageSegmentAppendStatus.dataset.chainageSegmentAppendStatus = "";
			submit.onclick = () => void this.#onChainageSegmentAppend({
				mappingId: inputs.appendMappingId.value,
				segmentId: inputs.appendSegmentId.value,
				startS: inputs.appendStartS.value,
				endS: inputs.appendEndS.value,
				startAddress: inputs.appendStartAddress.value,
				direction: direction.value,
			});
			details.append(submit, this.#chainageSegmentAppendStatus);
			root.append(details);
		}

		if (
			this.#onTerminalChainageAddressEdit &&
			viewModel.chainage?.status !== "absent"
		) {
			const details = documentRef.createElement("details");
			details.dataset.terminalChainageAddressEdit = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Edit terminal chainage start address";
			details.append(summary);
			const fields = [
				["Mapping ID", "addressEditMappingId", "text"],
				["Terminal segment ID", "addressEditSegmentId", "text"],
				["Start address", "addressEditStartAddress", "number"],
			];
			const inputs = {};
			for (const [labelText, name, type] of fields) {
				const label = documentRef.createElement("label");
				label.textContent = labelText;
				const input = documentRef.createElement("input");
				input.name = name;
				input.type = type;
				input.value = "";
				label.append(input);
				details.append(label);
				inputs[name] = input;
			}
			const submit = documentRef.createElement("button");
			submit.type = "button";
			submit.textContent = "Apply terminal start address";
			this.#terminalChainageAddressEditStatus = documentRef.createElement("strong");
			this.#terminalChainageAddressEditStatus.dataset.terminalChainageAddressEditStatus = "";
			submit.onclick = () => void this.#onTerminalChainageAddressEdit({
				mappingId: inputs.addressEditMappingId.value,
				segmentId: inputs.addressEditSegmentId.value,
				startAddress: inputs.addressEditStartAddress.value,
			});
			details.append(submit, this.#terminalChainageAddressEditStatus);
			root.append(details);
		}

		if (this.#onTerminalChainageDirectionEdit && viewModel.chainage?.status !== "absent") {
			const details = documentRef.createElement("details");
			details.dataset.terminalChainageDirectionEdit = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Edit terminal chainage direction";
			details.append(summary);
			const inputs = {};
			for (const [labelText, name] of [["Mapping ID", "directionEditMappingId"], ["Terminal segment ID", "directionEditSegmentId"]]) {
				const label = documentRef.createElement("label"); label.textContent = labelText;
				const input = documentRef.createElement("input"); input.name = name; input.value = "";
				label.append(input); details.append(label); inputs[name] = input;
			}
			const directionLabel = documentRef.createElement("label"); directionLabel.textContent = "Direction";
			const direction = documentRef.createElement("select"); direction.name = "directionEditDirection";
			for (const [text, value] of [["Select direction", ""], ["+1", "1"], ["-1", "-1"]]) {
				const option = documentRef.createElement("option"); option.textContent = text; option.value = value; direction.append(option);
			}
			direction.value = ""; directionLabel.append(direction); details.append(directionLabel);
			const submit = documentRef.createElement("button"); submit.type = "button"; submit.textContent = "Apply terminal direction";
			this.#terminalChainageDirectionEditStatus = documentRef.createElement("strong");
			this.#terminalChainageDirectionEditStatus.dataset.terminalChainageDirectionEditStatus = "";
			submit.onclick = () => void this.#onTerminalChainageDirectionEdit({
				mappingId: inputs.directionEditMappingId.value,
				segmentId: inputs.directionEditSegmentId.value,
				direction: direction.value,
			});
			details.append(submit, this.#terminalChainageDirectionEditStatus); root.append(details);
		}

		if (this.#onTerminalChainageDomainEdit && viewModel.chainage?.status !== "absent") {
			const details = documentRef.createElement("details");
			details.dataset.terminalChainageDomainEdit = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Edit terminal chainage domain";
			details.append(summary);
			const inputs = {};
			for (const [labelText, name, type] of [
				["Mapping ID", "domainEditMappingId", "text"],
				["Terminal segment ID", "domainEditSegmentId", "text"],
				["End s", "domainEditEndS", "number"],
			]) {
				const label = documentRef.createElement("label"); label.textContent = labelText;
				const input = documentRef.createElement("input"); input.name = name; input.type = type; input.value = "";
				label.append(input); details.append(label); inputs[name] = input;
			}
			const submit = documentRef.createElement("button"); submit.type = "button"; submit.textContent = "Apply terminal chainage end s";
			this.#terminalChainageDomainEditStatus = documentRef.createElement("strong");
			this.#terminalChainageDomainEditStatus.dataset.terminalChainageDomainEditStatus = "";
			submit.onclick = () => void this.#onTerminalChainageDomainEdit({
				mappingId: inputs.domainEditMappingId.value,
				segmentId: inputs.domainEditSegmentId.value,
				endS: inputs.domainEditEndS.value,
			});
			details.append(submit, this.#terminalChainageDomainEditStatus); root.append(details);
		}

		if (this.#onTerminalChainageCompositeEdit && viewModel.chainage?.status !== "absent") {
			const details = documentRef.createElement("details"); details.dataset.terminalChainageCompositeEdit = "";
			const summary = documentRef.createElement("summary"); summary.textContent = "Edit terminal chainage segment fields"; details.append(summary);
			const inputs = {};
			for (const [labelText, name, type] of [
				["Mapping ID", "compositeEditMappingId", "text"],
				["Terminal segment ID", "compositeEditSegmentId", "text"],
				["Start address", "compositeEditStartAddress", "number"],
				["End s", "compositeEditEndS", "number"],
			]) {
				const label = documentRef.createElement("label"); label.textContent = labelText;
				const input = documentRef.createElement("input"); input.name = name; input.type = type; input.value = "";
				label.append(input); details.append(label); inputs[name] = input;
			}
			const directionLabel = documentRef.createElement("label"); directionLabel.textContent = "Direction";
			const direction = documentRef.createElement("select"); direction.name = "compositeEditDirection";
			for (const [text, value] of [["Select direction", ""], ["+1", "1"], ["-1", "-1"]]) {
				const option = documentRef.createElement("option"); option.textContent = text; option.value = value; direction.append(option);
			}
			direction.value = ""; directionLabel.append(direction); details.append(directionLabel);
			const submit = documentRef.createElement("button"); submit.type = "button"; submit.textContent = "Apply terminal segment fields";
			this.#terminalChainageCompositeEditStatus = documentRef.createElement("strong");
			this.#terminalChainageCompositeEditStatus.dataset.terminalChainageCompositeEditStatus = "";
			submit.onclick = () => void this.#onTerminalChainageCompositeEdit({
				mappingId: inputs.compositeEditMappingId.value,
				segmentId: inputs.compositeEditSegmentId.value,
				startAddress: inputs.compositeEditStartAddress.value,
				direction: direction.value,
				endS: inputs.compositeEditEndS.value,
			});
			details.append(submit, this.#terminalChainageCompositeEditStatus); root.append(details);
		}

		if (this.#onTerminalChainageRemove && viewModel.chainage?.status !== "absent") {
			const details = documentRef.createElement("details"); details.dataset.terminalChainageRemove = "";
			const summary = documentRef.createElement("summary"); summary.textContent = "Remove terminal chainage segment"; details.append(summary);
			const inputs = {};
			for (const [labelText, name] of [["Mapping ID", "removeMappingId"], ["Terminal segment ID", "removeSegmentId"]]) {
				const label = documentRef.createElement("label"); label.textContent = labelText;
				const input = documentRef.createElement("input"); input.name = name; input.value = ""; label.append(input); details.append(label); inputs[name] = input;
			}
			const submit = documentRef.createElement("button"); submit.type = "button"; submit.textContent = "Remove exact terminal segment";
			this.#terminalChainageRemoveStatus = documentRef.createElement("strong"); this.#terminalChainageRemoveStatus.dataset.terminalChainageRemoveStatus = "";
			submit.onclick = () => void this.#onTerminalChainageRemove({ mappingId: inputs.removeMappingId.value, segmentId: inputs.removeSegmentId.value });
			details.append(submit, this.#terminalChainageRemoveStatus); root.append(details);
		}

		if (this.#onBasicCantSubmit) {
			const details = documentRef.createElement("details");
			details.dataset.basicCantCrossLevel = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Basic constant cross-level";
			details.append(summary);

			const evidence = documentRef.createElement("pre");
			evidence.dataset.basicCantConvention = "";
			evidence.textContent = JSON.stringify({
				elementType: "constant-cross-level",
				quantity: "cross-level",
				unit: "alignment-length-unit",
				signConvention:
					"left-minus-right-viewed-in-increasing-s",
				scalarCrossLevelStatus: "partial-evidence",
				workingReference: "midpointGoverningRailEdges",
				pairedRails: "unknown",
				sourceReference: "unknown",
				["trans" + "formation"]: "not-performed",
			}, null, 2);
			details.append(evidence);

			const fields = [
				["Cant state ID", "cantStateId", "text"],
				["Element ID", "elementId", "text"],
				["Start s", "startS", "number"],
				["End s", "endS", "number"],
				["Start cross-level", "startCrossLevel", "number"],
			];
			const inputs = {};
			for (const [labelText, name, type] of fields) {
				const label = documentRef.createElement("label");
				label.textContent = labelText;
				const input = documentRef.createElement("input");
				input.name = name;
				input.type = type;
				input.value = "";
				label.append(input);
				details.append(label);
				inputs[name] = input;
			}
			const submit = documentRef.createElement("button");
			submit.type = "button";
			submit.textContent = "Save constant cross-level";
			this.#cantAuthoringStatus = documentRef.createElement("strong");
			this.#cantAuthoringStatus.dataset.basicCantStatus = "";
			submit.onclick = () => {
				void this.#onBasicCantSubmit({
					cantStateId: inputs.cantStateId.value,
					elementId: inputs.elementId.value,
					startS: inputs.startS.value,
					endS: inputs.endS.value,
					startCrossLevel: inputs.startCrossLevel.value,
				});
			};
			details.append(submit, this.#cantAuthoringStatus);
			root.append(details);
		}

		if (this.#onLinearCantSubmit && viewModel.cant?.status !== "absent") {
			const details = documentRef.createElement("details");
			details.dataset.linearCantElement = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Append linear cross-level";
			const evidence = documentRef.createElement("pre");
			evidence.dataset.linearCantConvention = "";
			evidence.textContent = JSON.stringify({
				elementType: "linear-cross-level",
				quantity: "cross-level",
				unit: "alignment-length-unit",
				signConvention: "left-minus-right-viewed-in-increasing-s",
				scalarCrossLevelStatus: "partial-evidence",
				workingReference: "midpointGoverningRailEdges",
				pairedRails: "unknown",
				sourceReference: "unknown",
				["trans" + "formation"]: "not-performed",
			}, null, 2);
			details.append(summary, evidence);
			const fields = [
				["Element ID", "linearCantElementId", "text"],
				["End s", "linearCantEndS", "number"],
				["Cross-level rate", "crossLevelRate", "number"],
			];
			const inputs = {};
			for (const [labelText, name, type] of fields) {
				const label = documentRef.createElement("label");
				label.textContent = labelText;
				const input = documentRef.createElement("input");
				input.name = name;
				input.type = type;
				input.value = "";
				label.append(input);
				details.append(label);
				inputs[name] = input;
			}
			const submit = documentRef.createElement("button");
			submit.type = "button";
			submit.textContent = "Append linear cross-level";
			this.#linearCantStatus = documentRef.createElement("strong");
			this.#linearCantStatus.dataset.linearCantStatus = "";
			submit.onclick = () => void this.#onLinearCantSubmit({
				elementId: inputs.linearCantElementId.value,
				endS: inputs.linearCantEndS.value,
				crossLevelRate: inputs.crossLevelRate.value,
			});
			details.append(submit, this.#linearCantStatus);
			root.append(details);
		}

		if (
			this.#onTerminalLinearCantRateSubmit &&
			viewModel.terminalLinearCantElement?.type === "linear-cross-level" &&
			Number.isFinite(viewModel.terminalLinearCantElement.crossLevelRate)
		) {
			const element = viewModel.terminalLinearCantElement;
			const details = documentRef.createElement("details");
			details.dataset.terminalLinearCantRateEdit = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Edit terminal linear cross-level rate";
			const identity = documentRef.createElement("pre");
			identity.dataset.terminalLinearCantIdentity = "";
			identity.textContent = JSON.stringify({
				elementId: element.id,
				type: element.type,
				startS: element.startS,
				endS: element.endS,
				crossLevelRate: element.crossLevelRate,
			}, null, 2);
			const label = documentRef.createElement("label");
			label.textContent = "Cross-level rate";
			const rate = documentRef.createElement("input");
			rate.name = "terminalLinearCantCrossLevelRate";
			rate.type = "number";
			rate.value = String(element.crossLevelRate);
			label.append(rate);
			const submit = documentRef.createElement("button");
			submit.type = "button";
			submit.textContent = "Apply cross-level rate";
			this.#terminalLinearCantRateStatus = documentRef.createElement("strong");
			this.#terminalLinearCantRateStatus.dataset.terminalLinearCantRateStatus = "";
			submit.onclick = () => void this.#onTerminalLinearCantRateSubmit({
				elementId: element.id,
				crossLevelRate: rate.value,
			});
			details.append(summary, identity, label, submit, this.#terminalLinearCantRateStatus);
			root.append(details);
		}

		if (this.#onTerminalCantRemove && viewModel.terminalCantElement) {
			const element = viewModel.terminalCantElement;
			const details = documentRef.createElement("details");
			details.dataset.terminalCantRemove = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Remove terminal Cant element";
			const identity = documentRef.createElement("pre");
			identity.dataset.terminalCantRemoveIdentity = "";
			identity.textContent = JSON.stringify({ elementId: element.id, type: element.type, startS: element.startS, endS: element.endS }, null, 2);
			const submit = documentRef.createElement("button");
			submit.type = "button";
			submit.textContent = "Remove exact terminal Cant element";
			this.#terminalCantRemoveStatus = documentRef.createElement("strong");
			this.#terminalCantRemoveStatus.dataset.terminalCantRemoveStatus = "";
			submit.onclick = () => void this.#onTerminalCantRemove({ elementId: element.id });
			details.append(summary, identity, submit, this.#terminalCantRemoveStatus);
			root.append(details);
		}

		if (this.#onTerminalConstantCantSubmit && viewModel.terminalCantElement?.type === "constant-cross-level" && Number.isFinite(viewModel.terminalCantElement.startCrossLevel)) {
			const element = viewModel.terminalCantElement;
			const details = documentRef.createElement("details");
			details.dataset.terminalConstantCantEdit = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Edit terminal constant cross-level";
			const identity = documentRef.createElement("pre");
			identity.dataset.terminalConstantCantIdentity = "";
			identity.textContent = JSON.stringify({ elementId: element.id, type: element.type, startS: element.startS, endS: element.endS, crossLevel: element.startCrossLevel }, null, 2);
			const label = documentRef.createElement("label");
			label.textContent = "Cross-level";
			const input = documentRef.createElement("input");
			input.name = "terminalConstantCantCrossLevel";
			input.type = "number";
			input.value = String(element.startCrossLevel);
			label.append(input);
			const submit = documentRef.createElement("button");
			submit.type = "button";
			submit.textContent = "Apply constant cross-level";
			this.#terminalConstantCantStatus = documentRef.createElement("strong");
			this.#terminalConstantCantStatus.dataset.terminalConstantCantStatus = "";
			submit.onclick = () => void this.#onTerminalConstantCantSubmit({ elementId: element.id, crossLevel: input.value });
			details.append(summary, identity, label, submit, this.#terminalConstantCantStatus);
			root.append(details);
		}

		if (this.#onTerminalConstantCantDomainSubmit && viewModel.terminalCantElement?.type === "constant-cross-level" && Number.isFinite(viewModel.terminalCantElement.endS)) {
			const element = viewModel.terminalCantElement;
			const details = documentRef.createElement("details");
			details.dataset.terminalConstantCantDomainEdit = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Edit terminal constant Cant domain";
			const identity = documentRef.createElement("pre");
			identity.dataset.terminalConstantCantDomainIdentity = "";
			identity.textContent = JSON.stringify({ elementId: element.id, type: element.type, startS: element.startS, endS: element.endS, crossLevel: element.startCrossLevel }, null, 2);
			const label = documentRef.createElement("label");
			label.textContent = "End s";
			const input = documentRef.createElement("input");
			input.name = "terminalConstantCantEndS";
			input.type = "number";
			input.value = String(element.endS);
			label.append(input);
			const submit = documentRef.createElement("button");
			submit.type = "button";
			submit.textContent = "Apply constant Cant end s";
			this.#terminalConstantCantDomainStatus = documentRef.createElement("strong");
			this.#terminalConstantCantDomainStatus.dataset.terminalConstantCantDomainStatus = "";
			submit.onclick = () => void this.#onTerminalConstantCantDomainSubmit({ elementId: element.id, endS: input.value });
			details.append(summary, identity, label, submit, this.#terminalConstantCantDomainStatus);
			root.append(details);
		}

		if (this.#onTerminalLinearCantDomainSubmit && viewModel.terminalCantElement?.type === "linear-cross-level" && Number.isFinite(viewModel.terminalCantElement.endS)) {
			const element = viewModel.terminalCantElement;
			const details = documentRef.createElement("details");
			details.dataset.terminalLinearCantDomainEdit = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Edit terminal linear Cant domain";
			const identity = documentRef.createElement("pre");
			identity.dataset.terminalLinearCantDomainIdentity = "";
			identity.textContent = JSON.stringify({ elementId: element.id, type: element.type, startS: element.startS, endS: element.endS, startCrossLevel: element.startCrossLevel, crossLevelRate: element.crossLevelRate }, null, 2);
			const label = documentRef.createElement("label");
			label.textContent = "End s";
			const input = documentRef.createElement("input");
			input.name = "terminalLinearCantEndS";
			input.type = "number";
			input.value = String(element.endS);
			label.append(input);
			const submit = documentRef.createElement("button");
			submit.type = "button";
			submit.textContent = "Apply linear Cant end s";
			this.#terminalLinearCantDomainStatus = documentRef.createElement("strong");
			this.#terminalLinearCantDomainStatus.dataset.terminalLinearCantDomainStatus = "";
			submit.onclick = () => void this.#onTerminalLinearCantDomainSubmit({ elementId: element.id, endS: input.value });
			details.append(summary, identity, label, submit, this.#terminalLinearCantDomainStatus);
			root.append(details);
		}

		if (this.#onTerminalLinearCantCompositeSubmit && viewModel.terminalCantElement?.type === "linear-cross-level" && Number.isFinite(viewModel.terminalCantElement.crossLevelRate) && Number.isFinite(viewModel.terminalCantElement.endS)) {
			const element = viewModel.terminalCantElement;
			const details = documentRef.createElement("details"); details.dataset.terminalLinearCantCompositeEdit = "";
			const summary = documentRef.createElement("summary"); summary.textContent = "Edit terminal linear Cant fields";
			const identity = documentRef.createElement("pre"); identity.dataset.terminalLinearCantCompositeIdentity = "";
			identity.textContent = JSON.stringify({ elementId: element.id, type: element.type, startS: element.startS, endS: element.endS, startCrossLevel: element.startCrossLevel, crossLevelRate: element.crossLevelRate }, null, 2);
			const rateLabel = documentRef.createElement("label"); rateLabel.textContent = "Cross-level rate";
			const rate = documentRef.createElement("input"); rate.name = "terminalLinearCantCompositeRate"; rate.type = "number"; rate.value = String(element.crossLevelRate); rateLabel.append(rate);
			const endLabel = documentRef.createElement("label"); endLabel.textContent = "End s";
			const end = documentRef.createElement("input"); end.name = "terminalLinearCantCompositeEndS"; end.type = "number"; end.value = String(element.endS); endLabel.append(end);
			const submit = documentRef.createElement("button"); submit.type = "button"; submit.textContent = "Apply linear Cant fields";
			this.#terminalLinearCantCompositeStatus = documentRef.createElement("strong"); this.#terminalLinearCantCompositeStatus.dataset.terminalLinearCantCompositeStatus = "";
			submit.onclick = () => void this.#onTerminalLinearCantCompositeSubmit({ elementId: element.id, crossLevelRate: rate.value, endS: end.value });
			details.append(summary, identity, rateLabel, endLabel, submit, this.#terminalLinearCantCompositeStatus); root.append(details);
		}

		if (this.#onChainageLookup && this.#onChainageCandidateUse) {
			const details = documentRef.createElement("details");
			details.dataset.chainageAddressLookup = "";
			const summary = documentRef.createElement("summary");
			summary.textContent = "Chainage address lookup";
			const mappingLabel = documentRef.createElement("label");
			mappingLabel.textContent = "Mapping ID";
			const mappingId = documentRef.createElement("input");
			mappingId.name = "lookupMappingId";
			mappingLabel.append(mappingId);
			const addressLabel = documentRef.createElement("label");
			addressLabel.textContent = "Address";
			const address = documentRef.createElement("input");
			address.name = "lookupAddress";
			address.type = "number";
			addressLabel.append(address);
			const lookup = documentRef.createElement("button");
			lookup.type = "button";
			lookup.textContent = "Lookup address";
			lookup.onclick = () => void this.#onChainageLookup({ mappingId: mappingId.value, address: address.value });
			const use = documentRef.createElement("button");
			use.type = "button";
			use.dataset.chainageUseCandidate = "";
			use.textContent = "Use candidate";
			use.disabled = true;
			this.#chainageUseCandidate = use;
			use.onclick = () => void this.#onChainageCandidateUse();
			this.#chainageLookupStatus = documentRef.createElement("strong");
			this.#chainageLookupStatus.dataset.chainageLookupStatus = "";
			this.#chainageLookupResult = documentRef.createElement("pre");
			this.#chainageLookupResult.dataset.chainageLookupResult = "";
			details.append(summary, mappingLabel, addressLabel, lookup, use, this.#chainageLookupStatus, this.#chainageLookupResult);
			root.append(details);
		}

		if (viewModel.laneCoverage) assembleLongitudinalSurface(documentRef, root, viewModel);
		if (viewModel.selectableElements) this.#renderCrossViewSelection(root, viewModel);
		this.#host.replaceChildren(root);
		if (this.#focusedLane) this.focusLane(this.#focusedLane);
		return root;
	}

	#renderCrossViewSelection(root, viewModel) {
		const documentRef = this.#host.ownerDocument;
		for (const lane of ["vertical", "chainage", "cant"]) {
			const host = root.querySelector?.(`[data-longitudinal-design-lane="${lane}"]`);
			if (!host) continue;
			const list = documentRef.createElement("div"); list.dataset.crossViewElementChoices = lane;
			for (const entry of viewModel.selectableElements?.[lane] ?? []) {
				if (!entry.elementId) continue;
				const button = documentRef.createElement("button"); button.type = "button"; button.dataset.crossViewElementId = entry.elementId; button.dataset.crossViewDiscipline = lane; button.textContent = `${entry.elementId} · ${entry.type} · ${String(entry.startS)}..${String(entry.endS)}`;
				const selected = viewModel.crossViewSelection?.primaryId === viewModel.alignmentId && viewModel.crossViewSelection?.elementDiscipline === lane && viewModel.crossViewSelection?.elementId === entry.elementId;
				button.dataset.selected = String(selected); button.setAttribute("aria-pressed", String(selected));
				button.onclick = () => this.#onCrossViewElementSelection?.({ discipline: lane, elementId: entry.elementId, s: Number.isFinite(entry.startS) ? entry.startS : null }); list.append(button);
			}
			host.append(list);
		}
	}
}

export default AlignmentProfileSynchronizedView;
