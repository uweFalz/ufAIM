// symInt.js (schema_v3)
// Symbolic *domain* integral: I(u) = \int_0^u f(t) dt
//
// This is intentionally NOT a general CAS. It supports the restricted family:
// - polynomials in implicit u only (poly.arg absent)
// - trig affine-only: sin(m*u+n), cos(m*u+n) (no explicit arg)
// - scalar factors via {op:'sc', value, arg}
// - add/neg/sc wrappers
//
// Key detail: we bake the boundary condition I(0)=0 into the AST. For polynomials this is
// automatic. For trig we return F(u)-F(0) by adding the required constant term.

import { simplify, mkConst, mkPoly, mkAdd, mkNeg, mkSc } from './simplify.js';

function isObj(v) { return v && typeof v==='object' && !Array.isArray(v); } 

function polyIntCoeff(c) {
	const out=[0];
	for (let i=0, len=c.length; i<len; i++) out[i+1] = Number(c[i])/(i+1);
	return out;
}

export function symInt(node) {
	if (node==null) throw new Error('symInt: node null');
	if (typeof node==='number') return mkPoly([0, Number(node)]);
	if (!isObj(node)) throw new Error('symInt: node must be object');

	switch (node.op) {
		case 'const': {
			// ∫ c du = c*u  (u is poly [0,1])
			return simplify(mkPoly([0, Number(node.value)]));
		}

		case 'pi': {
			return simplify(mkPoly([0, Math.PI]));
		}

		case '2pi': {
			return simplify(mkPoly([0, 2*Math.PI]));
		}

		case 'poly': {
			if (node.arg) throw new Error('symInt: poly with arg not supported (should be composed earlier)');
			return simplify(mkPoly(polyIntCoeff(node.coeff || [])));
		}

		case 'sin': {
			const m = ('m' in node) ? Number(node.m) : 1;
			const n = ('n' in node) ? Number(node.n) : 0;

			if (!Number.isFinite(m) || Math.abs(m) < 1e-15) {
				// sin(n) constant -> sin(n) * u
				return mkPoly([0, Math.sin(n)]);
			}

			// ∫0^u sin(m t + n) dt = (-cos(m u + n) + cos(n)) / m
			const termU = mkSc(-1 / m, { op: 'cos', m, n });
			const term0 = mkConst(Math.cos(n) / m);
			return mkAdd([termU, term0]);
		}

		case 'cos': {
			const m = ('m' in node) ? Number(node.m) : 1;
			const n = ('n' in node) ? Number(node.n) : 0;

			if (!Number.isFinite(m) || Math.abs(m) < 1e-15) {
				// cos(n) constant -> cos(n) * u
				return mkPoly([0, Math.cos(n)]);
			}

			// ∫0^u cos(m t + n) dt = (sin(m u + n) - sin(n)) / m
			const termU = mkSc(1 / m, { op: 'sin', m, n });
			const term0 = mkConst(-Math.sin(n) / m);
			return mkAdd([termU, term0]);
		}

		case 'neg': {
			return simplify(mkNeg(symInt(node.arg)));
		}

		case 'sc': {
			return simplify(mkSc(Number(node.value), symInt(node.arg)));
		}

		case 'add': {
			return simplify(mkAdd((node.args || []).map(symInt)));
		}

		case 'mul': {
			// only support constant*expr here; simplify() should have normalized to sc
			throw new Error("symInt: unsupported op 'mul' (expected sc + poly/trig/add/neg)");
		}

		case 'pow': {
			// Only for poly bases which simplify expanded; if it still exists, refuse.
			throw new Error("symInt: unsupported op 'pow' (expected simplify to expand for poly)");
		}

		default: {
			throw new Error(`symInt: unsupported op '${node.op}'`);
		}
	}
}
