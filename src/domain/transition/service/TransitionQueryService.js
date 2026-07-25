// src/domain/transition/service/TransitionQueryService.js

export function createTransitionQueryService({ db, registryResolver } = {}) {
	if (!db || typeof db !== "object") {
		throw new Error("createTransitionQueryService: missing db");
	}
	if (!registryResolver || typeof registryResolver.resolveTransitionDescriptor !== "function") {
		throw new Error("createTransitionQueryService: missing registryResolver");
	}
	const workingTransitions = new Map();

	function clone(value) {
		return structuredClone(value);
	}

	function effectiveTransition(id) {
		return workingTransitions.get(id) ?? db?.transition?.[id] ?? null;
	}

	function listPresets() {
		const tr = db?.transition ?? {};

		return Object.keys(tr).map((id) => {
			const t = effectiveTransition(id) ?? {};
			return { id, label: t.label ?? id, family: classifyTransition(id, t), status: workingTransitions.has(id) ? "working-copy" : "persisted-read-only" };
		});
	}

	function getPresetSpec(presetId) {
		const descriptor = registryResolver.resolveTransitionDescriptor(presetId);

		if (!descriptor) {
			throw new Error(`Unknown presetId: ${presetId}`);
		}

		const id = String(descriptor.id ?? presetId ?? "").toLowerCase();
		const effective = effectiveTransition(id);
		const part = Array.isArray(effective?.normLengthPartition)
			? effective.normLengthPartition
			: Array.isArray(descriptor.normLengthPartition)
			? descriptor.normLengthPartition
			: [0, 1, 0];

		const l1 = Number(part[0] ?? 0) || 0;
		const lc = Number(part[1] ?? 0) || 0;

		const w1 = l1;
		const w2 = l1 + lc;

		return {
			presetId: id,
			descriptor: { ...descriptor, normLengthPartition: clone(part) },
			cuts01: { w1, w2 },
			meta: {
				label: descriptor.label ?? String(descriptor.id ?? presetId ?? ""),
				family: classifyTransition(id, effective),
				status: workingTransitions.has(id) ? "working-copy" : "persisted-read-only",
				persistence: "runtime-working-copy-only",
			},
		};
	}

	function getCatalogue() {
		const levels = ["constant", "simpleFcn", "protoFcn", "halfWave", "transition"];
		return {
			schema: clone(db.schema ?? null),
			persistence: { durable: false, mode: "runtime-working-copy", editableLevels: ["transition.normLengthPartition"] },
			levels: levels.map((level) => ({ id: level, count: Object.keys(db?.[level] ?? {}).length })),
			records: Object.fromEntries(levels.map((level) => [level, Object.entries(db?.[level] ?? {}).map(([id, value]) => ({ id, value: level === "transition" ? clone(effectiveTransition(id)) : clone(value), access: level === "transition" ? "working-copy-editable" : "read-only", derived: false }))])),
			workingCopyIds: [...workingTransitions.keys()],
		};
	}

	function updateWorkingCopy({ presetId, normLengthPartition } = {}) {
		const id = String(presetId ?? "").trim().toLowerCase();
		const persisted = db?.transition?.[id];
		if (!persisted) return reject("TRANSITION_WORKING_COPY_UNKNOWN", `unknown transition: ${id}`);
		if (!Array.isArray(normLengthPartition) || normLengthPartition.length !== 3) return reject("TRANSITION_PARTITION_INVALID", "normLengthPartition must contain three values");
		const values = normLengthPartition.map(Number);
		if (!values.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) return reject("TRANSITION_PARTITION_INVALID", "partition values must be finite in [0,1]");
		const sum = values.reduce((total, value) => total + value, 0);
		if (Math.abs(sum - 1) > 1e-6) return reject("TRANSITION_PARTITION_INVALID", "partition values must sum to 1");
		workingTransitions.set(id, { ...clone(persisted), normLengthPartition: values });
		return { ok: true, changed: true, status: "working-copy", presetId: id, record: clone(workingTransitions.get(id)), persistence: "runtime-working-copy-only" };
	}

	function resetWorkingCopy({ presetId } = {}) {
		const id = String(presetId ?? "").trim().toLowerCase();
		const changed = workingTransitions.delete(id);
		return { ok: true, changed, status: "persisted-read-only", presetId: id, record: clone(db?.transition?.[id] ?? null) };
	}

	return {
		listPresets,
		getPresetSpec,
		getCatalogue,
		updateWorkingCopy,
		resetWorkingCopy,
	};
}

function classifyTransition(id, record) {
	const key = String(id ?? "");
	if (key.includes("klauder")) return "klauder";
	if (key.startsWith("vienna") || key === "part_v6") return "vienna";
	if (key.includes("_k1")) return "first-derivative-defined";
	if (key.includes("_k2")) return "second-derivative-defined";
	if (record?.halfWave1 === record?.halfWave2) return "symmetric";
	return "composed";
}

function reject(code, reason) {
	return { ok: false, changed: false, status: "rejected", code, reason };
}
