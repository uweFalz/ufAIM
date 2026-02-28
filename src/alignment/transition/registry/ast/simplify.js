// ast/simplify.js (schema_v3)
// Purpose: algebraic normalization + small rewrites to keep symDiff/symInt happy.
// - Fold scalar multipliers into poly coefficients
// - Expand poly*poly multiplication
// - Expand pow(poly, integer)
// - Rewrite div-by-const into scalar multiplication
// - Rewrite sub into add + neg

function isObj(v) { return v && typeof v==='object' && !Array.isArray(v); } 

export function mkPoly(coeff) { return { op: 'poly', coeff: coeff.slice() }; }
export function mkSin(m=1, n=0) { return { op: 'sin', m: Number(m), n: Number(n) }; }
export function mkCos(m=1, n=0) { return { op: 'cos', m: Number(m), n: Number(n) }; }
export function mkAdd(args) { return { op: 'add', args }; }
export function mkMul(args) { return { op: 'mul', args }; }
export function mkNeg(arg)  { return { op: 'neg', arg }; }
export function mkSub(a, b) { return { op: 'sub', minuend: a, subtrahend: b }; }
export function mkDiv(a, b) { return { op: 'div', dividend: a, divisor: b }; }
export function mkSc(value, arg) { return { op: 'sc', value: Number(value), arg }; }
export function mkConst(value, symbolic) {
	return symbolic ? { op: 'const', value: Number(value), symbolic: String(symbolic) } : { op: 'const', value: Number(value) };
}

function isConst(n) { return isObj(n) && n.op==='const'; }
function constVal(n) { return Number(n.value); } 

function cleanPoly(coeff) {
	let last = coeff.length-1;
	while (last>=0 && (!Number.isFinite(coeff[last]) || coeff[last]===0)) last--;
	return coeff.slice(0, last+1);
}

function polyAdd(a, b) {
	const n = Math.max(a.length, b.length);
	const out = new Array(n).fill(0);
	for (let i=0; i<n; i++) out[i] = (a[i] || 0) + (b[i] || 0);
	return cleanPoly(out);
}

function polyScale(c, a){
	return cleanPoly(a.map(x => Number(x || 0)*c));
}

function polyMul(a, b) {
	const out = new Array(a.length + b.length - 1).fill(0);
	for (let i=0, aLen=a.length; i<aLen; i++) {
		for (let j=0, bLen=b.length; j<bLen; j++) out[i+j] += (a[i] || 0)*(b[j] || 0);
	}
	return cleanPoly(out);
}

function polyPow(a, exp) {
	let e = exp|0;
	if (e<0) throw new Error('simplify: polyPow exp must be >= 0');
	let res = [1];
	let base = a;
	while (e>0) {
		if (e&1) res = polyMul(res, base);
		e >>= 1;
		if (e) base = polyMul(base, base);
	}
	return res;
}

function isPoly(n) { return isObj(n) && n.op==='poly' && Array.isArray(n.coeff); } 
function isTrig(n) { return isObj(n) && (n.op==='sin' || n.op==='cos'); }

// trig nodes are normalized to {op:'sin'|'cos', m:number, n:number}
function normTrig(node) {
	if (!isTrig(node)) return node;
	const m = ('m' in node) ? Number(node.m) : 1;
	const n = ('n' in node) ? Number(node.n) : 0;
	return { op: node.op, m, n };
}

function mergeScalarsIntoTrig(sc, trig) {
	// keep as { op: 'sc', value, arg: trig }
	return mkSc(sc, trig);
}

export function simplify(node) {
	if (node==null) return node;
	if (!isObj(node)) return node;

	// --- atoms ---
	switch (node.op) {
		case 'const': return mkConst(node.value, node.symbolic);
		case 'pi': return { op: 'pi' };
		case '2pi': return { op: '2pi' };
		case 'poly': {
			if (!Array.isArray(node.coeff)) throw new Error('simplify: poly.coeff must be array');
			return mkPoly(cleanPoly(node.coeff.map(Number)));
		}
		
		case 'sin':
		case 'cos': {
			// accept legacy {op:'sin', arg:expr} but prefer affine form
			if ('arg' in node && node.arg) {
				// We only expect arg to be affine in u; try to fold it into (m,n)
				const a = simplify(node.arg);
				const aff = affineFromExpr(a);
				if (!aff) throw new Error(`simplify: ${node.op}.arg must be affine in u (use crop/reparam on ref)`);
				return { op: node.op, m: aff.m, n: aff.n };
			}
			return normTrig(node);
		}
		
		case 'ref': {
			return node; // buildProtoAst should have resolved refs
			}
			
		case 'neg': {
			const a = simplify(node.arg);
			if (isConst(a)) return mkConst(-constVal(a), a.symbolic);
			if (isPoly(a)) return mkPoly(polyScale(-1, a.coeff));
			return { op: 'neg', arg: a };
		}
		
		case 'sc': {
			const a = simplify(node.arg);
			const v = Number(node.value);
			if (!Number.isFinite(v)) throw new Error('simplify: sc.value must be finite');
			if (isConst(a)) return mkConst(v*constVal(a), a.symbolic);
			if (isPoly(a)) return mkPoly(polyScale(v, a.coeff));
			// trig or composite stays
			return { op: 'sc', value: v, arg: a };
		}
		
		case 'add': {
			const args = (Array.isArray(node.args) ? node.args : []).map(simplify).filter(x => x!=null);
			if (args.length===0) return mkConst(0);
			if (args.length===1) return args[0];

			// fold constants and polys
			let c = 0;
			let poly = null;
			const rest = [];
			for (const a of args){
				if (isConst(a)) { c += constVal(a); continue; }
				if (isPoly(a)) { poly = poly ? mkPoly(polyAdd(poly.coeff, a.coeff)) : a; continue; }
				rest.push(a);
			}
			const out = [];
			if (poly && poly.coeff.length) out.push(poly);
			if (c!==0) out.push(mkConst(c));
			out.push(...rest);
			if (out.length===0) return mkConst(0);
			if (out.length===1) return out[0];
			return { op: 'add', args: out };
		}
		
		case 'sub': {
			const a = simplify(node.minuend ?? node.a);
			const b = simplify(node.subtrahend ?? node.b);
			return simplify(mkAdd([a, mkNeg(b)]));
		}
		
		case 'mul': {
			// general mul, but we try hard to reduce it to:
			// - const * expr   => sc
			// - poly * poly    => poly
			// - poly * (const/trig/sc/add) stays mul only if unavoidable (should be avoided)
			const raw = Array.isArray(node.args) ? node.args : [node.a, node.b].filter(Boolean);
			const args = raw.map(simplify).filter(x => x!=null);
			if (args.length===0) return mkConst(1);
			if (args.length===1) return args[0];

			let c = 1;
			const polys = [];
			const rest = [];
			for (const a of args){
				if (isConst(a)) { c *= constVal(a); continue; }
				if (isPoly(a)) { polys.push(a); continue; }
				if (isObj(a) && a.op==='sc' && Number.isFinite(Number(a.value))) {
					c *= Number(a.value);
					rest.push(a.arg);
					continue;
				}
				rest.push(a);
			}
			
			if (!Number.isFinite(c)) throw new Error('simplify: mul constant overflow/NaN');
			// multiply all polys
			let poly = null;
			for (const p of polys) { poly = poly ? mkPoly(polyMul(poly.coeff, p.coeff)) : p; }

			// if only polys and const
			if (rest.length===0) {
				if (!poly) return mkConst(c);
				return (c===1) ? poly : mkPoly(polyScale(c, poly.coeff));
			}

			// poly * (something) is NOT supported in diff/int pipeline; keep as mul but wrap scalar
			const out = [];
			if (poly) out.push(poly);
			out.push(...rest);
			let expr = (out.length===1) ? out[0] : { op: 'mul', args: out };
			return (c===1) ? expr : mkSc(c, expr);
		}
		
		case 'div': {
			const a = simplify(node.dividend ?? node.a);
			const b = simplify(node.divisor ?? node.b);
			// only support division by constant => scalar multiplication
			if (isConst(b)) {
				const d = constVal(b);
				if (!Number.isFinite(d) || Math.abs(d)<1e-15) throw new Error('simplify: div by zero/NaN');
				return simplify(mkSc(1/d, a));
			}
			return { op: 'div', dividend: a, divisor: b };
		}
		
		case 'pow': {
			const base = simplify(node.base);
			const exp = node.exp;
			let e;
			if (typeof exp==='number') e = exp;
			else if (isObj(exp) && exp.op==='const') e = Number(exp.value);
			else throw new Error('simplify: pow.exp must be number or const');
			if (!Number.isFinite(e)) throw new Error('simplify: pow.exp must be finite');
			if (!Number.isInteger(e)) throw new Error('simplify: pow.exp must be integer');
			if (isPoly(base)) return mkPoly(polyPow(base.coeff, e));
			// keep pow for non-poly (should not happen in schema_v3)
			return { op: 'pow', base, exp: e };
		}
		case 'diff': return { op: 'diff', arg: simplify(node.arg) };
		case 'int': return { op: 'int', arg: simplify(node.arg) };
		default: return node;
	}
}

// Try to extract affine (m*u + n) from an expression.
// Supported patterns (after simplify):
// - poly [n, m]
// - add of const + poly [0,m]
// - sc(c, poly [n,m])
function affineFromExpr(expr) {
	if (!expr || typeof expr!=='object') return null;
	if (expr.op==='poly') {
		const c = expr.coeff;
		if (c.length<=2) {
			return { n: Number(c[0] || 0), m: Number(c[1] || 0) };
		}
		return null;
	}
	if (expr.op==='add' && Array.isArray(expr.args)){
		let n=0, m=0;
		for (const a of expr.args) {
			const aff = affineFromExpr(a);
			if (!aff) return null;
			n += aff.n;
			m += aff.m;
		}
		return { n, m };
	}
	if( expr.op==='sc') {
		const aff = affineFromExpr(expr.arg);
		if (!aff) return null;
		const c = Number(expr.value);
		return { n: c*aff.n, m: c*aff.m };
	}
	if (expr.op==='const') return { n: Number(expr.value), m: 0 };
	return null;
}
