// src/aim-core/alignment/authoring/createEmptyAlignmentData.js

export function createEmptyAlignmentData({
	id = makeAlignmentId(),
	name = "New Alignment",
	now = new Date().toISOString(),
} = {}) {
	return {
		type: "AlignmentData",
		id,
		name,

		source: {
			kind: "native",
			native: true,
		},

		placement: {
			mode: "local-cartesian",
			engineeringCrsId: "engineering-nullCRS",
			geographicOrigin: null,
		},

		editModel: {
			startPose: {
				p: { x: 0, y: 0 },
				t: { x: 1, y: 0 },
			},
			elements: [],
		},

		sparseAlignment: null,

		profileState: {
			vertical: null,
			cant: null,
			chainageMappings: [],
		},

		meta: {
			lifecycle: "draft",
			dirty: true,
			createdAt: now,
			modifiedAt: now,
		},
	};
}

function makeAlignmentId() {
	return `alignment_${Date.now().toString(36)}_${Math.random()
		.toString(36)
		.slice(2, 8)}`;
}
