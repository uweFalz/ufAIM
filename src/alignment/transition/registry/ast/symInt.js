// symInt.js
const TAU = 2 * Math.PI;

function c(v) { return { type: "const", value: v }; }
function add(a,b){ return { type:"add", a, b }; }
function mul(a,b){ return { type:"mul", a, b }; }

function intPoly(poly) {
	const cc = poly.coeff || [0];
	const out = [0];
	for (let i = 0; i < cc.length; i++) out.push(cc[i] / (i + 1));
	return { type:"poly", coeff: out };
}

function scalePoly(poly, s) {
	return { type:"poly", coeff: (poly.coeff || [0]).map(v => v * s) };
}

function polyComposeAffine(poly, a, b) {
	// Returns poly( a*u + b ) expanded as a polynomial in u.
	// coeff in ascending order.
	const p = poly.coeff || [0];

	// binomial expansion: (a u + b)^k = sum_{j=0..k} binom(k,j) a^j b^(k-j) u^j
	const out = [];
	function addCoeff(j, v) { out[j] = (out[j] ?? 0) + v; }
	function binom(n,k){
		if (k<0||k>n) return 0;
		let r=1;
		for (let i=1;i<=k;i++) r = r*(n-(k-i))/i;
		return r;
	}

	for (let k = 0; k < p.length; k++) {
		const ck = p[k];
		if (!ck) continue;
		for (let j = 0; j <= k; j++) {
			addCoeff(j, ck * binom(k,j) * (a ** j) * (b ** (k - j)));
		}
	}

	// trim
	let m = out.length - 1;
	while (m > 0 && Math.abs(out[m]) < 1e-15) m--;
	return { type:"poly", coeff: out.slice(0, m + 1) };
}

export function intExpr(ast) {
	switch (ast.type) {
		case "const":
		// ∫c du = c*u
		return mul(c(ast.value), { type:"var", name:"u" });

		case "var":
		// ∫u du = u^2/2
		return { type:"poly", coeff: [0, 0, 0.5] };

		case "add":
		return add(intExpr(ast.a), intExpr(ast.b));

		case "mul":
		// Only support const * expr (enough for our compiler usage)
		if (ast.a.type === "const") return mul(ast.a, intExpr(ast.b));
		if (ast.b.type === "const") return mul(ast.b, intExpr(ast.a));
		throw new Error("symInt: only supports const*expr in mul");

		case "poly":
		return intPoly(ast);

		case "sin0":
		// ∫ sin(2πu) du = -cos(2πu)/(2π)
		return mul(c(-1 / TAU), { type:"cos0" });

		case "cos0":
		// ∫ cos(2πu) du = sin(2πu)/(2π)
		return mul(c(1 / TAU), { type:"sin0" });

		case "compose": {
			// PATCH: poly∘affine integral exactly:
			// If expr is poly, compose expands -> integrate poly -> done.
			const a = Number(ast.affine.alpha);
			const b = Number(ast.affine.beta);

			if (ast.expr.type === "poly") {
				const p = polyComposeAffine(ast.expr, a, b); // now poly in u
				return intPoly(p);
			}

			// For sin0/cos0 under affine, we can also do exact:
			// ∫ sin(2π(a u+b)) du = -cos(2π(a u+b)) / (2π a)
			// and similarly for cos.
			if (ast.expr.type === "sin0") {
				if (Math.abs(a) < 1e-15) {
					// sin(2π*b) is constant
					return mul(c(Math.sin(TAU * b)), { type:"var", name:"u" });
				}
				return mul(c(-1 / (TAU * a)), { type:"compose", expr: { type:"cos0" }, affine: ast.affine });
			}

			if (ast.expr.type === "cos0") {
				if (Math.abs(a) < 1e-15) {
					return mul(c(Math.cos(TAU * b)), { type:"var", name:"u" });
				}
				return mul(c(1 / (TAU * a)), { type:"compose", expr: { type:"sin0" }, affine: ast.affine });
			}

			// Generic fallback: not allowed in your spec (no numeric) → explicit error
			throw new Error("symInt: compose only supports poly/sin0/cos0 under affine");
		}

		default: {
			throw new Error(`symInt: unsupported "${ast.type}"`);
		}
	}
}
