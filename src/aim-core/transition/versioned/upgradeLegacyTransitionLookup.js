import {
	TRANSITION_COMPONENT_ORDER,
	TRANSITION_SCHEMA_VERSION,
	TRANSITION_UPGRADER_VERSION,
	TransitionComponentRole,
	TransitionQuantityRole,
	TransitionRepresentationLevel,
	ZERO_LENGTH_POLICY,
} from "../grammar/TransitionQuantityRoles.js";

const EPS = 1e-12;

function clone(value) {
	return structuredClone(value);
}

function isObj(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteOrNull(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function classifyTransitionFamily(id, transition) {
	const key = String(id ?? "").toLowerCase();
	if (key.includes("klauder")) return "klauder";
	if (key.startsWith("vienna") || key === "part_v6") return "vienna";
	if (key.includes("_k1")) return "first-derivative-defined";
	if (key.includes("_k2")) return "second-derivative-defined";
	if (transition?.halfWave1 && transition?.halfWave1 === transition?.halfWave2) return "symmetric";
	return "composed";
}

function fieldProvenance(status, detail = null) {
	return { status, detail };
}

function buildBaseProvenance({ id, legacyLevel, sourceFile, legacyRecord }) {
	return {
		originalRecordIdentifier: id,
		originalRegistryLevel: legacyLevel,
		sourceFile,
		upgraderVersion: TRANSITION_UPGRADER_VERSION,
		legacyRecord: clone(legacyRecord),
		fieldProvenance: {},
	};
}

function buildTransitionComponents({ transitionId, halfWave1, halfWave2, lambdas, sourceFile }) {
	const l1 = finiteOrNull(lambdas[0]);
	const lc = finiteOrNull(lambdas[1]);
	const l2 = finiteOrNull(lambdas[2]);

	const w1 = l1 == null ? null : l1;
	const w2 = l1 == null || lc == null ? null : l1 + lc;

	const definitions = [
		{
			role: TransitionComponentRole.HALFWAVE_IN,
			reference: { kind: "halfWave", id: halfWave1 ?? null },
			normalizedStart: 0,
			normalizedEnd: w1,
			normalizedLength: l1,
			orientation: "forward",
			reversed: false,
		},
		{
			role: TransitionComponentRole.CLOTHOID_CORE,
			reference: { kind: "protoFcn", id: "clothoCore" },
			normalizedStart: w1,
			normalizedEnd: w2,
			normalizedLength: lc,
			orientation: "forward",
			reversed: false,
		},
		{
			role: TransitionComponentRole.HALFWAVE_OUT,
			reference: { kind: "halfWave", id: halfWave2 ?? null },
			normalizedStart: w2,
			normalizedEnd: 1,
			normalizedLength: l2,
			orientation: "reversed-halfwave",
			reversed: true,
		},
	];

	return definitions.map((def, index) => ({
		componentId: `${transitionId}::${def.role}`,
		role: def.role,
		order: index,
		reference: def.reference,
		normalizedDomain: {
			start: def.normalizedStart,
			end: def.normalizedEnd,
		},
		normalizedLength: {
			role: TransitionQuantityRole.NORMALIZED_COMPONENT_LENGTH,
			value: def.normalizedLength,
		},
		orientation: def.orientation,
		reversed: def.reversed,
		zeroLength: Number.isFinite(def.normalizedLength) ? Math.abs(def.normalizedLength) <= EPS : null,
		provenance: {
			sourceFile,
			upgraderVersion: TRANSITION_UPGRADER_VERSION,
			fieldProvenance: {
				normalizedDomain: fieldProvenance("derived", "derived from normLengthPartition"),
				normalizedLength: fieldProvenance("sourced", "transition.normLengthPartition"),
				orientation: fieldProvenance("derived", "canonical berlinish component orientation"),
			},
		},
	}));
}

function buildTransitionRecord({ id, transition, halfWaveDef1, halfWaveDef2, sourceFile }) {
	const partitionWasProvided = Array.isArray(transition?.normLengthPartition) && transition.normLengthPartition.length === 3;
	const rawPartition = partitionWasProvided ? transition.normLengthPartition : [0, 1, 0];
	const lambdas = rawPartition.map((value) => finiteOrNull(value));

	const l1 = lambdas[0];
	const lc = lambdas[1];
	const l2 = lambdas[2];
	const w1 = l1;
	const w2 = l1 == null || lc == null ? null : l1 + lc;

	const components = buildTransitionComponents({
		transitionId: id,
		halfWave1: transition?.halfWave1,
		halfWave2: transition?.halfWave2,
		lambdas,
		sourceFile,
	});

	const provenance = buildBaseProvenance({
		id,
		legacyLevel: "transition",
		sourceFile,
		legacyRecord: transition,
	});

	provenance.fieldProvenance = {
		id: fieldProvenance("sourced", "transition key"),
		label: fieldProvenance(transition?.label ? "sourced" : "defaulted", transition?.label ? "transition.label" : "fallback to transition id"),
		normLengthPartition: fieldProvenance(partitionWasProvided ? "sourced" : "defaulted", partitionWasProvided ? "transition.normLengthPartition" : "fallback [0,1,0]"),
		w1: fieldProvenance("derived", "normLengthPartition[0]"),
		w2: fieldProvenance("derived", "normLengthPartition[0] + normLengthPartition[1]"),
		components: fieldProvenance("derived", "berlinish ordered composition"),
	};

	const inSource = halfWaveDef1?.source ?? "kappa";
	const outSource = halfWaveDef2?.source ?? "kappa";

	return {
		schemaVersion: TRANSITION_SCHEMA_VERSION,
		id,
		kind: "transition",
		label: transition?.label ?? id,
		legacyRecord: clone(transition),
		functionFamily: classifyTransitionFamily(id, transition),
		representationLevel: [
			inSource,
			TransitionRepresentationLevel.KAPPA,
			outSource,
		],
		normalizedDomain: { start: 0, end: 1 },
		typedParameters: {
			normLengthPartition: {
				role: TransitionQuantityRole.NORMALIZED_COMPONENT_LENGTH,
				value: lambdas,
			},
			w1: {
				role: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER,
				value: w1,
			},
			w2: {
				role: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER,
				value: w2,
			},
		},
		coefficients: [],
		boundaryConditions: {
			normalized: {
				start: 0,
				end: 1,
			},
			partition: {
				w1,
				w2,
			},
			kappa: {
				start: {
					declared: 0,
					calculated: null,
					validation: "not-validated",
					tolerance: null,
				},
				end: {
					declared: 1,
					calculated: null,
					validation: "not-validated",
					tolerance: null,
				},
			},
			kappa1: {},
			kappa2: {},
			kappaInt: {},
			joins: {
				inToCore: {
					normalizedPosition: w1,
					declared: {},
					calculated: {},
					validation: "not-validated",
					tolerance: null,
				},
				coreToOut: {
					normalizedPosition: w2,
					declared: {},
					calculated: {},
					validation: "not-validated",
					tolerance: null,
				},
			},
		},
		components,
		componentOrdering: TRANSITION_COMPONENT_ORDER,
		zeroLengthPolicy: ZERO_LENGTH_POLICY.id,
		provenance,
		compatibility: {
			legacy: {
				id,
				level: "transition",
				record: clone(transition),
			},
			adapter: {
				type: "legacy-descriptor",
				assumptions: [
					"clothoid core is always protoFcn.clothoCore",
					"component roles are explicit and not inferred by position",
				],
			},
		},
		storedValues: {
			normLengthPartition: clone(rawPartition),
			halfWave1: transition?.halfWave1 ?? null,
			halfWave2: transition?.halfWave2 ?? null,
		},
		derivedValues: {
			w1,
			w2,
			partitionOrdering: (Number.isFinite(w1) && Number.isFinite(w2)) ? (w1 <= w2 ? "ordered" : "reversed") : "unknown",
		},
	};
}

function normalizeRecords(levelName, input, sourceFile) {
	const out = {};
	for (const [id, legacyRecord] of Object.entries(input ?? {})) {
		const provenance = buildBaseProvenance({
			id,
			legacyLevel: levelName,
			sourceFile,
			legacyRecord,
		});

		out[id] = {
			schemaVersion: TRANSITION_SCHEMA_VERSION,
			id,
			kind: levelName,
			legacyRecord: clone(legacyRecord),
			provenance,
			compatibility: {
				legacy: {
					id,
					level: levelName,
					record: clone(legacyRecord),
				},
			},
		};
	}
	return out;
}

export function upgradeLegacyTransitionLookup(legacyDb, options = {}) {
	if (!isObj(legacyDb)) {
		throw new Error("upgradeLegacyTransitionLookup: legacyDb must be an object");
	}

	const sourceFile = options.sourceFile ?? "src/domain/transition/transitionLookup.json";

	const constant = normalizeRecords("constant", legacyDb.constant, sourceFile);
	const simpleFcn = normalizeRecords("simpleFcn", legacyDb.simpleFcn, sourceFile);
	const protoFcn = normalizeRecords("protoFcn", legacyDb.protoFcn, sourceFile);
	const halfWave = normalizeRecords("halfWave", legacyDb.halfWave, sourceFile);

	const transition = {};
	for (const [id, record] of Object.entries(legacyDb.transition ?? {})) {
		transition[id] = buildTransitionRecord({
			id,
			transition: record,
			halfWaveDef1: legacyDb?.halfWave?.[record?.halfWave1],
			halfWaveDef2: legacyDb?.halfWave?.[record?.halfWave2],
			sourceFile,
		});
	}

	return {
		schema: {
			name: "berlinish-transition-registry",
			version: TRANSITION_SCHEMA_VERSION,
			legacySchema: clone(legacyDb?.schema ?? null),
			upgraderVersion: TRANSITION_UPGRADER_VERSION,
		},
		metadata: {
			zeroLengthPolicy: ZERO_LENGTH_POLICY,
			composition: {
				formula: "T = H_in + C + H_out",
				orderedRoles: TRANSITION_COMPONENT_ORDER,
			},
			representationLevels: Object.values(TransitionRepresentationLevel),
			quantityRoles: Object.values(TransitionQuantityRole),
		},
		records: {
			constant,
			simpleFcn,
			protoFcn,
			halfWave,
			transition,
		},
		compatibility: {
			strategy: "in-memory-upgrade",
			legacySourcePreserved: true,
			note: "No source record is mutated; all upgraded records keep legacy provenance.",
		},
	};
}

export function toLegacyTransitionDescriptor({ legacyDb, versionedTransitionId }) {
	const key = String(versionedTransitionId ?? "").toLowerCase();
	const tr = legacyDb?.transition?.[key];
	if (!tr) {
		throw new Error(`toLegacyTransitionDescriptor: unknown transition '${key}'`);
	}

	const hw1Id = tr.halfWave1;
	const hw2Id = tr.halfWave2;
	const hw1 = legacyDb?.halfWave?.[hw1Id];
	const hw2 = legacyDb?.halfWave?.[hw2Id];
	const core = legacyDb?.protoFcn?.clothoCore;

	if (!hw1 || !hw2 || !core) {
		throw new Error(`toLegacyTransitionDescriptor: incomplete refs for transition '${key}'`);
	}

	return {
		id: key,
		label: tr.label ?? key,
		normLengthPartition: tr.normLengthPartition ?? [0, 1, 0],
		halfWave1: {
			id: hw1Id,
			protoId: hw1.proto,
			protoDef: legacyDb?.protoFcn?.[hw1.proto],
			source: hw1.source ?? "kappa",
		},
		halfWave2: {
			id: hw2Id,
			protoId: hw2.proto,
			protoDef: legacyDb?.protoFcn?.[hw2.proto],
			source: hw2.source ?? "kappa",
		},
		core: {
			id: "clothoCore",
			protoId: "clothoCore",
			protoDef: core,
			source: "kappa",
		},
		simpleFcn: legacyDb?.simpleFcn ?? {},
		meta: {
			kind: "transitionDescriptor",
			schemaVersion: TRANSITION_SCHEMA_VERSION,
		},
	};
}

export function createLegacyRoundTripSnapshot(versionedRegistry) {
	const levels = ["constant", "simpleFcn", "protoFcn", "halfWave", "transition"];
	const out = {
		schema: {
			name: "legacy-roundtrip-snapshot",
			version: "1",
		},
	};

	for (const level of levels) {
		out[level] = {};
		for (const [id, record] of Object.entries(versionedRegistry?.records?.[level] ?? {})) {
			out[level][id] = clone(record?.legacyRecord ?? record?.compatibility?.legacy?.record ?? null);
		}
	}

	return out;
}
