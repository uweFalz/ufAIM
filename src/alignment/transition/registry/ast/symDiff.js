// ast/symDiff.js (schema_v3)
// Symbolic derivative d/du.

import { simplify, mkConst, mkPoly, mkAdd, mkNeg, mkSc } from './simplify.js';

function isObj(v) { return v && typeof v==='object'&&!Array.isArray(v); } 

function cleanPoly(coeff) {
	let last = coeff.length-1;
	while (last >= 0 && (!Number.isFinite(coeff[last]) || coeff[last]===0)) last--;
	return coeff.slice(0, last+1);
}

function polyDeriv(coeff) {
	if (coeff.length<=1) return [];
	const out = new Array(Math.max(0, coeff.length-1)).fill(0);
	for (let i=1; i<coeff.length; i++) out[i-1] = Number(coeff[i] || 0)*i;
	return cleanPoly(out);
}

export function symDiff(expr){
	return simplify(diffExpr(expr));
}

function diffExpr(node){
	if (node==null) return mkConst(0);
	if (typeof node==='number') return mkConst(0);
	if (!isObj(node)) throw new Error('symDiff: node must be object');

	switch(node.op) {
		case 'const':
		case 'pi':
		case '2pi': {
			return mkConst(0);
			}
		case 'poly':
			return mkPoly(polyDeriv(node.coeff));
		case 'neg':
			return mkNeg(diffExpr(node.arg));
		case 'sc':
			return mkSc(Number(node.value), diffExpr(node.arg));
		case 'add':
			return mkAdd((node.args||[]).map(diffExpr));
		case 'sin': {
			const m = ('m' in node) ? Number(node.m) : 1;
			const n = ('n' in node) ? Number(node.n) : 0;
			// d sin(m u + n) = m cos(m u + n)
			return mkSc(m, { op: 'cos', m, n} );
		}
		case 'cos': {
			const m = ('m' in node) ? Number(node.m) : 1;
			const n = ('n' in node) ? Number(node.n) : 0;
			// d cos(m u + n) = -m sin(m u + n)
			return mkSc(-m, {op:'sin', m, n});
		}
		default:
			throw new Error(`symDiff: unsupported op '${node.op}'`);
	}
}
