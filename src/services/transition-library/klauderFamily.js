// src/services/transition-library/klauderFamily.js
//
// Klauder family as a generator instead of fixed records.
//
// The built-in database defines its Klauder halfWaves through the second
// derivative of the curvature on the argument interval [-1, 0]:
//
//     kappa''(x)  ~  (1 + x)^m * x^n * (1 - x)^m
//
// (records PROTO_KLAU_m_n / HW_KLAU_m_n, source "kappa2"). Two integers name
// a member, so the family is generated here rather than listed. The result
// is ordinary user-library data: a prototype built from the built-in
// simple functions ROOTm1 = 1 + x, IDENT = x, ROOTp1 = 1 - x, and a halfWave
// that reads it as kappa''.

export const KLAUDER_INTERVAL = Object.freeze([-1, 0]);
export const KLAUDER_SOURCE = "kappa2";
export const KLAUDER_EXPONENT_MAX = 24;

function reject(code, reason) {
	return { ok: false, code, reason };
}

function exponent(value, name) {
	const number = Number(value);
	if (value === "" || value === null || value === undefined || !Number.isInteger(number) || number < 0 || number > KLAUDER_EXPONENT_MAX) {
		return reject("KLAUDER_EXPONENT_INVALID", `${name} must be a whole number from 0 to ${KLAUDER_EXPONENT_MAX}`);
	}
	return { ok: true, value: number };
}

function parameters({ m, n } = {}) {
	const em = exponent(m, "m");
	if (!em.ok) return em;
	const en = exponent(n, "n");
	if (!en.ok) return en;
	return { ok: true, m: em.value, n: en.value };
}

// The three factors in the order the built-in records use.
export function klauderTerms(input) {
	const p = parameters(input);
	if (!p.ok) return p;
	const [a, b] = KLAUDER_INTERVAL;
	return {
		ok: true,
		m: p.m,
		n: p.n,
		combine: "mul",
		source: KLAUDER_SOURCE,
		terms: [
			{ factor: 1, fn: "ROOTp1", a, b, power: p.m },
			{ factor: 1, fn: "IDENT", a, b, power: p.n },
			{ factor: 1, fn: "ROOTm1", a, b, power: p.m },
		],
	};
}

// Prototype in exactly the shape of the built-in PROTO_KLAU_m_n records.
export function klauderPrototype(input) {
	const built = klauderTerms(input);
	if (!built.ok) return built;
	return {
		ok: true,
		m: built.m,
		n: built.n,
		source: KLAUDER_SOURCE,
		proto: {
			op: "mul",
			args: built.terms.map((term) => ({ op: "pow", base: { op: "ref", id: term.fn, crop: [term.a, term.b] }, exp: term.power })),
		},
	};
}

export function klauderName(input) {
	const p = parameters(input);
	return p.ok ? `KLAUDER_${p.m}_${p.n}` : null;
}

// Records ready for putUserRecords of the transition library service.
export function klauderRecords({ m, n, id = null, quantity = "curvature" } = {}) {
	const built = klauderPrototype({ m, n });
	if (!built.ok) return built;
	const name = id ?? klauderName(built);
	return {
		ok: true,
		m: built.m,
		n: built.n,
		records: [
			{ level: "protoFcn", id: `PROTO_${name}`, value: built.proto },
			{ level: "halfWave", id: `HW_${name}`, value: { proto: `PROTO_${name}`, source: KLAUDER_SOURCE, ...(quantity === "cant" ? { quantity } : {}) } },
		],
	};
}
