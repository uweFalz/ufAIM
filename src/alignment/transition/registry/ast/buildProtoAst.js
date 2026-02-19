// buildProtoAst.js
// Turns protoFcn.tree (v3 "tree.op" style + legacy v2) into a canonical AST used by eval/diff/int/simplify.
//
// Design goals:
// - Author-friendly proto JSON ("tree.op" style), but compile to a tiny canonical AST.
// - Canonical AST is intentionally small: const, add, mul, poly, sin0/cos0, sin/cos, compose.
// - Prefer numeric folding for constants (PI/TAU) and simple constant-only subexpressions.
//
// Supported proto tree nodes (input JSON):
// 1) Reference into simpleFcn (recommended):
//    { op:"ref", id:"SIMPLE_ID", crop:[a,b] }        // v3 preferred
//    { type:"ref", ref:"SIMPLE_ID", crop:[a,b] }     // legacy v2
//    Aliases accepted: id <-> ref
//
// 2) "op" nodes (recommended for readability):
//    { op:"+", args:[tree,...] }  (alias op:"add")
//    { op:"*", args:[tree,...] }  (alias op:"mul")
//    { op:"-", args:[tree,...] }  (alias op:"sub")   unary neg if 1 arg; n-ary left fold
//    { op:"/", args:[a,b] }       (alias op:"div")   ONLY if b is constant-foldable
//
//    Consts (as leafs) can be:
//      - number
//      - "PI" | "TAU"
//      - { const:"PI" | "TAU" }
//      - { op:"const", value:number }   // v3 style
//      - { type:"const", value:number } // legacy
//
// 3) Legacy v2 nodes (still accepted):
//    {type:"sum", terms:[...] }   (or "add" alias)
//    {type:"scale", a:number|constExpr, expr:tree}
//    {type:"call", fn:"SIN"|"COS", arg:tree}
//    {type:"poly", coeff:[...] }  (direct poly leaf)
//    {type:"trig", fn:"sin"|"cos", arg:tree} (direct trig call)
//
// Notes:
// - Trig base functions should usually come from simpleFcn as {type:"trig", fn:"sin"|"cos"}
//   and be referenced via {ref/id + crop}. eval/diff/int treat sin0/cos0 as sin(2πu), cos(2πu).

function isNum(x) { return typeof x === "number" && Number.isFinite(x); }

function mkConst(v) { return { type: "const", value: Number(v) }; }
function mkAdd(a, b) { if (!a) return b; if (!b) return a; return { type: "add", a, b }; }
function mkMul(a, b) { return { type: "mul", a, b }; }

function mkCall(fn, arg) {
	const f = String(fn).toLowerCase();
	if (f !== "sin" && f !== "cos") throw new Error(`buildProtoAst: unsupported call "${fn}"`);
	return { type: f, arg };
}

function mkPoly(coeff) { return { type: "poly", coeff: (coeff ?? [0]).map(Number) }; }

function mkCompose(expr, affine) {
	return { type: "compose", expr, affine: { alpha: Number(affine.alpha), beta: Number(affine.beta) } };
}

// ----------------------- constants -----------------------

function parseConstNode(x) {
	// raw number
	if (isNum(x)) return mkConst(x);

	// "PI" / "TAU"
	if (typeof x === "string") {
		const k = x.trim().toUpperCase();
		if (k === "PI") return mkConst(Math.PI);
		if (k === "TAU") return mkConst(2 * Math.PI);
		return null;
	}

	// {const:"PI"|"TAU"}
	if (x && typeof x === "object" && "const" in x) {
		const k = String(x.const).trim().toUpperCase();
		if (k === "PI") return mkConst(Math.PI);
		if (k === "TAU") return mkConst(2 * Math.PI);
		throw new Error(`buildProtoAst: unknown const "${x.const}"`);
	}

	// {op:"const", value:number}  OR  {type:"const", value:number}
	if (x && typeof x === "object") {
		const op = String(x.op || "").trim().toLowerCase();
		const t = String(x.type || "").trim().toLowerCase();
		if (op === "const" || t === "const") {
			const v = Number(x.value);
			if (!Number.isFinite(v)) throw new Error("buildProtoAst: const.value not finite");
			return mkConst(v);
		}
	}

	return null;
}

function foldConstNumber(node) {
	const c = parseConstNode(node);
	if (c) return c.value;
	if (!node || typeof node !== "object") return null;

	const op = String(node.op || "").trim();
	if (op) {
		const k = op.toLowerCase();
		const args = node.args ?? node.terms ?? node.items ?? [];

		if (k === "+" || k === "add") {
			let acc = 0;
			for (const a of args) {
				const v = foldConstNumber(a);
				if (v == null) return null;
				acc += v;
			}
			return acc;
		}
		if (k === "*" || k === "mul") {
			let acc = 1;
			for (const a of args) {
				const v = foldConstNumber(a);
				if (v == null) return null;
				acc *= v;
			}
			return acc;
		}
		if (k === "-" || k === "sub") {
			if (!Array.isArray(args) || args.length === 0) return null;
			if (args.length === 1) {
				const v = foldConstNumber(args[0]);
				return v == null ? null : -v;
			}
			let acc = foldConstNumber(args[0]);
			if (acc == null) return null;
			for (let i = 1; i < args.length; i++) {
				const v = foldConstNumber(args[i]);
				if (v == null) return null;
				acc -= v;
			}
			return acc;
		}
		if (k === "/" || k === "div") {
			if (!Array.isArray(args) || args.length !== 2) return null;
			const a = foldConstNumber(args[0]);
			const b = foldConstNumber(args[1]);
			if (a == null || b == null) return null;
			if (Math.abs(b) < 1e-15) throw new Error("buildProtoAst: division by ~0 in const fold");
			return a / b;
		}
		return null;
	}

	const t = String(node.type || "").toLowerCase();
	if (t === "scale") {
		const a = foldConstNumber(node.a);
		if (a == null) return null;
		const b = foldConstNumber(node.expr);
		if (b == null) return null;
		return a * b;
	}

	return null;
}

// ----------------------- ref/crop -----------------------

function cropToAffine(crop) {
	if (!crop) return { alpha: 1, beta: 0 };
	if (!Array.isArray(crop) || crop.length !== 2) throw new Error("buildProtoAst: crop must be [a,b]");

	const a = Number(crop[0]);
	const b = Number(crop[1]);
	if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("buildProtoAst: crop [a,b] not finite");

	return { alpha: (b - a), beta: a };
}

function getRefId(node) {
	// accept {ref:"X"} or {id:"X"} (both v2/v3)
	const id = node?.ref ?? node?.id ?? "";
	return String(id || "");
}

// ----------------------- main -----------------------

export function buildProtoAst(tree, simpleFcns) {
	// const leafs (incl. op:"const")
	const cLeaf = parseConstNode(tree);
	if (cLeaf) return cLeaf;

	if (!tree || typeof tree !== "object") throw new Error("buildProtoAst: bad tree");

	// v3 op nodes
	const op = String(tree.op || "").trim();
	if (op) {
		const k = op.toLowerCase();
		const args = tree.args ?? tree.terms ?? tree.items ?? [];

		if (k === "+" || k === "add") {
			if (!Array.isArray(args) || args.length === 0) throw new Error("buildProtoAst: empty +");
			let acc = null;
			for (const it of args) acc = mkAdd(acc, buildProtoAst(it, simpleFcns));
			return acc;
		}

		if (k === "*" || k === "mul") {
			if (!Array.isArray(args) || args.length === 0) throw new Error("buildProtoAst: empty *");
			let acc = null;
			for (const it of args) {
				const term = buildProtoAst(it, simpleFcns);
				acc = acc ? mkMul(acc, term) : term;
			}
			return acc;
		}

		if (k === "-" || k === "sub") {
			if (!Array.isArray(args) || args.length === 0) throw new Error("buildProtoAst: empty -");
			if (args.length === 1) return mkMul(mkConst(-1), buildProtoAst(args[0], simpleFcns));
			let acc = buildProtoAst(args[0], simpleFcns);
			for (let i = 1; i < args.length; i++) {
				acc = mkAdd(acc, mkMul(mkConst(-1), buildProtoAst(args[i], simpleFcns)));
			}
			return acc;
		}

		if (k === "/" || k === "div") {
			if (!Array.isArray(args) || args.length !== 2) throw new Error("buildProtoAst: / expects 2 args");
			const denom = foldConstNumber(args[1]);
			if (denom == null) throw new Error("buildProtoAst: / only supported for constant denominator");
			if (Math.abs(denom) < 1e-15) throw new Error("buildProtoAst: division by ~0");
			return mkMul(buildProtoAst(args[0], simpleFcns), mkConst(1 / denom));
		}

		if (k === "ref") {
			// ✅ accept both id/ref
			const id = getRefId(tree);
			return buildProtoAst({ type: "ref", ref: id, crop: tree.crop }, simpleFcns);
		}

		throw new Error(`buildProtoAst: unsupported op "${tree.op}"`);
	}

	// legacy v2 types
	const t = String(tree.type || "").toLowerCase();

	if (t === "ref") {
		// ✅ accept both ref/id
		const ref = getRefId(tree);
		const smp = simpleFcns?.[ref];
		if (!smp) throw new Error(`buildProtoAst: unknown simpleFcn "${ref}"`);

		const affine = cropToAffine(tree.crop ?? null);

		let base;
		const st = String(smp.type || "").toLowerCase();

		if (st === "poly") base = mkPoly(smp.coeff ?? [0]);
		else if (st === "sin") base = { type: "sin0" };
		else if (st === "cos") base = { type: "cos0" };
		else if (st === "trig") {
			const fn = String(smp.fn || smp.appear || "").toLowerCase();
			if (fn === "sin") base = { type: "sin0" };
			else if (fn === "cos") base = { type: "cos0" };
			else throw new Error(`buildProtoAst: bad simpleFcn.trig "${smp.fn}"`);
		} else {
			throw new Error(`buildProtoAst: bad simpleFcn.type "${smp.type}"`);
		}

		return mkCompose(base, affine);
	}

	if (t === "sum" || t === "add") {
		const terms = tree.terms ?? tree.items ?? [];
		if (!Array.isArray(terms) || terms.length === 0) throw new Error("buildProtoAst: empty sum");
		let acc = null;
		for (const it of terms) acc = mkAdd(acc, buildProtoAst(it, simpleFcns));
		return acc;
	}

	if (t === "scale") {
		const aNum = foldConstNumber(tree.a);
		if (aNum == null) throw new Error("buildProtoAst: scale.a not const-foldable");
		const expr = buildProtoAst(tree.expr, simpleFcns);
		return mkMul(mkConst(aNum), expr);
	}

	if (t === "call") {
		return mkCall(tree.fn, buildProtoAst(tree.arg, simpleFcns));
	}

	if (t === "poly") {
		return mkPoly(tree.coeff ?? [0]);
	}

	if (t === "trig") {
		const fn = String(tree.fn || tree.appear || "").toLowerCase();
		return mkCall(fn, buildProtoAst(tree.arg, simpleFcns));
	}

	throw new Error(`buildProtoAst: unsupported node type "${tree.type}"`);
}
