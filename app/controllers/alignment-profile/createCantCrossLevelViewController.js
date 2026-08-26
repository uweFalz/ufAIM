import { evaluateCantAt, isCantConstructiveState } from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";
import { evaluateRailPairCantAt, isRailPairCantConstructiveState } from "../../../src/aim-core/alignment/profile/RailPairCantConstructiveState.js";

export class CantCrossLevelViewControllerError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "CantCrossLevelViewControllerError";
		this.code = code;
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
		elements: Object.freeze([]),
		samples: Object.freeze([]),
		cursor: Object.freeze({ status, s }),
		reference: Object.freeze({
			status: status === "absent" ? "absent" : "unavailable",
		}),
		error: code === undefined ? null : Object.freeze({ code, message }),
	});
}

function context({ alignmentId, revision, s } = {}) {
	const id = typeof alignmentId === "string" ? alignmentId.trim() : "";
	if (!id || revision === undefined || !Number.isFinite(s)) {
		throw new CantCrossLevelViewControllerError(
			"INVALID_CONTEXT",
			"Cant cross-level view requires explicit Alignment identity, revision, and finite s"
		);
	}
	return { alignmentId: id, revision, s };
}

function cantDomain(profileState, alignmentId) {
	const cant = profileState?.cant;
	if (cant === null || cant === undefined) return null;
	if (!isCantConstructiveState(cant) && !isRailPairCantConstructiveState(cant)) {
		throw new CantCrossLevelViewControllerError(
			"INVALID_CANT_STATE",
			"persisted Cant state is malformed or belongs to another Alignment"
		);
	}
	if (cant.alignmentId !== alignmentId) throw new CantCrossLevelViewControllerError("INVALID_CANT_STATE", "persisted Cant state belongs to another Alignment");
	if (isRailPairCantConstructiveState(cant)) {
		return {
			cant,
			representation: "rail-pair",
			startS: cant.coverage.startS,
			endS: cant.coverage.endS,
			boundaries: [...new Set([cant.coverage.startS, ...cant.elements.flatMap((element) => [element.startS, element.endS]), cant.coverage.endS])].sort((a, b) => a - b),
		};
	}
	if (cant.elements.length === 0) throw new CantCrossLevelViewControllerError("INVALID_CANT_STATE", "persisted Cant state has no visible elements");
	const first = cant.elements[0];
	const last = cant.elements.at(-1);
	if (
		!Number.isFinite(first?.startS) ||
		!Number.isFinite(last?.endS) ||
		last.endS <= first.startS ||
		cant.elements.some(
			(element) =>
				!Number.isFinite(element?.startS) ||
				!Number.isFinite(element?.endS) ||
				element.endS <= element.startS
		)
	) {
		throw new CantCrossLevelViewControllerError(
			"INVALID_CANT_STATE",
			"persisted Cant state has no valid intrinsic-s domain"
		);
	}
	return {
		cant,
		representation: "legacy-scalar",
		startS: first.startS,
		endS: last.endS,
		boundaries: [first.startS, ...cant.elements.map((element) => element.endS)],
	};
}

function referenceEvidence() {
	return Object.freeze({
		status: "partial",
		workingReference: "midpointGoverningRailEdges",
		scalarCrossLevelStatus: "partial-evidence",
		pairedRails: Object.freeze({ status: "unknown" }),
		sourceReference: Object.freeze({ status: "unknown" }),
		transformation: Object.freeze({ status: "not-performed" }),
	});
}

export function createCantCrossLevelViewController() {
	return Object.freeze({
		project(input = {}) {
			const current = context(input);
			let domain;
			try {
				domain = cantDomain(input.profileState, current.alignmentId);
			} catch (error) {
				return unavailable({ ...current, status: "error", code: error.code ?? "INVALID_CANT_STATE", message: error.message });
			}
			if (!domain) return unavailable({ ...current, status: "absent" });
			const positions = [...domain.boundaries];
			if (
				current.s >= domain.startS &&
				current.s <= domain.endS &&
				!positions.some((position) => Object.is(position, current.s))
			) positions.push(current.s);
			positions.sort((left, right) => left - right);
			const samples = [];
			try {
				for (const s of positions) {
					const value = domain.representation === "rail-pair" ? evaluateRailPairCantAt(domain.cant, { s }) : evaluateCantAt(domain.cant, { s });
					if (value.status === "unknown" || !Number.isFinite(value.crossLevel)) {
						throw new CantCrossLevelViewControllerError("CANT_EVALUATION_FAILED", "Cant evaluation returned non-finite evidence");
					}
					samples.push(domain.representation === "rail-pair" ? Object.freeze({
						...value,
						left: Object.freeze({ railId: domain.cant.railPair.leftRailId, ...value.left }),
						right: Object.freeze({ railId: domain.cant.railPair.rightRailId, ...value.right }),
					}) : freezeEntry(value));
				}
			} catch (error) {
				return unavailable({ ...current, status: "error", code: String(error?.code ?? "CANT_EVALUATION_FAILED"), message: String(error?.message ?? error) });
			}
			let cursor;
			if (current.s < domain.startS || current.s > domain.endS) {
				cursor = Object.freeze({ status: "not-covered", s: current.s });
			} else {
				const sample = samples.find((entry) => Object.is(entry.s, current.s));
				cursor = Object.freeze({ ...sample, status: "evaluated" });
			}
			return Object.freeze({
				status: "projected",
				representation: domain.representation,
				alignmentId: current.alignmentId,
				revision: current.revision,
				domain: freezeEntry({ parameterKind: "intrinsic-s", startS: domain.startS, endS: domain.endS }),
				boundaries: Object.freeze([...domain.boundaries]),
				elements: Object.freeze(domain.cant.elements.map(freezeEntry)),
				samples: Object.freeze(samples),
				cursor,
				reference: domain.representation === "rail-pair" ? Object.freeze({
					status: "known",
					workingReference: domain.cant.anchorRule.kind,
					scalarCrossLevelStatus: "derived",
					pairedRails: Object.freeze({ status: "known", leftRailId: domain.cant.railPair.leftRailId, rightRailId: domain.cant.railPair.rightRailId, separation: domain.cant.railPair.separation }),
					sourceReference: domain.cant.anchorRule,
					transformation: Object.freeze({ status: "not-required", reason: "PAIRED_RAIL_CONSTRUCTION_IS_AUTHORITATIVE" }),
				}) : referenceEvidence(),
				crossSection: domain.representation === "rail-pair" && cursor.left && cursor.right ? Object.freeze({
					status: "evaluated",
					s: current.s,
					left: cursor.left,
					right: cursor.right,
					crossLevel: cursor.crossLevel,
					commonOffset: cursor.commonOffset,
					midpointStatus: "derived",
				}) : null,
				error: null,
			});
		},
	});
}

export default createCantCrossLevelViewController;
