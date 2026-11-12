// Transition library: the built-in transitionDB stays immutable, user records
// form a second layer of the same shape on top of it. The merged catalogue is
// what the query service and the resolver see.
//
// A user library file is "analog transDB": the same four levels, holding only
// the user's own records. It is how creations travel between AIM users.

import { RegistryResolver } from "../../aim-core/transition/registry/RegistryResolver.js";
import { createTransitionQueryService } from "../../aim-core/transition/query/createTransitionQueryService.js";
import { KappaFcnBuilder } from "../../aim-core/transition/runtime/KappaFcnBuilder.js";
import { buildProtoAst } from "../../aim-core/transition/ast/buildProtoAst.js";
import { makeEvalFn } from "../../aim-core/transition/ast/evalAst.js";
import { simplify } from "../../aim-core/transition/ast/simplify.js";
import { symDiff } from "../../aim-core/transition/ast/symDiff.js";
import { validateLookupV3 } from "../../domain/transition/registry/validator.js";
import {
	DEFAULT_COUPLING_ASSUMPTION,
	assessCouplingSuitability,
	cantFromCurvature,
	couplingEpsilon,
	curvatureFromCant,
} from "./cantCurvatureCoupling.js";

export const USER_LIBRARY_LEVELS = Object.freeze(["simpleFcn", "protoFcn", "halfWave", "transition"]);
export const HALFWAVE_QUANTITIES = Object.freeze(["curvature", "cant"]);
export const USER_LIBRARY_KIND = "user-library";

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const TRANSITION_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const PROBE_ID = "zz_user_library_probe";
const END_VALUE_TOLERANCE = 1e-6;

function clone(value) {
	return structuredClone(value);
}

function isObj(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function reject(code, reason) {
	return { ok: false, changed: false, status: "rejected", code, reason };
}

function emptyLayer() {
	return { simpleFcn: {}, protoFcn: {}, halfWave: {}, transition: {} };
}

function collectRefIds(node, out = new Set()) {
	if (!node || typeof node !== "object") return out;
	if (node.op === "ref" && node.id) out.add(String(node.id));
	for (const value of Object.values(node)) {
		if (Array.isArray(value)) for (const item of value) collectRefIds(item, out);
		else if (value && typeof value === "object") collectRefIds(value, out);
	}
	return out;
}

function halfWaveQuantity(record) {
	return record?.quantity ?? "curvature";
}

export function createTransitionLibraryService({ catalogue, userLibrary = null } = {}) {
	if (!isObj(catalogue) || !USER_LIBRARY_LEVELS.every((level) => isObj(catalogue[level]))) {
		throw new Error("createTransitionLibraryService: catalogue must be a transitionDB object");
	}
	const builtIn = catalogue;
	let user = emptyLayer();
	const workingCopies = new Map(); // presetId -> normLengthPartition
	const draftDescriptors = new Map(); // "hw1|hw2" -> descriptor of an unsaved combination
	let merged = null;
	let resolver = null;
	let query = null;

	function mergeWith(layer) {
		const out = { ...builtIn };
		for (const level of USER_LIBRARY_LEVELS) out[level] = { ...builtIn[level], ...layer[level] };
		return out;
	}

	function activate(layer) {
		user = layer;
		merged = mergeWith(user);
		resolver = new RegistryResolver(merged);
		query = createTransitionQueryService({ db: merged, registryResolver: resolver });
		draftDescriptors.clear();
		for (const [presetId, partition] of [...workingCopies]) {
			if (!query.updateWorkingCopy({ presetId, normLengthPartition: partition }).ok) workingCopies.delete(presetId);
		}
	}

	function isBuiltIn(level, id) {
		return Object.hasOwn(builtIn[level], id);
	}

	function transitionQuantity(db, record) {
		const first = halfWaveQuantity(db.halfWave[record.halfWave1]);
		const second = halfWaveQuantity(db.halfWave[record.halfWave2]);
		return first === second ? first : null;
	}

	function checkShape(level, id, value) {
		if (!USER_LIBRARY_LEVELS.includes(level)) return reject("USER_LIBRARY_LEVEL_UNKNOWN", `unknown level: ${level}`);
		if (typeof id !== "string" || !ID_PATTERN.test(id)) return reject("USER_LIBRARY_ID_INVALID", `id must match ${ID_PATTERN}: ${id}`);
		if (level === "transition" && !TRANSITION_ID_PATTERN.test(id)) return reject("USER_LIBRARY_ID_INVALID", `transition ids are lower case: ${id}`);
		if (id === PROBE_ID) return reject("USER_LIBRARY_ID_INVALID", `reserved id: ${id}`);
		if (isBuiltIn(level, id)) return reject("USER_LIBRARY_BUILT_IN_IMMUTABLE", `${level}.${id} is a built-in record`);
		if (!isObj(value)) return reject("USER_LIBRARY_RECORD_INVALID", `${level}.${id} must be an object`);
		if (level === "halfWave" && !HALFWAVE_QUANTITIES.includes(halfWaveQuantity(value))) {
			return reject("USER_LIBRARY_QUANTITY_INVALID", `halfWave.${id}: quantity must be one of ${HALFWAVE_QUANTITIES.join(", ")}`);
		}
		if (level === "transition") {
			const partition = value.normLengthPartition;
			if (!Array.isArray(partition) || partition.length !== 3) return reject("TRANSITION_PARTITION_INVALID", "normLengthPartition must contain three values");
			const numbers = partition.map(Number);
			if (!numbers.every((x) => Number.isFinite(x) && x >= 0 && x <= 1)) return reject("TRANSITION_PARTITION_INVALID", "partition values must be finite in [0,1]");
			if (Math.abs(numbers[0] + numbers[1] + numbers[2] - 1) > 1e-6) return reject("TRANSITION_PARTITION_INVALID", "partition values must sum to 1");
		}
		return null;
	}

	// Build one transition of `db` and check that it is usable: finite
	// everywhere, starting at 0 and reaching 1.
	function probeTransition(db, probeResolver, transitionId) {
		const descriptor = probeResolver.resolveTransitionDescriptor(transitionId);
		const preset = KappaFcnBuilder.buildPresetFromDescriptor(descriptor);
		for (let index = 0; index <= 200; index += 1) {
			const u = index / 200;
			for (const name of ["kappa", "kappa1", "kappa2"]) {
				if (!Number.isFinite(preset[name](u))) throw new Error(`${name} is not finite at u=${u}`);
			}
		}
		if (Math.abs(preset.kappa(0)) > END_VALUE_TOLERANCE) throw new Error(`value at the start is ${preset.kappa(0)}, expected 0`);
		if (Math.abs(preset.kappa(1) - 1) > END_VALUE_TOLERANCE) throw new Error(`value at the end is ${preset.kappa(1)}, expected 1`);
		return preset;
	}

	// Whole-layer validation: structure, references, and every user halfWave
	// and transition must actually build.
	function validateLayer(layer) {
		for (const [id, record] of Object.entries(layer.protoFcn)) {
			for (const refId of collectRefIds(record.tree ?? record)) {
				if (!Object.hasOwn(builtIn.simpleFcn, refId) && !Object.hasOwn(layer.simpleFcn, refId)) {
					return reject("USER_LIBRARY_REFERENCE_MISSING", `protoFcn.${id}: simpleFcn '${refId}' not found`);
				}
			}
		}
		const candidate = mergeWith(layer);
		const probes = {};
		for (const id of Object.keys(layer.halfWave)) {
			probes[`${PROBE_ID}_${Object.keys(probes).length}`] = { id, record: { halfWave1: id, halfWave2: id, normLengthPartition: [0.5, 0, 0.5] } };
		}
		const probeDb = { ...candidate, transition: { ...candidate.transition, ...Object.fromEntries(Object.entries(probes).map(([key, probe]) => [key, probe.record])) } };
		try {
			validateLookupV3(probeDb);
		} catch (error) {
			return reject("USER_LIBRARY_STRUCTURE_INVALID", String(error?.message ?? error));
		}
		let probeResolver;
		try {
			probeResolver = new RegistryResolver(probeDb);
		} catch (error) {
			return reject("USER_LIBRARY_STRUCTURE_INVALID", String(error?.message ?? error));
		}
		for (const [key, probe] of Object.entries(probes)) {
			try {
				probeTransition(probeDb, probeResolver, key);
			} catch (error) {
				return reject("USER_LIBRARY_HALFWAVE_UNSUITABLE", `halfWave.${probe.id}: ${String(error?.message ?? error)}`);
			}
		}
		for (const [id, record] of Object.entries(layer.transition)) {
			if (!transitionQuantity(candidate, record)) {
				return reject("USER_LIBRARY_QUANTITY_MIXED", `transition.${id}: both halfWaves must describe the same quantity`);
			}
			try {
				probeTransition(probeDb, probeResolver, id);
			} catch (error) {
				return reject("USER_LIBRARY_TRANSITION_UNSUITABLE", `transition.${id}: ${String(error?.message ?? error)}`);
			}
		}
		return null;
	}

	function dependents(layer, level, id) {
		const found = [];
		if (level === "simpleFcn") {
			for (const [key, record] of Object.entries(layer.protoFcn)) if (collectRefIds(record.tree ?? record).has(id)) found.push(`protoFcn.${key}`);
		} else if (level === "protoFcn") {
			for (const [key, record] of Object.entries(layer.halfWave)) if (record.proto === id) found.push(`halfWave.${key}`);
		} else if (level === "halfWave") {
			for (const [key, record] of Object.entries(layer.transition)) if (record.halfWave1 === id || record.halfWave2 === id) found.push(`transition.${key}`);
		}
		return found;
	}

	// All or nothing: either every record is stored or none.
	function putUserRecords(records = []) {
		if (!Array.isArray(records) || !records.length) return reject("USER_LIBRARY_RECORD_INVALID", "no records given");
		const next = clone(user);
		const stored = [];
		for (const { level, id, value } of records) {
			const shape = checkShape(level, id, value);
			if (shape) return shape;
			stored.push({ level, id, status: Object.hasOwn(next[level], id) ? "updated" : "created" });
			next[level][id] = clone(value);
		}
		const invalid = validateLayer(next);
		if (invalid) return invalid;
		activate(next);
		return { ok: true, changed: true, status: "stored", records: stored };
	}

	function putUserRecord({ level, id, value } = {}) {
		const result = putUserRecords([{ level, id, value }]);
		if (!result.ok) return result;
		return { ok: true, changed: true, status: result.records[0].status, level, id, record: clone(value) };
	}

	function removeUserRecord({ level, id } = {}) {
		if (!USER_LIBRARY_LEVELS.includes(level)) return reject("USER_LIBRARY_LEVEL_UNKNOWN", `unknown level: ${level}`);
		if (isBuiltIn(level, id)) return reject("USER_LIBRARY_BUILT_IN_IMMUTABLE", `${level}.${id} is a built-in record`);
		if (!Object.hasOwn(user[level], id)) return reject("USER_LIBRARY_RECORD_UNKNOWN", `${level}.${id} is not a user record`);
		const used = dependents(user, level, id);
		if (used.length) return reject("USER_LIBRARY_RECORD_IN_USE", `${level}.${id} is used by ${used.join(", ")}`);
		const next = clone(user);
		delete next[level][id];
		if (level === "transition") workingCopies.delete(id);
		activate(next);
		return { ok: true, changed: true, status: "removed", level, id };
	}

	function exportUserLibrary() {
		return { schema: { ...clone(builtIn.schema ?? {}), kind: USER_LIBRARY_KIND }, ...clone(user) };
	}

	// All or nothing. Identical records are accepted silently; a different
	// record under an existing user id needs `replace: true`.
	function importUserLibrary(library, { replace = false } = {}) {
		if (!isObj(library)) return reject("USER_LIBRARY_FILE_INVALID", "library must be an object");
		const next = clone(user);
		const imported = [];
		for (const level of USER_LIBRARY_LEVELS) {
			const records = library[level] ?? {};
			if (!isObj(records)) return reject("USER_LIBRARY_FILE_INVALID", `${level} must be an object`);
			for (const [id, value] of Object.entries(records)) {
				if (isBuiltIn(level, id) && JSON.stringify(builtIn[level][id]) === JSON.stringify(value)) continue;
				const shape = checkShape(level, id, value);
				if (shape) return shape;
				if (Object.hasOwn(next[level], id)) {
					if (JSON.stringify(next[level][id]) === JSON.stringify(value)) continue;
					if (!replace) return reject("USER_LIBRARY_RECORD_EXISTS", `${level}.${id} exists with a different definition`);
				}
				next[level][id] = clone(value);
				imported.push(`${level}.${id}`);
			}
		}
		const invalid = validateLayer(next);
		if (invalid) return invalid;
		if (imported.length) activate(next);
		return { ok: true, changed: imported.length > 0, status: "imported", imported };
	}

	function presetOrigin(presetId) {
		return Object.hasOwn(user.transition, presetId) ? "user" : "built-in";
	}

	function getPresetSpec(presetId) {
		const spec = query.getPresetSpec(presetId);
		const record = merged.transition[spec.presetId];
		return { ...spec, meta: { ...spec.meta, origin: presetOrigin(spec.presetId), quantity: transitionQuantity(merged, record) } };
	}

	function listPresets() {
		return query.listPresets().map((preset) => ({
			...preset,
			origin: presetOrigin(preset.id),
			quantity: transitionQuantity(merged, merged.transition[preset.id]),
		}));
	}

	function getCatalogue() {
		const base = query.getCatalogue();
		const records = Object.fromEntries(Object.entries(base.records).map(([level, list]) => [
			level,
			list.map((record) => ({ ...record, origin: USER_LIBRARY_LEVELS.includes(level) && Object.hasOwn(user[level], record.id) ? "user" : "built-in" })),
		]));
		return {
			...base,
			records,
			userLibrary: Object.fromEntries(USER_LIBRARY_LEVELS.map((level) => [level, Object.keys(user[level])])),
		};
	}

	function updateWorkingCopy(payload = {}) {
		const result = query.updateWorkingCopy(payload);
		if (result.ok) workingCopies.set(result.presetId, clone(result.record.normLengthPartition));
		return result;
	}

	function resetWorkingCopy(payload = {}) {
		const result = query.resetWorkingCopy(payload);
		workingCopies.delete(result.presetId);
		return result;
	}

	function couplingOf(preset, quantity, { assumption = null, epsilon = null, count = 201, tolerance, requiredOrder } = {}) {
		const usedAssumption = { ...DEFAULT_COUPLING_ASSUMPTION, ...(assumption ?? {}) };
		const eps = epsilon == null ? couplingEpsilon(usedAssumption) : Number(epsilon);
		const result = quantity === "cant"
			? curvatureFromCant({ cant: preset.kappa, cant1: preset.kappa1, cant2: preset.kappa2 }, eps, { count })
			: cantFromCurvature(preset.kappa, eps, { count });
		const curvatures = result.samples.map((sample) => sample.curvature);
		return {
			given: quantity,
			derived: quantity === "cant" ? "curvature" : "cant",
			epsilon: result.epsilon,
			assumption: epsilon == null ? usedAssumption : null,
			samples: result.samples,
			endSlopes: result.endSlopes,
			endDerivatives: result.endDerivatives,
			suitability: assessCouplingSuitability(result.endSlopes, {
				endDerivatives: result.endDerivatives,
				peaks: result.peaks,
				...(tolerance == null ? {} : { tolerance }),
				...(requiredOrder == null ? {} : { requiredOrder }),
			}),
			curvatureRange: { min: Math.min(...curvatures), max: Math.max(...curvatures) },
		};
	}

	/**
	 * Both quantities of one transition under the declared coupling model.
	 * A curvature transition yields its cant ramp and the end-slope verdict;
	 * a cant transition yields the track curvature that goes with it.
	 */
	function evaluateCoupling({ presetId, ...options } = {}) {
		const spec = getPresetSpec(presetId);
		if (!spec.meta.quantity) return reject("USER_LIBRARY_QUANTITY_MIXED", `transition.${spec.presetId}: mixed quantities`);
		const preset = KappaFcnBuilder.buildPresetFromDescriptor(spec.descriptor);
		return { ok: true, presetId: spec.presetId, ...couplingOf(preset, spec.meta.quantity, options) };
	}

	function listHalfWaves() {
		return Object.entries(merged.halfWave).map(([id, record]) => ({
			id,
			proto: record.proto,
			source: record.source ?? "kappa",
			quantity: halfWaveQuantity(record),
			origin: Object.hasOwn(user.halfWave, id) ? "user" : "built-in",
		}));
	}

	/**
	 * The same halfWave read as the other quantity. Built-in entries stay as
	 * they are: an existing halfWave with the same prototype and source and the
	 * wanted quantity is used, otherwise a user copy `<id>_CANT` / `<id>_CURV`
	 * is stored that points at the same prototype.
	 */
	function declareHalfWaveAs({ id, quantity } = {}) {
		if (!HALFWAVE_QUANTITIES.includes(quantity)) return reject("USER_LIBRARY_QUANTITY_INVALID", `quantity must be one of ${HALFWAVE_QUANTITIES.join(", ")}`);
		const record = merged.halfWave[id ?? ""];
		if (!record || !Object.hasOwn(merged.halfWave, id)) return reject("USER_LIBRARY_REFERENCE_MISSING", `halfWave '${id}' not found`);
		if (halfWaveQuantity(record) === quantity) return { ok: true, id, changed: false, status: "unchanged" };
		const source = record.source ?? "kappa";
		const twins = listHalfWaves().filter((hw) => hw.proto === record.proto && hw.source === source && hw.quantity === quantity);
		const twin = twins.find((hw) => hw.origin === "built-in") ?? twins[0];
		if (twin) return { ok: true, id: twin.id, changed: false, status: "existing" };
		const copyId = `${id}_${quantity === "cant" ? "CANT" : "CURV"}`;
		if (Object.hasOwn(merged.halfWave, copyId)) return reject("USER_LIBRARY_RECORD_EXISTS", `halfWave '${copyId}' exists with another definition`);
		const stored = putUserRecords([{ level: "halfWave", id: copyId, value: { proto: record.proto, source, ...(quantity === "cant" ? { quantity } : {}) } }]);
		if (!stored.ok) return stored;
		return { ok: true, id: copyId, changed: true, status: "created" };
	}

	// Descriptor of an unsaved combination; one resolver per halfWave pair.
	function draftDescriptor(halfWave1, halfWave2) {
		const key = `${halfWave1}|${halfWave2}`;
		if (!draftDescriptors.has(key)) {
			const draftDb = { ...merged, transition: { ...merged.transition, [PROBE_ID]: { halfWave1, halfWave2, normLengthPartition: [0.5, 0, 0.5] } } };
			draftDescriptors.set(key, new RegistryResolver(draftDb).resolveTransitionDescriptor(PROBE_ID));
		}
		return draftDescriptors.get(key);
	}

	/**
	 * An unsaved transition: two halfWaves and a partition. Returns the three
	 * curvature-level curves and the coupling, or the reason it cannot be built.
	 */
	function describeDraft({ halfWave1, halfWave2, normLengthPartition, count = 201, ...options } = {}) {
		for (const id of [halfWave1, halfWave2]) {
			if (!Object.hasOwn(merged.halfWave, id ?? "")) return reject("USER_LIBRARY_REFERENCE_MISSING", `halfWave '${id}' not found`);
		}
		const shape = checkShape("transition", "draft", { halfWave1, halfWave2, normLengthPartition });
		if (shape) return shape;
		const record = { halfWave1, halfWave2, normLengthPartition: normLengthPartition.map(Number) };
		const quantity = transitionQuantity(merged, record);
		if (!quantity) return reject("USER_LIBRARY_QUANTITY_MIXED", "both halfWaves must describe the same quantity");
		let preset;
		try {
			preset = KappaFcnBuilder.buildPresetFromDescriptor({ ...draftDescriptor(halfWave1, halfWave2), normLengthPartition: record.normLengthPartition });
		} catch (error) {
			return reject("USER_LIBRARY_TRANSITION_UNSUITABLE", String(error?.message ?? error));
		}
		const n = Math.max(3, Math.min(2001, Math.trunc(Number(count) || 201)));
		const samples = Array.from({ length: n }, (_, index) => {
			const u = index / (n - 1);
			return { u, k: preset.kappa(u), k1: preset.kappa1(u), k2: preset.kappa2(u) };
		});
		if (!samples.every((sample) => Number.isFinite(sample.k) && Number.isFinite(sample.k1) && Number.isFinite(sample.k2))) {
			return reject("USER_LIBRARY_TRANSITION_UNSUITABLE", "the combination is not finite everywhere");
		}
		return { ok: true, record, quantity, samples, coupling: couplingOf(preset, quantity, { count, ...options }) };
	}

	function listSimpleFunctions() {
		return Object.entries(merged.simpleFcn).map(([id, value]) => {
			// the argument interval of the plain piece cut from this function, if there is one
			const piece = Object.values(merged.protoFcn).find((proto) => proto?.op === "ref" && proto.id === id && Array.isArray(proto.crop));
			return { id, value: clone(value), origin: Object.hasOwn(user.simpleFcn, id) ? "user" : "built-in", interval: piece ? piece.crop.map(Number) : [0, 1] };
		});
	}

	/**
	 * An unsaved elementary function: f, f′ and f″ over `range`, and the frame
	 * that the argument interval `interval` cuts out of it.
	 */
	function describeFunction({ value, interval = [0, 1], range = null, count = 201 } = {}) {
		if (!isObj(value)) return reject("USER_LIBRARY_RECORD_INVALID", "the function must be an object");
		const [a, b] = (interval ?? []).map(Number);
		if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return reject("USER_LIBRARY_INTERVAL_INVALID", "the argument interval needs two different finite ends");
		const [x0, x1] = (range ?? [Math.min(a, b), Math.max(a, b)]).map(Number);
		if (!Number.isFinite(x0) || !Number.isFinite(x1) || !(x1 > x0)) return reject("USER_LIBRARY_INTERVAL_INVALID", "the plot range must be an increasing finite interval");
		let f; let f1; let f2;
		try {
			validateLookupV3({ ...builtIn, simpleFcn: { ...builtIn.simpleFcn, [PROBE_ID]: value } });
			// compiled over u in [0,1] with x = x0 + (x1 - x0) u
			const expr = simplify(buildProtoAst({ op: "ref", id: PROBE_ID, crop: [x0, x1] }, { [PROBE_ID]: value }));
			const d1 = simplify(symDiff(expr));
			const d2 = simplify(symDiff(d1));
			const span = x1 - x0;
			const e0 = makeEvalFn(expr); const e1 = makeEvalFn(d1); const e2 = makeEvalFn(d2);
			f = (x) => e0((x - x0) / span); f1 = (x) => e1((x - x0) / span) / span; f2 = (x) => e2((x - x0) / span) / (span * span);
		} catch (error) {
			return reject("USER_LIBRARY_STRUCTURE_INVALID", String(error?.message ?? error));
		}
		const n = Math.max(3, Math.min(2001, Math.trunc(Number(count) || 201)));
		const samples = Array.from({ length: n }, (_, index) => {
			const x = x0 + ((x1 - x0) * index) / (n - 1);
			return { x, f: f(x), f1: f1(x), f2: f2(x) };
		});
		if (!samples.every((sample) => Number.isFinite(sample.f))) return reject("USER_LIBRARY_STRUCTURE_INVALID", "the function is not finite on the plot range");
		const frame = { a, b, fa: f(a), fb: f(b) };
		const rises = Number.isFinite(frame.fa) && Number.isFinite(frame.fb) && Math.abs(frame.fb - frame.fa) > 1e-12;
		return { ok: true, samples, frame, usableAsPiece: rises, reason: rises ? null : "the function has the same value at both ends of the interval" };
	}

	/**
	 * An unsaved halfWave: a prototype tree over elementary functions, the
	 * quantity level it describes and its declaration. It is built and checked
	 * exactly like a stored one and shown as a lone entry halfWave.
	 */
	function describeHalfWave({ proto, source = "kappa", quantity = "curvature", count = 201 } = {}) {
		const protoId = `${PROBE_ID}_proto`; const halfWaveId = `${PROBE_ID}_hw`;
		if (!isObj(proto)) return reject("USER_LIBRARY_RECORD_INVALID", "the prototype must be an object");
		if (!HALFWAVE_QUANTITIES.includes(quantity)) return reject("USER_LIBRARY_QUANTITY_INVALID", `quantity must be one of ${HALFWAVE_QUANTITIES.join(", ")}`);
		const layer = clone(user);
		layer.protoFcn[protoId] = clone(proto);
		layer.halfWave[halfWaveId] = { proto: protoId, source, quantity };
		const invalid = validateLayer(layer);
		if (invalid) return { ...invalid, reason: invalid.reason.replaceAll(halfWaveId, "draft").replaceAll(protoId, "draft") };
		const draftDb = mergeWith(layer);
		draftDb.transition = { ...draftDb.transition, [PROBE_ID]: { halfWave1: halfWaveId, halfWave2: halfWaveId, normLengthPartition: [1, 0, 0] } };
		let preset;
		try {
			preset = KappaFcnBuilder.buildPresetFromDescriptor(new RegistryResolver(draftDb).resolveTransitionDescriptor(PROBE_ID));
		} catch (error) {
			return reject("USER_LIBRARY_HALFWAVE_UNSUITABLE", String(error?.message ?? error));
		}
		const n = Math.max(3, Math.min(2001, Math.trunc(Number(count) || 201)));
		const samples = Array.from({ length: n }, (_, index) => {
			const u = index / (n - 1);
			return { u, k: preset.kappa(u), k1: preset.kappa1(u), k2: preset.kappa2(u) };
		});
		return { ok: true, quantity, source, samples, endSlopes: { start: preset.kappa1(0), end: preset.kappa1(1) } };
	}

	activate(emptyLayer());
	if (userLibrary) {
		const loaded = importUserLibrary(userLibrary);
		if (!loaded.ok) throw new Error(`createTransitionLibraryService: ${loaded.code}: ${loaded.reason}`);
	}

	return {
		listPresets,
		getPresetSpec,
		getCatalogue,
		updateWorkingCopy,
		resetWorkingCopy,
		putUserRecord,
		putUserRecords,
		removeUserRecord,
		exportUserLibrary,
		importUserLibrary,
		evaluateCoupling,
		listHalfWaves,
		declareHalfWaveAs,
		listSimpleFunctions,
		describeDraft,
		describeFunction,
		describeHalfWave,
		resolveTransitionDescriptor: (presetId) => resolver.resolveTransitionDescriptor(presetId),
	};
}
