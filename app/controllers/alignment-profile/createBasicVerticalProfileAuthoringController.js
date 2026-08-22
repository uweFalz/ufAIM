import {
	appendVerticalElement,
	createVerticalConstructiveState,
	evaluateVerticalAt,
} from "../../../src/aim-core/alignment/profile/VerticalConstructiveState.js";

export class BasicVerticalProfileAuthoringError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "BasicVerticalProfileAuthoringError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) {
		throw new BasicVerticalProfileAuthoringError(
			"INVALID_BASIC_VERTICAL_PROFILE",
			`${label} must be a non-empty string`
		);
	}
	return id;
}

function finite(value, label) {
	const number = Number(value);
	if (!Number.isFinite(number)) {
		throw new BasicVerticalProfileAuthoringError(
			"INVALID_BASIC_VERTICAL_PROFILE",
			`${label} must be finite`
		);
	}
	return number;
}

function sameValue(left, right) {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		return (
			Array.isArray(left) &&
			Array.isArray(right) &&
			left.length === right.length &&
			left.every((entry, index) =>
				sameValue(entry, right[index])
			)
		);
	}
	if (
		!left ||
		!right ||
		typeof left !== "object" ||
		typeof right !== "object"
	) {
		return false;
	}
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	return (
		leftKeys.length === rightKeys.length &&
		leftKeys.every(
			(key, index) =>
				key === rightKeys[index] &&
				sameValue(left[key], right[key])
		)
	);
}

function validateProjection(projection, expected) {
	if (
		!projection ||
		projection.alignmentId !== expected.alignmentId ||
		!sameValue(projection.revision, expected.revision) ||
		projection.cursor?.parameterKind !== "intrinsic-s" ||
		!Object.is(projection.cursor?.s, expected.s)
	) {
		throw new BasicVerticalProfileAuthoringError(
			"PROFILE_READBACK_MISMATCH",
			"profile projection does not match the active Alignment context"
		);
	}
	return projection;
}

function profileStateMatches(snapshot, profileState) {
	return (
		snapshot?.presence === "present" &&
		sameValue(snapshot.vertical, profileState.vertical) &&
		sameValue(snapshot.cant, profileState.cant) &&
		sameValue(
			snapshot.chainageMappings,
			profileState.chainageMappings
		)
	);
}

function requirePersistedProfileState(
	profileState,
	expectedAlignmentId
) {
	if (
		!profileState ||
		typeof profileState !== "object" ||
		Array.isArray(profileState) ||
		!profileState.vertical ||
		profileState.vertical.alignmentId !== expectedAlignmentId ||
		!Array.isArray(profileState.vertical.elements) ||
		profileState.vertical.elements.length === 0 ||
		!Object.prototype.hasOwnProperty.call(profileState, "cant") ||
		!Array.isArray(profileState.chainageMappings)
	) {
		throw new BasicVerticalProfileAuthoringError(
			"INVALID_PARABOLIC_GRADIENT_CHANGE",
			"a non-empty persisted vertical profile for the active Alignment is required"
		);
	}
	return profileState;
}

export function createBasicVerticalProfileAuthoringController({
	alignmentProfileApplicationService,
	projectionController,
} = {}) {
	if (
		typeof alignmentProfileApplicationService?.saveProfileState !==
			"function" ||
		typeof projectionController?.projectAt !== "function"
	) {
		throw new BasicVerticalProfileAuthoringError(
			"INVALID_SERVICE",
			"basic vertical authoring requires profile save and projection services"
		);
	}
	let lastVerifiedFingerprint = null;

	return Object.freeze({
		async removeTerminalParabolicElement({
			alignmentId,
			revision,
			s,
			profileState,
			elementId,
		} = {}) {
			const normalizedAlignmentId = requireId(
				alignmentId,
				"alignmentId"
			);
			const normalizedElementId = requireId(
				elementId,
				"elementId"
			);
			if (revision === undefined) {
				throw new BasicVerticalProfileAuthoringError(
					"INVALID_TERMINAL_PARABOLIC_REMOVE",
					"revision must be explicit"
				);
			}
			const cursorS = finite(s, "s");
			const persisted = requirePersistedProfileState(
				profileState,
				normalizedAlignmentId
			);
			const targetIndex = persisted.vertical.elements.findIndex(
				(element) => element.id === normalizedElementId
			);
			if (targetIndex < 0) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_ELEMENT_NOT_FOUND",
					`vertical element ${normalizedElementId} was not found`
				);
			}
			const target = persisted.vertical.elements[targetIndex];
			if (target.type !== "parabolic") {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_ELEMENT_NOT_PARABOLIC",
					`vertical element ${normalizedElementId} is not parabolic`
				);
			}
			if (targetIndex !== persisted.vertical.elements.length - 1) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_ELEMENT_NOT_TERMINAL",
					`vertical element ${normalizedElementId} is not terminal`
				);
			}
			if (targetIndex === 0) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_REMOVE_REQUIRES_PREDECESSOR",
					"terminal parabolic removal requires a preceding vertical element"
				);
			}

			const context = {
				alignmentId: normalizedAlignmentId,
				revision,
				s: cursorS,
			};
			validateProjection(
				await projectionController.projectAt(context),
				context
			);

			let vertical = createVerticalConstructiveState({
				id: persisted.vertical.id,
				alignmentId: persisted.vertical.alignmentId,
			});
			for (const element of persisted.vertical.elements.slice(0, -1)) {
				vertical = appendVerticalElement(vertical, { ...element });
			}
			evaluateVerticalAt(vertical, {
				s: vertical.elements.at(-1).endS,
			});
			const nextProfileState = {
				vertical,
				cant: persisted.cant,
				chainageMappings: persisted.chainageMappings,
			};

			let snapshot;
			try {
				snapshot =
					await alignmentProfileApplicationService.saveProfileState({
						alignmentId: normalizedAlignmentId,
						profileState: nextProfileState,
					});
			} catch (cause) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_SAVE_FAILED",
					"terminal parabolic element was not removed",
					{ cause }
				);
			}
			if (!profileStateMatches(snapshot, nextProfileState)) {
				throw new BasicVerticalProfileAuthoringError(
					"PROFILE_READBACK_MISMATCH",
					"removed terminal parabolic element does not match repository readback"
				);
			}
			const projection = validateProjection(
				await projectionController.projectAt({
					alignmentId: normalizedAlignmentId,
					revision: snapshot.revision,
					s: cursorS,
				}),
				{
					alignmentId: normalizedAlignmentId,
					revision: snapshot.revision,
					s: cursorS,
				}
			);
			return Object.freeze({
				status: "removed",
				elementId: normalizedElementId,
				profileState: nextProfileState,
				snapshot,
				projection,
			});
		},
		async updateTerminalParabolicEndS({
			alignmentId,
			revision,
			s,
			profileState,
			elementId,
			endS,
		} = {}) {
			const normalizedAlignmentId = requireId(
				alignmentId,
				"alignmentId"
			);
			const normalizedElementId = requireId(
				elementId,
				"elementId"
			);
			if (revision === undefined) {
				throw new BasicVerticalProfileAuthoringError(
					"INVALID_TERMINAL_PARABOLIC_DOMAIN_EDIT",
					"revision must be explicit"
				);
			}
			const cursorS = finite(s, "s");
			const normalizedEndS = finite(endS, "endS");
			const persisted = requirePersistedProfileState(
				profileState,
				normalizedAlignmentId
			);
			const targetIndex = persisted.vertical.elements.findIndex(
				(element) => element.id === normalizedElementId
			);
			if (targetIndex < 0) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_ELEMENT_NOT_FOUND",
					`vertical element ${normalizedElementId} was not found`
				);
			}
			const target = persisted.vertical.elements[targetIndex];
			if (target.type !== "parabolic") {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_ELEMENT_NOT_PARABOLIC",
					`vertical element ${normalizedElementId} is not parabolic`
				);
			}
			if (targetIndex !== persisted.vertical.elements.length - 1) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_ELEMENT_NOT_TERMINAL",
					`vertical element ${normalizedElementId} is not terminal`
				);
			}
			if (normalizedEndS <= target.startS) {
				throw new BasicVerticalProfileAuthoringError(
					"INVALID_TERMINAL_PARABOLIC_DOMAIN_EDIT",
					"endS must be greater than the terminal parabolic startS"
				);
			}
			if (Object.is(target.endS, normalizedEndS)) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_NO_CHANGE",
					"terminal parabolic endS is unchanged"
				);
			}

			const context = {
				alignmentId: normalizedAlignmentId,
				revision,
				s: cursorS,
			};
			validateProjection(
				await projectionController.projectAt(context),
				context
			);

			let vertical = createVerticalConstructiveState({
				id: persisted.vertical.id,
				alignmentId: persisted.vertical.alignmentId,
			});
			for (const element of persisted.vertical.elements) {
				vertical = appendVerticalElement(vertical, {
					...element,
					...(Object.is(element, target)
						? { endS: normalizedEndS }
						: {}),
				});
			}
			evaluateVerticalAt(vertical, { s: normalizedEndS });
			const nextProfileState = {
				vertical,
				cant: persisted.cant,
				chainageMappings: persisted.chainageMappings,
			};

			let snapshot;
			try {
				snapshot =
					await alignmentProfileApplicationService.saveProfileState({
						alignmentId: normalizedAlignmentId,
						profileState: nextProfileState,
					});
			} catch (cause) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_SAVE_FAILED",
					"terminal parabolic endS was not saved",
					{ cause }
				);
			}
			if (!profileStateMatches(snapshot, nextProfileState)) {
				throw new BasicVerticalProfileAuthoringError(
					"PROFILE_READBACK_MISMATCH",
					"saved terminal parabolic domain edit does not match repository readback"
				);
			}
			const projection = validateProjection(
				await projectionController.projectAt({
					alignmentId: normalizedAlignmentId,
					revision: snapshot.revision,
					s: cursorS,
				}),
				{
					alignmentId: normalizedAlignmentId,
					revision: snapshot.revision,
					s: cursorS,
				}
			);
			return Object.freeze({
				status: "saved",
				elementId: normalizedElementId,
				profileState: nextProfileState,
				snapshot,
				projection,
			});
		},
		async updateTerminalParabolicGradientRate({
			alignmentId,
			revision,
			s,
			profileState,
			elementId,
			gradientRate,
		} = {}) {
			const normalizedAlignmentId = requireId(
				alignmentId,
				"alignmentId"
			);
			const normalizedElementId = requireId(
				elementId,
				"elementId"
			);
			if (revision === undefined) {
				throw new BasicVerticalProfileAuthoringError(
					"INVALID_TERMINAL_PARABOLIC_EDIT",
					"revision must be explicit"
				);
			}
			const cursorS = finite(s, "s");
			const normalizedGradientRate = finite(
				gradientRate,
				"gradientRate"
			);
			const persisted = requirePersistedProfileState(
				profileState,
				normalizedAlignmentId
			);
			const targetIndex = persisted.vertical.elements.findIndex(
				(element) => element.id === normalizedElementId
			);
			if (targetIndex < 0) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_ELEMENT_NOT_FOUND",
					`vertical element ${normalizedElementId} was not found`
				);
			}
			const target = persisted.vertical.elements[targetIndex];
			if (target.type !== "parabolic") {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_ELEMENT_NOT_PARABOLIC",
					`vertical element ${normalizedElementId} is not parabolic`
				);
			}
			if (targetIndex !== persisted.vertical.elements.length - 1) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_ELEMENT_NOT_TERMINAL",
					`vertical element ${normalizedElementId} is not terminal`
				);
			}
			if (Object.is(target.gradientRate, normalizedGradientRate)) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_NO_CHANGE",
					"terminal parabolic gradientRate is unchanged"
				);
			}

			const context = {
				alignmentId: normalizedAlignmentId,
				revision,
				s: cursorS,
			};
			validateProjection(
				await projectionController.projectAt(context),
				context
			);

			let vertical = createVerticalConstructiveState({
				id: persisted.vertical.id,
				alignmentId: persisted.vertical.alignmentId,
			});
			for (const element of persisted.vertical.elements) {
				vertical = appendVerticalElement(vertical, {
					...element,
					...(Object.is(element, target)
						? { gradientRate: normalizedGradientRate }
						: {}),
				});
			}
			const nextProfileState = {
				vertical,
				cant: persisted.cant,
				chainageMappings: persisted.chainageMappings,
			};

			let snapshot;
			try {
				snapshot =
					await alignmentProfileApplicationService.saveProfileState({
						alignmentId: normalizedAlignmentId,
						profileState: nextProfileState,
					});
			} catch (cause) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_SAVE_FAILED",
					"terminal parabolic gradientRate was not saved",
					{ cause }
				);
			}
			if (!profileStateMatches(snapshot, nextProfileState)) {
				throw new BasicVerticalProfileAuthoringError(
					"PROFILE_READBACK_MISMATCH",
					"saved terminal parabolic edit does not match repository readback"
				);
			}
			const projection = validateProjection(
				await projectionController.projectAt({
					alignmentId: normalizedAlignmentId,
					revision: snapshot.revision,
					s: cursorS,
				}),
				{
					alignmentId: normalizedAlignmentId,
					revision: snapshot.revision,
					s: cursorS,
				}
			);
			return Object.freeze({
				status: "saved",
				elementId: normalizedElementId,
				profileState: nextProfileState,
				snapshot,
				projection,
			});
		},
		deriveParabolicGradientChangeStart({
			alignmentId,
			profileState,
		} = {}) {
			const normalizedAlignmentId = requireId(
				alignmentId,
				"alignmentId"
			);
			const persisted = requirePersistedProfileState(
				profileState,
				normalizedAlignmentId
			);
			const lastElement = persisted.vertical.elements.at(-1);
			const endpoint = evaluateVerticalAt(persisted.vertical, {
				s: lastElement.endS,
			});
			return Object.freeze({
				startS: lastElement.endS,
				startElevation: endpoint.elevation,
				startGradient: endpoint.gradient,
				previousElementId: lastElement.id,
			});
		},
		async appendParabolicGradientChange({
			alignmentId,
			revision,
			s,
			profileState,
			elementId,
			endS,
			gradientRate,
		} = {}) {
			const normalizedAlignmentId = requireId(
				alignmentId,
				"alignmentId"
			);
			const normalizedElementId = requireId(
				elementId,
				"elementId"
			);
			if (revision === undefined) {
				throw new BasicVerticalProfileAuthoringError(
					"INVALID_PARABOLIC_GRADIENT_CHANGE",
					"revision must be explicit"
				);
			}
			const cursorS = finite(s, "s");
			const normalizedEndS = finite(endS, "endS");
			const normalizedGradientRate = finite(
				gradientRate,
				"gradientRate"
			);
			const persisted = requirePersistedProfileState(
				profileState,
				normalizedAlignmentId
			);
			const derivedStart =
				this.deriveParabolicGradientChangeStart({
					alignmentId: normalizedAlignmentId,
					profileState: persisted,
				});
			if (normalizedEndS <= derivedStart.startS) {
				throw new BasicVerticalProfileAuthoringError(
					"INVALID_PARABOLIC_GRADIENT_CHANGE",
					"endS must be greater than the derived startS"
				);
			}

			const context = {
				alignmentId: normalizedAlignmentId,
				revision,
				s: cursorS,
			};
			await projectionController.projectAt(context);

			const vertical = appendVerticalElement(
				persisted.vertical,
				{
					id: normalizedElementId,
					type: "parabolic",
					startS: derivedStart.startS,
					endS: normalizedEndS,
					startElevation: derivedStart.startElevation,
					startGradient: derivedStart.startGradient,
					gradientRate: normalizedGradientRate,
				}
			);
			const nextProfileState = {
				vertical,
				cant: persisted.cant,
				chainageMappings: persisted.chainageMappings,
			};
			const fingerprint = JSON.stringify(nextProfileState);
			if (fingerprint === JSON.stringify(persisted)) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_NO_CHANGE",
					"parabolic gradient change is unchanged"
				);
			}

			let snapshot;
			try {
				snapshot =
					await alignmentProfileApplicationService.saveProfileState({
						alignmentId: normalizedAlignmentId,
						profileState: nextProfileState,
					});
			} catch (cause) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_SAVE_FAILED",
					"parabolic gradient change was not saved",
					{ cause }
				);
			}
			if (!profileStateMatches(snapshot, nextProfileState)) {
				throw new BasicVerticalProfileAuthoringError(
					"PROFILE_READBACK_MISMATCH",
					"saved parabolic gradient change does not match repository readback"
				);
			}
			const projection = validateProjection(
				await projectionController.projectAt({
					alignmentId: normalizedAlignmentId,
					revision: snapshot.revision,
					s: cursorS,
				}),
				{
					alignmentId: normalizedAlignmentId,
					revision: snapshot.revision,
					s: cursorS,
				}
			);
			lastVerifiedFingerprint = fingerprint;
			return Object.freeze({
				status: "saved",
				derivedStart,
				profileState: nextProfileState,
				snapshot,
				projection,
			});
		},
		async submit({
			alignmentId,
			revision,
			s,
			segmentId,
			startS,
			endS,
			startElevation,
			gradient,
		} = {}) {
			const normalizedAlignmentId = requireId(
				alignmentId,
				"alignmentId"
			);
			const normalizedSegmentId = requireId(
				segmentId,
				"segmentId"
			);
			if (revision === undefined) {
				throw new BasicVerticalProfileAuthoringError(
					"INVALID_BASIC_VERTICAL_PROFILE",
					"revision must be explicit"
				);
			}
			const cursorS = finite(s, "s");
			const normalizedStartS = finite(startS, "startS");
			const normalizedEndS = finite(endS, "endS");
			const normalizedStartElevation = finite(
				startElevation,
				"startElevation"
			);
			const normalizedGradient = finite(gradient, "gradient");
			if (normalizedEndS <= normalizedStartS) {
				throw new BasicVerticalProfileAuthoringError(
					"INVALID_BASIC_VERTICAL_PROFILE",
					"endS must be greater than startS"
				);
			}

			const context = {
				alignmentId: normalizedAlignmentId,
				revision,
				s: cursorS,
			};
			await projectionController.projectAt(context);

			const vertical = appendVerticalElement(
				createVerticalConstructiveState({
					id: `vertical:${normalizedAlignmentId}`,
					alignmentId: normalizedAlignmentId,
				}),
				{
					id: normalizedSegmentId,
					type: "constant-gradient",
					startS: normalizedStartS,
					endS: normalizedEndS,
					startElevation: normalizedStartElevation,
					gradient: normalizedGradient,
				}
			);
			const profileState = {
				vertical,
				cant: null,
				chainageMappings: [],
			};
			const fingerprint = JSON.stringify(profileState);
			if (fingerprint === lastVerifiedFingerprint) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_NO_CHANGE",
					"basic vertical profile is unchanged"
				);
			}

			let snapshot;
			try {
				snapshot =
					await alignmentProfileApplicationService.saveProfileState({
						alignmentId: normalizedAlignmentId,
						profileState,
					});
			} catch (cause) {
				throw new BasicVerticalProfileAuthoringError(
					"VERTICAL_PROFILE_SAVE_FAILED",
					"basic vertical profile was not saved",
					{ cause }
				);
			}
			if (!profileStateMatches(snapshot, profileState)) {
				throw new BasicVerticalProfileAuthoringError(
					"PROFILE_READBACK_MISMATCH",
					"saved basic vertical profile does not match repository readback"
				);
			}
			const projection = validateProjection(
				await projectionController.projectAt({
					alignmentId: normalizedAlignmentId,
					revision: snapshot.revision,
					s: cursorS,
				}),
				{
					alignmentId: normalizedAlignmentId,
					revision: snapshot.revision,
					s: cursorS,
				}
			);
			if (
				projection.vertical?.status !== "evaluated" ||
				projection.cant?.status !== "absent" ||
				projection.chainage?.status !== "absent"
			) {
				throw new BasicVerticalProfileAuthoringError(
					"PROFILE_READBACK_MISMATCH",
					"saved profile projection is not the expected vertical-only state"
				);
			}
			lastVerifiedFingerprint = fingerprint;
			return Object.freeze({
				status: "saved",
				profileState,
				snapshot,
				projection,
			});
		},
	});
}

export default createBasicVerticalProfileAuthoringController;
