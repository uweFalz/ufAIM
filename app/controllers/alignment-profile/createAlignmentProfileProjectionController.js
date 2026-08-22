export class AlignmentProfileProjectionControllerError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "AlignmentProfileProjectionControllerError";
		this.code = code;
	}
}

function isObject(value) {
	return value !== null && typeof value === "object";
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
	if (!isObject(left) || !isObject(right)) return false;
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

function validateContext({ alignmentId, revision, s } = {}) {
	if (typeof alignmentId !== "string" || alignmentId.trim() === "") {
		throw new AlignmentProfileProjectionControllerError(
			"INVALID_CONTEXT",
			"alignmentId must be a non-empty string"
		);
	}
	if (revision === undefined) {
		throw new AlignmentProfileProjectionControllerError(
			"INVALID_CONTEXT",
			"revision must be explicit"
		);
	}
	if (!Number.isFinite(s)) {
		throw new AlignmentProfileProjectionControllerError(
			"INVALID_CONTEXT",
			"s must be a finite number"
		);
	}
	return Object.freeze({ alignmentId, revision, s });
}

export function createAlignmentProfileProjectionController({
	alignmentProfileApplicationService,
} = {}) {
	if (
		!alignmentProfileApplicationService ||
		typeof alignmentProfileApplicationService.projectAt !== "function"
	) {
		throw new AlignmentProfileProjectionControllerError(
			"INVALID_SERVICE",
			"alignmentProfileApplicationService must provide projectAt(request)"
		);
	}

	return Object.freeze({
		async projectAt(context = {}) {
			const expected = validateContext(context);
			const projection =
				await alignmentProfileApplicationService.projectAt({
					alignmentId: expected.alignmentId,
					s: expected.s,
				});

			if (
				!projection ||
				typeof projection !== "object" ||
				projection.alignmentId !== expected.alignmentId
			) {
				throw new AlignmentProfileProjectionControllerError(
					"ALIGNMENT_MISMATCH",
					"profile projection alignment does not match the active Alignment"
				);
			}
			if (!sameValue(projection.revision, expected.revision)) {
				throw new AlignmentProfileProjectionControllerError(
					"REVISION_MISMATCH",
					"profile projection revision does not match the active revision"
				);
			}
			if (
				!projection.cursor ||
				projection.cursor.parameterKind !== "intrinsic-s" ||
				!Object.is(projection.cursor.s, expected.s)
			) {
				throw new AlignmentProfileProjectionControllerError(
					"CURSOR_MISMATCH",
					"profile projection cursor does not match the active cursor"
				);
			}
			return projection;
		},
	});
}

export default createAlignmentProfileProjectionController;
