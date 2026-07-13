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

	async removeElementFromActiveAlignment(args = {}) {
		return this.service.removeElement(args);
	}

	async clearActiveAlignmentElements() {
		return this.service.clearElements();
	}
}
