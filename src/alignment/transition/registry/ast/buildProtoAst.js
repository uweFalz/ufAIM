// ast/buildProtoAst.js (schema_v3)
// Build a concrete AST in the *u-domain* (u in [0,1]) from a proto tree.
// Responsibilities:
// - Resolve {op:'ref', id, crop:[a,b]} against simpleFcn ONLY (proto-internal refs intentionally not supported yet)
// - Apply crop as affine reparam: x = a + (b-a)*u  (a>b allowed)
// - Produce only ops that downstream can handle: const, pi, 2pi, poly, sin, cos, add, sc, neg, pow

import { simplify, mkConst, mkPoly, mkAdd, mkMul, mkSc, mkNeg } from './simplify.js';

function isObj(v) { return v && typeof v==='object' && !Array.isArray(v); } 

function cleanPoly(coeff) {
	let last = coeff.length-1;
	while (last>=0 && (!Number.isFinite(coeff[last]) || coeff[last]===0)) last--;
	return coeff.slice(0,last+1);
}

function polyAdd(a,b) {
	const n = Math.max(a.length,b.length);
	const out = new Array(n).fill(0);
	for (let i=0; i<n; i++) out[i] = (a[i] || 0)+(b[i] || 0);
	return cleanPoly(out);
}

function polyMul(a,b) {
	const out = new Array(a.length + b.length - 1).fill(0);
	for (let i=0; i<a.length; i++){
		for (let j=0; j<b.length; j++) out[i+j] += (a[i] || 0)*(b[j] || 0);
	}
	return cleanPoly(out);
}

function polyPow(a, exp) {
	let e = exp|0;
	let res=[1];
	let base=a;
	while (e>0){
		if (e&1) res = polyMul(res, base);
		e >>= 1;
		if (e) base = polyMul(base, base);
	}
	return res;
}

// Compose polynomial P(x) with affine x = n + m*u
function polyComposeAffine(coeff, n, m) {
	// Horner with polynomial arithmetic: P(n+m*u)
	let out = [0];
	for (let i=coeff.length-1; i>=0; i--) {
		// out = out*(n+m*u) + coeff[i]
		out = polyMul(out, [n, m]);
		out = polyAdd(out, [Number(coeff[i] || 0)]);
	}
	return cleanPoly(out);
}

function normCrop(crop){
	if (!Array.isArray(crop) || crop.length!==2) return null;
	const a = Number(crop[0]);
	const b = Number(crop[1]);
	if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('ref.crop entries must be finite');
	return { a, b };
}

function compileSimpleWithCrop(simpleDef, crop) {
	// crop: map u in [0,1] to x in [a,b]
	const { a, b } = crop;
	const m = (b - a);
	const n = a;

	// poly
	if (simpleDef.op==='poly'){
		const coeff = simpleDef.coeff.map(Number);
		return mkPoly(polyComposeAffine(coeff, n, m));
	}

	// trig
	if (simpleDef.op==='sin' || simpleDef.op==='cos') {
		// normalize to sin(m*u + n)
		const sm = ('m' in simpleDef) ? Number(simpleDef.m) : 1;
		const sn = ('n' in simpleDef) ? Number(simpleDef.n) : 0;
		if (!Number.isFinite(sm) || !Number.isFinite(sn)) throw new Error('simpleFcn trig m/n must be finite');
		// f(x)=trig(sm*x+sn), x=a+(b-a)*u => trig((sm*m)*u + (sm*n + sn))
		const mm = sm*m;
		const nn = sm*n + sn;
		return { op: simpleDef.op, m: mm, n: nn };
	}

	if (simpleDef.op==='const') return mkConst(simpleDef.value, simpleDef.symbolic);
	if (simpleDef.op==='pi' || simpleDef.op==='2pi') return { op: simpleDef.op };

	throw new Error(`simpleFcn: unsupported op '${simpleDef.op}'`);
}

function compileNode(node, simpleFcn, path) {
	if (node==null) throw new Error(`${path}: node is null/undefined`);
	if (!isObj(node)) throw new Error(`${path}: node must be object`);
	const op = node.op;
	if (typeof op!=='string') throw new Error(`${path}: missing op`);

	switch(op) {
		case 'const': return mkConst(node.value, node.symbolic);
		case 'pi':
		case '2pi': return {op};
		case 'poly': {
			if (!Array.isArray(node.coeff)) throw new Error(`${path}: poly.coeff must be array`);
			return mkPoly(node.coeff.map(Number));
		}
		case 'sin':
		case 'cos': {
			// allow explicit arg, but prefer affine form
			if (node.arg){
				const a = simplify(compileNode(node.arg, simpleFcn, `${path}.arg`));
				// simplify() will fold affine arg into m/n
				return simplify({ op, arg: a });
			}
			return { op, m: ('m' in node)?Number(node.m): 1, n: ('n' in node) ? Number(node.n): 0 };
		}
		case 'ref': {
			const id = String(node.id || '');
			if (!id) throw new Error(`${path}: ref.id missing`);
			const def = simpleFcn[id];
			if (!def) throw new Error(`${path}: ref '${id}' not found in simpleFcn (protoRef disabled)`);
			const crop = normCrop(node.crop ?? [0, 1]) ?? { a: 0, b: 1 };
			return simplify(compileSimpleWithCrop(def, crop));
		}
		case 'neg': return mkNeg(compileNode(node.arg, simpleFcn, `${path}.arg`));
		case 'add': {
			const args = (Array.isArray(node.args)?node.args:[]).map((a, i)=>compileNode(a, simpleFcn, `${path}.args[${i}]`));
			return mkAdd(args);
		}
		case 'sub': {
			const a = compileNode(node.minuend ?? node.a, simpleFcn, `${path}.minuend`);
			const b = compileNode(node.subtrahend ?? node.b, simpleFcn, `${path}.subtrahend`);
			return mkAdd([a, mkNeg(b)]);
		}
		case 'mul': {
			const args = (Array.isArray(node.args)?node.args:[]).map((a,i)=>compileNode(a, simpleFcn, `${path}.args[${i}]`));
			return mkMul(args);
		}
		case 'div': {
			// keep div; simplify() will turn div-by-const into sc
			const a = compileNode(node.dividend ?? node.a, simpleFcn, `${path}.dividend`);
			const b = compileNode(node.divisor ?? node.b, simpleFcn, `${path}.divisor`);
			return { op: 'div', dividend: a, divisor: b };
		}
		case 'sc': {
			const v = Number(node.value);
			if (!Number.isFinite(v)) throw new Error(`${path}: sc.value must be finite`);
			return mkSc(v, compileNode(node.arg, simpleFcn, `${path}.arg`));
		}
		case 'pow': {
			const base = compileNode(node.base, simpleFcn, `${path}.base`);
			let e = node.exp;
			if (isObj(e) && e.op==='const') e = Number(e.value);
			if (typeof e!=='number' || !Number.isFinite(e) || !Number.isInteger(e)) 
			throw new Error(`${path}: pow.exp must be integer number or const`);
			return { op: 'pow', base: simplify(base), exp: e };
		}

		default:
			throw new Error(`${path}: unsupported op '${op}'`);
	}
}

export function buildProtoAst(tree, simpleFcn/*, protoFcn*/){
	const expr = compileNode(tree, simpleFcn, 'proto');
	return simplify(expr);
}
