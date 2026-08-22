import { mapChainageToIntrinsic } from "../../../src/aim-core/alignment/profile/ChainageMapping.js";

export class ChainageAddressLookupError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "ChainageAddressLookupError";
		this.code = code;
	}
}

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) {
		throw new ChainageAddressLookupError(
			"INVALID_CHAINAGE_LOOKUP",
			`${label} must be a non-empty string`
		);
	}
	return id;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") {
		throw new ChainageAddressLookupError(
			"INVALID_CHAINAGE_LOOKUP",
			`${label} must be finite`
		);
	}
	const number = Number(value);
	if (!Number.isFinite(number)) {
		throw new ChainageAddressLookupError(
			"INVALID_CHAINAGE_LOOKUP",
			`${label} must be finite`
		);
	}
	return number;
}

export function createChainageAddressLookupController({
	projectionController,
} = {}) {
	if (typeof projectionController?.projectAt !== "function") {
		throw new ChainageAddressLookupError(
			"INVALID_SERVICE",
			"chainage address lookup requires the profile projection service"
		);
	}

	return Object.freeze({
		async lookup({
			alignmentId,
			revision,
			s,
			profileState,
			mappingId,
			address,
		} = {}) {
			const normalizedAlignmentId = requireId(alignmentId, "alignmentId");
			const normalizedMappingId = requireId(mappingId, "mappingId");
			if (revision === undefined) {
				throw new ChainageAddressLookupError(
					"INVALID_CHAINAGE_LOOKUP",
					"revision must be explicit"
				);
			}
			const cursorS = finite(s, "s");
			const numericAddress = finite(address, "address");
			if (!profileState || !Array.isArray(profileState.chainageMappings)) {
				throw new ChainageAddressLookupError(
					"INVALID_CHAINAGE_LOOKUP",
					"canonical profileState is required"
				);
			}
			const projection = await projectionController.projectAt({
				alignmentId: normalizedAlignmentId,
				revision,
				s: cursorS,
			});
			if (
				projection?.alignmentId !== normalizedAlignmentId ||
				!Object.is(projection?.revision, revision) ||
				projection?.cursor?.parameterKind !== "intrinsic-s" ||
				!Object.is(projection?.cursor?.s, cursorS)
			) {
				throw new ChainageAddressLookupError(
					"CHAINAGE_LOOKUP_CONTEXT_MISMATCH",
					"profile projection does not match the active Alignment context"
				);
			}
			const matches = profileState.chainageMappings.filter(
				(mapping) => mapping?.id === normalizedMappingId
			);
			if (matches.length !== 1 || matches[0].alignmentId !== normalizedAlignmentId) {
				throw new ChainageAddressLookupError(
					"CHAINAGE_MAPPING_NOT_FOUND",
					`chainage mapping ${normalizedMappingId} is unavailable for the active Alignment`
				);
			}
			const candidates = mapChainageToIntrinsic(matches[0], {
				address: numericAddress,
			});
			return Object.freeze({
				status:
					candidates.length === 0
						? "not-covered"
						: candidates.length === 1
							? "unique"
							: "ambiguous",
				alignmentId: normalizedAlignmentId,
				revision,
				mappingId: normalizedMappingId,
				address: numericAddress,
				candidates,
			});
		},
	});
}

export default createChainageAddressLookupController;
