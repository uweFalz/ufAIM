import { assertAlignmentRepositoryPort } from "@src/aim-core/alignment/authoring/AlignmentRepositoryPort.js";

export class SpotAlignmentRepositoryAdapter {
	constructor({ spotGateway, mapper } = {}) {
		if (
			typeof spotGateway?.getObjectById !== "function" ||
			typeof spotGateway?.saveObject !== "function"
		) {
			throw new Error(
				"SpotAlignmentRepositoryAdapter: invalid spotGateway"
			);
		}
		if (
			typeof mapper?.readAlignmentDataFromSpotObject !== "function" ||
			typeof mapper?.updateAlignmentSpotObjectFromData !== "function"
		) {
			throw new Error(
				"SpotAlignmentRepositoryAdapter: invalid mapper"
			);
		}

		this.spotGateway = spotGateway;
		this.mapper = mapper;
		this.loadedObjects = new Map();
		assertAlignmentRepositoryPort(this);
	}

	async loadById(alignmentId) {
		const spotObject = await this.spotGateway.getObjectById(alignmentId);
		if (!spotObject || spotObject.type !== "alignment") return null;

		const alignmentState =
			this.mapper.readAlignmentDataFromSpotObject(spotObject);
		if (!alignmentState || alignmentState.id !== alignmentId) {
			return alignmentState ?? null;
		}

		this.loadedObjects.set(alignmentId, spotObject);
		return alignmentState;
	}

	async saveById(alignmentId, alignmentState) {
		if (alignmentState?.id !== alignmentId) {
			throw new Error(
				"SpotAlignmentRepositoryAdapter: Alignment ID mismatch"
			);
		}

		let original = this.loadedObjects.get(alignmentId) ?? null;
		if (!original) {
			original = await this.spotGateway.getObjectById(alignmentId);
		}
		if (!original || original.type !== "alignment") {
			throw new Error(
				`SpotAlignmentRepositoryAdapter: Alignment ${alignmentId} not found`
			);
		}

		const nextSpotObject =
			this.mapper.updateAlignmentSpotObjectFromData(
				original,
				alignmentState
			);
		const saved = await this.spotGateway.saveObject(nextSpotObject, {
			source: "alignment-authoring-explicit-id",
			focus: false,
		});
		const storedObject =
			saved?.spotObject ??
			saved ??
			null;
		if (
			!storedObject ||
			storedObject.type !== "alignment" ||
			storedObject.id !== alignmentId
		) {
			throw new Error(
				"SpotAlignmentRepositoryAdapter: persisted Alignment acknowledgement mismatch"
			);
		}
		const storedState =
			this.mapper.readAlignmentDataFromSpotObject(storedObject);
		if (
			!storedState ||
			storedState.id !== alignmentId ||
			!samePlainData(storedState, alignmentState) ||
			!samePlainData(
				storedObject?.data?.kernel,
				alignmentState?.sparseAlignment ?? null
			)
		) {
			throw new Error(
				"SpotAlignmentRepositoryAdapter: persisted Alignment state mismatch"
			);
		}
		this.loadedObjects.set(alignmentId, storedObject);
		return storedState;
	}
}

function samePlainData(left, right) {
	try {
		return JSON.stringify(left) === JSON.stringify(right);
	} catch {
		return false;
	}
}

export default SpotAlignmentRepositoryAdapter;
