const SAMPLE_INTERVALS = 32;

export class LongitudinalProfileControllerError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "LongitudinalProfileControllerError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

function freezeEntry(value) {
	return Object.freeze({ ...value });
}

function unavailable({ alignmentId, revision, s, status, code, message }) {
	return Object.freeze({
		status,
		alignmentId,
		revision,
		domain: null,
		boundaries: Object.freeze([]),
		elevationExtent: null,
		samples: Object.freeze([]),
		cursor: Object.freeze({ status, s }),
		elementDefinitions: Object.freeze([]),
		activeElementDefinition: null,
		error:
			code === undefined
				? null
				: Object.freeze({ code, message }),
	});
}

function normalizedContext({ alignmentId, revision, s } = {}) {
	const id = typeof alignmentId === "string" ? alignmentId.trim() : "";
	if (!id || revision === undefined || !Number.isFinite(s)) {
		throw new LongitudinalProfileControllerError(
			"INVALID_CONTEXT",
			"longitudinal profile requires explicit Alignment identity, revision, and finite s"
		);
	}
	return { alignmentId: id, revision, s };
}

function verticalDomain(profileState, alignmentId) {
	const vertical = profileState?.vertical;
	if (vertical === null || vertical === undefined) return null;
	if (
		!vertical ||
		typeof vertical !== "object" ||
		vertical.alignmentId !== alignmentId ||
		!Array.isArray(vertical.elements) ||
		vertical.elements.length === 0
	) {
		throw new LongitudinalProfileControllerError(
			"INVALID_VERTICAL_PROFILE",
			"persisted vertical profile is malformed or belongs to another Alignment"
		);
	}
	const first = vertical.elements[0];
	const last = vertical.elements.at(-1);
	if (
		!Number.isFinite(first?.startS) ||
		!Number.isFinite(last?.endS) ||
		last.endS <= first.startS ||
		vertical.elements.some(
			(element) =>
				!Number.isFinite(element?.startS) ||
				!Number.isFinite(element?.endS) ||
				element.endS <= element.startS
		)
	) {
		throw new LongitudinalProfileControllerError(
			"INVALID_VERTICAL_PROFILE",
			"persisted vertical profile has no valid intrinsic-s domain"
		);
	}
	return {
		startS: first.startS,
		endS: last.endS,
		boundaries: [
			first.startS,
			...vertical.elements.map((element) => element.endS),
		],
	};
}

function samplePositions({ startS, endS, boundaries }, cursorS) {
	const positions = new Set(boundaries);
	const span = endS - startS;
	for (let index = 0; index <= SAMPLE_INTERVALS; index += 1) {
		positions.add(startS + (span * index) / SAMPLE_INTERVALS);
	}
	if (cursorS >= startS && cursorS <= endS) positions.add(cursorS);
	return [...positions].sort((left, right) => left - right);
}

export function createLongitudinalProfileController({
	alignmentProfileApplicationService,
} = {}) {
	if (
		typeof alignmentProfileApplicationService?.evaluateMany !==
		"function"
	) {
		throw new LongitudinalProfileControllerError(
			"INVALID_SERVICE",
			"longitudinal profile requires evaluateMany(request)"
		);
	}

	return Object.freeze({
		async project({ alignmentId, revision, s, profileState } = {}) {
			const context = normalizedContext({ alignmentId, revision, s });
			let domain;
			try {
				domain = verticalDomain(profileState, context.alignmentId);
			} catch (error) {
				return unavailable({
					...context,
					status: "error",
					code: error.code ?? "INVALID_VERTICAL_PROFILE",
					message: error.message,
				});
			}
			if (!domain) {
				return unavailable({ ...context, status: "absent" });
			}
			const elementDefinitions = Object.freeze(
				profileState.vertical.elements.map(freezeEntry)
			);

			const positions = samplePositions(domain, context.s);
			let batch;
			try {
				batch =
					await alignmentProfileApplicationService.evaluateMany({
						alignmentId: context.alignmentId,
						positions,
					});
			} catch (cause) {
				return unavailable({
					...context,
					status: "error",
					code: String(cause?.code ?? "PROFILE_EVALUATION_FAILED"),
					message: String(cause?.message ?? cause),
				});
			}
			if (
				batch?.alignmentId !== context.alignmentId ||
				!Array.isArray(batch.positions) ||
				!Array.isArray(batch.results) ||
				batch.results.length !== positions.length ||
				batch.positions.some(
					(position, index) => !Object.is(position, positions[index])
				)
			) {
				return unavailable({
					...context,
					status: "error",
					code: "PROFILE_EVALUATION_MISMATCH",
					message: "profile batch does not match requested sample order",
				});
			}

			const samples = [];
			for (let index = 0; index < positions.length; index += 1) {
				const result = batch.results[index];
				const value = result?.vertical?.value;
				if (
					result?.s !== positions[index] ||
					result?.vertical?.status !== "evaluated" ||
					!Number.isFinite(value?.elevation) ||
					!Number.isFinite(value?.gradient)
				) {
					return unavailable({
						...context,
						status: "error",
						code: "PROFILE_EVALUATION_MISMATCH",
						message: "vertical sample is missing or non-finite",
					});
				}
				samples.push(
					freezeEntry({
						s: positions[index],
						elevation: value.elevation,
						gradient: value.gradient,
						elementId: value.elementId,
					})
				);
			}
			const elevations = samples.map((sample) => sample.elevation);
			const cursorIndex = positions.findIndex((position) =>
				Object.is(position, context.s)
			);
			const cursor =
				cursorIndex === -1
					? Object.freeze({ status: "not-covered", s: context.s })
					: Object.freeze({
							status: "evaluated",
							...samples[cursorIndex],
						});
			const activeElementMatches =
				cursor.status === "evaluated"
					? elementDefinitions.filter((element) =>
							Object.is(element.id, cursor.elementId)
						)
					: [];
			const activeElementDefinition =
				activeElementMatches.length === 1
					? activeElementMatches[0]
					: null;
			return Object.freeze({
				status: "projected",
				alignmentId: context.alignmentId,
				revision: context.revision,
				domain: freezeEntry({
					parameterKind: "intrinsic-s",
					startS: domain.startS,
					endS: domain.endS,
				}),
				boundaries: Object.freeze([...domain.boundaries]),
				elevationExtent: freezeEntry({
					min: Math.min(...elevations),
					max: Math.max(...elevations),
				}),
				samples: Object.freeze(samples),
				cursor,
				elementDefinitions,
				activeElementDefinition,
				error: null,
			});
		},
	});
}

export default createLongitudinalProfileController;
