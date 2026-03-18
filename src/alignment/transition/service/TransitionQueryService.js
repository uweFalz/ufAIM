// src/alignment/transition/service/TransitionQueryService.js

export function createTransitionQueryService({ db, registryResolver }) {

	function listPresets() {
		const tr = db?.transition ?? {};

		return Object.keys(tr).map((id) => {
			const t = tr[id] ?? {};
			return { id, label: t.label ?? id };
		});
	}

	function getPresetSpec(presetId) {
		const descriptor = registryResolver.resolveTransitionDescriptor(presetId);

		if (!descriptor) {
			throw new Error(`Unknown presetId: ${presetId}`);
		}

		const part = Array.isArray(descriptor.normLengthPartition)
			? descriptor.normLengthPartition
			: [0, 1, 0];

		const l1 = Number(part[0] ?? 0) || 0;
		const lc = Number(part[1] ?? 0) || 0;

		const w1 = l1;
		const w2 = l1 + lc;

		return {
			presetId: String(descriptor.id ?? presetId ?? "").toLowerCase(),
			descriptor,
			cuts01: { w1, w2 },
			meta: {
				label: descriptor.label ?? String(descriptor.id ?? presetId ?? ""),
			},
		};
	}

	return {
		listPresets,
		getPresetSpec,
	};
}
