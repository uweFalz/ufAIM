// simplify.js (minimal, keeps things readable but not aggressive)
export function simplify(ast) {
	if (!ast || typeof ast !== "object") return ast;

	const t = ast.type;

	if (t === "add") {
		const a = simplify(ast.a), b = simplify(ast.b);
		if (a.type === "const" && a.value === 0) return b;
		if (b.type === "const" && b.value === 0) return a;
		if (a.type === "const" && b.type === "const") return { type:"const", value: a.value + b.value };
		return { type:"add", a, b };
	}

	if (t === "mul") {
		const a = simplify(ast.a), b = simplify(ast.b);
		if (a.type === "const" && a.value === 0) return { type:"const", value: 0 };
		if (b.type === "const" && b.value === 0) return { type:"const", value: 0 };
		if (a.type === "const" && a.value === 1) return b;
		if (b.type === "const" && b.value === 1) return a;
		if (a.type === "const" && b.type === "const") return { type:"const", value: a.value * b.value };
		return { type:"mul", a, b };
	}

	if (t === "compose") {
		const expr = simplify(ast.expr);
		return { type:"compose", expr, affine: ast.affine };
	}

	// leaf nodes: const/var/poly/sin0/cos0/sin/cos
	return ast;
}
