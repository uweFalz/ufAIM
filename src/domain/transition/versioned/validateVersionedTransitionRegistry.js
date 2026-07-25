import {
	TRANSITION_COMPONENT_ORDER,
	TRANSITION_SCHEMA_VERSION,
	TransitionRepresentationLevel,
	ZERO_LENGTH_POLICY,
} from "./quantityRoles.js";

function isObj(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finite(value) {
	return Number.isFinite(Number(value));
}

function collectRefIds(node, out = new Set()) {
	if (!node || typeof node !== "object") return out;
	if (node.op === "ref" && node.id) out.add(String(node.id));
	for (const value of Object.values(node)) {
		if (Array.isArray(value)) {
			for (const item of value) collectRefIds(item, out);
		} else if (value && typeof value === "object") {
			collectRefIds(value, out);
		}
	}
	return out;
}

function signatureTransition(legacyTransition) {
	if (!isObj(legacyTransition)) return "<invalid-transition>";
	const part = Array.isArray(legacyTransition.normLengthPartition)
		? legacyTransition.normLengthPartition.map((x) => Number(x))
		: [null, null, null];
	return [
		String(legacyTransition.halfWave1 ?? ""),
		String(legacyTransition.halfWave2 ?? ""),
		part.map((x) => Number.isFinite(x) ? String(x) : "NaN").join("|"),
	].join("::");
}

export function validateVersionedTransitionRegistry({ versionedRegistry, legacyDb }) {
	const errors = [];
	const warnings = [];
	const diagnostics = {
		disconnectedConstants: [],
		duplicateEquivalentTransitions: [],
		adapterAssumptions: [],
		unsupportedLegacyFields: [],
	};

	if (!isObj(versionedRegistry)) {
		return {
			ok: false,
			errors: [{ code: "REGISTRY_MISSING", message: "versionedRegistry must be an object" }],
			warnings,
			diagnostics,
			inventory: null,
		};
	}

	if (!isObj(versionedRegistry.schema)) {
		errors.push({ code: "SCHEMA_MISSING", message: "schema object is required" });
	} else if (versionedRegistry.schema.version !== TRANSITION_SCHEMA_VERSION) {
		errors.push({
			code: "SCHEMA_VERSION_UNSUPPORTED",
			message: `unsupported schema version '${versionedRegistry.schema.version}'`,
		});
	}

	const records = versionedRegistry.records;
	if (!isObj(records)) {
		errors.push({ code: "RECORDS_MISSING", message: "records object is required" });
	}

	const levels = ["constant", "simpleFcn", "protoFcn", "halfWave", "transition"];
	for (const level of levels) {
		if (!isObj(records?.[level])) {
			errors.push({ code: "LEVEL_MISSING", message: `records.${level} must be an object` });
		}
	}

	const inventory = Object.fromEntries(levels.map((level) => [level, Object.keys(records?.[level] ?? {}).length]));

	const allIds = new Set();
	for (const level of levels) {
		for (const id of Object.keys(records?.[level] ?? {})) {
			if (allIds.has(id)) {
				warnings.push({
					code: "ID_REUSED_ACROSS_LEVELS",
					message: `identifier '${id}' exists in multiple levels`,
				});
			}
			allIds.add(id);
		}
	}

	for (const [id, hw] of Object.entries(records?.halfWave ?? {})) {
		const legacy = hw?.legacyRecord ?? {};
		if (!legacy?.proto || !records?.protoFcn?.[legacy.proto]) {
			errors.push({ code: "HALFWAVE_PROTO_MISSING", message: `halfWave '${id}' references missing proto '${legacy?.proto}'` });
		}
		const level = legacy?.source ?? TransitionRepresentationLevel.KAPPA;
		if (!Object.values(TransitionRepresentationLevel).includes(level)) {
			errors.push({ code: "HALFWAVE_SOURCE_UNSUPPORTED", message: `halfWave '${id}' uses unsupported source '${level}'` });
		}
	}

	for (const [id, tr] of Object.entries(records?.transition ?? {})) {
		const legacy = tr?.legacyRecord ?? {};
		if (!legacy?.halfWave1 || !records?.halfWave?.[legacy.halfWave1]) {
			errors.push({ code: "TRANSITION_HALFWAVE1_MISSING", message: `transition '${id}' references missing halfWave1 '${legacy?.halfWave1}'` });
		}
		if (!legacy?.halfWave2 || !records?.halfWave?.[legacy.halfWave2]) {
			errors.push({ code: "TRANSITION_HALFWAVE2_MISSING", message: `transition '${id}' references missing halfWave2 '${legacy?.halfWave2}'` });
		}

		const part = tr?.typedParameters?.normLengthPartition?.value;
		if (!Array.isArray(part) || part.length !== 3) {
			errors.push({ code: "TRANSITION_PARTITION_INVALID", message: `transition '${id}' partition must be a 3-element array` });
		} else {
			for (let i = 0; i < 3; i++) {
				if (!finite(part[i])) {
					errors.push({ code: "TRANSITION_PARTITION_NONFINITE", message: `transition '${id}' partition[${i}] must be finite` });
				}
			}
			const w1 = Number(tr?.typedParameters?.w1?.value);
			const w2 = Number(tr?.typedParameters?.w2?.value);
			if (!(w1 >= 0 && w2 >= 0 && w1 <= 1 && w2 <= 1 && w1 <= w2)) {
				errors.push({ code: "TRANSITION_PARTITION_ORDER", message: `transition '${id}' violates 0 <= w1 <= w2 <= 1` });
			}
		}

		if (!Array.isArray(tr?.components)) {
			errors.push({ code: "TRANSITION_COMPONENTS_MISSING", message: `transition '${id}' components array missing` });
		} else {
			const roles = tr.components.map((component) => component.role);
			if (roles.join("|") !== TRANSITION_COMPONENT_ORDER.join("|")) {
				errors.push({
					code: "TRANSITION_COMPONENT_ORDER_INVALID",
					message: `transition '${id}' components must follow '${TRANSITION_COMPONENT_ORDER.join(",")}'`,
				});
			}
		}

		if (tr?.zeroLengthPolicy !== ZERO_LENGTH_POLICY.id) {
			errors.push({
				code: "ZERO_LENGTH_POLICY_UNSUPPORTED",
				message: `transition '${id}' uses unsupported zeroLengthPolicy '${tr?.zeroLengthPolicy}'`,
			});
		}

		if (!isObj(tr?.boundaryConditions) || !isObj(tr.boundaryConditions.normalized)) {
			errors.push({ code: "BOUNDARY_STRUCTURE_INVALID", message: `transition '${id}' boundaryConditions.normalized missing` });
		}

		if (!isObj(tr?.provenance) || !isObj(tr.provenance.fieldProvenance)) {
			errors.push({ code: "PROVENANCE_MISSING", message: `transition '${id}' provenance is incomplete` });
		}
	}

	for (const [id, proto] of Object.entries(records?.protoFcn ?? {})) {
		const legacy = proto?.legacyRecord;
		const tree = legacy?.tree ?? legacy;
		for (const refId of collectRefIds(tree)) {
			if (!records?.simpleFcn?.[refId]) {
				errors.push({ code: "PROTO_SIMPLE_REF_MISSING", message: `protoFcn '${id}' references missing simpleFcn '${refId}'` });
			}
		}
	}

	for (const [id, sf] of Object.entries(records?.simpleFcn ?? {})) {
		const legacy = sf?.legacyRecord ?? {};
		if (legacy.op === "poly") {
			if (!Array.isArray(legacy.coeff)) {
				errors.push({ code: "SIMPLEFCN_POLY_COEFF_MISSING", message: `simpleFcn '${id}' poly coeff array missing` });
			} else if (!legacy.coeff.every((x) => finite(x))) {
				errors.push({ code: "SIMPLEFCN_POLY_COEFF_NONFINITE", message: `simpleFcn '${id}' coeff must be finite` });
			}
		}
		if ((legacy.op === "sin" || legacy.op === "cos") && (!finite(legacy.m) || !finite(legacy.n))) {
			errors.push({ code: "SIMPLEFCN_TRIG_PARAM_NONFINITE", message: `simpleFcn '${id}' trig params must be finite` });
		}
	}

	const constantIds = Object.keys(records?.constant ?? {});
	const usedConstantIds = new Set();
	for (const sf of Object.values(records?.simpleFcn ?? {})) {
		const legacy = sf?.legacyRecord ?? {};
		if (legacy.op === "pi" || legacy.op === "2pi") {
			usedConstantIds.add(legacy.op === "pi" ? "PI" : "2PI");
		}
	}
	for (const id of constantIds) {
		if (!usedConstantIds.has(id)) {
			diagnostics.disconnectedConstants.push({ id, status: "unreachable-from-simpleFcn" });
		}
	}
	if (diagnostics.disconnectedConstants.length > 0) {
		warnings.push({
			code: "CONSTANTS_DISCONNECTED",
			message: `${diagnostics.disconnectedConstants.length} constants are disconnected from active resolver references`,
		});
	}

	if (isObj(legacyDb?.transition)) {
		const bySig = new Map();
		for (const [id, tr] of Object.entries(legacyDb.transition)) {
			const sig = signatureTransition(tr);
			const existing = bySig.get(sig) ?? [];
			existing.push(id);
			bySig.set(sig, existing);
		}
		for (const ids of bySig.values()) {
			if (ids.length > 1) {
				diagnostics.duplicateEquivalentTransitions.push({ ids: [...ids], relation: "equivalent-transition-definition" });
			}
		}
		const v6pair = diagnostics.duplicateEquivalentTransitions.find((entry) => entry.ids.includes("vienna6") && entry.ids.includes("part_v6"));
		if (v6pair) {
			warnings.push({ code: "VIENNA6_PARTV6_DUPLICATE", message: "transition records 'vienna6' and 'part_v6' are equivalent" });
		}
	}

	for (const [id, tr] of Object.entries(records?.transition ?? {})) {
		const assumptions = tr?.compatibility?.adapter?.assumptions ?? [];
		for (const assumption of assumptions) {
			diagnostics.adapterAssumptions.push({ transitionId: id, assumption });
		}
		const unsupportedFields = Object.keys(tr?.legacyRecord ?? {}).filter((k) => !["halfWave1", "halfWave2", "normLengthPartition", "label"].includes(k));
		if (unsupportedFields.length > 0) {
			diagnostics.unsupportedLegacyFields.push({ transitionId: id, fields: unsupportedFields });
		}
	}

	return {
		ok: errors.length === 0,
		errors,
		warnings,
		diagnostics,
		inventory,
	};
}