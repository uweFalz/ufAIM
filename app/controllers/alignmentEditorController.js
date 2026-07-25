// app/controllers/alignmentEditorController.js

import { AlignmentMapper } from "@src/model/spot/model/AlignmentSpotObjectMapper.js";
import { AlignmentApplicationService } from "@src/services/alignment/AlignmentApplicationService.js";

export class AlignmentEditorController {
	constructor({ store, messaging, logLine, mapper } = {}) {
		this.mapper = mapper ?? new AlignmentMapper();
		this.service = new AlignmentApplicationService({
			store,
			messaging,
			logLine,
			mapper: this.mapper,
		});
	}

	async newAlignment(args = {}) {
		return this.service.newAlignment(args);
	}

	async addStraightToActiveAlignment(args = {}) {
		return this.service.addStraight(args);
	}

	async addArcToActiveAlignment(args = {}) {
		if (!isObject(args)) {
			return reject("ALIGNMENT_EDIT_ARC_REJECTED", "invalid request: args must be object");
		}
		return this.service.addArc(args);
	}

	async addTransitionToActiveAlignment(args = {}) {
		if (!isObject(args)) {
			return reject("ALIGNMENT_EDIT_TRANSITION_REJECTED", "invalid request: args must be object");
		}
		return this.service.addTransition(args);
	}

	async addTransitionArcToActiveAlignment(args = {}) {
		if (!isObject(args)) return reject("ALIGNMENT_EDIT_TRANSITION_ARC_REJECTED", "invalid request: args must be object");
		return this.service.addTransitionArc(args);
	}

	async removeElementFromActiveAlignment(args = {}) {
		return this.service.removeElement(args);
	}

	async updateStraightLengthOnActiveAlignment(args = {}) {
		if (!isObject(args) || !String(args.elementId ?? "").trim()) {
			return reject("ALIGNMENT_EDIT_STRAIGHT_REJECTED", "invalid request: elementId is required");
		}
		return this.service.updateStraightLength(args);
	}

	async updateArcOnActiveAlignment(args = {}) {
		if (!isObject(args) || !String(args.elementId ?? "").trim()) {
			return reject("ALIGNMENT_EDIT_ARC_REJECTED", "invalid request: elementId is required");
		}
		return this.service.updateArc(args);
	}

	async updateTransitionOnActiveAlignment(args = {}) {
		if (!isObject(args) || !String(args.elementId ?? "").trim()) {
			return reject("ALIGNMENT_EDIT_TRANSITION_REJECTED", "invalid request: elementId is required");
		}
		return this.service.updateTransition(args);
	}

	async clearActiveAlignmentElements() {
		return this.service.clearElements();
	}

	async undoLastAlignmentChange() {
		return this.service.undo();
	}
}

function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function reject(code, reason) {
	return {
		changed: false,
		ok: false,
		status: "rejected",
		code,
		reason,
	};
}
