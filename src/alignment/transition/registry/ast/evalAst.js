// ast/evalAst.js (schema_v3)
// Turn an AST into a JS function f(u).

function isObj(v) { return v && typeof v==='object' && !Array.isArray(v); } 

export function makeEvalFn(expr) {
	const e = expr;
	return function(u) {
		return evalNode(e, Number(u));
	};
}

function evalNode(node, u) {
	if (node==null) return NaN;
	if (typeof node==='number') return node;
	if (!isObj(node)) return NaN;

	switch (node.op) {
		case 'const': return Number(node.value);
		case 'pi': return Math.PI;
		case '2pi': return 2*Math.PI;
		case 'poly': {
			const c = node.coeff;
			let res = 0;
			// Horner
			for (let i=c.length-1; i>=0; i--) res = res*u + Number(c[i] || 0);
			return res;
		}
		case 'sin': {
			const m = ('m' in node) ? Number(node.m) : 1;
			const n = ('n' in node) ? Number(node.n) : 0;
			return Math.sin(m*u + n);
		}
		case 'cos': {
			const m = ('m' in node) ? Number(node.m) : 1;
			const n = ('n' in node) ? Number(node.n) : 0;
			return Math.cos(m*u + n);
		}
		case 'neg': return -evalNode(node.arg, u);
		case 'sc': return Number(node.value) * evalNode(node.arg, u);
		case 'add': {
			let s = 0;
			for (const a of node.args || []) s += evalNode(a, u);
			return s;
		}
		case 'mul': {
			let p = 1;
			for (const a of node.args || []) p *= evalNode(a, u);
			return p;
		}
		case 'div': return evalNode(node.dividend, u) / evalNode(node.divisor, u);
		case 'pow': return Math.pow(evalNode(node.base, u), Number(node.exp));
		default:
			throw new Error(`evalAst: unsupported op '${node.op}'`);
	}
}
